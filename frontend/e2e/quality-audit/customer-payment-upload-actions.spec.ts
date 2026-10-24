import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect,test,type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger,type ActionOutcome } from "./result-ledger";

const orderId="uxqa-payment-resubmit-order",orgId="uxqa-payment-org",at="2026-10-17T12:00:00.000Z";
const root="/api/v1/organizations/"+orgId+"/orders/"+orderId;
const order={orderId,organizationId:orgId,campaignId:"uxqa-campaign",customerId:"uxqa-customer",
 status:"PAYMENT_REJECTED",subtotal:18500,total:18500,items:[],createdAt:at,updatedAt:at};
const payment={paymentId:"uxqa-payment-existing",organizationId:orgId,orderId,customerId:"uxqa-customer",
 slipKey:"uxqa/existing/rejected",status:"REJECTED",rejectReason:"ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ",
 reviewedBy:"uxqa-staff",reviewedAt:at,createdAt:at,updatedAt:at};
type Proof={id:string;state:string;note:string;image:string};
test("Customer payment slip: invalid selection, PUT 403/retry, submit 409/retry, refresh success without writes",async({browser,request})=>{
 test.setTimeout(180000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let currentOrder="PAYMENT_REJECTED",currentPayment="REJECTED",uploaded=0,signCount=0,submitCount=0;
 let uploadMode:"forbidden"|"success"="forbidden",submitMode:"conflict"|"success"="conflict",unexpectedWrites=0;
 let holdUpload=false;
 const deferred:{release?:(()=>void)}={};
 const uploads:string[]=[];const submittedKeys:string[]=[];
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"customer");
 await ctx.route("**/*",async r=>{
  const req=r.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  if(method==="GET"&&path==="/api/v1/me/orders/"+orderId){
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{...order,status:currentOrder}
   })});return;
  }
  if(method==="GET"&&path==="/api/v1/me/orders/"+orderId+"/payment"){
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{...payment,status:currentPayment,
     rejectReason:currentPayment==="REJECTED"?payment.rejectReason:null,reviewedBy:currentPayment==="REJECTED"?payment.reviewedBy:null,
     reviewedAt:currentPayment==="REJECTED"?at:null,slipKey:currentPayment==="REJECTED"?payment.slipKey:submittedKeys.at(-1)}
   })});return;
  }
  if(method==="POST"&&path===root+"/payment-slip-upload-url"){
   signCount++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   const key="uxqa/fixture/payment-"+signCount;
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{objectKey:key,url:frontend+"/__uxqa_upload__/"+signCount,method:"PUT",expiresInSeconds:900}
   })});return;
  }
  if(method==="PUT"&&path.startsWith("/__uxqa_upload__/")){
   uploaded++;
   expect(req.headers()["content-type"]).toContain("image/png");
   uploads.push(path);
   if(holdUpload)await new Promise<void>(resolve=>{deferred.release=resolve;});
   await r.fulfill(uploadMode==="forbidden"?{status:403,body:"expired synthetic URL"}:{status:200,body:""});
   return;
  }
  if(method==="POST"&&path===root+"/payment"){
   submitCount++;const body=req.postDataJSON();submittedKeys.push(body.slipKey);
   if(submitMode==="conflict"){
    await r.fulfill({status:409,contentType:"application/json",body:JSON.stringify({
     success:false,error:{code:"PAYMENT_NOT_REVIEWABLE",message:"Synthetic submission conflict"}
    })});return;
   }
   currentOrder="PAYMENT_REVIEW";currentPayment="PENDING_REVIEW";
   await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    success:true,data:{...payment,status:"PENDING_REVIEW",slipKey:body.slipKey,rejectReason:null,reviewedBy:null,reviewedAt:null}
   })});return;
  }
  if(!["GET","HEAD","OPTIONS"].includes(method)){unexpectedWrites++;await r.abort("blockedbyclient");return;}
  await r.continue();
 });
 async function proof(page:Page,id:string,state:string,note:string){
  const image=id+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});proofs.push({id,state,note,image});
 }
 try {
  const page=await ctx.newPage();
  await page.goto(frontend+"/my/payment/?orderId="+orderId,{waitUntil:"domcontentloaded"});
  const heading=page.getByRole("heading",{name:"ชำระและส่งหลักฐาน",level:1});
  await expect(heading).toBeVisible({timeout:18000});
  await expect(page.getByText(payment.rejectReason,{exact:true})).toBeVisible();
  const back=page.getByRole("link",{name:"กลับรายละเอียดคำสั่งซื้อ"});
  await expect(back).toHaveAttribute("href","/my/order/?orderId="+orderId);
  await proof(page,"FE-UX-10-01","rejected-back","Rejected payment links back to the matching Order");
  const file=page.locator("#payment-slip"),submit=page.getByRole("button",{name:"ส่งหลักฐานใหม่"});
  await submit.click();
  await expect(page.getByText("กรุณาเลือกไฟล์หลักฐานการชำระเงิน")).toBeVisible();
  await expect(file).toBeFocused();
  expect(signCount).toBe(0);
  await proof(page,"FE-UX-10-05","missing-file","First invalid resubmit blocks API signing and focuses file");
  await file.setInputFiles({name:"bad.txt",mimeType:"text/plain",buffer:Buffer.from("not a payment slip")});
  await expect(page.getByText("รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP")).toBeVisible();
  await proof(page,"FE-UX-10-03","invalid-mime","Unsupported file type is rejected without persistence");
  await file.setInputFiles({name:"too-big.png",mimeType:"image/png",buffer:Buffer.alloc(10*1024*1024+1,1)});
  await expect(page.getByText("ไฟล์หลักฐานต้องมีขนาดไม่เกิน 10 MiB")).toBeVisible();
  await proof(page,"FE-UX-10-03","oversized","Oversize file is rejected without signing");
  await file.setInputFiles({name:"new-proof.png",mimeType:"image/png",buffer:Buffer.from("test-only-png-content")});
  await expect(page.getByText("new-proof.png",{exact:true})).toBeVisible();
  await proof(page,"FE-UX-10-03","valid-selection","Accepted synthetic PNG displays filename and size");

  await submit.click();
  await expect(page.getByRole("alert").filter({hasText:"ลิงก์อัปโหลดหมดอายุ"})).toBeVisible({timeout:12000});
  expect(signCount).toBe(1);expect(uploaded).toBe(1);expect(submitCount).toBe(0);
  const error=page.getByRole("alert").filter({hasText:"ลิงก์อัปโหลดหมดอายุ"});
  await expect(error).toBeInViewport();
  await expect(page.locator("[data-payment-operation-error]")).toBeFocused();
  await proof(page,"FE-UX-10-05","put-403-focused","Synthetic expired upload link failure visible in viewport and focused; no payment submit");

  uploadMode="success";holdUpload=true;
  await submit.click();
  await expect.poll(()=>uploaded).toBe(2);
  await expect(page.getByRole("button",{name:"กำลังส่งหลักฐาน"})).toBeDisabled();
  await expect(page.getByRole("status").filter({hasText:"กำลังส่งไฟล์หลักฐานไปยังพื้นที่จัดเก็บ"})).toBeVisible();
  await proof(page,"FE-UX-10-05","upload-pending","Pending direct PUT blocks repeat submit and shows upload stage");
  holdUpload=false;deferred.release?.();
  await expect(page.getByRole("alert").filter({hasText:"ไม่สามารถส่งหลักฐานในสถานะแคมเปญปัจจุบันได้"})).toBeVisible({timeout:12000});
  expect(signCount).toBe(2);expect(uploaded).toBe(2);expect(submitCount).toBe(1);
  await expect(page.locator("[data-payment-operation-error]")).toBeFocused();
  await proof(page,"FE-UX-10-05","submit-409-focused","Synthetic submission conflict focuses operation error, preserves selected file");

  submitMode="success";
  await submit.click();
  await expect(page.getByRole("status").filter({hasText:"ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ"})).toBeVisible({timeout:12000});
  await expect(page.getByRole("button",{name:"ส่งหลักฐานใหม่"})).toHaveCount(0);
  await expect(page.locator("[data-payment-operation-success]")).toBeFocused();
  await expect(page.getByText(payment.rejectReason,{exact:true})).toHaveCount(0);
  expect(signCount).toBe(3);expect(uploaded).toBe(3);expect(submitCount).toBe(2);
  expect(new Set(submittedKeys).size).toBe(2);
  await proof(page,"FE-UX-10-05","resubmit-success","Fresh object key and synthetic 200 yield authoritative refreshed REVIEW state");
  await page.close();
 } finally {deferred.release?.();await ctx.close();}
 expect(unexpectedWrites).toBe(0);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(x=>({
  actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",
  status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"All states not yet certified: "+x.statesToTest.join(", ")
 }));
 for(const e of proofs)outcomes.push({actionId:e.id,role:"customer",state:e.state,viewport:"390x844",
  status:"PASS",testRunId:runId,evidence:[e.image],notes:e.note+"; all POST and PUT simulated in Browser"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(dir,"payment-upload-safe-states.json"),JSON.stringify({
  proofs,distinctIds:[...new Set(proofs.map(x=>x.id))],signCount,uploaded,submitCount,unexpectedWrites,
  submittedKeys,uploads,limitation:"All presign POST, direct PUT, and payment POST intercepted in Playwright; no real uploaded bytes or payment writes."
 },null,2)+"\n");
});
