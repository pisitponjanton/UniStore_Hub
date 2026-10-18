import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const org="uxqa-create-org",storeId="uxqa-create-store",productId="uxqa-create-product",variantId="uxqa-create-variant",campaignId="uxqa-create-campaign",orderId="uxqa-created-order";
const at="2026-10-17T08:00:00.000Z";
const store={storeId,organizationId:org,name:"UXQA Campus Shop",description:"Local synthetic",status:"ACTIVE"};
const product={productId,storeId,organizationId:org,name:"UXQA Campus Shirt",description:"Test-only",imageUrl:null,status:"ACTIVE",variants:[{variantId,productId,organizationId:org,name:"Size M",price:25000,status:"ACTIVE",createdAt:at,updatedAt:at}],createdAt:at,updatedAt:at};
const campaign={campaignId,storeId,organizationId:org,name:"UXQA October Drop",status:"OPEN",openAt:at,closeAt:"2026-12-01T12:00:00.000Z",paymentDeadline:"2026-12-04T12:00:00.000Z",pickupAt:"2026-12-10T12:00:00.000Z",createdAt:at,updatedAt:at};
const order={orderId,organizationId:org,campaignId,customerId:"uxqa-customer",status:"PENDING_PAYMENT",subtotal:50000,total:47500,items:[{orderItemId:"uxqa-created-item",productId,variantId,productName:product.name,variantName:"Size M",quantity:2,unitPrice:25000,totalPrice:50000}],createdAt:at,updatedAt:at};
type Proof={id:string;state:string;note:string;image:string};

