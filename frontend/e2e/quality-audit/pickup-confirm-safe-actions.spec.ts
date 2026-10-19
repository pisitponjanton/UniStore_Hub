import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect,test,type Page } from "@playwright/test";
import { establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger,type ActionOutcome } from "./result-ledger";

const base="/api/v1/organizations/"+ids.organizationId;
const pickupId="uxqa-pickup-modal",orderId="uxqa-pickup-order",at="2026-10-17T12:00:00.000Z";
const initialPickup={pickupId,organizationId:ids.organizationId,orderId,token:"ABCDEFGHIJKLMNOPQRSTUV",status:"READY",
 receivedBy:null,receivedAt:null,createdAt:at,updatedAt:at};
const initialOrder={orderId,organizationId:ids.organizationId,campaignId:"uxqa-pickup-campaign",
 customerId:"uxqa-pickup-customer",status:"READY_FOR_PICKUP",subtotal:18000,total:18000,items:[],createdAt:at,updatedAt:at};
type Proof={id:string;state:string;note:string;image:string};
test("Pickup selection and confirm modal pending/409/retry/200, intercepted only",async({browser,request})=>{
 test.setTimeout(190000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let mutated=false,mode:"conflict"|"success"="conflict",pending=false,intercepted=0,otherWrites=0,details=0;
 const deferred:{release?:(()=>void)}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"staff");
 await ctx.route("**/*",async r=>{
  const req=r.request(),path=new URL(req.url()).pathname;
  if(req.method()==="GET"&&path===base+"/pickups"){
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{
    items:[{...initialPickup,status:mutated?"RECEIVED":"READY",receivedBy:mutated?"uxqa-staff":null,receivedAt:mutated?at:null}],nextCursor:null
   }})});return;
  }
  if(req.method()==="GET"&&path===base+"/pickups/"+pickupId){
   details++;
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{
     ...initialPickup,status:mutated?"RECEIVED":"READY",receivedBy:mutated?"uxqa-staff":null,receivedAt:mutated?at:null
   }})});return;
  }
  if(req.method()==="GET"&&path===base+"/orders/"+orderId){
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{
    ...initialOrder,status:mutated?"COMPLETED":"READY_FOR_PICKUP"
   }})});return;
  }
  if(req.method()==="POST"&&path===base+"/pickups/"+pickupId+"/confirm"){
   intercepted++;
   if(pending)await new Promise<void>(resolve=>{deferred.release=resolve;});
   if(mode==="conflict"){
    await r.fulfill({status:409,contentType:"application/json",
      body:JSON.stringify({success:false,error:{code:"ORDER_NOT_READY_FOR_PICKUP",message:"Synthetic stale pickup"}})});return;
   }
   mutated=true;
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{
     ...initialPickup,status:"RECEIVED",receivedBy:"uxqa-staff",receivedAt:at
   }})});return;
  }
  if(!["GET","HEAD","OPTIONS"].includes(req.method())){otherWrites++;await r.abort("blockedbyclient");return;}
  await r.continue();
 });
 async function proof(page:Page,id:string,state:string,note:string){
  const image=id+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,state,note,image});
 }
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/org/pickups/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
  const item=page.getByRole("article",{name:/Pickup uxqa-pickup-modal/});
  await expect(item).toBeVisible({timeout:17000});
  await item.getByRole("button",{name:/ดูรายละเอียด Pickup uxqa-pickup-modal/}).click();
  const detail=page.getByRole("complementary",{name:"รายละเอียด Pickup"});
  await expect(detail.getByRole("heading",{name:"รายการรับสินค้า "+pickupId.slice(0, 12)})).toBeVisible();
  await expect(detail).toContainText("ABCDEFGHIJKLMNOPQRSTUV");
  await expect(detail).toContainText(orderId);
  await proof(page,"FE-UX-24-07","fresh-detail","Separate Pickup and Order GETs populate selected panel");

  const trigger=detail.getByRole("button",{name:"ยืนยันรับสินค้า",exact:true});
  await trigger.click();
  let modal=page.getByRole("dialog",{name:"ยืนยันการรับสินค้า"});
  await expect(modal).toContainText("ไม่ควรยืนยันซ้ำ");
  await proof(page,"FE-UX-24-09","confirm-open","Confirmation includes irreversible warning and exact operation");
  await modal.getByRole("button",{name:"ยกเลิก",exact:true}).click();
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(intercepted).toBe(0);
  await proof(page,"FE-UX-24-09","confirm-cancel","Cancel returns focus to trigger and sends no POST");

  await trigger.click();
  modal=page.getByRole("dialog",{name:"ยืนยันการรับสินค้า"});
  pending=true;
  await modal.getByRole("button",{name:"ยืนยันรับสินค้า"}).click();
  await expect.poll(()=>intercepted).toBe(1);
  await expect(modal.getByRole("button",{name:"กำลังดำเนินการ"})).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  await proof(page,"FE-UX-24-09","pending-locked","Deferred POST disables repeated confirmation and Escape");
  pending=false;deferred.release?.();
  await expect(modal).not.toBeVisible({timeout:10000});
  const error=page.locator("[data-pickup-action-feedback]");
  await expect(error.getByRole("alert")).toBeVisible();
  await expect(error).toBeFocused();
  await expect.poll(()=>error.evaluate(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;})).toBe(true);
  await expect(trigger).toBeEnabled();
  await proof(page,"FE-UX-24-09","synthetic-409","Modal closes and displays focused visible recoverable conflict after synthetic 409");

  mode="success";
  await trigger.click();
  modal=page.getByRole("dialog",{name:"ยืนยันการรับสินค้า"});
  await modal.getByRole("button",{name:"ยืนยันรับสินค้า"}).click();
  await expect(modal).not.toBeVisible();
  await expect(error.getByRole("status")).toContainText("ยืนยันการรับสินค้าเรียบร้อยแล้ว");
  await expect(error).toBeFocused();
  await expect(trigger).toHaveCount(0);
  await expect(detail).toContainText("รับสินค้าแล้ว");
  await proof(page,"FE-UX-24-09","synthetic-200","Intercepted 200 updates detail and disables repeat action with focused success");
  expect(intercepted).toBe(2);

  await page.reload({waitUntil:"domcontentloaded"});
  await expect(item).toBeVisible();
  await item.getByRole("button",{name:/ดูรายละเอียด Pickup uxqa-pickup-modal/}).click();
  await expect(detail.getByRole("button",{name:"ยืนยันรับสินค้า",exact:true})).toHaveCount(0);
  await proof(page,"FE-UX-24-07","received-guard","Already received item is read-only after synthetic GET");
  await page.close();
 }finally{deferred.release?.();await ctx.close();}
 expect(otherWrites).toBe(0);expect(details).toBeGreaterThanOrEqual(3);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
  testRunId:runId,evidence:[],notes:"Complete state coverage unverified: "+a.statesToTest.join(", ")
 }));
 for(const p of proofs)entries.push({actionId:p.id,role:"staff",state:p.state,viewport:"390x844",status:"PASS",
  testRunId:runId,evidence:[p.image],notes:p.note+"; intercepted Browser POST, zero real backend mutation"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"pickup-confirm-safe-states.json"),JSON.stringify({
  proofs,distinctIds:[...new Set(proofs.map(x=>x.id))],intercepted,otherWrites,
  limitation:"409 and 200 served by Playwright only. No real pickup confirmed; no persisted mutation tested."
 },null,2)+"\n");
});
