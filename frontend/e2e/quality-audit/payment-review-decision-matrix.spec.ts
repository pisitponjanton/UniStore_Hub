import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {establishSeedRoleSession,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const root="/api/v1/organizations/"+ids.organizationId, paymentId="uxqa-review-matrix",orderId="uxqa-review-matrix-order",at="2026-10-17T12:00:00.000Z";
type Review="approve"|"reject";
type Case="conflict"|"success";
type PayStatus="PENDING_REVIEW"|"APPROVED"|"REJECTED";
const basePayment={paymentId,orderId,organizationId:ids.organizationId,customerId:"uxqa-customer",slipKey:"uxqa/test-only",status:"PENDING_REVIEW" as PayStatus,rejectReason:null as string|null,reviewedBy:null as string|null,reviewedAt:null as string|null,createdAt:at,updatedAt:at};
const baseOrder={orderId,organizationId:ids.organizationId,campaignId:"uxqa-campaign",customerId:"uxqa-customer",status:"PAYMENT_REVIEW",subtotal:28000,total:28000,items:[],createdAt:at,updatedAt:at};
type Proof={id:string;role:"staff";state:string;notes:string;image:string};
test("Payment Review approval/rejection state matrix: pending, 409, success, focus",async({browser,request})=>{
 test.setTimeout(220000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proof:Proof[]=[];let writes=0,approves=0,rejects=0;
 let status:PayStatus="PENDING_REVIEW",reason:string|null=null,kind:Case="conflict",mode:Review="approve",pause=false;
 const pending:{release?:()=>void}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"staff");
 await ctx.route("**/*",async r=>{
  const req=r.request(),p=new URL(req.url()).pathname,m=req.method();
  const pay=()=>({...basePayment,status,rejectReason:reason,reviewedBy:status==="PENDING_REVIEW"?null:"uxqa-staff",reviewedAt:status==="PENDING_REVIEW"?null:at});
  const ok=(data:unknown)=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(m==="GET"&&p===root+"/payments")return ok({items:[pay()],nextCursor:null});
  if(m==="GET"&&p===root+"/payments/"+paymentId)return ok(pay());
  if(m==="GET"&&p===root+"/orders/"+orderId)return ok({...baseOrder,status:status==="APPROVED"?"PAID":status==="REJECTED"?"PAYMENT_REJECTED":"PAYMENT_REVIEW"});
  if(m==="POST"&&p===root+"/payments/"+paymentId+"/"+mode){
   if(mode==="approve"){approves++;expect(req.postData()).toBeNull();}
   else {rejects++;expect(req.postDataJSON()).toEqual({reason:"ยอดเงินไม่ตรง"});}
   if(pause)await new Promise<void>(resolve=>{pending.release=resolve;});
   if(kind==="conflict")return r.fulfill({status:409,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"INVALID_STATUS_TRANSITION",message:"Synthetic stale review"}})});
   status=mode==="approve"?"APPROVED":"REJECTED";reason=mode==="reject"?"ยอดเงินไม่ตรง":null;
   return ok(pay());
  }
  if(!["GET","HEAD","OPTIONS"].includes(m)){writes++;await r.abort("blockedbyclient");return;}
  return r.continue();
 });
 async function save(page:Page,id:string,stateName:string,notes:string){
  const image=id+"-"+stateName+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proof.push({id,role:"staff",state:stateName,notes,image});
 }
 try{
  const page=await ctx.newPage();
  async function select(){
   await page.goto(frontend+"/org/payments/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
   const select=page.getByRole("button",{name:"ตรวจสอบ การชำระเงิน "+paymentId});
   await expect(select).toBeVisible();
   await select.click();
   const detail=page.getByLabel("รายละเอียดการชำระเงิน");
   await expect(detail.getByRole("heading",{name:"Payment "+paymentId})).toBeVisible();
   return detail;
  }
  let detail=await select();
  await detail.getByRole("button",{name:"อนุมัติการชำระเงิน"}).click();
  const approve=page.getByRole("dialog",{name:"ยืนยันการอนุมัติการชำระเงิน"});
  await expect(approve).toBeVisible();
  pause=true;
  await approve.getByRole("button",{name:"ยืนยันอนุมัติ"}).click();
  await expect.poll(()=>approves).toBe(1);
  await expect(approve.getByRole("button",{name:"กำลังดำเนินการ"})).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(approve).toBeVisible();
  await save(page,"FE-UX-22-10","approve-pending-locked","Deferred approval disables duplicate action and blocks Escape");
  pause=false;pending.release?.();
  await expect(approve).not.toBeVisible();
  await expect(page.getByRole("alert").filter({hasText:"สถานะ Payment เปลี่ยนไปแล้ว"})).toBeVisible();
  await expect(page.locator("[data-payment-review-result]")).toBeFocused();
  await save(page,"FE-UX-22-10","approve-409-focused","Synthetic 409 closes modal and focuses visible failure");
  // A new explicit user decision should be possible after the recoverable 409.
  kind="success";
  if(await approve.isVisible())await approve.getByRole("button",{name:"ยืนยันอนุมัติ"}).click();
  else {await detail.getByRole("button",{name:"อนุมัติการชำระเงิน"}).click();await approve.getByRole("button",{name:"ยืนยันอนุมัติ"}).click();}
  await expect(detail.getByText("รายการนี้ตัดสินผลแล้ว")).toBeVisible();
  await expect(detail.getByRole("button",{name:"อนุมัติการชำระเงิน"})).toHaveCount(0);
  await expect(detail.getByRole("button",{name:"ปฏิเสธการชำระเงิน"})).toHaveCount(0);
  await expect(page.locator("[data-payment-review-result]")).toBeFocused();
  await save(page,"FE-UX-22-10","approve-synthetic-200","Synthetic approved result removes duplicate-review controls and focuses feedback");
  status="PENDING_REVIEW";reason=null;mode="reject";kind="conflict";
  detail=await select();
  await detail.getByRole("button",{name:"ปฏิเสธการชำระเงิน"}).click();
  const reject=page.getByRole("dialog",{name:"ปฏิเสธการชำระเงิน"});
  await reject.getByRole("textbox",{name:"เหตุผลที่ปฏิเสธ"}).fill("  ยอดเงินไม่ตรง  ");
  await save(page,"FE-UX-22-12","reject-trimmed-input","Reason is editable; server payload must be trimmed");
  await reject.getByRole("button",{name:"ยืนยันปฏิเสธ"}).click();
  await expect.poll(()=>rejects).toBe(1);
  await expect(page.getByRole("alert").filter({hasText:"สถานะ Payment เปลี่ยนไปแล้ว"})).toBeVisible();
  await expect(reject).not.toBeVisible();
  await expect(page.locator("[data-payment-review-result]")).toBeFocused();
  await save(page,"FE-UX-22-14","reject-409-focused","Intercepted rejection conflict closes modal and focuses visible feedback");
  kind="success";
  if(!await reject.isVisible()){await detail.getByRole("button",{name:"ปฏิเสธการชำระเงิน"}).click();await reject.getByRole("textbox",{name:"เหตุผลที่ปฏิเสธ"}).fill("ยอดเงินไม่ตรง");}
  await reject.getByRole("button",{name:"ยืนยันปฏิเสธ"}).click();
  await expect(reject).not.toBeVisible();
  await expect(detail.getByText("รายการนี้ตัดสินผลแล้ว")).toBeVisible();
  await expect(detail.getByText("ยอดเงินไม่ตรง")).toBeVisible();
  await expect(page.locator("[data-payment-review-result]")).toBeFocused();
  await save(page,"FE-UX-22-14","reject-synthetic-200","Intercepted rejection closes modal and focuses reviewed result");
  expect(approves).toBe(2);expect(rejects).toBe(2);
  await page.close();
 }finally{pending.release?.();await ctx.close();}
 expect(writes).toBe(0);
 const base=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...base.actions,...base.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full declared-state coverage unverified: "+a.statesToTest.join(", ")}));
 for(const p of proof)entries.push({actionId:p.id,role:"staff",state:p.state,viewport:"390x844",status:"PASS",testRunId:runId,evidence:[p.image],notes:p.notes+"; synthetic local review POST only"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"payment-review-matrix.json"),JSON.stringify({engine:browser.browserType().name(),proof,approves,rejects,writes,limitations:"Synthetic GET and intercepted 409/200 POST, no payment actually reviewed"},null,2)+"\n");
});
