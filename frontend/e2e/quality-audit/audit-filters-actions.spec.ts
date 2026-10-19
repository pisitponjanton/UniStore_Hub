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
      const rows=empty?[]:cursor?[item(2)]:filtered?[item(1)]:[item(1)];
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
    const cardReadability=await page.evaluate(()=>{
      const table=document.querySelector("main table");
      const row=table?.querySelector("tbody tr");
      const cell=row?.querySelector("td");
      const caption=table?.querySelector("caption");
      return {
        tableWidth:table?.getBoundingClientRect().width??0,
        rowDisplay:row?getComputedStyle(row).display:null,
        cellDisplay:cell?getComputedStyle(cell).display:null,
        captionClipped:caption?getComputedStyle(caption).clipPath:null,
        overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
      };
    });
    expect(cardReadability.overflow).toBeLessThanOrEqual(1);
    expect(cardReadability.rowDisplay).toBe("block");
    expect(cardReadability.cellDisplay).toBe("grid");
    expect(cardReadability.captionClipped).toBe("inset(50%)");
    const details=page.locator("main details").first();
    await details.locator("summary").click();await expect(details).toHaveAttribute("open","");
    await expect(details.locator("pre")).toContainText('"source": "synthetic-read-only"');
    await capture(page,"FE-UX-25-07","metadata-expanded","Metadata disclosure expands to formatted read-only JSON");
    await details.locator("summary").click();await expect(details).not.toHaveAttribute("open","");
    await capture(page,"FE-UX-25-07","metadata-collapsed","Metadata closes without mutation");
    const search=page.locator("#audit-directory-search");
    await search.fill("no-matching-event");
    await expect(page.getByText("ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง")).toBeVisible();
    await capture(page,"FE-UX-25-05","loaded-search-empty","Local loaded-only search shows no-match");
    await page.getByRole("button",{name:"ล้างคำค้นหา"}).click();
    await expect(search).toHaveValue("");
    await capture(page,"FE-UX-25-05","loaded-search-clear","Local clear restores events");
    const more=page.getByRole("button",{name:"โหลดเพิ่มเติม",exact:true});
    pagingFail=true;await more.click();
    await expect(page.getByRole("alert").filter({hasText:"โหลดรายการไม่สำเร็จ"})).toBeVisible();
    await capture(page,"FE-UX-25-08","cursor-503","A failed cursor GET preserves existing loaded row");
    await more.click();
    await expect(page.getByText("uxqa-payment-2",{exact:true})).toBeVisible();
    expect(seen.some(s=>new URLSearchParams(s).get("cursor")==="uxqa-audit-next")).toBe(true);
    await capture(page,"FE-UX-25-08","cursor-retry","Retry uses opaque cursor and appends audit log");

    for(const f of fields){
      await page.locator(f.selector).fill("  "+f.value+"  ");
      await expect(page.locator(f.selector)).toHaveValue("  "+f.value+"  ");
      await capture(page,f.id,"filter-draft","Editable "+f.param+" filter input without server mutation");
    }
    await page.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    const success=page.locator("#audit-search-success");
    await expect(success).toBeFocused();
    for(const f of fields){
      expect(new URLSearchParams(seen.at(-1)).get(f.param)).toBe(f.value);
      await expect(page.locator(f.selector)).toHaveValue(f.value);
    }
    await capture(page,"FE-UX-25-05","trimmed-server-filter","Applied all four trimmed server filters and focused result");
    await page.getByRole("button",{name:"แสดงทั้งหมด"}).click();
    await expect(success).toBeFocused();
    for(const f of fields) await expect(page.locator(f.selector)).toHaveValue("");
    await capture(page,"FE-UX-25-06","clear-applied","Clear resets all drafts and server filter results");

    await page.locator("#audit-actor-id").fill("uxqa-503");
    await page.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    const error=page.locator("#audit-search-error");
    await expect(error).toBeFocused();
    await expect(page.getByText("uxqa-payment-1",{exact:true})).toBeVisible();
    await capture(page,"FE-UX-25-05","server-503-focused","503 retains previous row and focuses recoverable visible alert");
    await page.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    await expect(success).toBeFocused();
    await capture(page,"FE-UX-25-05","503-retry-success","Retry succeeds without modifying server records");

    await page.locator("#audit-actor-id").fill("uxqa-empty");
    await page.getByRole("button",{name:"ค้นหา / กรอง"}).click();
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
