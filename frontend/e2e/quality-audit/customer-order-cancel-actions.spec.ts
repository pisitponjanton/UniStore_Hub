import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect,test,type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger,type ActionOutcome } from "./result-ledger";

const id="uxqa-customer-cancel-order",at="2026-10-17T12:00:00.000Z";
const item={orderItemId:"uxqa-customer-item",productId:"uxqa-product",variantId:"uxqa-variant",productName:"UXQA Club Tee",variantName:"Size M",quantity:1,unitPrice:28000,totalPrice:28000};
const seed={orderId:id,organizationId:"uxqa-organization",campaignId:"uxqa-campaign",customerId:"uxqa-customer",subtotal:28000,total:28000,items:[item],createdAt:at,updatedAt:at};
type S="PENDING_PAYMENT"|"READY_FOR_PICKUP"|"CANCELLED"|"PAID";
type Proof={id:string;state:string;note:string;image:string};

test("customer order detail links, recovery, cancel dialog pending/409/200 safely intercepted",async({browser,request})=>{
 test.setTimeout(195000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let status:S="PENDING_PAYMENT",get503=false,cancelMode:"conflict"|"success"="conflict",pausePost=false,cancels=0,writes=0,reads=0;
 const deferred:{release?:(()=>void)}={};
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"customer");
 await ctx.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname,method=req.method();
  if(method==="GET"&&p==="/api/v1/me/orders/uxqa-customer-missing"){
   await route.fulfill({status:404,contentType:"application/json",
     body:JSON.stringify({success:false,error:{code:"ORDER_NOT_FOUND",message:"Synthetic order missing"}})});return;
  }
  if(method==="GET"&&p==="/api/v1/me/orders/"+id){
   reads++;
   if(get503){await route.fulfill({status:503,contentType:"application/json",
     body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic order GET failed"}})});return;}
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{...seed,status}})});return;
  }
  if(method==="GET"&&p==="/api/v1/me/orders"){
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{items:[{...seed,status}],nextCursor:null}})});return;
  }
  if(method==="POST"&&p==="/api/v1/me/orders/"+id+"/cancel"){
   cancels++;
   if(pausePost)await new Promise<void>(resolve=>{deferred.release=resolve;});
   if(cancelMode==="conflict"){await route.fulfill({status:409,contentType:"application/json",
     body:JSON.stringify({success:false,error:{code:"INVALID_STATUS_TRANSITION",message:"Synthetic cancel conflict"}})});return;}
   status="CANCELLED";
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:null})});return;
  }
  if(!["GET","HEAD","OPTIONS"].includes(method)){writes++;await route.abort("blockedbyclient");return;}
  await route.continue();
 });
 async function proof(page:Page,actionId:string,stateName:string,note:string){
  const image=actionId+"-"+stateName+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:actionId,state:stateName,note,image});
 }
 const url=frontend+"/my/order/?orderId="+id;
 try{
  const page=await ctx.newPage();
  get503=true;
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"ไม่สามารถโหลดคำสั่งซื้อได้"})).toBeVisible({timeout:17000});
  const backError=page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"});
  await expect(backError).toHaveAttribute("href","/my/orders/");
  await proof(page,"FE-UX-09-01","503-back","Recoverable initial server failure links to My Orders");
  await proof(page,"FE-UX-09-02","load-503","Order detail initial GET 503 offers Retry");
  get503=false;
  await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
  const heading=page.getByRole("heading",{name:"รายละเอียดคำสั่งซื้อ",level:1});
  await expect(page.getByText(item.productName)).toBeVisible();
  await expect(heading).toBeFocused();
  await proof(page,"FE-UX-09-02","retry-focused-success","Retry transitions to loaded order and focuses outcome heading");
  const back=page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"});
  await back.click();
  await expect(page).toHaveURL(frontend+"/my/orders/");
  await proof(page,"FE-UX-09-01","back-navigation","Back actually opens My Orders list");
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("link",{name:"ไปชำระเงิน"})).toHaveAttribute("href","/my/payment/?orderId="+id);
  await proof(page,"FE-UX-09-03","pending-payment-link","Payment action retains exact Order ID");

  const trigger=page.getByRole("button",{name:"ยกเลิกคำสั่งซื้อ",exact:true});
  await trigger.click();
  let modal=page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"});
  await expect(modal.getByRole("button",{name:"ยืนยันยกเลิก",exact:true})).toBeVisible();
  await proof(page,"FE-UX-09-05","modal-open","Eligible pending-payment order shows explicit cancel warning");
  await modal.getByRole("button",{name:"กลับ",exact:true}).click();
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(cancels).toBe(0);
  await proof(page,"FE-UX-09-06","dialog-cancel","Cancel restores focus without POST");
  await trigger.click();
  await expect(page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"})).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(cancels).toBe(0);
  await proof(page,"FE-UX-09-05","dialog-escape-focus","Escape cancels safely with trigger focus and no network mutation");
  await trigger.click();
  modal=page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"});
  pausePost=true;
  await modal.getByRole("button",{name:"ยืนยันยกเลิก",exact:true}).click();
  await expect.poll(()=>cancels).toBe(1);
  await expect(modal.getByRole("button",{name:"กำลังดำเนินการ"})).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  await proof(page,"FE-UX-09-06","pending-locked","Pending confirmation disabled and Escape cannot dismiss");
  pausePost=false;deferred.release?.();
  await expect(modal).not.toBeVisible({timeout:15000});
  const feedback=page.locator("[data-customer-order-action-feedback]");
  await expect(feedback.getByRole("alert")).toContainText("สถานะคำสั่งซื้อเปลี่ยนไปแล้ว");
  await expect(feedback).toBeFocused();
  await expect.poll(()=>feedback.evaluate(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;})).toBe(true);
  await expect(trigger).toBeVisible();
  await proof(page,"FE-UX-09-06","synthetic-409-visible","Intercepted 409 closes modal and focuses visible retryable failure");

  cancelMode="success";
  await trigger.click();
  await page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"}).getByRole("button",{name:"ยืนยันยกเลิก",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"})).not.toBeVisible();
  await expect(feedback.getByRole("status")).toContainText("ยกเลิกคำสั่งซื้อแล้ว");
  await expect(feedback).toBeFocused();
  await expect(trigger).toHaveCount(0);
  await expect(page.getByText("คำสั่งซื้อนี้สิ้นสุดแล้ว",{exact:true})).toBeVisible();
  await proof(page,"FE-UX-09-06","synthetic-200-cancelled","Intercepted 200 refreshes CANCELLED and prevents repeat");
  expect(cancels).toBe(2);

  status="READY_FOR_PICKUP";
  await page.goto(url,{waitUntil:"domcontentloaded"});
  const pickup=page.getByRole("link",{name:"เปิดข้อมูลรับสินค้า"});
  await expect(pickup).toHaveAttribute("href","/my/pickup/?orderId="+id);
  await expect(page.getByRole("button",{name:"ยกเลิกคำสั่งซื้อ",exact:true})).toHaveCount(0);
  await proof(page,"FE-UX-09-04","ready-pickup-link","Ready Order offers scoped pickup and hides ineligible cancel");
  await pickup.click();
  await expect(page).toHaveURL(new RegExp("/my/pickup/\\?orderId="+id));
  await proof(page,"FE-UX-09-04","pickup-navigation","Pickup link opens matching customer pickup route");

  status="PAID";
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button",{name:"ยกเลิกคำสั่งซื้อ",exact:true})).toHaveCount(0);
  await proof(page,"FE-UX-09-05","paid-ineligible","Paid order never displays an ineligible cancel action");
  await page.goto(frontend+"/my/order/?orderId=uxqa-customer-missing",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"ไม่พบคำสั่งซื้อ"})).toBeVisible();
  await expect(page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"})).toHaveAttribute("href","/my/orders/");
  await proof(page,"FE-UX-09-01","notfound-404","Synthetic 404 supplies a scoped and discoverable recovery link");
  await page.goto(frontend+"/my/order/",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"ลิงก์คำสั่งซื้อไม่สมบูรณ์"})).toBeVisible();
  await proof(page,"FE-UX-09-01","invalid-link","Missing ID has back-to-My-Orders recovery");
  await page.close();
 }finally{deferred.release?.();await ctx.close();}
 expect(writes).toBe(0);expect(cancels).toBe(2);expect(reads).toBeGreaterThan(4);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
  testRunId:runId,evidence:[],notes:"Full Action/state matrix still unverified: "+a.statesToTest.join(", ")
 }));
 for(const e of proofs)outcomes.push({actionId:e.id,role:"customer",state:e.state,viewport:"390x844",
  status:"PASS",testRunId:runId,evidence:[e.image],notes:e.note+"; synthetic GET and intercepted POST only"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(dir,"customer-order-cancel-actions.json"),JSON.stringify({
  proofs,distinctIds:[...new Set(proofs.map(p=>p.id))],reads,interceptedCancels:cancels,backendWrites:writes,
  limitation:"Playwright intercepted 409/200 cancel POST, no real order mutated."
 },null,2)+"\n");
});
