import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const orgPath="/api/v1/organizations/"+ids.organizationId;
const orderId="a5555555-5555-4555-8555-111111111111",at="2026-10-17T12:00:00.000Z";
const organization={organizationId:ids.organizationId,name:"UXQA Club",description:"Synthetic read-only club",status:"ACTIVE",createdBy:"uxqa",createdAt:at,updatedAt:at};
const order={orderId,organizationId:ids.organizationId,campaignId:ids.campaignId,customerId:"uxqa-browser-customer",
 status:"PAYMENT_REVIEW",subtotal:25000,total:25000,items:[],createdAt:at,updatedAt:at};
type Proof={id:string;role:"staff"|"organizationAdmin";state:string;note:string;image:string};

test("Settings 503 repeat/recovery and Staff/Admin per-order detail, GET-only",async({browser,request})=>{
 test.setTimeout(200000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let writes=0,settingsFail=true,organizationGets=0,ordersGets=0,detailGets=0;
 async function proof(page:Page,id:string,role:Proof["role"],state:string,note:string){
  const image=id+"-"+role+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,role,state,note,image});
 }
 for(const role of ["organizationAdmin","staff"] as const){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,role);
  await ctx.route("**/*",async route=>{
   const req=route.request(),p=new URL(req.url()).pathname,m=req.method();
   const respond=(data:unknown,status=200)=>route.fulfill({status,contentType:"application/json",
    body:JSON.stringify(status===200?{success:true,data}:{success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic GET failure"}})});
   if(!["GET","HEAD","OPTIONS"].includes(m)){writes++;await route.abort("blockedbyclient");return;}
   if(m!=="GET")return route.continue();
   if(p===orgPath){
    organizationGets++;
    // Only Organization Admin's explicit Settings GET failure; secondary shell label requests can fail harmlessly.
    return respond(organization,role==="organizationAdmin"&&settingsFail?503:200);
   }
   if(p===orgPath+"/orders"){ordersGets++;return respond({items:[order],nextCursor:null});}
   if(p===orgPath+"/orders/"+orderId){detailGets++;return respond(order);}
   return route.continue();
  });
  try{
   const page=await ctx.newPage();
   if(role==="organizationAdmin"){
    await page.goto(frontend+"/org/settings/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByText("ไม่สามารถโหลดข้อมูลหน่วยงานได้")).toBeVisible();
    await expect(page.getByRole("button",{name:"ลองโหลดอีกครั้ง"})).toBeVisible();
    await proof(page,"FE-UX-15-01",role,"503-initial","Settings synthetic GET failure shows in-page Retry");
    await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
    await expect(page.getByText("ไม่สามารถโหลดข้อมูลหน่วยงานได้")).toBeVisible();
    await expect(page.locator("main[data-organization-settings-result]")).toBeFocused();
    await proof(page,"FE-UX-15-01",role,"503-retry-focus","Repeat failure preserves error state and focuses main landmark");
    settingsFail=false;
    await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
    const heading=page.getByRole("heading",{level:1,name:"ตั้งค่าหน่วยงาน"});
    await expect(page.locator("#organization-settings-name")).toHaveValue(organization.name);
    await expect(heading).toBeFocused();
    await proof(page,"FE-UX-15-01",role,"recovery-heading-focus","In-place Retry recovers scoped data and focuses page heading");
   }
   await page.goto(frontend+"/org/orders/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
   const details=page.getByRole("link",{name:"ดูรายละเอียดคำสั่งซื้อ "+orderId});
   await expect(details).toHaveAttribute("href","/org/orders/view/?organizationId="+ids.organizationId+"&orderId="+orderId);
   await details.click();
   await expect(page).toHaveURL(new RegExp("/org/orders/view/\\?organizationId="+ids.organizationId+"&orderId="+orderId));
   await expect(page.getByRole("heading",{level:1,name:"รายละเอียดคำสั่งซื้อ"})).toBeVisible();
   await expect(page.getByText("Order "+orderId,{exact:true}).first()).toBeVisible();
   await proof(page,"FE-UX-20-06",role,"scoped-detail","Per-order list link navigates to correct existing detail for "+role);
   await page.close();
  } finally {await ctx.close();}
 }
 expect(writes).toBe(0);expect(ordersGets).toBeGreaterThanOrEqual(2);expect(detailGets).toBeGreaterThanOrEqual(2);
 expect(organizationGets).toBeGreaterThanOrEqual(3);
 const base=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...base.actions,...base.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
  testRunId:runId,evidence:[],notes:"Full matrix unverified: "+a.statesToTest.join(", ")
 }));
 for(const p of proofs)outcomes.push({actionId:p.id,role:p.role,state:p.state,viewport:"390x844",status:"PASS",
  testRunId:runId,evidence:[p.image],notes:p.note+"; local GET fixtures and no mutation"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(dir,"settings-order-detail-actions.json"),JSON.stringify({browserEngine:browser.browserType().name(),
  proofs,distinctIds:[...new Set(proofs.map(p=>p.id))],writes,organizationGets,ordersGets,detailGets,
  limitation:"Backend GETs are mocked. Never claim real database order detail or user permissions were audited."},null,2)+"\n");
});