test("customer create-order invalid, retry, quantity, pending, conflict and success safely intercepted",async({browser,request})=>{
 test.setTimeout(185000);
 const {frontend}=localAuditTargets();
 const runId="uxqa-"+randomUUID(),out=join("test-results","quality-audit",runId);
 await mkdir(out,{recursive:true});
 const proofs:Proof[]=[];
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"customer");
 let failGet=false,postMode:"conflict"|"success"="conflict",pause=false,postCount=0,blocked=0,reads=0;
 const pendingPost:{release?:()=>void}={};
 await ctx.route("**/*",async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname,method=req.method();
  const base="/api/v1/storefront/organizations/"+org+"/stores";
  const json=(data:unknown)=>JSON.stringify({success:true,data});
  if(method==="GET"&&path===base){reads++;if(failGet){await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA synthetic outage"}})});return;}await route.fulfill({status:200,contentType:"application/json",body:json({items:[store],nextCursor:null})});return;}
  if(method==="GET"&&path===base+"/"+storeId+"/products"){await route.fulfill({status:200,contentType:"application/json",body:json({items:[product],nextCursor:null})});return;}
  if(method==="GET"&&path===base+"/"+storeId+"/products/"+productId){await route.fulfill({status:200,contentType:"application/json",body:json(product)});return;}
  if(method==="GET"&&path===base+"/"+storeId+"/campaigns"){await route.fulfill({status:200,contentType:"application/json",body:json({items:[campaign],nextCursor:null})});return;}
  if(method==="POST"&&path==="/api/v1/organizations/"+org+"/orders"){
   postCount++;
   const sent=req.postDataJSON();
   expect(sent).toEqual({campaignId,items:[{productId,variantId,quantity:2}]});
   if(pause)await new Promise<void>(resolve=>{pendingPost.release=resolve;});
   if(postMode==="conflict"){await route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"ORDER_CONFLICT",message:"UXQA synthetic order conflict"}})});return;}
   await route.fulfill({status:200,contentType:"application/json",body:json(order)});return;
  }
  if(!["GET","HEAD","OPTIONS"].includes(method)){blocked++;await route.abort("blockedbyclient");return;}
  await route.continue();
 });
 async function proof(page:Page,id:string,state:string,note:string){
  const image=id+"-"+state+".png";
  await page.screenshot({path:join(out,image),animations:"disabled"});
  proofs.push({id,state,note,image});
 }
 const url=frontend+"/orders/new/?"+new URLSearchParams({organizationId:org,campaignId,productId,variantId});
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/orders/new/",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"ลิงก์สร้างคำสั่งซื้อไม่สมบูรณ์"})).toBeVisible();
  await expect(page.getByRole("link",{name:"กลับหน้าร้าน"})).toHaveAttribute("href","/");
  await proof(page,"FE-UX-07-05","invalid-entry-back","Invalid order link has functional storefront recovery");
  failGet=true;
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button",{name:"ลองโหลดอีกครั้ง"})).toBeVisible();
  await proof(page,"FE-UX-07-04","503-retry-offered","Initial product context GET failure shows Retry without losing page title");
  await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
  await expect(page.getByRole("button",{name:"ลองโหลดอีกครั้ง"})).toBeVisible();
  await expect(page.locator("main")).toBeFocused();
  await proof(page,"FE-UX-07-04","second-503-focus","Repeated failure retains Retry and focuses the recovery landmark");
  failGet=false;
  await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
  const heading=page.getByRole("heading",{name:"ตรวจสอบคำสั่งซื้อ",level:1});
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await proof(page,"FE-UX-07-04","503-recovered","Retry recovers the original scoped product context");
  const back=page.getByRole("link",{name:"กลับไปที่สินค้า"});
  await expect(back).toHaveAttribute("href",new RegExp("/products/view/\\?"));
  await proof(page,"FE-UX-07-01","back-to-selected-product","Back link retains product/campaign context");
  const quantity=page.getByRole("spinbutton",{name:"จำนวน"});
  await quantity.fill("0");
  await page.getByRole("button",{name:"ยืนยันสร้างคำสั่งซื้อ"}).click();
  const error=page.locator("#order-create-error-summary");
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
  expect(postCount).toBe(0);
  await proof(page,"FE-UX-07-02","invalid-quantity-focused","Invalid quantity blocks network and focuses field error summary");
  await quantity.fill("2");
  await expect(page.getByText("฿500.00").first()).toBeVisible();
  await proof(page,"FE-UX-07-02","quantity-price-calculated","Two items calculate client estimate; server remains authoritative");
  pause=true;
  await page.getByRole("button",{name:"ยืนยันสร้างคำสั่งซื้อ"}).click();
  await expect.poll(()=>postCount).toBe(1);
  const submitting=page.getByRole("button",{name:/กำลังสร้างคำสั่งซื้อ/});
  await expect(submitting).toBeDisabled();
  await proof(page,"FE-UX-07-03","pending-single-submit","While synthetic POST pending, submit disabled to prevent duplicate");
  pause=false;pendingPost.release?.();
  await expect(page.getByText("สร้างคำสั่งซื้อไม่สำเร็จ")).toBeVisible();
  const feedback=page.locator("#order-create-submit-feedback");
  await expect(feedback).toBeFocused();
  await expect.poll(()=>feedback.evaluate(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;})).toBe(true);
  await proof(page,"FE-UX-07-03","synthetic-409","Server conflict is presented without claiming order created");
  postMode="success";
  await page.getByRole("button",{name:"ยืนยันสร้างคำสั่งซื้อ"}).click();
  const success=page.getByRole("heading",{name:"สร้างคำสั่งซื้อสำเร็จ",level:1});
  await expect(success).toBeVisible();
  await expect(success).toBeFocused();
  await expect(page.getByText("฿475.00")).toBeVisible();
  expect(postCount).toBe(2);
  await proof(page,"FE-UX-07-03","synthetic-200-authoritative-total","Accepted synthetic POST renders server total, not the earlier estimate");
  const payment=page.getByRole("link",{name:"ไปชำระเงิน"});
  await expect(payment).toHaveAttribute("href","/my/payment/?orderId="+orderId);
  await proof(page,"FE-UX-07-06","success-payment-link","Payment target retains created Order ID");
  const detail=page.getByRole("link",{name:"ดูรายละเอียดคำสั่งซื้อ"});
  await expect(detail).toHaveAttribute("href","/my/order/?orderId="+orderId);
  await proof(page,"FE-UX-07-07","success-detail-link","Details target retains created Order ID");
  const productReturn=page.getByRole("link",{name:"กลับไปดูสินค้า"});
  await expect(productReturn).toHaveAttribute("href",new RegExp("productId="+productId));
  await proof(page,"FE-UX-07-08","success-product-return","Product return target preserves original product");
  await page.close();
 }finally{pendingPost.release?.();await ctx.close();}
 expect(blocked).toBe(0);
 expect(reads).toBeGreaterThanOrEqual(2);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full state matrix unverified: "+a.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:"customer",state:p.state,viewport:"390x844",status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; read-only GET mocks, intercepted POST only"});
 await writeActionLedger(runId,entries);
 await writeFile(join(out,"create-order-actions.json"),JSON.stringify({proofs,distinctIds:[...new Set(proofs.map(p=>p.id))],postCount,blocked,reads,limitation:"No real order created; all post responses synthetic."},null,2)+"\n");
});
