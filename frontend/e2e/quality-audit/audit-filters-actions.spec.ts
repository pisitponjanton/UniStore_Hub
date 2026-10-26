import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const endpoint="/api/v1/organizations/"+ids.organizationId+"/audit-logs";
const now="2026-10-17T11:00:00.000Z";
function item(n:number) {
  return {auditId:"uxqa-audit-"+n,organizationId:ids.organizationId,actorId:"uxqa-actor",
    action:"PAYMENT_APPROVED",resourceType:"PAYMENT",resourceId:"uxqa-payment-"+n,
    metadata:{orderId:"uxqa-order-"+n,source:"synthetic-read-only"},createdAt:now};
}
const fields=[
  {id:"FE-UX-25-01",selector:"#audit-actor-id",value:"uxqa-actor",param:"actorId"},
  {id:"FE-UX-25-02",selector:"#audit-action",value:"PAYMENT_APPROVED",param:"action"},
  {id:"FE-UX-25-03",selector:"#audit-resource-type",value:"PAYMENT",param:"resourceType"},
  {id:"FE-UX-25-04",selector:"#audit-resource-id",value:"uxqa-payment-1",param:"resourceId"},
] as const;
type Evidence={id:string;state:string;image:string;details:string};
test("Audit filters, metadata, cursor, server 503 and recovery with zero writes",async({browser,request})=>{
  test.setTimeout(160000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),out=join("test-results","quality-audit",runId);
  await mkdir(out,{recursive:true});
  const evidence:Evidence[]=[],seen:string[]=[];
  let writes=0,failOnce=true,pagingFail=false;
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,"organizationAdmin");
  await ctx.route("**/*",async route=>{
    const r=route.request(),url=new URL(r.url());
    if(r.method()==="GET"&&url.pathname===endpoint){
      seen.push(url.search);
      if(url.searchParams.get("actorId")==="uxqa-503"&&failOnce){
        failOnce=false;await route.fulfill({status:503,contentType:"application/json",
          body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic audit search unavailable"}})});return;
      }
      if(pagingFail&&url.searchParams.has("cursor")){
        pagingFail=false;await route.fulfill({status:503,contentType:"application/json",
          body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic audit cursor unavailable"}})});return;
      }
      const params=url.searchParams;
      const empty=params.get("actorId")==="uxqa-empty";
      const filtered=[...params.keys()].some(key=>key!=="cursor");
      const cursor=params.has("cursor");
      const rows=empty?[]:cursor?[item(11)]:filtered?[item(1)]:Array.from({length:10},(_,i)=>item(i+1));
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{items:rows,nextCursor:filtered||cursor?null:"uxqa-audit-next"}})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(r.method())){writes++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function capture(page:Page,id:string,state:string,details:string){
    const image=id+"-"+state+".png";await page.screenshot({path:join(out,image),animations:"disabled"});
    evidence.push({id,state,image,details});
  }
  try {
    const page=await ctx.newPage();
    await page.goto(frontend+"/org/audit/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ประวัติการทำรายการ",level:1})).toBeVisible({timeout:16000});
    const layout=await page.evaluate(()=>{
      const list=document.querySelector('[aria-label="รายการ Audit Log ของหน่วยงาน"]');
      const row=list?.querySelector('[role="listitem"]');
      return { hasTable:Boolean(document.querySelector("main table")),
        rowGrid:row?getComputedStyle(row).display:null,
        overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth) };
    });
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.hasTable).toBe(false);
    expect(layout.rowGrid).toBe("grid");
    await page.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-1",exact:true}).click();
    const details=page.getByRole("dialog",{name:"รายละเอียดเหตุการณ์"});
    await expect(details.locator("pre")).toContainText('"source": "synthetic-read-only"');
    await capture(page,"FE-UX-25-07","metadata-expanded","Read-only metadata inside event popup");
    await details.getByRole("button",{name:"ปิด",exact:true}).first().click();
    await expect(details).toHaveCount(0);
    await capture(page,"FE-UX-25-07","metadata-collapsed","Popup closes without mutation");
    const search=page.locator("#audit-directory-search");
    await search.fill("no-matching-event");
    await expect(page.getByText("ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง")).toBeVisible();
    await capture(page,"FE-UX-25-05","loaded-search-empty","Local loaded-only search shows no-match");
    await page.getByRole("button",{name:"ล้างคำค้นหา"}).click();
    await expect(search).toHaveValue("");
    await capture(page,"FE-UX-25-05","loaded-search-clear","Local clear restores events");
    const more=page.getByRole("button",{name:"ถัดไป"});
    await expect(page.getByRole("list",{name:"รายการ Audit Log ของหน่วยงาน"}).getByRole("listitem")).toHaveCount(10);
    pagingFail=true;await more.click();
    await expect(page.getByRole("alert").filter({hasText:"โหลดรายการไม่สำเร็จ"})).toBeVisible();
    await capture(page,"FE-UX-25-08","cursor-503","A failed cursor GET preserves existing loaded row");
    await more.click();
    await page.getByRole("button",{name:/ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-11/}).click();
    await expect(page.getByRole("dialog",{name:"รายละเอียดเหตุการณ์"}).getByText("uxqa-payment-11")).toBeVisible();
    await page.getByRole("dialog",{name:"รายละเอียดเหตุการณ์"}).getByRole("button",{name:"ปิด",exact:true}).first().click();
    expect(seen.some(s=>new URLSearchParams(s).get("cursor")==="uxqa-audit-next")).toBe(true);
    await expect(page.getByRole("button",{name:"หน้า 2"})).toHaveAttribute("aria-current","page");
    await expect(page.getByRole("list",{name:"รายการ Audit Log ของหน่วยงาน"}).getByRole("listitem")).toHaveCount(1);
    await capture(page,"FE-UX-25-08","cursor-retry","Retry follows opaque cursor and replaces page one with the second page");
    await page.getByRole("button",{name:"ก่อนหน้า"}).click();
    await expect(page.getByRole("list",{name:"รายการ Audit Log ของหน่วยงาน"}).getByRole("listitem")).toHaveCount(10);

    await page.getByRole("button",{name:"ตัวกรอง"}).click();
    const filter=page.getByRole("dialog",{name:"ตัวกรองเหตุการณ์"});
    for(const f of fields){
      await filter.locator(f.selector).fill("  "+f.value+"  ");
      await expect(page.locator(f.selector)).toHaveValue("  "+f.value+"  ");
      await capture(page,f.id,"filter-draft","Editable "+f.param+" filter input without server mutation");
    }
    await filter.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    const success=page.locator("#audit-search-success");
    await expect(success).toBeFocused();
    for(const f of fields){
      expect(new URLSearchParams(seen.at(-1)).get(f.param)).toBe(f.value);
      await expect(page.getByRole("group",{name:"ตัวกรองที่ใช้อยู่"})).toContainText(f.value);
    }
    await capture(page,"FE-UX-25-05","trimmed-server-filter","Applied all four trimmed server filters and focused result");
    await page.getByRole("button",{name:"ล้างทั้งหมด"}).click();
    await expect(success).toBeFocused();
    await expect(page.getByRole("group",{name:"ตัวกรองที่ใช้อยู่"})).toHaveCount(0);
    await capture(page,"FE-UX-25-06","clear-applied","Clear resets all drafts and server filter results");

    await page.getByRole("button",{name:"ตัวกรอง"}).click();
    await filter.locator("#audit-actor-id").fill("uxqa-503");
    await filter.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    const error=filter.locator("#audit-search-error");
    await expect(error).toBeFocused();
    await expect(page.locator('[aria-label="รายการ Audit Log ของหน่วยงาน"] [role="listitem"]')).toHaveCount(10);
    await capture(page,"FE-UX-25-05","server-503-focused","503 retains previous row and focuses recoverable visible alert");
    await filter.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    await expect(success).toBeFocused();
    await capture(page,"FE-UX-25-05","503-retry-success","Retry succeeds without modifying server records");

    await page.getByRole("button",{name:/ตัวกรอง/}).click();
    await filter.locator("#audit-actor-id").fill("uxqa-empty");
    await filter.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    await expect(page.getByText("ไม่พบ Audit Log")).toBeVisible();
    await expect(success).toBeFocused();
    await capture(page,"FE-UX-25-01","server-empty","Filtered backend response with zero rows shows empty state");
    await page.close();
  }finally{await ctx.close();}
  expect(writes).toBe(0);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full state matrix unverified: "+a.statesToTest.join(", "),
  }));
  for(const e of evidence)outcomes.push({actionId:e.id,role:"organizationAdmin",state:e.state,
    viewport:"390x844",status:"PASS",testRunId:runId,evidence:[e.image],notes:e.details+"; synthetic read-only GET"});
  await writeActionLedger(runId,outcomes);
  await writeFile(join(out,"audit-filters-states.json"),JSON.stringify({
    evidence,ids:[...new Set(evidence.map(e=>e.id))],queries:seen,backendWrites:writes,
  },null,2)+"\n");
});


