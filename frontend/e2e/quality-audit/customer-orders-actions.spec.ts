import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect,test,type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger,type ActionOutcome } from "./result-ledger";

const path="/api/v1/me/orders",at="2026-10-17T12:00:00.000Z";
type S="PENDING_PAYMENT"|"IN_PRODUCTION"|"RECEIVED"|"READY_FOR_PICKUP";
const makeOrder=(n:number,status:S)=>({
 orderId:"uxqa-my-orders-"+n,organizationId:"uxqa-organization",campaignId:"uxqa-campaign",
 customerId:"uxqa-customer",status,subtotal:18500+n,total:18500+n,
 items:[],createdAt:at,updatedAt:at
});
const order1=makeOrder(1,"PENDING_PAYMENT"),order2=makeOrder(2,"IN_PRODUCTION"),
 order3=makeOrder(3,"READY_FOR_PICKUP"),order4=makeOrder(4,"RECEIVED");
type Proof={id:string;state:string;note:string;image:string};
test("My Orders links, filters, cursor 503/retry, initial 503/retry and focus",async({browser,request})=>{
 test.setTimeout(185000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[],queries:string[]=[];
 let initialFail=false,cursorFail=true,writes=0,requests=0;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"customer");
 await ctx.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==="GET"&&url.pathname===path){
   requests++;queries.push(url.search);
   const cursor=url.searchParams.get("cursor");
   if(!cursor&&initialFail){
    await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({
      success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic initial orders unavailable"}
    })});return;
   }
   if(cursor&&cursorFail){
    await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({
      success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic cursor unavailable"}
    })});return;
   }
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     success:true,data:cursor?{items:[order3,order4],nextCursor:null}:{items:[order1,order2],nextCursor:"opaque-uxqa-cursor"}
   })});return;
  }
  if(req.method()==="GET"&&url.pathname.startsWith("/api/v1/me/orders/")){
    const order=[order1,order2,order3,order4].find(o=>url.pathname.endsWith("/"+o.orderId));
    if(order){await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:order})});return;}
  }
  if(!["GET","HEAD","OPTIONS"].includes(req.method())){writes++;await route.abort("blockedbyclient");return;}
  await route.continue();
 });
 async function proof(page:Page,id:string,state:string,note:string){
  const image=id+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,state,note,image});
 }
 try{
  const page=await ctx.newPage(),href=frontend+"/my/orders/";
  initialFail=true;
  await page.goto(href,{waitUntil:"domcontentloaded"});
  await expect(page.getByText("ไม่สามารถโหลดคำสั่งซื้อได้")).toBeVisible({timeout:20000});
  await expect(page.getByRole("link",{name:"กลับหน้าร้าน"})).toHaveAttribute("href","/shops/");
  await proof(page,"FE-UX-08-02","initial-503","Persistent synthetic 503 shows retry and safe store return");
  initialFail=false;
  await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
  const heading=page.getByRole("heading",{name:"คำสั่งซื้อของฉัน",level:1});
  await expect(heading).toBeVisible();
  await expect(page.getByRole("article",{name:"คำสั่งซื้อ "+order1.orderId})).toBeVisible();
  await expect(heading).toBeFocused();
  await proof(page,"FE-UX-08-02","retry-success-focus","Explicit Retry displays Order list and focuses new page heading");
  const chooseMore=page.getByRole("link",{name:"เลือกสินค้าเพิ่ม"});
  await expect(chooseMore).toHaveAttribute("href","/shops/");
  await chooseMore.click();
  await expect(page).toHaveURL(frontend+"/shops/");
  await proof(page,"FE-UX-08-01","choose-more-navigation","Customer returns to storefront from My Orders");

  await page.goto(href,{waitUntil:"domcontentloaded"});
  const paymentRow=page.getByRole("article",{name:"คำสั่งซื้อ "+order1.orderId});
  await expect(paymentRow).toBeVisible();
  await expect(paymentRow.getByRole("link",{name:"ชำระเงิน คำสั่งซื้อ "+order1.orderId}))
    .toHaveAttribute("href","/my/payment/?orderId="+order1.orderId);
  const detail=paymentRow.getByRole("link",{name:"ดูรายละเอียด คำสั่งซื้อ "+order1.orderId});
  await expect(detail).toHaveAttribute("href","/my/order/?orderId="+order1.orderId);
  await detail.click();
  await expect(page).toHaveURL(new RegExp("/my/order/\\?orderId="+order1.orderId));
  await expect(page.getByRole("heading",{name:"รายละเอียดคำสั่งซื้อ",level:1})).toBeVisible();
  await proof(page,"FE-UX-08-03","detail-navigation","Open matching order detail with correct order ID");
  await page.goto(href,{waitUntil:"domcontentloaded"});
  // This view has a real empty category on the first page.
  const filtersOnFirstPage=page.getByRole("group",{name:"กรองคำสั่งซื้อที่โหลดแล้ว"});
  await filtersOnFirstPage.getByRole("combobox",{name:"เลือกสถานะคำสั่งซื้อ"}).selectOption("finished");
  await expect(page.getByText("ยังไม่มีคำสั่งซื้อในกลุ่มนี้จากรายการที่โหลดแล้ว")).toBeVisible();
  await proof(page,"FE-UX-08-04","local-no-match","Local finished filter empty state shows return-to-all action");
  await page.getByRole("button",{name:"ดูคำสั่งซื้อทั้งหมด"}).click();
  await expect(filtersOnFirstPage.getByRole("combobox",{name:"เลือกสถานะคำสั่งซื้อ"})).toHaveValue("all");
  // Customer list deliberately defaults to action-only; switch to All
  // before asserting non-action progress and completed rows remain preserved.
  const more=page.getByRole("button",{name:"โหลดคำสั่งซื้อเพิ่มเติม"});
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.getByRole("alert").filter({hasText:"โหลดรายการเพิ่มเติมไม่สำเร็จ"})).toBeVisible();
  await expect(page.getByRole("article",{name:"คำสั่งซื้อ "+order1.orderId})).toBeVisible();
  await expect(page.getByRole("article",{name:"คำสั่งซื้อ "+order2.orderId})).toBeVisible();
  await expect(more).toBeEnabled();
  await expect(page.getByRole("alert").filter({hasText:"โหลดรายการเพิ่มเติมไม่สำเร็จ"})).toBeInViewport();
  await expect(page.locator("[data-customer-orders-page-error]")).toBeFocused();
  await proof(page,"FE-UX-08-04","cursor-503-focused","Failed opaque cursor preserves previous page and focuses visible recoverable error");
  cursorFail=false;
  await more.click();
  await expect(page.getByRole("article",{name:"คำสั่งซื้อ "+order3.orderId})).toBeVisible();
  await expect(page.getByRole("article",{name:"คำสั่งซื้อ "+order4.orderId})).toBeVisible();
  await expect(more).toHaveCount(0);
  expect(queries.some(q=>new URLSearchParams(q).get("cursor")==="opaque-uxqa-cursor")).toBe(true);
  await proof(page,"FE-UX-08-04","cursor-retry","Retry appends new rows and finalizes pagination");
  const pickupRow=page.getByRole("article",{name:"คำสั่งซื้อ "+order3.orderId});
  await expect(pickupRow.getByRole("link",{name:"เปิดข้อมูลรับสินค้า คำสั่งซื้อ "+order3.orderId}))
    .toHaveAttribute("href","/my/pickup/?orderId="+order3.orderId);
  await proof(page,"FE-UX-08-03","pickup-contextual","Ready pickup contextual action links to corresponding Order pickup");
  const filters=page.getByRole("group",{name:"กรองคำสั่งซื้อที่โหลดแล้ว"});
  await filters.getByRole("combobox",{name:"เลือกสถานะคำสั่งซื้อ"}).selectOption("progress");
  await expect(filters.getByRole("combobox",{name:"เลือกสถานะคำสั่งซื้อ"})).toHaveValue("progress");
  await proof(page,"FE-UX-08-04","local-filter-progress","Loaded-only progress filter retains matching order");
  await filters.getByRole("combobox",{name:"เลือกสถานะคำสั่งซื้อ"}).selectOption("finished");
  await expect(page.getByRole("article",{name:"คำสั่งซื้อ "+order4.orderId})).toBeVisible();
  await proof(page,"FE-UX-08-04","local-filter-completed","Loaded-only finished filter shows completed order");
  await page.close();

  // Entirely empty response remains isolated from the real backend.
  const emptyCtx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(emptyCtx,request,"customer");
  await emptyCtx.route("**/api/v1/me/orders*",route=>route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({success:true,data:{items:[],nextCursor:null}})}));
  const emptyPage=await emptyCtx.newPage();
  await emptyPage.goto(href,{waitUntil:"domcontentloaded"});
  await expect(emptyPage.getByText("ยังไม่มีคำสั่งซื้อ")).toBeVisible();
  await expect(emptyPage.getByRole("link",{name:"เลือกสินค้า"})).toHaveAttribute("href","/shops/");
  await proof(emptyPage,"FE-UX-08-04","server-empty","Server empty state offers discoverable store navigation");
  await emptyCtx.close();
 }finally{await ctx.close();}
 expect(writes).toBe(0);expect(requests).toBeGreaterThan(3);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
  testRunId:runId,evidence:[],notes:"All declared states not certified: "+a.statesToTest.join(", ")
 }));
 for(const p of proofs)outcomes.push({actionId:p.id,role:"customer",state:p.state,viewport:"390x844",
  status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; isolated synthetic GET only"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(dir,"customer-orders-actions.json"),JSON.stringify({
  proofs,distinctIds:[...new Set(proofs.map(x=>x.id))],queries,requests,unexpectedWrites:writes,
 },null,2)+"\n");
});
