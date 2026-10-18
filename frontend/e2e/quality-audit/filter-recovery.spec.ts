import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const error500 = { success:false, error:{code:"SERVICE_UNAVAILABLE",message:"UXQA synthetic 503; no backend writes"} };
test("notification GET 503 recoverable retry and Audit filter GET 503 recovery", async ({browser, request})=>{
  test.setTimeout(115_000);
  const {frontend}=localAuditTargets();
  const runId="uxqa-"+randomUUID();
  const out=join("test-results","quality-audit",runId);
  await mkdir(out,{recursive:true});
  const passed:Array<{actionId:string;role:"customer"|"organizationAdmin";state:string;filename:string;notes:string}>=[];
  let realWrites=0,notificationGets=0,auditGets=0;
  const customer=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(customer,request,"customer");
  let failNotifications=true;
  await customer.route("**/*",async route=>{
    const r=route.request(),u=new URL(r.url());
    if(!["GET","HEAD","OPTIONS"].includes(r.method())) {
      realWrites++;await route.abort("blockedbyclient");return;
    }
    if(r.method()==="GET"&&u.pathname==="/api/v1/notifications"){
      notificationGets++;
      if(failNotifications){
        await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify(error500)});
      }else{
        await route.fulfill({status:200,contentType:"application/json",
          body:JSON.stringify({success:true,data:{items:[],nextCursor:null}})});
      }
      return;
    }
    await route.continue();
  });
  try {
    const page=await customer.newPage();
    await page.goto(frontend+"/notifications/",{waitUntil:"domcontentloaded"});
    await expect(page.getByText("ไม่สามารถโหลดการแจ้งเตือนได้")).toBeVisible({timeout:18000});
    await expect(page.getByRole("button",{name:"ลองอีกครั้ง"})).toBeVisible();
    const token=await page.evaluate(()=>sessionStorage.getItem("unistoreHub.accessToken"));
    expect(token).toBeTruthy();
    failNotifications=false;
    await page.getByRole("button",{name:"ลองอีกครั้ง"}).click();
    await expect(page.getByText("ไม่มีการแจ้งเตือน")).toBeVisible();
    await expect(page.getByText("ไม่สามารถโหลดการแจ้งเตือนได้")).toHaveCount(0);
    expect(await page.evaluate(()=>sessionStorage.getItem("unistoreHub.accessToken"))).toBe(token);
    const filename="notifications-503-retry-390.png";
    await page.screenshot({path:join(out,filename),animations:"disabled"});
    passed.push({actionId:"FE-UX-12-05",role:"customer",state:"GET-503-to-empty-recovery",
      filename,notes:"GET 503 shows retry button; retry re-fetches, renders valid Empty state and preserves session"});
    await page.close();
  }finally{await customer.close();}

  const admin=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(admin,request,"organizationAdmin");
  const auditPath="/api/v1/organizations/"+ids.organizationId+"/audit-logs";
  const audit={auditId:"uxqa-audit",organizationId:ids.organizationId,actorId:"uxqa-actor",
    action:"PAYMENT_APPROVED",resourceType:"PAYMENT",resourceId:"uxqa-payment",
    metadata:{synthetic:true},createdAt:"2026-10-17T09:00:00.000Z"};
  let failFiltered=true,failedQueries=0;
  await admin.route("**/*",async route=>{
    const r=route.request(),u=new URL(r.url());
    if(!["GET","HEAD","OPTIONS"].includes(r.method())){
      realWrites++;await route.abort("blockedbyclient");return;
    }
    if(r.method()==="GET"&&u.pathname===auditPath){
      auditGets++;
      if(u.searchParams.get("action")==="PAYMENT_APPROVED"&&failFiltered){
        failFiltered=false;failedQueries++;
        await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify(error500)});
      }else{
        await route.fulfill({status:200,contentType:"application/json",
          body:JSON.stringify({success:true,data:{items:[audit],nextCursor:null}})});
      }
      return;
    }
    await route.continue();
  });
  try {
    const page=await admin.newPage();
    await page.goto(frontend+"/org/audit/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByText("PAYMENT_APPROVED")).toBeVisible({timeout:18000});
    const field=page.locator("#audit-action");
    await field.fill("  PAYMENT_APPROVED  ");
    await page.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    await expect(page.getByRole("alert").filter({hasText:"โหลดรายการไม่สำเร็จ"})).toContainText("ระบบขัดข้อง");
    await expect(page.locator("#audit-search-error")).toBeFocused();
    await expect.poll(() => page.locator("#audit-search-error").evaluate(el => {
      const rect=el.getBoundingClientRect();return rect.top < innerHeight && rect.bottom > 0;
    })).toBe(true);
    await expect(page.getByText("PAYMENT_APPROVED")).toBeVisible();
    await expect(field).toHaveValue("PAYMENT_APPROVED");
    const fileError="audit-filter-503-visible-390.png";
    await page.screenshot({path:join(out,fileError),animations:"disabled"});
    passed.push({actionId:"FE-UX-25-05",role:"organizationAdmin",state:"GET-503-inline-error",
      filename:fileError,notes:"Filter 503 displays inline alert while retaining last known audit rows and filter draft"});
    await page.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    await expect(page.getByText(/แสดง 1 เหตุการณ์ตามตัวกรอง/)).toBeVisible();
    await expect(page.locator("#audit-search-success")).toBeFocused();
    await expect(page.getByRole("alert").filter({hasText:"โหลดรายการไม่สำเร็จ"})).toHaveCount(0);
    const fileRecovered="audit-filter-503-retry-success-390.png";
    await page.screenshot({path:join(out,fileRecovered),animations:"disabled"});
    passed.push({actionId:"FE-UX-25-05",role:"organizationAdmin",state:"GET-503-manual-retry-recovered",
      filename:fileRecovered,notes:"Repeated filter GET recovers without changing audit records"});
    await page.close();
  }finally{await admin.close();}
  expect(failedQueries).toBe(1);
  expect(realWrites).toBe(0);

  const b=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const entries:ActionOutcome[]=[...b.actions,...b.shellActions].map(x=>({
    actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],
    notes:"All declared states remain not exhaustively tested: "+x.statesToTest.join(", "),
  }));
  for(const p of passed) entries.push({
    actionId:p.actionId,role:p.role,state:p.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[p.filename],notes:p.notes+"; synthetic GET-only, scoped state proof",
  });
  await writeActionLedger(runId,entries);
  await writeFile(join(out,"filter-recovery-matrix.json"),JSON.stringify({
    stateScopedPasses:passed,notificationGets,auditGets,realWrites,
  },null,2)+"\n");
});