test("activity list, detail and filter popups stay within viewport with long metadata", async ({ browser, request }) => {
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  const longId = "audit-id-" + "abc123".repeat(25);
  const longItem = { ...item(1), auditId: longId,
    resourceId: "resource-" + "0123456789".repeat(22),
    metadata: { nested: { identifier: "metadata-" + "LONGVALUE".repeat(65) }, other: 456 } };
  let blockedWrites = 0;
  await ctx.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "GET" && url.pathname === endpoint) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: [longItem], nextCursor: null } }) });
    }
    if (!["GET","HEAD","OPTIONS"].includes(req.method())) {
      blockedWrites++;
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const errors:string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto(frontend + "/org/audit/?organizationId=" + ids.organizationId);
    await expect(page.getByRole("heading", { name: "ประวัติการทำรายการ", level: 1, exact: true })).toBeVisible();
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of [320,390,768,1024,1440]) {
        await page.setViewportSize({ width, height: 850 });
        const row = page.locator('[role="listitem"]').first();
        await expect(row).toBeVisible();
        const outer = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(outer, `${scheme} list overflow at ${width}`).toBeLessThanOrEqual(1);
        await page.getByRole("button", { name: /ดูรายละเอียด PAYMENT_APPROVED/ }).click();
        const detail = page.getByRole("dialog", { name: "รายละเอียดเหตุการณ์" });
        await expect(detail.getByText(longItem.resourceId)).toBeVisible();
        await expect(detail.locator("pre")).toContainText("LONGVALUE");
        const modalOuter = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(modalOuter, `${scheme} detail overflow at ${width}`).toBeLessThanOrEqual(1);
        await detail.getByRole("button",{name:"ปิด",exact:true}).first().click();
        await page.getByRole("button", { name: "ตัวกรอง" }).click();
        const filter = page.getByRole("dialog", { name: "ตัวกรองเหตุการณ์" });
        await expect(filter.locator("#audit-actor-id")).toBeVisible();
        const filterOuter = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(filterOuter, `${scheme} filter overflow at ${width}`).toBeLessThanOrEqual(1);
        await filter.getByRole("button", { name: "ปิด", exact: true }).click();
      }
    }
    expect(blockedWrites).toBe(0);
    expect(errors).toEqual([]);
  } finally { await ctx.close(); }
});


