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
    await expect(admin.getByRole("button",{name:"จัดการสมาชิก UXQA Sole Admin"})).toBeVisible();
    await expect(admin.getByRole("combobox",{name:"บทบาท"})).toHaveCount(0);
    await admin.getByRole("button",{name:"จัดการสมาชิก UXQA Sole Admin"}).click();
    let manager=page.getByRole("dialog",{name:"จัดการสมาชิก"});
    await expect(manager.getByText(/ผู้ดูแลหน่วยงานที่ใช้งานอยู่คนสุดท้าย/)).toBeVisible();
    await expect(manager.getByRole("button",{name:"นำออกจากหน่วยงาน"})).toBeDisabled();
    await manager.getByRole("combobox",{name:"บทบาท"}).selectOption("STAFF");
    await expect(manager.getByRole("button",{name:"บันทึกบทบาท"})).toBeDisabled();
    await manager.getByRole("button",{name:"ปิด"}).click();
    await inactive.getByRole("button",{name:"จัดการสมาชิก UXQA Inactive Member"}).click();
    manager=page.getByRole("dialog",{name:"จัดการสมาชิก"});
    await expect(manager.getByRole("combobox",{name:"บทบาท"})).toBeDisabled();
    await expect(manager.getByRole("button",{name:"นำออกจากหน่วยงาน"})).toBeDisabled();
    await manager.getByRole("button",{name:"ปิด"}).click();
    await prove(page,"FE-UX-16-03","last-admin-inactive-guards","The final admin and inactive membership actions are restricted within management popup");

    await staff.getByRole("button",{name:"จัดการสมาชิก UXQA Staff Member"}).click();
    manager=page.getByRole("dialog",{name:"จัดการสมาชิก"});
    const role=manager.getByRole("combobox",{name:"บทบาท"});
    await expect(manager.getByRole("button",{name:"บันทึกบทบาท"})).toBeDisabled();
    await role.selectOption("ORGANIZATION_ADMIN");
    await expect(manager.getByRole("button",{name:"บันทึกบทบาท"})).toBeEnabled();
    await prove(page,"FE-UX-16-01","staff-role-draft","Role draft inside management popup and change enabled only when edited");
    const change=manager.getByRole("button",{name:"บันทึกบทบาท"});
    await change.click();
    let modal=page.getByRole("dialog",{name:"ยืนยันการเปลี่ยนบทบาท"});
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("UXQA Staff Member");
    await expect(modal.getByRole("button",{name:"ยืนยันการเปลี่ยน"})).toBeEnabled();
    await prove(page,"FE-UX-16-02","change-role-dialog","Confirmation names affected member and new role before PATCH");
    await modal.getByRole("button",{name:"ยกเลิก"}).click();
    await expect(modal).not.toBeVisible();
    await expect(manager).toBeVisible();
    await expect(change).toBeFocused();
    expect(rolePatches).toBe(0);
    await prove(page,"FE-UX-16-02","change-role-cancel","Cancel restores focus and does not change role");
    const remove=manager.getByRole("button",{name:"นำออกจากหน่วยงาน"});
    await remove.click();
    modal=page.getByRole("dialog",{name:"ยืนยันการนำสมาชิกออก"});
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("UXQA Staff Member");
    await prove(page,"FE-UX-16-03","remove-dialog-open","Removal requires a distinct confirmation");
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await expect(manager).toBeVisible();
    await expect(remove).toBeFocused();
    expect(memberDeletes).toBe(0);
    await prove(page,"FE-UX-16-03","remove-dialog-escape","Escape cancels without DELETE and restores trigger focus");
    await manager.getByRole("button",{name:"ปิด"}).click();

    await page.getByRole("button",{name:"เพิ่มสมาชิก"}).click();
    const addModal=page.getByRole("dialog",{name:"เพิ่มสมาชิก"});
    const email=addModal.locator("#staff-email");
    const addRole=addModal.locator("#staff-role");
    const add=addModal.getByRole("button",{name:"เพิ่มสมาชิก"});
    await add.click();
    await expect(addModal.getByRole("link",{name:/อีเมล/})).toBeVisible();
    await expect(addModal.locator("#staff-add-error-summary")).toBeFocused();
    await prove(page,"FE-UX-16-06","blank-email-validation","Blank email validation is visible within popup and blocks POST");
    await email.fill("not-an-email");
    await add.click();
    await expect(addModal.getByRole("link",{name:"กรุณาระบุอีเมลที่ถูกต้อง"})).toBeVisible();
    await prove(page,"FE-UX-16-04","invalid-email-validation","Malformed email handled in popup without POST");
    await email.fill("  TEST-ONLY.MISSING@EXAMPLE.COM  ");
    await prove(page,"FE-UX-16-04","email-input-draft","Email draft remains editable");
    await addRole.selectOption("ORGANIZATION_ADMIN");
    await expect(addModal.getByText("จัดการข้อมูลหน่วยงาน บุคลากร และงานสำหรับผู้ดูแลได้")).toBeVisible();
    await prove(page,"FE-UX-16-05","select-admin-role","Role access helper appears in popup");
    await add.click();
    await expect(addModal.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toContainText(/ไม่พบผู้ใช้/);
    const feedback=addModal.locator("[data-staff-operation-error]");
    await expect(feedback).toBeFocused();
    await expect.poll(() => feedback.evaluate(element=>{
      const rect=element.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0;
    })).toBe(true);
    expect(stubbedPosts).toBe(1);
    await expect(email).toHaveValue("TEST-ONLY.MISSING@EXAMPLE.COM");
    await prove(page,"FE-UX-16-06","mocked-user-not-found","Mock POST error in add popup; no role created");
    await email.fill("fixed@example.com");
    await expect(addModal.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toHaveCount(0);
    await prove(page,"FE-UX-16-06","edit-after-404","Editing email clears server error within popup");
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


test("member popups complete synthetic add, role update and removal, across viewports", async ({browser, request}) => {
  const {frontend}=localAuditTargets();
  const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,"organizationAdmin");
  const current=[members[0]];
  const created={ ...members[1], userId:"uxqa-new", user:{
    userId:"uxqa-new", name:"New Popup Member", email:"added.popup@example.com",
  }};
  const actions:string[]=[];
  let otherWrites=0;
  await ctx.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url()), method=req.method();
    const ok=(data:unknown,status=200)=>route.fulfill({
      status,contentType:"application/json",body:JSON.stringify({success:true,data}),
    });
    if(method==="GET" && url.pathname===memberBase)
      return ok({items:current,nextCursor:null});
    if(method==="POST" && url.pathname===memberBase) {
      expect(req.postDataJSON()).toEqual({email:"added.popup@example.com",role:"STAFF"});
      current.push({...created}); actions.push("ADD");return ok(created,201);
    }
    if(method==="PATCH" && url.pathname===memberBase+"/uxqa-new") {
      expect(req.postDataJSON()).toEqual({role:"ORGANIZATION_ADMIN"});
      const idx=current.findIndex(m=>m.userId==="uxqa-new");
      current[idx]={...current[idx],role:"ORGANIZATION_ADMIN"};
      actions.push("ROLE");return ok(current[idx]);
    }
    if(method==="DELETE" && url.pathname===memberBase+"/uxqa-new") {
      const idx=current.findIndex(m=>m.userId==="uxqa-new");
      if(idx>=0)current.splice(idx,1);
      actions.push("REMOVE");return route.fulfill({status:204});
    }
    if(!["GET","HEAD","OPTIONS"].includes(method)){
      otherWrites++;return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  try {
    const page=await ctx.newPage();
    const errors:string[]=[];
    page.on("pageerror",err=>errors.push(err.message));
    await page.goto(frontend+"/org/staff/?organizationId="+ids.organizationId);
    await expect(page.getByRole("heading",{name:"UXQA Sole Admin"})).toBeVisible();
    for(const colorScheme of ["dark","light"] as const){
      await page.emulateMedia({colorScheme});
      for(const width of [320,390,768,1024,1440]){
        await page.setViewportSize({width,height:844});
        const addButton = page.getByRole("button",{name:"เพิ่มสมาชิก"});
        await expect(addButton).toBeVisible();
        const placement = await addButton.evaluate(element => {
          const button = element.getBoundingClientRect();
          const icon = element.querySelector("svg")?.getBoundingClientRect();
          const labelElement = element.querySelector("span");
          const label = labelElement?.getBoundingClientRect();
          return {
            height: button.height,
            iconCenter: icon ? icon.top + icon.height / 2 : -1,
            labelCenter: label ? label.top + label.height / 2 : -1,
            iconRight: icon?.right ?? -1,
            labelLeft: label?.left ?? -1,
            textWrap: labelElement ? getComputedStyle(labelElement).whiteSpace : "missing",
          };
        });
        expect(placement.height,colorScheme+" button height at "+width).toBeLessThanOrEqual(54);
        expect(Math.abs(placement.iconCenter - placement.labelCenter),
          colorScheme+" icon/text aligned at "+width).toBeLessThanOrEqual(4);
        expect(placement.iconRight,colorScheme+" icon precedes label at "+width).toBeLessThan(placement.labelLeft);
        expect(placement.textWrap,colorScheme+" no text wrapping at "+width).toBe("nowrap");
        const over=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
        expect(over,colorScheme+" horizontal overflow at "+width).toBeLessThanOrEqual(1);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.getByRole("button",{name:"เพิ่มสมาชิก"}).click();
    const add=page.getByRole("dialog",{name:"เพิ่มสมาชิก"});
    await expect(add).toBeVisible();
    await add.locator("#staff-email").fill("added.popup@example.com");
    await add.getByRole("button",{name:"เพิ่มสมาชิก"}).click();
    await expect(add).toHaveCount(0);
    const row=page.getByRole("article").filter({has:page.getByRole("heading",{name:"New Popup Member"})});
    await expect(row).toBeVisible();
    await row.getByRole("button",{name:"จัดการสมาชิก New Popup Member"}).click();
    const manage=page.getByRole("dialog",{name:"จัดการสมาชิก"});
    await manage.getByRole("combobox",{name:"บทบาท"}).selectOption("ORGANIZATION_ADMIN");
    await manage.getByRole("button",{name:"บันทึกบทบาท"}).click();
    const confirmRole=page.getByRole("dialog",{name:"ยืนยันการเปลี่ยนบทบาท"});
    await expect(confirmRole).toBeVisible();
    expect(actions).toEqual(["ADD"]);
    await confirmRole.getByRole("button",{name:"ยืนยันการเปลี่ยน"}).click();
    await expect(manage).toHaveCount(0);
    await expect(row.getByText("ผู้ดูแลหน่วยงาน")).toBeVisible();
    await row.getByRole("button",{name:"จัดการสมาชิก New Popup Member"}).click();
    await manage.getByRole("button",{name:"นำออกจากหน่วยงาน"}).click();
    const confirmRemove=page.getByRole("dialog",{name:"ยืนยันการนำสมาชิกออก"});
    await expect(confirmRemove).toBeVisible();
    expect(actions).toEqual(["ADD","ROLE"]);
    await confirmRemove.getByRole("button",{name:"นำออกจากหน่วยงาน"}).click();
    await expect(row).toHaveCount(0);
    expect(actions).toEqual(["ADD","ROLE","REMOVE"]);
    expect(otherWrites).toBe(0);
    expect(errors).toEqual([]);
  }finally{await ctx.close();}
});
