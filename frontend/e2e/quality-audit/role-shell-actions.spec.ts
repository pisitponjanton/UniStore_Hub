import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, getSeedOrganizationId } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

type Role="staff"|"organizationAdmin"|"platformAdmin";
type Navigation={id:string;label:string;path:string};
type Proof={id:string;role:Role;state:string;image:string;note:string;viewport:string};
const orgPages=[
 ["03","แดชบอร์ด","/org/dashboard/"],["04","ข้อมูลหน่วยงาน","/org/settings/"],
 ["05","บุคลากร","/org/staff/"],["06","ร้านค้า","/org/stores/"],
 ["07","สินค้า","/org/products/"],["08","แคมเปญ","/org/campaigns/"],
 ["09","คำสั่งซื้อ","/org/orders/"],["10","ตรวจสอบการชำระเงิน","/org/payments/"],
 ["11","รับสินค้า","/org/pickups/"],["12","สรุปการผลิต","/org/production/"],
 ["13","ประวัติการทำรายการ","/org/audit/"],
] as const;
const roles:Record<Role,{slug:string;initial:string;scope:string;items:Navigation[];switchOrg:boolean}>={
 staff:{
  slug:"STAFF",initial:"/org/orders/",scope:"organization",switchOrg:true,
  items:[
   {id:"FE-UX-SHELL-STAFF-03",label:"คำสั่งซื้อ",path:"/org/orders/"},
   {id:"FE-UX-SHELL-STAFF-04",label:"ตรวจสอบการชำระเงิน",path:"/org/payments/"},
   {id:"FE-UX-SHELL-STAFF-05",label:"รับสินค้า",path:"/org/pickups/"},
  ],
 },
 organizationAdmin:{
  slug:"ORGANIZATIONADMIN",initial:"/org/dashboard/",scope:"organization",switchOrg:true,
  items:orgPages.map(([n,label,path])=>({id:"FE-UX-SHELL-ORGANIZATIONADMIN-"+n,label,path})),
 },
 platformAdmin:{
  slug:"PLATFORMADMIN",initial:"/platform/summary/",scope:"platform",switchOrg:false,
  items:[
   {id:"FE-UX-SHELL-PLATFORMADMIN-03",label:"ภาพรวมระบบ",path:"/platform/summary/"},
   {id:"FE-UX-SHELL-PLATFORMADMIN-04",label:"หน่วยงาน",path:"/platform/organizations/"},
   {id:"FE-UX-SHELL-PLATFORMADMIN-05",label:"ผู้ใช้",path:"/platform/users/"},
  ],
 },
};

