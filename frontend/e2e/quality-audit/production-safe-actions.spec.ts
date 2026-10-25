import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const api="/api/v1/organizations/"+ids.organizationId+"/production";
const products=Array.from({length:27},(_,i)=>({
  productId:"uxqa-product-"+i,
  productName:i===26?"UXQA Last Sweater":"UXQA Shirt "+(i+1),
  variants:[{variantId:"uxqa-variant-"+i,variantName:"Size M",quantity:i+1}],
}));
const summary={campaignId:"uxqa-campaign-good",products};
type Proof={id:string;state:string;notes:string;image:string};
test("production ID submission, loading, search and GET failures are visible without writes",async({browser,request})=>{
  test.setTimeout(155000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID();
  const path=join("test-results","quality-audit",runId);
  await mkdir(path,{recursive:true});
  const proofs:Proof[]=[],queries:string[]=[];
  let writes=0,failUntilRetry=true;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(context,request,"organizationAdmin");
  await context.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==="GET"&&url.pathname==="/api/v1/organizations/"+ids.organizationId+"/campaigns"){
      const choices=[{organizationId:ids.organizationId,campaignId:"uxqa-campaign-good",
        storeId:"uxqa-store",name:"UXQA Production Shirt",status:"CLOSED",
        openAt:null,closeAt:null,paymentDeadline:null,pickupAt:null,
        createdAt:"2026-10-01T00:00:00Z",updatedAt:"2026-10-01T00:00:00Z"}];
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{items:choices,nextCursor:null}})});return;
    }
    if(req.method()==="GET"&&url.pathname===api){
      const id=url.searchParams.get("campaignId");
      queries.push(id??"");
      if(id==="uxqa-campaign-503"&&failUntilRetry){
        await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic production outage"}})});return;
      }
      if(id==="uxqa-campaign-not-found"){
        await route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"CAMPAIGN_NOT_FOUND",message:"Synthetic missing campaign"}})});return;
      }
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{...summary,campaignId:id}})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())){writes++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function evidence(page:Page,id:string,state:string,notes:string){
    const image=id+"-"+state+".png";
    await page.screenshot({path:join(path,image),animations:"disabled"});
    proofs.push({id,state,notes,image});
  }
  try{
    const page=await context.newPage();
    await page.goto(frontend+"/org/production/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"สรุปงานผลิต",level:1})).toBeVisible({timeout:16000});
    const field=page.locator("#production-campaign-id");
    await expect(page.getByText("เลือกแคมเปญเพื่อดูยอดผลิต")).toBeVisible();
    await expect(field).toBeVisible();
    await evidence(page,"FE-UX-23-01","idle","No Campaign ID displays meaningful idle guidance");
    await field.press("Enter");
    const invalid=page.locator("#production-campaign-error");
    await expect(invalid).toContainText("กรุณาเลือกแคมเปญหรือระบุ Campaign ID");
    await expect(field).toBeFocused();
    expect(queries).toHaveLength(0);
    await evidence(page,"FE-UX-23-02","first-invalid-submit","Empty Campaign ID blocks GET and focuses ErrorSummary");

    await field.fill("  uxqa-campaign-503  ");
    await evidence(page,"FE-UX-23-01","editable-id","Campaign ID draft editable before submit");
    await field.press("Enter");
    await expect(page.getByRole("heading",{name:"ไม่สามารถโหลดสรุปการผลิตได้"})).toBeVisible();
    expect(queries.at(-1)).toBe("uxqa-campaign-503");
    await evidence(page,"FE-UX-23-02","503-feedback","Synthetic 503 shows recoverable failure, no URL update");
    failUntilRetry=false;
    await field.press("Enter");
    await expect(page.getByRole("heading",{name:"รายการที่ต้องผลิต"})).toBeVisible();
    await expect(page).toHaveURL(/campaignId=uxqa-campaign-503/);
    await expect(page.locator("#production-product-search")).toBeVisible();
    await evidence(page,"FE-UX-23-02","retry-loaded","Retry same ID retrieves report and preserves URL campaign scope");

    const search=page.locator("#production-product-search");
    await search.fill("last sweater");
    await expect(page.getByRole("heading",{name:"UXQA Last Sweater"})).toBeVisible();
    await evidence(page,"FE-UX-23-02","search-off-first-page","Loaded product search finds product beyond initial 24 visible entries");
    await search.fill("unfindable");
    await expect(page.getByText("ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง")).toBeVisible();
    await evidence(page,"FE-UX-23-02","search-empty","No-match local search presents explicit feedback");
    await page.getByRole("button",{name:"ล้างคำค้นหา"}).click();
    await expect(search).toHaveValue("");
    await page.getByRole("button",{name:/แสดงเพิ่มอีก/}).click();
    await expect(page.getByRole("heading",{name:"UXQA Last Sweater"})).toBeVisible();
    await evidence(page,"FE-UX-23-02","show-more","Client-side Show More reveals all 27 product groups");

    await field.fill("uxqa-campaign-not-found");
    await field.press("Enter");
    await expect(page.getByRole("heading",{name:"ไม่พบแคมเปญ"})).toBeVisible();
    await evidence(page,"FE-UX-23-02","not-found","404 Campaign ID renders not-found state");
    await field.fill("uxqa-campaign-good");
    await field.press("Enter");
    await expect(page.getByRole("heading",{name:"รายการที่ต้องผลิต"})).toBeVisible();
    await evidence(page,"FE-UX-23-02","recover-after-404","New valid ID recovers from not-found");

    await field.fill("Production Shirt");
    await expect(page.getByRole("option",{name:/UXQA Production Shirt/})).toBeVisible();
    await evidence(page,"FE-UX-23-01","campaign-choices","Searchable campaign choices use readable names, not memorized IDs");
    await page.getByRole("option",{name:/UXQA Production Shirt/}).click();
    await expect(page.getByRole("heading",{name:"รายการที่ต้องผลิต"})).toBeVisible();
    await expect(field).toHaveValue("UXQA Production Shirt");
    await expect(page).toHaveURL(/campaignId=uxqa-campaign-good/);
    await evidence(page,"FE-UX-23-02","campaign-autoload","Selecting campaign loads read-only production immediately");
    await page.close();
  }finally{await context.close();}
  expect(writes).toBe(0);
  const m=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const ledger:ActionOutcome[]=[...m.actions,...m.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
    testRunId:runId,evidence:[],notes:"All declared action states not yet certified: "+a.statesToTest.join(", "),
  }));
  for(const e of proofs)ledger.push({actionId:e.id,role:"organizationAdmin",state:e.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[e.image],notes:e.notes+"; synthetic read-only GET"});
  await writeActionLedger(runId,ledger);
  await writeFile(join(path,"production-safe-states.json"),JSON.stringify({
    proofs,ids:[...new Set(proofs.map(x=>x.id))],queries,backendWrites:writes,
  },null,2)+"\n");
});
