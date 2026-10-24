import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const stamp="2026-10-17T02:00:00.000Z";
const order=(n:number)=>({
  orderId:"uxqa-order-"+n,organizationId:ids.organizationId,campaignId:"campaign-test",
  customerId:"customer-test",status:"PAYMENT_REVIEW",subtotal:25000,total:25000,
  items:[],createdAt:stamp,updatedAt:stamp,
});
const payment=(n:number)=>({
  paymentId:"uxqa-payment-"+n,organizationId:ids.organizationId,orderId:"uxqa-order-"+n,
  customerId:"customer-test",slipKey:"uxqa/temp/placeholder",status:"PENDING_REVIEW",
  rejectReason:null,reviewedBy:null,reviewedAt:null,createdAt:stamp,updatedAt:stamp,
});
const pickup=(n:number)=>({
  pickupId:"uxqa-pickup-"+n,organizationId:ids.organizationId,orderId:"uxqa-order-"+n,
  token:"abcdefghijklmnopqrstuv",status:"READY",receivedBy:null,receivedAt:null,
  createdAt:stamp,updatedAt:stamp,
});

type Kind="orders"|"payments"|"pickups";
const configs=[
  {kind:"orders" as Kind, route:"/org/orders/", api:"orders", item:order,
   inputs:[["#organization-orders-campaign","campaign-test","FE-UX-20-01"],
     ["#organization-orders-customer","customer-test","FE-UX-20-02"]],
   select:"#organization-orders-status",status:"PAYMENT_REVIEW",statusId:"FE-UX-20-03",
   applyId:"FE-UX-20-04",clearId:"FE-UX-20-05",moreId:"FE-UX-20-07",
   item2:"uxqa-order-2",emptyText:"ไม่พบคำสั่งซื้อที่ตรงกับตัวกรอง"},
  {kind:"payments" as Kind,route:"/org/payments/",api:"payments",item:payment,
   inputs:[["#payment-review-campaign","campaign-test","FE-UX-22-02"],
     ["#payment-review-order","uxqa-order-1","FE-UX-22-03"]],
   select:"#payment-review-status",status:"PENDING_REVIEW",statusId:"FE-UX-22-01",
   applyId:"FE-UX-22-04",clearId:"FE-UX-22-05",moreId:"FE-UX-22-07",
   item2:"uxqa-payment-2",emptyText:"ไม่พบรายการที่ตรงกับตัวกรอง"},
  {kind:"pickups" as Kind,route:"/org/pickups/",api:"pickups",item:pickup,
   inputs:[["#pickup-token-filter","abcdefghijklmnopqrstuv","FE-UX-24-01"],
     ["#pickup-order-filter","uxqa-order-1","FE-UX-24-02"],
     ["#pickup-campaign-filter","campaign-test","FE-UX-24-03"]],
   select:"#pickup-status-filter",status:"READY",statusId:"FE-UX-24-04",
   applyId:"FE-UX-24-05",clearId:"FE-UX-24-06",moreId:"FE-UX-24-08",
   item2:"uxqa-pickup-2",emptyText:"ไม่พบรายการที่ตรงกับตัวกรอง"},
] as const;

