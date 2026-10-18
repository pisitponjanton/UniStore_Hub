import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const org="uxqa-navbar-organization";
type Role="guest"|"customer";
type Proof={id:string;role:Role;state:string;note:string;image:string};
const created="2026-10-17T12:00:00.000Z";

test("public and customer shell, authenticated login/register shortcuts and logout",async({browser,request})=>{
 test.setTimeout(210000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let blockedWrites=0,accountReads=0;
 const contexts:BrowserContext[]=[];
 async function configure(role:"guest"|"customer",hasOrg=false){
  const ctx=await browser.newContext({viewport:role==="guest"?{width:1440,height:900}:{width:390,height:844},reducedMotion:"reduce"});
  contexts.push(ctx);
  if(role==="customer")await establishSeedRoleSession(ctx,request,"customer");
  await ctx.route("**/*",async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname,method=req.method();
   const good=(data:unknown)=>({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
   if(!["GET","HEAD","OPTIONS"].includes(method)){blockedWrites++;await route.abort("blockedbyclient");return;}
   if(method==="GET"&&p==="/api/v1/me"){
    accountReads++;
    await route.fulfill(good({
     user:{userId:"uxqa-nav-user",email:"uxqa-navigation@local.test",name:"UXQA Customer",status:"ACTIVE",platformRole:null},
     memberships:hasOrg?[{organizationId:org,role:"STAFF",status:"ACTIVE"}]:[],
    }));return;
   }
   if(method==="GET"&&p==="/api/v1/storefront/directory"){
    await route.fulfill(good([]));return;
   }
   if(method==="GET"&&p==="/api/v1/me/orders"){
    await route.fulfill(good({items:[],nextCursor:null}));return;
   }
   if(method==="GET"&&p==="/api/v1/notifications"){
    await route.fulfill(good({items:[],nextCursor:null}));return;
   }
   if(method==="GET"&&p==="/api/v1/organizations"){
    await route.fulfill(good({items:hasOrg?[{organizationId:org,name:"UXQA Org",description:"Synthetic",status:"ACTIVE",createdBy:"uxqa-nav-user",createdAt:created,updatedAt:created}]:[],nextCursor:null}));return;
   }
   await route.continue();
  });
  return ctx;
 }
 async function record(page:Page,id:string,role:Role,state:string,note:string){
  const image=id+"-"+role+"-"+state+".png";
  await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id,role,state,note,image});
 }
 try{
  // Public Storefront Header: all guest controls clicked and route checked.
  const guest=await configure("guest");
  const g=await guest.newPage();
  await g.goto(frontend+"/",{waitUntil:"domcontentloaded"});
  const publicNav=g.getByRole("navigation",{name:"เมนูหน้าร้าน"});
  await expect(publicNav.getByRole("link",{name:"ร้านค้า"})).toHaveAttribute("aria-current","page");
  await g.goto(frontend+"/stores/view/",{waitUntil:"domcontentloaded"});
  await expect(g.getByText("ลิงก์ร้านค้าไม่สมบูรณ์")).toBeVisible();
  await publicNav.getByRole("link",{name:"ร้านค้า"}).click();
  await expect(g).toHaveURL(frontend+"/");
  await expect(publicNav.getByRole("link",{name:"ร้านค้า"})).toHaveAttribute("aria-current","page");
  await record(g,"FE-UX-SHELL-GUEST-02","guest","stores-home","Desktop Guest Stores link returns from detail to catalog");
  await publicNav.getByRole("link",{name:"เข้าสู่ระบบ"}).click();
  await expect(g).toHaveURL(frontend+"/login/");
  await expect(g.locator("#login-email")).toBeVisible();
  await record(g,"FE-UX-SHELL-GUEST-03","guest","login-page","Guest Login navigation opens usable form");
  await g.getByRole("link",{name:"UniStore Hub หน้าร้าน"}).click();
  await expect(g).toHaveURL(frontend+"/");
  await expect(publicNav.getByRole("link",{name:"สมัครสมาชิก"})).toBeVisible();
  await record(g,"FE-UX-SHELL-GUEST-01","guest","brand-home","Public brand navigates from auth page back to catalog");
  await publicNav.getByRole("link",{name:"สมัครสมาชิก"}).click();
  await expect(g).toHaveURL(frontend+"/register/");
  await expect(g.locator("#register-email")).toBeVisible();
  await record(g,"FE-UX-SHELL-GUEST-04","guest","register-page","Guest Register navigation opens usable form");
  await g.close();

  // Authenticated Customer shell with no organization privileges.
  const customer=await configure("customer");
  const c=await customer.newPage();
  await c.goto(frontend+"/my/orders/",{waitUntil:"domcontentloaded"});
  await expect(c.getByRole("heading",{name:"คำสั่งซื้อของฉัน",level:1})).toBeVisible();
  const openMenu=c.getByRole("button",{name:"เปิดเมนูหลัก"});
  await openMenu.click();
  const drawer=c.getByRole("dialog",{name:"เมนูหลัก"});
  await expect(drawer).toBeVisible();
  const nav=drawer.getByRole("navigation",{name:"เมนูหลัก"});
  const storefront=nav.getByRole("link",{name:"หน้าร้านค้า"});
  await storefront.click();
  await expect(c).toHaveURL(frontend+"/");
  await record(c,"FE-UX-SHELL-CUSTOMER-02","customer","storefront-click","Customer side navigation returns to public storefront");
  await c.goto(frontend+"/my/orders/",{waitUntil:"domcontentloaded"});
  await expect(c.getByRole("heading",{name:"คำสั่งซื้อของฉัน",level:1})).toBeVisible();
  await c.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
  await nav.getByRole("link",{name:"คำสั่งซื้อของฉัน"}).click();
  await expect(c).toHaveURL(frontend+"/my/orders/");
  await expect(c.getByRole("heading",{name:"คำสั่งซื้อของฉัน",level:1})).toBeVisible();
  await record(c,"FE-UX-SHELL-CUSTOMER-03","customer","orders-click","Customer Orders menu remains scoped and navigable");
  await c.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
  await nav.getByRole("link",{name:"การแจ้งเตือน"}).click();
  await expect(c).toHaveURL(frontend+"/notifications/");
  await expect(c.getByRole("heading",{name:"การแจ้งเตือน",level:1})).toBeVisible();
  await record(c,"FE-UX-SHELL-CUSTOMER-04","customer","notifications-click","Customer Notifications menu opens destination");
  await c.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
  await expect(drawer.getByRole("link",{name:"เปลี่ยนหน่วยงาน"})).toHaveCount(0);
  await drawer.getByRole("button",{name:"ปิดเมนูหลัก"}).click();
  await c.locator('aside a[href="/"]').first().click();
  await expect(c).toHaveURL(frontend+"/");
  await record(c,"FE-UX-SHELL-CUSTOMER-01","customer","brand-click","Customer shell brand opens public landing");

  await c.goto(frontend+"/my/orders/",{waitUntil:"domcontentloaded"});
  await expect(c.locator("#main-content")).toBeVisible();
  const skip=c.locator('a[href="#main-content"]');
  await skip.focus();
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(c.locator("#main-content")).toBeFocused();
  await record(c,"FE-UX-SHELL-CUSTOMER-05","customer","keyboard-skip","Skip link focuses main-content from keyboard activation");

  await c.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
  await drawer.getByRole("button",{name:"ออกจากระบบ"}).click();
  await expect(c).toHaveURL(frontend+"/");
  await expect(c.getByRole("navigation",{name:"เมนูหน้าร้าน"}).getByRole("link",{name:"เข้าสู่ระบบ"})).toBeVisible();
  await expect(c.evaluate(()=>sessionStorage.getItem("unistoreHub.accessToken"))).resolves.toBeNull();
  await record(c,"FE-UX-SHELL-CUSTOMER-06","customer","logout-to-public","Logout clears session and reveals guest storefront navigation");
  await c.close();

  // Authenticated Login/Register shortcut pages. No org membership => no org control.
  const shortcuts=await configure("customer",false);
  const p=await shortcuts.newPage();
  for(const entry of [
   {index:"02",path:"/login/"},
   {index:"03",path:"/register/"},
  ]){
   await p.goto(frontend+entry.path,{waitUntil:"domcontentloaded"});
   const area=p.getByRole("navigation",{name:"ไปยังพื้นที่ใช้งาน"});
   await expect(p.getByRole("heading",{name:"คุณเข้าสู่ระบบอยู่แล้ว"})).toBeVisible();
   await expect(p.locator("form")).toHaveCount(0);
   await expect(area.getByRole("link",{name:"ไปยังพื้นที่หน่วยงาน"})).toHaveCount(0);
   const orders=area.getByRole("link",{name:"คำสั่งซื้อของฉัน"});
   await orders.click();
   await expect(p).toHaveURL(frontend+"/my/orders/");
   await record(p,entry.index==="02"?"FE-UX-02-07":"FE-UX-03-08","customer","shortcut-orders","Authenticated account shortcut opens My Orders without showing login form");
   await p.goto(frontend+entry.path,{waitUntil:"domcontentloaded"});
   await expect(p.getByRole("navigation",{name:"ไปยังพื้นที่ใช้งาน"})).toBeVisible();
   await area.getByRole("link",{name:"การแจ้งเตือน"}).click();
   await expect(p).toHaveURL(frontend+"/notifications/");
   await record(p,entry.index==="02"?"FE-UX-02-08":"FE-UX-03-09","customer","shortcut-notifications","Authenticated shortcut navigates to Notifications");
   await p.goto(frontend+entry.path,{waitUntil:"domcontentloaded"});
   await expect(p.getByRole("navigation",{name:"ไปยังพื้นที่ใช้งาน"})).toBeVisible();
   await p.getByRole("link",{name:"กลับหน้าร้านค้า"}).click();
   await expect(p).toHaveURL(frontend+"/");
   await record(p,entry.index==="02"?"FE-UX-02-10":"FE-UX-03-11","customer","shortcut-home","Authenticated entry has direct storefront return");
  }
  await p.close();

  // Conditional organization access on both authenticated entry pages.
  const orgContext=await configure("customer",true);
  const o=await orgContext.newPage();
  for(const entry of [{id:"FE-UX-02-09",path:"/login/"},{id:"FE-UX-03-10",path:"/register/"}]){
   await o.goto(frontend+entry.path,{waitUntil:"domcontentloaded"});
   const link=o.getByRole("navigation",{name:"ไปยังพื้นที่ใช้งาน"}).getByRole("link",{name:"ไปยังพื้นที่หน่วยงาน"});
   await expect(link).toHaveAttribute("href","/org/select/");
   await link.click();
   await expect(o).toHaveURL(frontend+"/org/select/");
   await expect(o.getByRole("heading",{name:"เลือกหน่วยงานที่จะทำงาน",level:1})).toBeVisible();
   await record(o,entry.id,"customer","conditional-organization","Eligible active membership exposes scoped organization selection destination");
  }
  await o.close();
 }finally{await Promise.all(contexts.map(ctx=>ctx.close()));}
 expect(blockedWrites).toBe(0);
 expect(accountReads).toBeGreaterThan(0);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
   actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
   shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const full:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
  testRunId:runId,evidence:[],notes:"Full declared action-state matrix not exercised: "+a.statesToTest.join(", ")
 }));
 for(const p of proofs)full.push({actionId:p.id,role:p.role,state:p.state,viewport:p.role==="guest"?"1440x900":"390x844",status:"PASS",
  testRunId:runId,evidence:[p.image],notes:p.note+"; local browser session and GET-only mocks"});
 await writeActionLedger(runId,full);
 await writeFile(join(dir,"auth-shell-navigation-actions.json"),JSON.stringify({
  browserEngine:browser.browserType().name(),proofs,distinctIds:[...new Set(proofs.map(x=>x.id))],blockedWrites,accountReads,
  limitation:"Only browser navigation, sessionStorage and synthetic local GETs were observed; no backend authorization transitions or business mutations."
 },null,2)+"\n");
});
