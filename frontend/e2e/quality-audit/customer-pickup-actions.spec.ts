import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const orderId="uxqa-my-pickup-order", stamp="2026-10-17T12:00:00.000Z";
const order={orderId,organizationId:"uxqa-organization",campaignId:"uxqa-campaign",customerId:"uxqa-customer",
  status:"IN_PRODUCTION",subtotal:23000,total:23000,items:[],createdAt:stamp,updatedAt:stamp};
const pickup={pickupId:"uxqa-my-pickup",organizationId:order.organizationId,orderId,token:"UXQAPICKUPTOKEN0123456789",
  status:"READY",receivedBy:null,receivedAt:null,createdAt:stamp,updatedAt:stamp};
type Proof={id:string;state:string;notes:string;image:string};

test("Customer Pickup: not-ready refresh, error retry, received QR guard and back navigation",async({browser,request})=>{
  test.setTimeout(145000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const proofs:Proof[]=[];
  let orderState:"IN_PRODUCTION"|"READY_FOR_PICKUP"|"RECEIVED"="IN_PRODUCTION";
  let failOrder=false,failPickup=false,writes=0,ordersGet=0,pickupGet=0;
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,"customer");
  await ctx.route("**/*",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(req.method()==="GET"&&path==="/api/v1/me/orders/"+orderId){
      ordersGet++;
      if(failOrder){await route.fulfill({status:503,contentType:"application/json",
        body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic order error"}})});return;}
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        success:true,data:{...order,status:orderState}
      })});return;
    }
    if(req.method()==="GET"&&path==="/api/v1/me/orders/"+orderId+"/pickup"){
      pickupGet++;
      if(failPickup){await route.fulfill({status:503,contentType:"application/json",
        body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic pickup error"}})});return;}
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        success:true,data:{...pickup,status:orderState==="RECEIVED"?"RECEIVED":"READY",
          receivedBy:orderState==="RECEIVED"?"uxqa-staff":null,receivedAt:orderState==="RECEIVED"?stamp:null}
      })});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())){writes++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function proof(page:Page,id:string,state:string,notes:string){
    const image=id+"-"+state+".png";
    await page.screenshot({path:join(dir,image),animations:"disabled"});
    proofs.push({id,state,notes,image});
  }
  try{
    const page=await ctx.newPage();
    const url=frontend+"/my/pickup/?orderId="+orderId;
    await page.goto(url,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ยังไม่ต้องเดินทางไปรับสินค้า"})).toBeVisible({timeout:17000});
    expect(pickupGet).toBe(0);
    const back=page.getByRole("link",{name:"กลับรายละเอียดคำสั่งซื้อ"});
    await expect(back).toHaveAttribute("href","/my/order/?orderId="+orderId);
    await proof(page,"FE-UX-11-01","not-ready-back","Not-ready Pickup offers scoped Order link and does not request Pickup prematurely");
    const refresh=page.getByRole("button",{name:"ตรวจสอบสถานะล่าสุด"});
    orderState="READY_FOR_PICKUP";
    await refresh.click();
    const heading=page.getByRole("heading",{name:"ข้อมูลรับสินค้า",level:1});
    await expect(heading).toBeVisible();
    await expect(page.getByText(pickup.token,{exact:true})).toBeVisible();
    await expect(page.getByRole("img",{name:"QR สำหรับรับสินค้า"})).toBeVisible();
    await proof(page,"FE-UX-11-02","refresh-ready","Status recheck transitions from not-ready to pickup with token-only QR");
    await expect(heading).toBeFocused();
    await proof(page,"FE-UX-11-02","refresh-focus","After refresh replaces button, keyboard focus reaches new page heading");

    await page.goto(url,{waitUntil:"domcontentloaded"});
    await expect(heading).toBeVisible();
    await expect(back).toHaveAttribute("href","/my/order/?orderId="+orderId);
    await back.click();
    await expect(page).toHaveURL(/\/my\/order\/\?orderId=uxqa-my-pickup-order/);
    await expect(page.getByRole("heading",{name:"รายละเอียดคำสั่งซื้อ",level:1})).toBeVisible();
    await proof(page,"FE-UX-11-01","ready-back-navigation","Ready Pickup back link navigates to related Order detail");

    failOrder=true;
    await page.goto(url,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ไม่สามารถโหลดข้อมูลรับสินค้าได้"})).toBeVisible();
    await expect(page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"})).toHaveAttribute("href","/my/orders/");
    await proof(page,"FE-UX-11-04","error-back","Synthetic order GET 503 provides safe recovery link to orders list");
    failOrder=false;
    await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
    await expect(heading).toBeVisible();
    await expect(page.getByText(pickup.token,{exact:true})).toBeVisible();
    await proof(page,"FE-UX-11-03","order-503-retry","Retry after failed Order GET recovers QR/token without mutation");
    await expect(heading).toBeFocused();

    failPickup=true;
    await page.goto(url,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ไม่สามารถโหลดข้อมูลรับสินค้าได้"})).toBeVisible();
    await proof(page,"FE-UX-11-03","pickup-503","Synthetic Pickup GET 503 displays recoverable error");
    failPickup=false;
    await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
    await expect(heading).toBeVisible();
    await proof(page,"FE-UX-11-03","pickup-503-retry","Retry after failed Pickup GET reaches authoritative token");
    await expect(heading).toBeFocused();

    orderState="RECEIVED";
    await page.goto(url,{waitUntil:"domcontentloaded"});
    await expect(heading).toBeVisible();
    await expect(page.getByRole("status").filter({hasText:"รายการนี้รับสินค้าเรียบร้อยแล้ว"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"QR และ Pickup Token ที่ใช้แล้ว"})).toBeVisible();
    await proof(page,"FE-UX-11-02","received-read-only","Received credential clearly marked used and not reusable");

    await page.goto(frontend+"/my/pickup/",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ลิงก์รับสินค้าไม่สมบูรณ์"})).toBeVisible();
    await expect(page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"})).toHaveAttribute("href","/my/orders/");
    await proof(page,"FE-UX-11-04","invalid-link-recovery","Missing Order ID produces safe back-to-orders recovery");
    await page.close();
  } finally {await ctx.close();}
  expect(writes).toBe(0);
  expect(ordersGet).toBeGreaterThan(5);
  expect(pickupGet).toBeGreaterThan(3);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
    testRunId:runId,evidence:[],notes:"Complete declared matrix unverified: "+a.statesToTest.join(", "),
  }));
  for(const e of proofs)outcomes.push({
    actionId:e.id,role:"customer",state:e.state,viewport:"390x844",status:"PASS",
    testRunId:runId,evidence:[e.image],notes:e.notes+"; GET-only synthetic fixtures",
  });
  await writeActionLedger(runId,outcomes);
  await writeFile(join(dir,"customer-pickup-actions.json"),JSON.stringify({
    proofs,distinctIds:[...new Set(proofs.map(p=>p.id))],ordersGet,pickupGet,backendWrites:writes,
  },null,2)+"\n");
});