test("numbered audit pages replace previous items, fill partial pages from cursor, and reset on filters", async ({ browser, request }) => {
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  const seenQueries:string[] = [];
  let writes = 0;
  await ctx.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if(req.method() === "GET" && url.pathname === endpoint) {
      seenQueries.push(url.search);
      const filtered = url.searchParams.has("action");
      const cursor = url.searchParams.has("cursor");
      const rows = filtered
        ? Array.from({length:12}, (_, i) => item(200 + i))
        : cursor ? Array.from({length:12}, (_, i) => item(25 + i))
        : Array.from({length:24}, (_, i) => item(1 + i));
      return route.fulfill({status:200, contentType:"application/json", body:JSON.stringify({
        success:true, data:{items:rows, nextCursor: filtered || cursor ? null : "audit-page-next"},
      })});
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())) {
      writes++; return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  try {
    const page = await ctx.newPage();
    await page.goto(frontend + "/org/audit/?organizationId=" + ids.organizationId);
    const list = page.getByRole("list", { name: "รายการ Audit Log ของหน่วยงาน" });
    const rows = list.getByRole("listitem");
    await expect(rows).toHaveCount(10);
    await expect(page.getByRole("button",{name:"หน้า 1"})).toHaveAttribute("aria-current","page");
    await expect(list.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-1",exact:true})).toBeVisible();

    const initialGets = seenQueries.length;
    await page.getByRole("button",{name:"หน้า 2"}).click();
    await expect(rows).toHaveCount(10);
    await expect(list.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-11",exact:true})).toBeVisible();
    await expect(list.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-1",exact:true})).toHaveCount(0);
    expect(seenQueries).toHaveLength(initialGets);

    await page.getByRole("button",{name:"ถัดไป"}).click();
    await expect(page.getByRole("button",{name:"หน้า 3"})).toHaveAttribute("aria-current","page");
    await expect(rows).toHaveCount(10);
    await expect(list.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-30",exact:true})).toBeVisible();
    expect(new URLSearchParams(seenQueries.at(-1)).get("cursor")).toBe("audit-page-next");

    await page.getByRole("button",{name:"ถัดไป"}).click();
    await expect(rows).toHaveCount(6);
    await expect(page.getByRole("button",{name:"ถัดไป"})).toBeDisabled();
    await page.getByRole("button",{name:"หน้า 1"}).click();
    await expect(rows).toHaveCount(10);
    expect(seenQueries).toHaveLength(initialGets+1);

    await page.getByRole("button",{name:"หน้า 4"}).click();
    await page.getByRole("button",{name:"ตัวกรอง"}).click();
    const dialog=page.getByRole("dialog",{name:"ตัวกรองเหตุการณ์"});
    await dialog.locator("#audit-action").fill("PAYMENT_APPROVED");
    await dialog.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button",{name:"หน้า 1"})).toHaveAttribute("aria-current","page");
    await expect(rows).toHaveCount(10);
    await expect(list.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-200",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"หน้า 2"}).click();
    await expect(rows).toHaveCount(2);

    const search=page.locator("#audit-directory-search");
    await search.fill("uxqa-payment-211");
    await expect(page.getByRole("button",{name:"หน้า 2"})).toHaveCount(0);
    await expect(rows).toHaveCount(1);
    await expect(list.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-211",exact:true})).toBeVisible();
    await search.fill("");
    await expect(rows).toHaveCount(10);
    await expect(page.getByRole("button",{name:"หน้า 1"})).toHaveAttribute("aria-current","page");
    expect(writes).toBe(0);
  }finally {
    await ctx.close();
  }
});