for(const role of ["staff","organizationAdmin","platformAdmin"] as Role[]){
 test("role shell navigation and keyboard interactions: "+role,async({browser,request})=>{
  test.setTimeout(215000);
  const {frontend}=localAuditTargets(),config=roles[role],org=getSeedOrganizationId();
  const sourceId="FE-UX-SHELL-"+config.slug;
  const initial=config.initial+(config.scope==="organization"?"?organizationId="+org:"");
  const runId="uxqa-"+randomUUID(),out=join("test-results","quality-audit",runId);
  await mkdir(out,{recursive:true});
  let blockedWrites=0;
  const proof:Proof[]=[];
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,role);
  await ctx.route("**/*",async route=>{
   const method=route.request().method();
   if(!["GET","HEAD","OPTIONS"].includes(method)){blockedWrites++;await route.abort("blockedbyclient");return;}
   await route.continue();
  });
  async function capture(page:Page,id:string,state:string,note:string){
   const image=id+"-"+state+".png";
   await page.screenshot({path:join(out,image),animations:"disabled"});
   proof.push({id,role,state,note,image,viewport:"390x844"});
  }
  const page=await ctx.newPage();
  try{
   await page.goto(frontend+initial,{waitUntil:"domcontentloaded"});
   const menu=page.getByRole("button",{name:"เปิดเมนูหลัก"});
   await expect(menu).toBeVisible({timeout:20000});
   await expect(page.locator("[data-shell-scope]")).toHaveAttribute("data-shell-scope",config.scope);
   await expect(page.locator("#main-content")).toBeVisible();
   await menu.click();
   const drawer=page.getByRole("dialog",{name:"เมนูหลัก"});
   await expect(drawer).toBeVisible();
   await expect(drawer.getByRole("button",{name:"ปิดเมนูหลัก"})).toBeFocused();
   await expect(page.locator("#main-content")).toHaveAttribute("inert","");
   const nav=drawer.getByRole("navigation",{name:"เมนูหลัก"});
   if(config.scope==="organization"){
    if(role==="staff")await expect(nav.getByRole("link",{name:"แดชบอร์ด"})).toHaveCount(0);
    if(role==="organizationAdmin")await expect(nav.getByRole("link",{name:"แดชบอร์ด"})).toBeVisible();
   }else{
    await expect(nav.getByRole("link",{name:"แดชบอร์ด"})).toHaveCount(0);
    await expect(nav.getByRole("link",{name:"ภาพรวมระบบ"})).toBeVisible();
   }
   await expect(nav.getByRole("link",{name:"หน้าร้านค้า"})).toBeVisible();
   await expect(nav.getByRole("link",{name:"คำสั่งซื้อของฉัน"})).toBeVisible();

   // Every named role-specific menu link is actually clicked and the destination checked.
   for(const action of config.items){
    const menuItem=nav.getByRole("link",{name:action.label,exact:true});
    const target=action.path+(config.scope==="organization"?"?organizationId="+org:"");
    await expect(menuItem).toHaveAttribute("href",target);
    await menuItem.click();
    await expect(page).toHaveURL(frontend+target);
    await expect(page.locator("[data-shell-scope]")).toHaveAttribute("data-shell-scope",config.scope);
    await expect(page.getByRole("button",{name:"เปิดเมนูหลัก"})).toBeVisible();
    await capture(page,action.id,"navigated-"+action.id.split("-").at(-1),"Clicked role-scoped navigation link and asserted exact route/query");
    await page.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
    await expect(drawer).toBeVisible();
    const active=nav.getByRole("link",{name:action.label,exact:true});
    await expect(active).toHaveAttribute("aria-current","page");
   }
   // Explicitly close mobile panel via keyboard Escape; focus should return.
   await page.keyboard.press("Escape");
   await expect(page.getByRole("dialog",{name:"เมนูหลัก"})).toHaveCount(0);
   await expect(page.getByRole("button",{name:"เปิดเมนูหลัก"})).toBeFocused();
   await expect(page.locator("#main-content")).not.toHaveAttribute("inert","");
   await page.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
   await drawer.getByRole("button",{name:"ปิดเมนูหลัก"}).click();
   await expect(page.getByRole("button",{name:"เปิดเมนูหลัก"})).toBeFocused();

   // Keyboard skip bypasses role navigation, focusing the actual content region.
   const skip=page.locator('a[href="#main-content"]');
   await skip.focus();
   await expect(skip).toBeFocused();
   await skip.press("Enter");
   await expect(page.locator("#main-content")).toBeFocused();
   await capture(page,sourceId+"-02","keyboard-skip","Skip link focuses main content");
   // Switch organization only appears for ACTIVE memberships.
   if(config.switchOrg){
    await page.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
    const orgLink=drawer.getByRole("link",{name:"เปลี่ยนหน่วยงาน"});
    await expect(orgLink).toHaveAttribute("href","/org/select/");
    await orgLink.click();
    await expect(page).toHaveURL(frontend+"/org/select/");
    await expect(page.getByRole("heading",{name:"เลือกหน่วยงานที่จะทำงาน",level:1})).toBeVisible();
    await capture(page,sourceId+(role==="staff"?"-06":"-14"),"organization-switch","Role authorized Organization switch opens the correct selector");
    await page.goto(frontend+initial,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("button",{name:"เปิดเมนูหลัก"})).toBeVisible();
   }else{
    await page.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
    await expect(drawer.getByRole("link",{name:"เปลี่ยนหน่วยงาน"})).toHaveCount(0);
    await drawer.getByRole("button",{name:"ปิดเมนูหลัก"}).click();
   }
   // Shell brand sits outside mobile dialog; close it before actual brand click.
   await page.locator('aside a[href="/"]').first().click();
   await expect(page).toHaveURL(frontend+"/");
   await capture(page,sourceId+"-01","brand-return","App shell brand click opens public storefront");
   // Resume authenticated workspace before logout.
   await page.goto(frontend+initial,{waitUntil:"domcontentloaded"});
   await expect(page.getByRole("button",{name:"เปิดเมนูหลัก"})).toBeVisible();
   await page.getByRole("button",{name:"เปิดเมนูหลัก"}).click();
   await drawer.getByRole("button",{name:"ออกจากระบบ"}).click();
   await expect(page).toHaveURL(frontend+"/");
   await expect(page.getByRole("navigation",{name:"เมนูหน้าร้าน"}).getByRole("link",{name:"เข้าสู่ระบบ"})).toBeVisible();
   expect(await page.evaluate(()=>window.sessionStorage.getItem("unistoreHub.accessToken"))).toBeNull();
   await capture(page,sourceId+(role==="staff"?"-07":role==="organizationAdmin"?"-15":"-06"),"logout-clears-session","Logout removes local token and restores guest storefront header");
  }finally{await ctx.close();}
  expect(blockedWrites).toBe(0);
  const manifest=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
   actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
   shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const expected=manifest.shellActions.filter(a=>a.roles.includes(role)&&a.id.startsWith(sourceId));
  for(const p of proof)expect(expected.map(x=>x.id)).toContain(p.id);
  const entries:ActionOutcome[]=[...manifest.actions,...manifest.shellActions].map(a=>({
   actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,
   evidence:[],notes:"This run does not certify full declared states: "+a.statesToTest.join(", "),
  }));
  for(const p of proof)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,
   status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; no browser data mutations"});
  await writeActionLedger(runId,entries);
  await writeFile(join(out,"role-shell-actions.json"),JSON.stringify({role,browserEngine:browser.browserType().name(),
   ids:[...new Set(proof.map(p=>p.id))],proof,blockedWrites,limitation:"Local seeded read-only UI/browser navigation only; full action states unverified."},null,2)+"\n");
 });
}
