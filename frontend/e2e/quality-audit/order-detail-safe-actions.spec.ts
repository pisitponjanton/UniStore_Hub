import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const root="/api/v1/organizations/"+ids.organizationId+"/orders";
const orderId="uxqa-order-cancel";
const timestamp="2026-10-17T09:00:00.000Z";
const order={
  orderId,organizationId:ids.organizationId,campaignId:"uxqa-campaign",customerId:"uxqa-customer",
  status:"PENDING_PAYMENT",subtotal:27000,total:27000,createdAt:timestamp,updatedAt:timestamp,
  items:[{orderItemId:"uxqa-order-item",productId:"uxqa-product",variantId:"uxqa-variant",
    productName:"UXQA Faculty Shirt",variantName:"Medium",quantity:1,unitPrice:27000,totalPrice:27000}],
};
type Proof={id:string;role:"staff"|"organizationAdmin";state:string;notes:string;image:string};
test("organization order detail role controls, safe cancellation dialogs, synthetic error and recovery",async({browser,request})=>{
  test.setTimeout(180000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const proofs:Proof[]=[];
  let writes=0,stubbedCancel=0,cancelMode:"conflict"|"success"="conflict";
  let cancelState:"PENDING_PAYMENT"|"CANCELLED"="PENDING_PAYMENT";
  let releasePending: (() => void) | undefined;
  const admin=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(admin,request,"organizationAdmin");
  const route=(id:string)=>frontend+"/org/orders/view/?organizationId="+ids.organizationId+"&orderId="+id;
  await admin.route("**/*",async r=>{
    const req=r.request(),url=new URL(req.url());
    if(req.method()==="GET"&&url.pathname.startsWith(root+"/")){
      const id=url.pathname.slice(root.length+1);
      if(id==="uxqa-order-missing"){
        await r.fulfill({status:404,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"ORDER_NOT_FOUND",message:"Synthetic no order"}})});return;
      }
      if(id==="uxqa-order-503"){
        await r.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic order outage"}})});return;
      }
      await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        success:true,data:{...order,orderId:id,status:id==="uxqa-order-paid"?"PAID":cancelState}
      })});return;
    }
    if(req.method()==="POST"&&url.pathname===root+"/"+orderId+"/cancel"){
      stubbedCancel++;
      if(cancelMode==="conflict"){
        await new Promise<void>(resolve => { releasePending=resolve; });
        await r.fulfill({status:409,contentType:"application/json",
          body:JSON.stringify({success:false,error:{code:"INVALID_STATUS_TRANSITION",message:"Synthetic conflict"}})});return;
      }
      cancelState="CANCELLED";
      await r.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{...order,status:"CANCELLED"}})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())){writes++;await r.abort("blockedbyclient");return;}
    await r.continue();
  });
  async function capture(page:Page,id:string,role:Proof["role"],state:string,notes:string){
    const image=id+"-"+role+"-"+state+".png";
    await page.screenshot({path:join(dir,image),animations:"disabled"});
    proofs.push({id,role,state,notes,image});
  }
  try{
    const page=await admin.newPage();
    await page.goto(route(orderId),{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"รายละเอียดคำสั่งซื้อ",level:1})).toBeVisible({timeout:18000});
    await expect(page.getByText("UXQA Faculty Shirt")).toBeVisible();
    const back=page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"});
    await back.click();
    await expect(page).toHaveURL(new RegExp("/org/orders/\\?organizationId="+ids.organizationId));
    await capture(page,"FE-UX-21-01","organizationAdmin","loaded-back","Back to org list keeps organization scope");
    await page.goto(route(orderId),{waitUntil:"domcontentloaded"});
    const trigger=page.getByRole("button",{name:"ยกเลิกคำสั่งซื้อ",exact:true});
    await expect(trigger).toBeVisible();
    await trigger.click();
    let modal=page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"});
    await expect(modal.getByRole("button",{name:"ยืนยันยกเลิกคำสั่งซื้อ"})).toBeVisible();
    await capture(page,"FE-UX-21-02","organizationAdmin","dialog-open","Only eligible admin sees cancel confirmation with clear irreversible warning");
    await modal.getByRole("button",{name:"กลับ"}).click();
    await expect(modal).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(stubbedCancel).toBe(0);
    await capture(page,"FE-UX-21-02","organizationAdmin","dialog-cancel","Dismiss restores focus; no cancellation POST");

    await trigger.click();
    modal=page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"});
    await modal.getByRole("button",{name:"ยืนยันยกเลิกคำสั่งซื้อ"}).click();
    await expect.poll(()=>stubbedCancel).toBe(1);
    await expect(modal.getByRole("button",{name:"กำลังดำเนินการ"})).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();
    await capture(page,"FE-UX-21-02","organizationAdmin","pending-locked","While intercepted POST is pending, confirm disabled and Escape cannot dismiss dialog");
    releasePending?.();
    await expect(modal).not.toBeVisible();
    await expect(page.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toBeVisible();
    const feedback=page.locator("[data-order-action-feedback]");
    await expect(feedback).toBeFocused();
    await expect.poll(()=>feedback.evaluate(el=>{
      const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;
    })).toBe(true);
    expect(stubbedCancel).toBe(1);
    await expect(trigger).toBeVisible();
    await capture(page,"FE-UX-21-02","organizationAdmin","synthetic-409-error","Intercepted 409 prompts refresh, preserves last eligible order and retry");
    cancelMode="success";
    await trigger.click();
    await page.getByRole("dialog",{name:"ยืนยันการยกเลิกคำสั่งซื้อ"}).getByRole("button",{name:"ยืนยันยกเลิกคำสั่งซื้อ"}).click();
    await expect(page.getByRole("status").filter({hasText:"ยกเลิกคำสั่งซื้อแล้ว"})).toBeVisible();
    await expect(trigger).toHaveCount(0);
    await capture(page,"FE-UX-21-02","organizationAdmin","synthetic-cancelled","Intercepted 200 updates displayed status and removes ineligible cancel button");
    expect(stubbedCancel).toBe(2);

    await page.goto(route("uxqa-order-paid"),{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"รายละเอียดคำสั่งซื้อ",level:1})).toBeVisible();
    await expect(page.getByRole("button",{name:"ยกเลิกคำสั่งซื้อ",exact:true})).toHaveCount(0);
    await expect(page.getByText(/ยกเลิกคำสั่งซื้อได้เฉพาะสถานะ/)).toBeVisible();
    await capture(page,"FE-UX-21-02","organizationAdmin","paid-disallowed","Paid order has no general cancel action and shows policy");

    await page.goto(route("uxqa-order-missing"),{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ไม่พบคำสั่งซื้อ"})).toBeVisible();
    await capture(page,"FE-UX-21-01","organizationAdmin","404-back-link","Not-found view offers back to scoped list");
    await page.goto(route("uxqa-order-503"),{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ไม่สามารถโหลดคำสั่งซื้อได้"})).toBeVisible();
    await capture(page,"FE-UX-21-01","organizationAdmin","503-back-recovery","Server error offers recovery and scoped list navigation");
    await page.close();
  }finally{releasePending?.();await admin.close();}

  const staff=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(staff,request,"staff");
  await staff.route("**/*",async r=>{
    const req=r.request(),url=new URL(req.url());
    if(req.method()==="GET"&&url.pathname===root+"/"+orderId){
      await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:order})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())){writes++;await r.abort("blockedbyclient");return;}
    await r.continue();
  });
  try{
    const page=await staff.newPage();await page.goto(route(orderId),{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"รายละเอียดคำสั่งซื้อ",level:1})).toBeVisible({timeout:18000});
    await expect(page.getByRole("button",{name:"ยกเลิกคำสั่งซื้อ",exact:true})).toHaveCount(0);
    await capture(page,"FE-UX-21-02","staff","role-gated-cancel","STAFF sees same read-only order but no admin-only cancel");
    await page.getByRole("link",{name:"กลับรายการคำสั่งซื้อ"}).click();
    await expect(page).toHaveURL(new RegExp("/org/orders/\\?organizationId="+ids.organizationId));
    await capture(page,"FE-UX-21-01","staff","loaded-back","Staff Back uses scoped order list");
    await page.close();
  }finally{await staff.close();}
  expect(writes).toBe(0);expect(proofs.length).toBe(11);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Exhaustive role/action-state combinations not certified: "+a.statesToTest.join(", "),
  }));
  for(const e of proofs)entries.push({actionId:e.id,role:e.role,state:e.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[e.image],notes:e.notes+"; browser-only mocks, no real Backend mutations"});
  await writeActionLedger(runId,entries);
  await writeFile(join(dir,"order-detail-safe-states.json"),JSON.stringify({
    proofs,ids:[...new Set(proofs.map(x=>x.id))],browserStubbedCancelRequests:stubbedCancel,unexpectedWrites:writes,
    limitation:"409/200 cancellation results simulated by Playwright; no real persisted cancellation.",
  },null,2)+"\n");
});