test("Staff three queues handle GET filters, cursor, empty, 503 and focused results without writes",async({browser,request})=>{
  test.setTimeout(235_000);
  const {frontend}=localAuditTargets(), runId="uxqa-"+randomUUID();
  const out=join("test-results","quality-audit",runId);
  await mkdir(out,{recursive:true});
  const proof:Array<{id:string;role:"staff";page:Kind;state:string;evidence:string;detail:string}>=[];
  let writes=0;
  for(const c of configs){
    const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
    await establishSeedRoleSession(ctx,request,"staff");
    let gets=0, failOnce=false;
    const seen:string[]=[];
    const target="/api/v1/organizations/"+ids.organizationId+"/"+c.api;
    await ctx.route("**/*",async route=>{
      const req=route.request(),url=new URL(req.url());
      if(!["GET","HEAD","OPTIONS"].includes(req.method())){
        writes++;await route.abort("blockedbyclient");return;
      }
      if(req.method()==="GET"&&url.pathname===target){
        gets++;seen.push(url.search);
        if(url.searchParams.get("campaignId")==="uxqa-fail"&& !failOnce){
          failOnce=true;
          await route.fulfill({status:503,contentType:"application/json",
            body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic GET timeout"}})});
          return;
        }
        const empty=url.searchParams.get("campaignId")==="uxqa-empty";
        const cursor=url.searchParams.has("cursor");
        const filters=[...url.searchParams.keys()].some(k=>k!=="cursor");
        const items=empty?[]:cursor||filters?[c.item(2)]:[c.item(1)];
        const nextCursor=filters||cursor?null:"uxqa-next";
        await route.fulfill({status:200,contentType:"application/json",
          body:JSON.stringify({success:true,data:{items,nextCursor}})});return;
      }
      await route.continue();
    });
    const shoot=async(page:import("@playwright/test").Page,id:string,state:string,detail:string)=>{
      const evidence=c.kind+"-"+id+"-"+state+".png";
      await page.screenshot({path:join(out,evidence),animations:"disabled"});
      proof.push({id,role:"staff",page:c.kind,state,evidence,detail});
    };
    try{
      const page=await ctx.newPage();
      await page.goto(frontend+c.route+"?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
      await expect(page.locator('main article[aria-label]').first()).toBeVisible({timeout:19000});
      // Test opaque cursor first, when list still has only its initial unfiltered record.
      const more=page.getByRole("button",{name:"โหลดเพิ่มเติม",exact:true});
      await expect(more).toBeVisible();
      await more.click();
      await expect(page.locator('main article[aria-label*="' + c.item2 + '"]')).toBeVisible();
      expect(seen.some(search=>new URLSearchParams(search).get("cursor")==="uxqa-next")).toBe(true);
      await shoot(page,c.moreId,"opaque-cursor","Second GET used the opaque cursor; first record preserved");

      if (c.kind === "pickups") {
        // Direct Token / Order lookup is intentionally outside the advanced modal.
        for (const [selector, value, id] of c.inputs.filter(([selector]) => !selector.includes("campaign"))) {
          await page.locator(selector).fill("  " + value + "  ");
          await expect(page.locator(selector)).toHaveValue("  " + value + "  ");
          await shoot(page,id,"draft-typed","Direct pickup lookup stays visible above advanced filters");
        }
      }
      const toggle = page.getByRole("button", { name: /^ตัวกรอง/ });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(c.select)).toHaveCount(0);
      await toggle.click();
      await expect(page.getByRole("dialog", { name: /ตัวกรอง/ })).toBeVisible();
      for(const [selector,value,id] of c.inputs.filter(([selector]) => c.kind !== "pickups" || selector.includes("campaign"))){
        const field=page.locator(selector);
        await field.fill("  "+value+"  ");
        await expect(field).toHaveValue("  "+value+"  ");
        await shoot(page,id,"draft-typed","Local filter draft can be edited without a write");
      }
      // Escape and outside click must restore focus without resetting draft.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog",{name:/ตัวกรอง/})).toHaveCount(0);
      await expect(toggle).toBeFocused();
      await toggle.click();
      await expect(page.getByRole("dialog",{name:/ตัวกรอง/})).toBeVisible();
      for(const [selector,value] of c.inputs.filter(([selector])=>c.kind!=="pickups" || selector.includes("campaign"))) {
        await expect(page.locator(selector)).toHaveValue("  "+value+"  ");
      }
      await page.mouse.click(5, 180);
      await expect(page.getByRole("dialog",{name:/ตัวกรอง/})).toHaveCount(0);
      await toggle.click();
      for(const [selector,value] of c.inputs.filter(([selector])=>c.kind!=="pickups" || selector.includes("campaign"))) {
        await expect(page.locator(selector)).toHaveValue("  "+value+"  ");
      }
      // Desktop floating popover, mobile anchored bottom sheet, no horizontal overflow.
      await page.setViewportSize({width:1440,height:900});
      const dlg=page.getByRole("dialog",{name:/ตัวกรอง/});
      await expect.poll(async()=> (await dlg.boundingBox())?.width).toBeLessThanOrEqual(445);
      let bounds=await dlg.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(1440);
      await page.screenshot({path:join(out,c.kind+"-filter-popover-desktop.png"),animations:"disabled"});
      await page.setViewportSize({width:390,height:844});
      await expect.poll(async()=> (await dlg.boundingBox())?.width).toBeGreaterThanOrEqual(380);
      bounds=await dlg.boundingBox();
      expect(bounds).not.toBeNull();
      // The bottom sheet should not inherit the much shorter desktop anchored height.
      expect(bounds!.height).toBeGreaterThanOrEqual(320);
      expect(bounds!.y+bounds!.height).toBeGreaterThanOrEqual(820);
      // The sheet must expose a usable viewport, not inherit a tiny desktop max-height.
      expect(bounds!.height).toBeGreaterThanOrEqual(350);
      const sheetAction=dlg.getByRole("button",{name:"ใช้ตัวกรอง"});
      await sheetAction.scrollIntoViewIfNeeded();
      await expect(sheetAction).toBeVisible();
      expect(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth))).toBeLessThanOrEqual(1);
      await page.screenshot({path:join(out,c.kind+"-filter-bottom-sheet-mobile.png"),animations:"disabled"});
      // Validate both themes while the actual overlay and its fields are mounted.
      await page.emulateMedia({ colorScheme: "dark" });
      await expect(dlg).toBeVisible();
      await expect(page.locator(c.select)).toBeVisible();
      await page.screenshot({path:join(out,c.kind+"-filter-bottom-sheet-mobile-dark.png"),animations:"disabled"});
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(dlg).toBeVisible();
      await page.screenshot({path:join(out,c.kind+"-filter-popover-desktop-dark.png"),animations:"disabled"});
      await page.emulateMedia({ colorScheme: "light" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator(c.select).selectOption(c.status);
      await expect(page.locator(c.select)).toHaveValue(c.status);
      await shoot(page,c.statusId,"status-selection","Status selection changes draft without submitting");
      await page.getByRole("button",{name:"ใช้ตัวกรอง"}).click();
      const success=page.locator('[data-queue-filter-feedback="success"]');
      await expect(success).toBeVisible({timeout:14000});
      await expect(success).toBeFocused();
      await expect.poll(()=>success.evaluate(el=>{
        const rect=el.getBoundingClientRect();return rect.top<innerHeight&&rect.bottom>0;
      })).toBe(true);
      const latest=new URLSearchParams(seen.at(-1));
      for(const [selector,value] of c.inputs){
        const key=selector.includes("campaign")?"campaignId":selector.includes("customer")?"customerId":
          selector.includes("token")?"token":selector.includes("order")?"orderId":"";
        expect(latest.get(key),c.kind+" "+selector).toBe(value);
      }
      expect(latest.get("status")).toBe(c.status);
      await expect(toggle).toContainText(c.kind==="pickups" ? "2" : "3");
      const campaignChip=page.getByRole("button",{name:/ลบตัวกรอง แคมเปญ:/});
      await expect(campaignChip).toBeVisible();
      await campaignChip.click();
      await expect(success).toBeFocused();
      expect(new URLSearchParams(seen.at(-1)).get("campaignId")).toBeNull();
      await expect(campaignChip).toHaveCount(0);
      await shoot(page,c.applyId,"trimmed-get-focused-success","Applied documented GET filters, result announcement focused and visible");

      await toggle.click();
      await page.getByRole("button",{name:"ล้างตัวกรอง"}).click();
      await expect(success).toBeFocused();
      await toggle.click();
      for(const [selector,value] of c.inputs) {
        await expect(page.locator(selector)).toHaveValue(c.kind==="pickups" && !selector.includes("campaign") ? value : "");
      }
      await expect(page.locator(c.select)).toHaveValue("");
      await page.getByRole("button",{name:"ปิดตัวกรอง"}).click();
      await shoot(page,c.clearId,"clear-filter-focused-success","Clearing resets advanced filters and preserves pickup direct search");

      // Force a filtered 503; unchanged list remains visible, then a normal resubmit recovers.
      const campaignSelector=c.inputs.find(([sel])=>sel.includes("campaign"))![0];
      await toggle.click();
      await page.locator(campaignSelector).fill("uxqa-fail");
      await page.getByRole("button",{name:"ใช้ตัวกรอง"}).click();
      const error=page.locator('[data-queue-filter-feedback="error"]');
      await expect(error).toBeVisible();
      const visibleModalError=page.locator('[data-queue-filter-popover-error]');
      await expect(visibleModalError).toBeVisible();
      await expect(visibleModalError).toBeFocused();
      await expect(page.locator('main article[aria-label]').first()).toBeVisible();
      await shoot(page,c.applyId,"503-visible-retryable","Failed GET preserves last known rows and focuses visible error");
      await page.getByRole("button",{name:"ใช้ตัวกรอง"}).click();
      await expect(success).toBeFocused();
      await expect(error).toHaveCount(0);
      await expect(page.locator('[data-queue-filter-popover-error]')).toHaveCount(0);
      await shoot(page,c.applyId,"503-retry-success","Resubmit GET recovers without mutation");

      await toggle.click();
      await page.locator(campaignSelector).fill("uxqa-empty");
      await page.getByRole("button",{name:"ใช้ตัวกรอง"}).click();
      await expect(page.getByText(c.emptyText,{exact:true})).toBeVisible();
      await expect(success).toBeFocused();
      await shoot(page,c.applyId,"server-empty-result","Empty response shows empty state and result focus");

      expect(gets).toBeGreaterThanOrEqual(5);
      await page.close();
    }finally{await ctx.close();}
  }
  expect(writes).toBe(0);
  expect(proof).toHaveLength(28); // 9 Orders + 9 Payments + 10 Pickups
  const m=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const ledger:ActionOutcome[]=[...m.actions,...m.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],
    notes:"All declared states not exhaustively verified: "+a.statesToTest.join(", "),
  }));
  for(const x of proof)ledger.push({actionId:x.id,role:x.role,state:x.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[x.evidence],notes:x.detail+"; read-only GET fixture"});
  await writeActionLedger(runId,ledger);
  await writeFile(join(out,"three-staff-queues.json"),JSON.stringify({
    proofCount:proof.length,distinctIds:[...new Set(proof.map(x=>x.id))],backendWrites:writes,proof,
  },null,2)+"\n");
});
