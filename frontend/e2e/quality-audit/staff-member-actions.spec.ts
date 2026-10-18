import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const memberBase="/api/v1/organizations/"+ids.organizationId+"/members";
const now="2026-10-17T10:00:00.000Z";
const members=[
  {organizationId:ids.organizationId,userId:"uxqa-admin",role:"ORGANIZATION_ADMIN",status:"ACTIVE",
   user:{userId:"uxqa-admin",email:"uxqa.admin@example.com",name:"UXQA Sole Admin"},createdAt:now,updatedAt:now},
  {organizationId:ids.organizationId,userId:"uxqa-staff",role:"STAFF",status:"ACTIVE",
   user:{userId:"uxqa-staff",email:"uxqa.staff@example.com",name:"UXQA Staff Member"},createdAt:now,updatedAt:now},
  {organizationId:ids.organizationId,userId:"uxqa-inactive",role:"STAFF",status:"INACTIVE",
   user:{userId:"uxqa-inactive",email:"uxqa.inactive@example.com",name:"UXQA Inactive Member"},createdAt:now,updatedAt:now},
];
type E={id:string;state:string;description:string;file:string};
test("synthetic staff membership controls, modal cancel, validation and add-error recovery",async({browser,request})=>{
  test.setTimeout(145000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID();
  const dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const results:E[]=[];
  let realWrites=0,stubbedPosts=0,memberGets=0,rolePatches=0,memberDeletes=0;
  const simulateAddStatus=404;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(context,request,"organizationAdmin");
  await context.route("**/*",async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(method==="GET"&&url.pathname===memberBase){
      memberGets++;
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        success:true,data:{items:members,nextCursor:null},
      })});return;
    }
    if(method==="POST"&&url.pathname===memberBase){
      stubbedPosts++;
      const body=request.postDataJSON() as Record<string,unknown>;
      expect(body).toEqual({email:"test-only.missing@example.com",role:"ORGANIZATION_ADMIN"});
      await route.fulfill({status:simulateAddStatus,contentType:"application/json",body:JSON.stringify({
        success:false,error:{code:"USER_NOT_FOUND",message:"Synthetic missing account; browser mock only"},
      })});return;
    }
    if(method==="PATCH"&&url.pathname.startsWith(memberBase+"/")){rolePatches++;await route.abort("blockedbyclient");return;}
    if(method==="DELETE"&&url.pathname.startsWith(memberBase+"/")){memberDeletes++;await route.abort("blockedbyclient");return;}
    if(!["GET","HEAD","OPTIONS"].includes(method)){realWrites++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function prove(page:Page,id:string,state:string,description:string){
    const file=id+"-"+state+".png";
    await page.screenshot({path:join(dir,file),animations:"disabled"});
    results.push({id,state,description,file});
  }
  try{
    const page=await context.newPage();
    await page.goto(frontend+"/org/staff/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"บุคลากรและสิทธิ์",level:1})).toBeVisible({timeout:16000});
    const admin=page.getByRole("article").filter({has:page.getByRole("heading",{name:"UXQA Sole Admin"})});
    const staff=page.getByRole("article").filter({has:page.getByRole("heading",{name:"UXQA Staff Member"})});
    const inactive=page.getByRole("article").filter({has:page.getByRole("heading",{name:"UXQA Inactive Member"})});
    await expect(admin.getByText(/ผู้ดูแลหน่วยงานที่ใช้งานอยู่คนสุดท้าย/)).toBeVisible();
    await expect(admin.getByRole("button",{name:"นำออก"})).toBeDisabled();
    await expect(inactive.getByRole("button",{name:"นำออก"})).toBeDisabled();
    await expect(inactive.getByRole("button",{name:"บันทึกบทบาท"})).toBeDisabled();
    await prove(page,"FE-UX-16-03","last-admin-inactive-guards","Final admin and inactive member cannot be removed and inactive member cannot change roles");

    const role=staff.getByRole("combobox",{name:"บทบาท"});
    await expect(staff.getByRole("button",{name:"บันทึกบทบาท"})).toBeDisabled();
    await role.selectOption("ORGANIZATION_ADMIN");
    await expect(staff.getByRole("button",{name:"บันทึกบทบาท"})).toBeEnabled();
    await prove(page,"FE-UX-16-01","staff-role-draft","Role draft selectable and change action enabled only when dirty");
    const change=staff.getByRole("button",{name:"บันทึกบทบาท"});
    await change.click();
    let modal=page.getByRole("dialog",{name:"ยืนยันการเปลี่ยนบทบาท"});
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("UXQA Staff Member");
    await expect(modal.getByRole("button",{name:"ยืนยันการเปลี่ยน"})).toBeEnabled();
    await prove(page,"FE-UX-16-02","change-role-dialog","Confirmation names the affected user and new role before any PATCH");
    await modal.getByRole("button",{name:"ยกเลิก"}).click();
    await expect(modal).not.toBeVisible();
    await expect(change).toBeFocused();
    expect(rolePatches).toBe(0);
    await prove(page,"FE-UX-16-02","change-role-cancel","Cancel returns keyboard focus to trigger and no role write is sent");

    const remove=staff.getByRole("button",{name:"นำออก"});
    await remove.click();
    modal=page.getByRole("dialog",{name:"ยืนยันการนำสมาชิกออก"});
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("UXQA Staff Member");
    await prove(page,"FE-UX-16-03","remove-dialog-open","Destructive confirmation identifies member and has distinct cancel/confirm actions");
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await expect(remove).toBeFocused();
    expect(memberDeletes).toBe(0);
    await prove(page,"FE-UX-16-03","remove-dialog-escape","Escape dismisses modal and restores trigger focus without DELETE");

    const email=page.locator("#staff-email");
    const addRole=page.locator("#staff-role");
    const add=page.getByRole("button",{name:"เพิ่มสมาชิก",exact:true});
    await add.click();
    await expect(page.getByRole("link",{name:/อีเมล/})).toBeVisible();
    await expect(page.locator("#staff-add-error-summary")).toBeFocused();
    await prove(page,"FE-UX-16-06","blank-email-validation","Blank email blocks POST and focuses ErrorSummary");
    await email.fill("not-an-email");
    await add.click();
    await expect(page.getByRole("link",{name:"กรุณาระบุอีเมลที่ถูกต้อง"})).toBeVisible();
    await prove(page,"FE-UX-16-04","invalid-email-validation","Malformed email handled client side without POST");
    await email.fill("  TEST-ONLY.MISSING@EXAMPLE.COM  ");
    await prove(page,"FE-UX-16-04","email-input-draft","Email remains editable and preserves draft until Submit");
    await addRole.selectOption("ORGANIZATION_ADMIN");
    await expect(page.getByText("จัดการข้อมูลหน่วยงาน บุคลากร และงานสำหรับผู้ดูแลได้")).toBeVisible();
    await prove(page,"FE-UX-16-05","select-admin-role","Role selection displays privileged access explanation");
    await add.click();
    await expect(page.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toContainText(/ไม่พบผู้ใช้/);
    const feedback=page.locator("[data-staff-operation-error]");
    await expect(feedback).toBeFocused();
    await expect.poll(() => feedback.evaluate(element=>{
      const rect=element.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0;
    })).toBe(true);
    expect(stubbedPosts).toBe(1);
    await expect(email).toHaveValue("TEST-ONLY.MISSING@EXAMPLE.COM");
    await prove(page,"FE-UX-16-06","mocked-user-not-found","Synthetic POST 404 shows recoverable error, no role/member created");
    await email.fill("fixed@example.com");
    await expect(page.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toHaveCount(0);
    await prove(page,"FE-UX-16-06","edit-after-404","Editing email clears stale server error and keeps form operable");
    await page.close();
  }finally{await context.close();}
  expect({realWrites,rolePatches,memberDeletes,stubbedPosts}).toEqual({realWrites:0,rolePatches:0,memberDeletes:0,stubbedPosts:1});
  expect(results).toHaveLength(12);
  const base=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const ledger:ActionOutcome[]=[...base.actions,...base.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
    testRunId:runId,evidence:[],notes:"Full action-state suite unverified: "+a.statesToTest.join(", "),
  }));
  for(const e of results)ledger.push({
    actionId:e.id,role:"organizationAdmin",state:e.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[e.file],notes:e.description+"; synthetic browser GET/POST only",
  });
  await writeActionLedger(runId,ledger);
  await writeFile(join(dir,"staff-membership-probes.json"),JSON.stringify({
    results,distinctIds:[...new Set(results.map(x=>x.id))],realWrites,rolePatches,memberDeletes,
    stubbedPosts,memberGets,scope:"All writes intercepted, only synthetic POST 404 fulfilled",
  },null,2)+"\n");
});
