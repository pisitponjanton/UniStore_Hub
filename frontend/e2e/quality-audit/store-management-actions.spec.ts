import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const list="/api/v1/organizations/"+ids.organizationId+"/stores";
const a={storeId:"uxqa-active-store",organizationId:ids.organizationId,name:"UXQA Campus Active",
  description:"Synthetic campus store",status:"ACTIVE",createdAt:"2026-10-17T10:00:00.000Z",updatedAt:"2026-10-17T10:00:00.000Z"};
const b={...a,storeId:"uxqa-inactive-store",name:"UXQA Campus Inactive",status:"INACTIVE"};
type Proof={id:string;state:string;notes:string;image:string};
test("store create/edit validation, status confirmation and cancel without backend mutations",async({browser,request})=>{
  test.setTimeout(175000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID();
  const dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const proofs:Proof[]=[];
  let blockedWrites=0,storeGets=0;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(context,request,"organizationAdmin");
  await context.route("**/*",async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==="GET"&&url.pathname===list){
      storeGets++;await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{items:[a,b],nextCursor:null}})});return;
    }
    if(request.method()==="GET"&&url.pathname===list+"/"+a.storeId){
      storeGets++;await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:a})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(request.method())){
      blockedWrites++;await route.abort("blockedbyclient");return;
    }
    await route.continue();
  });
  async function proof(page:Page,id:string,state:string,notes:string){
    const image=id+"-"+state+".png";
    await page.screenshot({path:join(dir,image),animations:"disabled"});
    proofs.push({id,state,notes,image});
  }
  try{
    const page=await context.newPage();
    await page.goto(frontend+"/org/stores/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ร้านค้า",level:1})).toBeVisible({timeout:15000});
    const active=page.getByRole("article").filter({has:page.getByRole("heading",{name:a.name})});
    const inactive=page.getByRole("article").filter({has:page.getByRole("heading",{name:b.name})});
    const deactivate=active.getByRole("button",{name:"ปิดใช้งาน"});
    await deactivate.click();
    let dialog=page.getByRole("dialog",{name:"ยืนยันการปิดใช้งานร้านค้า"});
    await expect(dialog).toContainText(a.name);
    await proof(page,"FE-UX-17-02","deactivate-confirmation","ACTIVE store confirmation identifies store and warns impact before destructive action");
    await dialog.getByRole("button",{name:"ยกเลิก"}).click();
    await expect(dialog).not.toBeVisible();
    await expect(deactivate).toBeFocused();
    await proof(page,"FE-UX-17-02","deactivate-cancel","Cancel restores focus and sends no PATCH");
    const activate=inactive.getByRole("button",{name:"เปิดใช้งาน"});
    await activate.click();
    dialog=page.getByRole("dialog",{name:"ยืนยันการเปิดใช้งานร้านค้า"});
    await expect(dialog).toContainText(b.name);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(activate).toBeFocused();
    await proof(page,"FE-UX-17-02","activate-escape","ESC dismisses inactive-store activation confirmation without PATCH");

    await page.getByRole("button",{name:"+ สร้างร้านค้า"}).click();
    const createName=page.locator("#store-create-name");
    const createDescription=page.locator("#store-create-description");
    await createName.fill("UXQA test store draft");
    await proof(page,"FE-UX-17-03","create-name-draft","Store name field accepts typed local draft");
    await createDescription.fill("Synthetic description is never submitted");
    await proof(page,"FE-UX-17-04","create-description-draft","Store description editable without backend write");
    await createName.fill("");
    const createSubmit=page.getByRole("button",{name:"สร้างร้านค้า",exact:true});
    await createSubmit.click();
    await expect(page.getByRole("link",{name:"กรุณาระบุชื่อร้านค้า"})).toBeVisible();
    await expect(page.locator("#store-create-error-summary")).toBeFocused();
    await proof(page,"FE-UX-17-05","create-empty-validation","Invalid create submit blocks POST and focuses ErrorSummary");

    await page.getByRole("button",{name:"ปิดหน้าต่าง"}).click();
    await expect(page.getByRole("alertdialog",{name:"ยืนยันการทิ้งข้อมูล"})).toBeVisible();
    await page.getByRole("button",{name:"ทิ้งข้อมูล"}).click();
    const edit=active.getByRole("button",{name:"แก้ไขข้อมูล"});
    await edit.click();
    await expect(page.getByRole("heading",{name:"แก้ไข "+a.name})).toBeVisible();
    await expect(page.locator("#store-edit-name")).toHaveValue(a.name);
    await proof(page,"FE-UX-17-01","open-edit","Load selected store through read-only GET into editor");
    await page.locator("#store-edit-name").fill("UXQA Edit Draft");
    await proof(page,"FE-UX-17-07","edit-name-draft","Editor name can be edited locally");
    await page.locator("#store-edit-description").fill("UXQA changed description");
    await proof(page,"FE-UX-17-08","edit-description-draft","Editor description can be edited locally");
    await page.locator("#store-edit-name").fill("");
    await page.getByRole("button",{name:"บันทึกข้อมูล",exact:true}).click();
    await expect(page.locator("#store-edit-error-summary").getByRole("link",{name:"กรุณาระบุชื่อร้านค้า"})).toBeVisible();
    await expect(page.locator("#store-edit-error-summary")).toBeFocused();
    await proof(page,"FE-UX-17-09","edit-empty-validation","Empty edit name blocks PATCH with focusable ErrorSummary");
    await page.getByRole("button",{name:"ปิดส่วนแก้ไข"}).click();
    await expect(page.locator("#store-edit-name")).toHaveCount(0);
    await proof(page,"FE-UX-17-06","close-editor","Close leaves original store list unchanged with no PATCH");
    await page.close();
  }finally{await context.close();}
  expect(blockedWrites).toBe(0);
  expect(proofs).toHaveLength(11);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(x=>({
    actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],
    notes:"Exhaustive action states not tested: "+x.statesToTest.join(", "),
  }));
  for(const p of proofs)entries.push({
    actionId:p.id,role:"organizationAdmin",state:p.state,viewport:"390x844",status:"PASS",
    testRunId:runId,evidence:[p.image],notes:p.notes+"; GET-only fixture and zero submitted writes",
  });
  await writeActionLedger(runId,entries);
  await writeFile(join(dir,"store-management-probes.json"),JSON.stringify({
    proofs,uniqueActionIds:[...new Set(proofs.map(x=>x.id))],blockedWrites,storeGets,
    scope:"Synthetic GET-only, confirmation canceled and invalid validation blocks all API writes",
  },null,2)+"\n");
});
