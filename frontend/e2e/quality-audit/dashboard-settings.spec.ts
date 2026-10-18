import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const orgPath="/api/v1/organizations/"+ids.organizationId;
const reportPath=orgPath+"/reports";
const summary={
  totalStores:2,totalProducts:12,campaignsByStatus:{OPEN:1,CLOSED:2},
  ordersByStatus:{PAID:5,RECEIVED:3},pendingPaymentReviews:4,
  paidOrderCount:8,paidRevenueSatang:2500000,
};
const original={
  organizationId:ids.organizationId,name:"UXQA Local Organization",
  description:"Local synthetic GET-only organization",status:"ACTIVE",
  createdBy:"uxqa-only",createdAt:"2026-10-17T01:00:00.000Z",updatedAt:"2026-10-17T02:00:00.000Z",
};
type Evidence={id:string;role:"organizationAdmin";state:string;filename:string;notes:string};
test("Organization Dashboard and Settings links, validation and mocked save lifecycle",async({browser,request})=>{
  test.setTimeout(240_000);
  const {frontend}=localAuditTargets();
  const runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const proof:Evidence[]=[];
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,"organizationAdmin");
  let writes=0, mockedPatches=0, reportGets=0, organizationGets=0;
  let failInitialDashboard=true, failInitialOrganization=true, failReportFilter=true;
  let savedOrganization={...original}, patchMode:"conflict"|"success"="conflict";
  const receivedPatches:Array<Record<string,unknown>>=[];
  const reports:Array<string>=[];
  await ctx.route("**/*",async route=>{
    const req=route.request(),u=new URL(req.url());
    if(req.method()==="GET"&&u.pathname===reportPath){
      reportGets++;reports.push(u.search);
      if(failInitialDashboard){await route.fulfill({
        status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic report unavailable"}})
      });return;}
      if(u.searchParams.has("campaignId")&&failReportFilter){
        failReportFilter=false;
        await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic report filter unavailable"}})});return;
      }
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:summary})});return;
    }
    if(req.method()==="GET"&&u.pathname===orgPath){
      organizationGets++;
      if(failInitialOrganization){await route.fulfill({
        status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic settings unavailable"}})
      });return;}
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:savedOrganization})});return;
    }
    if(req.method()==="PATCH"&&u.pathname===orgPath){
      mockedPatches++;
      const body=req.postDataJSON() as Record<string,unknown>;
      receivedPatches.push(body);
      if(patchMode==="conflict"){
        await route.fulfill({status:409,contentType:"application/json",
          body:JSON.stringify({success:false,error:{code:"CONFLICT",message:"Synthetic concurrent edit"}})});return;
      }
      savedOrganization={...savedOrganization,name:String(body.name),description:String(body.description)};
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:savedOrganization})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())){
      writes++;await route.abort("blockedbyclient");return;
    }
    await route.continue();
  });
  async function saveProof(page:Page,id:string,state:string,notes:string){
    const filename=id+"-"+state+".png";
    await page.screenshot({path:join(dir,filename),animations:"disabled"});
    proof.push({id,role:"organizationAdmin",state,filename,notes});
  }
  try{
    const page=await ctx.newPage();
    const dashboard=frontend+"/org/dashboard/?organizationId="+ids.organizationId;
    const settings=frontend+"/org/settings/?organizationId="+ids.organizationId;
    await page.goto(dashboard,{waitUntil:"domcontentloaded"});
    await expect(page.getByText("ไม่สามารถโหลดแดชบอร์ดได้")).toBeVisible({timeout:16000});
    failInitialDashboard=false;
    await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
    await expect(page.getByRole("heading",{name:"ภาพรวมหน่วยงาน",level:1})).toBeVisible();
    await saveProof(page,"FE-UX-14-01","503-dashboard-retry","Initial GET 503 recovered via visible Retry button");
    const links=[
      ["FE-UX-14-02","ตั้งค่าหน่วยงาน","/org/settings/"],
      ["FE-UX-14-03","เปิดคิวตรวจการชำระเงิน","/org/payments/"],
      ["FE-UX-14-04","เปิดรายการคำสั่งซื้อ","/org/orders/"],
      ["FE-UX-14-05","จัดการร้านค้า","/org/stores/"],
      ["FE-UX-14-06","จัดการสินค้า","/org/products/"],
      ["FE-UX-14-11","แคมเปญ","/org/campaigns/"],
      ["FE-UX-14-12","เปิดคำสั่งซื้อ","/org/orders/"],
    ] as const;
    for(const [id,label,dest] of links){
      const link=page.getByRole("link",{name:label,exact:true});
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(dest.replaceAll("/","\\/")+"\\?organizationId="));
      await saveProof(page,id,"scoped-navigation","Clicked actual shortcut and verified scoped destination URL");
      await page.goto(dashboard,{waitUntil:"domcontentloaded"});
      await expect(page.getByRole("heading",{name:"ภาพรวมหน่วยงาน",level:1})).toBeVisible({timeout:15000});
    }
    const campaign=page.locator("#dashboard-campaign-filter"),store=page.locator("#dashboard-store-filter");
    await campaign.fill("  campaign-example  ");
    await expect(campaign).toHaveValue("  campaign-example  ");
    await saveProof(page,"FE-UX-14-07","campaign-draft","Campaign filter editable, no write");
    await store.fill("  store-example  ");
    await expect(store).toHaveValue("  store-example  ");
    await saveProof(page,"FE-UX-14-08","store-draft","Store filter editable, no write");
    await page.getByRole("button",{name:"ใช้ตัวกรอง"}).click();
    await expect(page.getByRole("alert").filter({hasText:"ใช้ตัวกรองไม่สำเร็จ"})).toBeVisible();
    await saveProof(page,"FE-UX-14-09","503-filter-error","Filtered report failure visible and form retains draft");
    await page.getByRole("button",{name:"ใช้ตัวกรอง"}).click();
    await expect(page.getByRole("status",{name:"ขอบเขตรายงานที่ใช้อยู่"})).toContainText("campaign-example");
    const params=new URLSearchParams(reports.at(-1));
    expect(params.get("campaignId")).toBe("campaign-example");
    expect(params.get("storeId")).toBe("store-example");
    await saveProof(page,"FE-UX-14-09","server-get-filter-success","Filtered report passed only documented trimmed GET query");
    await page.getByRole("button",{name:"แสดงทั้งหน่วยงาน"}).click();
    await expect(page.getByRole("status",{name:"ขอบเขตรายงานที่ใช้อยู่"})).toContainText("ทั้งหน่วยงาน");
    await expect(campaign).toHaveValue("");
    await expect(store).toHaveValue("");
    await saveProof(page,"FE-UX-14-10","clear-filter","Cleared both local draft values and report scope");

    await page.goto(settings,{waitUntil:"domcontentloaded"});
    // A prior Dashboard shortcut may have warmed the SPA/page cache.
    // Reload for a genuine initial-settings GET 503 acceptance check.
    await page.reload({waitUntil:"domcontentloaded"});
    await expect(page.getByText("ไม่สามารถโหลดข้อมูลหน่วยงานได้")).toBeVisible({timeout:15000});
    const back=page.getByRole("link",{name:"กลับไปเลือกหน่วยงาน"});
    await expect(back).toHaveAttribute("href","/org/select/");
    await back.click();
    await expect(page).toHaveURL(/\/org\/select\/?/);
    await saveProof(page,"FE-UX-15-02","error-back-select","Settings error fallback links to Organization selector");
    failInitialOrganization=false;
    await page.goto(settings,{waitUntil:"domcontentloaded"});
    const name=page.locator("#organization-settings-name"),description=page.locator("#organization-settings-description");
    await expect(name).toHaveValue(original.name,{timeout:15000});
    await name.fill("");
    await expect(name).toHaveValue("");
    await saveProof(page,"FE-UX-15-03","name-edit-empty","Editable name supports empty client draft");
    await page.getByRole("button",{name:"บันทึกการเปลี่ยนแปลง"}).click();
    await expect(page.locator("#organization-settings-error-summary")).toBeFocused();
    await expect(page.getByRole("link",{name:"กรุณาระบุชื่อหน่วยงาน"})).toBeVisible();
    expect(mockedPatches).toBe(0);
    await saveProof(page,"FE-UX-15-05","empty-validation","Blank name rejected before any PATCH, summary focused");
    await name.fill("  UXQA Updated Name  ");
    await description.fill("  UXQA Updated Description  ");
    await expect(description).toHaveValue("  UXQA Updated Description  ");
    await saveProof(page,"FE-UX-15-04","description-edit","Editable description changes only browser draft");
    await page.getByRole("button",{name:"คืนค่าที่ยังไม่บันทึก"}).click();
    await expect(name).toHaveValue(original.name);
    await expect(description).toHaveValue(original.description);
    await saveProof(page,"FE-UX-15-03","discard-unsaved","Reset restores both organization field values without PATCH");
    await name.fill("  UXQA Updated Name  ");
    await description.fill("  UXQA Updated Description  ");
    await page.getByRole("button",{name:"บันทึกการเปลี่ยนแปลง"}).click();
    await expect(page.getByRole("alert").filter({hasText:"บันทึกไม่สำเร็จ"})).toBeVisible();
    expect(mockedPatches).toBe(1);
    expect(receivedPatches[0]).toEqual({name:"UXQA Updated Name",description:"UXQA Updated Description"});
    await saveProof(page,"FE-UX-15-05","409-synthetic-error","Browser-only PATCH 409 retains editable form; normalized body verified");
    patchMode="success";
    await page.getByRole("button",{name:"บันทึกการเปลี่ยนแปลง"}).click();
    await expect(page.getByText("ข้อมูลหน่วยงานถูกอัปเดตเรียบร้อย")).toBeVisible();
    expect(mockedPatches).toBe(2);
    await saveProof(page,"FE-UX-15-05","synthetic-save-success","Browser-only PATCH 200 produces success and disables clean form");
    await page.getByRole("link",{name:"เปลี่ยนหน่วยงาน"}).click();
    await expect(page).toHaveURL(/\/org\/select\/?/);
    await saveProof(page,"FE-UX-15-06","switch-org","Switch Organization shortcut navigates to selector");
    await page.close();
  }finally{await ctx.close();}
  expect(writes).toBe(0);
  expect(proof.length).toBe(21);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const ledger:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",
    testRunId:runId,evidence:[],notes:"Full state matrix still not evidenced: "+a.statesToTest.join(", "),
  }));
  for(const e of proof)ledger.push({actionId:e.id,role:e.role,state:e.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[e.filename],notes:e.notes+"; isolated browser mocks only"});
  await writeActionLedger(runId,ledger);
  await writeFile(join(dir,"admin-summary-settings.json"),JSON.stringify({
    scope:"Local seed session, synthetic report and organization GET, intercepted PATCH only",
    proofCount:proof.length,distinctIds:[...new Set(proof.map(x=>x.id))],
    interceptedPatches:mockedPatches,unexpectedWrites:writes,reportGets,organizationGets,
    proof,
  },null,2)+"\n");
});
