import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect,test,type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger,type ActionOutcome } from "./result-ledger";

const orderId="uxqa-payment-initial-order",orgId="uxqa-payment-initial-org",stamp="2026-10-17T12:00:00.000Z";
const root="/api/v1/organizations/"+orgId+"/orders/"+orderId;
const order={orderId,organizationId:orgId,campaignId:"uxqa-campaign",customerId:"uxqa-customer",
 status:"PENDING_PAYMENT",subtotal:17000,total:17000,items:[],createdAt:stamp,updatedAt:stamp};
type Proof={id:string;state:string;note:string;image:string};
test("initial payment: load 503 manual retry, first invalid submit, simulated upload and success focus",async({browser,request})=>{
 test.setTimeout(170000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});const proofs:Proof[]=[];
 let failLoad=true,submitted=false,putCount=0,signCount=0,submitCount=0,unexpectedWrites=0;
 let holdPut=true;
 const deferred:{release?:(()=>void)}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"customer");
 await ctx.route("**/*",async r=>{
  const req=r.request(),path=new URL(req.url()).pathname,method=req.method();
  if(method==="GET"&&path==="/api/v1/me/orders/"+orderId){
   if(failLoad){
    await r.fulfill({status:503,contentType:"application/json",body:JSON.stringify({
     success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic GET failure"}
    })});return;
   }
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{...order,status:submitted?"PAYMENT_REVIEW":"PENDING_PAYMENT"}
   })});return;
  }
  if(method==="GET"&&path==="/api/v1/me/orders/"+orderId+"/payment"){
   if(!submitted){
    await r.fulfill({status:404,contentType:"application/json",body:JSON.stringify({
     success:false,error:{code:"PAYMENT_NOT_FOUND",message:"Synthetic no payment yet"}
    })});return;
   }
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{paymentId:"uxqa-payment-first",organizationId:orgId,orderId,customerId:"uxqa-customer",
     slipKey:"uxqa/initial/object",status:"PENDING_REVIEW",rejectReason:null,reviewedBy:null,reviewedAt:null,
     createdAt:stamp,updatedAt:stamp}
   })});return;
  }
  if(method==="POST"&&path===root+"/payment-slip-upload-url"){
   signCount++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{objectKey:"uxqa/initial/object",url:frontend+"/__uxqa_initial_upload__",method:"PUT",expiresInSeconds:900}
   })});return;
  }
  if(method==="PUT"&&path==="/__uxqa_initial_upload__"){
   putCount++;
   if(holdPut) await new Promise<void>(resolve=>{deferred.release=resolve;});
   await r.fulfill({status:200,body:""});return;
  }
  if(method==="POST"&&path===root+"/payment"){
   submitCount++;expect(req.postDataJSON()).toEqual({slipKey:"uxqa/initial/object"});
   submitted=true;
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{paymentId:"uxqa-payment-first",organizationId:orgId,orderId,customerId:"uxqa-customer",
     slipKey:"uxqa/initial/object",status:"PENDING_REVIEW",rejectReason:null,reviewedBy:null,reviewedAt:null,
     createdAt:stamp,updatedAt:stamp}
   })});return;
  }
  if(!["GET","HEAD","OPTIONS"].includes(method)){unexpectedWrites++;await r.abort("blockedbyclient");return;}
  await r.continue();
 });
 async function proof(page:Page,id:string,state:string,note:string){
  const image=id+"-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,state,note,image});
 }
 try{
  const page=await ctx.newPage();const url=frontend+"/my/payment/?orderId="+orderId;
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"ไม่สามารถโหลดข้อมูลการชำระเงินได้"})).toBeVisible({timeout:20000});
  await expect(page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"})).toHaveAttribute("href","/my/orders/");
  await proof(page,"FE-UX-10-01","error-back","403/503 recovery view links back to customer order list");
  await proof(page,"FE-UX-10-02","load-503","Persistent mocked order GET 503 shows retry");
  failLoad=false;
  await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
  const heading=page.getByRole("heading",{name:"ชำระและส่งหลักฐาน",level:1});
  await expect(heading).toBeVisible({timeout:16000});
  await expect(heading).toBeFocused();
  await proof(page,"FE-UX-10-02","manual-retry-focus","User-initiated retry recovers initial PAYMENT_NOT_FOUND and focuses new content");
  const submit=page.getByRole("button",{name:"ส่งหลักฐานการชำระเงิน"});
  const file=page.locator("#payment-slip");
  await submit.click();
  await expect(page.getByText("กรุณาเลือกไฟล์หลักฐานการชำระเงิน")).toBeVisible();
  await expect(file).toBeFocused();expect(signCount).toBe(0);
  await proof(page,"FE-UX-10-04","first-invalid-submit","Missing file first Submit focuses input without POST");
  await file.setInputFiles({name:"first-slip.png",mimeType:"image/png",buffer:Buffer.from("uxqa synthetic png bytes")});
  await proof(page,"FE-UX-10-03","first-file-selection","Initial payment accepts local image draft");
  await submit.click();
  await expect.poll(()=>putCount).toBe(1);
  await expect(page.getByRole("button",{name:"กำลังส่งหลักฐาน"})).toBeDisabled();
  await proof(page,"FE-UX-10-04","first-upload-pending","Direct PUT in progress blocks repeat submission");
  holdPut=false;deferred.release?.();
  await expect(page.locator("[data-payment-operation-success]")).toBeFocused({timeout:12000});
  await expect(page.getByRole("status").filter({hasText:"ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ"})).toBeVisible();
  await expect(submit).toHaveCount(0);expect(submitCount).toBe(1);expect(signCount).toBe(1);
  await proof(page,"FE-UX-10-04","first-upload-success","Authoritative refreshed order after intercepted initial submit renders review status");
  await page.goto(frontend+"/my/payment/",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"ลิงก์การชำระเงินไม่สมบูรณ์"})).toBeVisible();
  await expect(page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"})).toHaveAttribute("href","/my/orders/");
  await proof(page,"FE-UX-10-01","missing-order-id","Invalid link recovers to order list");
  await page.close();
 } finally {deferred.release?.();await ctx.close();}
 expect(unexpectedWrites).toBe(0);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const ledger:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(x=>({
  actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",
  status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Complete declared state matrix not verified: "+x.statesToTest.join(", ")
 }));
 for(const x of proofs)ledger.push({actionId:x.id,role:"customer",state:x.state,viewport:"390x844",
  status:"PASS",testRunId:runId,evidence:[x.image],notes:x.note+"; mocked GET and intercepted POST/PUT only"});
 await writeActionLedger(runId,ledger);
 await writeFile(join(dir,"payment-initial-safe-states.json"),JSON.stringify({
  proofs,distinctIds:[...new Set(proofs.map(x=>x.id))],putCount,signCount,submitCount,unexpectedWrites,
  limitation:"Synthetic presign/PUT/submit only; backend records unchanged",
 },null,2)+"\n");
});
