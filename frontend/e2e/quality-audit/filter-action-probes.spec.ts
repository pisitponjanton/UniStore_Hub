import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const orgPath = "/api/v1/organizations/" + ids.organizationId + "/audit-logs";
const auditA = { auditId: "uxqa-audit-a", organizationId: ids.organizationId, actorId: "uxqa-staff-a",
  action: "PAYMENT_APPROVED", resourceType: "PAYMENT", resourceId: "uxqa-payment-a",
  metadata: { synthetic: true, detail: "no backend write" }, createdAt: "2026-10-17T09:00:00.000Z" };
const auditB = { ...auditA, auditId: "uxqa-audit-b", actorId: "uxqa-staff-b",
  action: "PICKUP_CONFIRMED", resourceType: "PICKUP", resourceId: "uxqa-pickup-b" };
const noteA = { notificationId: "uxqa-note-a", userId: "uxqa-user-a",
  type: "PAYMENT_REJECTED", title: "UXQA คำสั่งซื้อรอตรวจสอบ", message: "Test-only GET fixture",
  resourceType: "PAYMENT", resourceId: "uxqa-payment", readAt: null, createdAt: "2026-10-17T09:00:00.000Z" };
const noteB = { ...noteA, notificationId: "uxqa-note-b", readAt: "2026-10-17T09:05:00.000Z",
  title: "UXQA อ่านแล้ว" };
type Evidence = { actionId: string; role: "customer" | "organizationAdmin"; state: string; screenshot: string; assertion: string };
test("Notifications and Audit safe controls have state-scoped read-only evidence", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { frontend } = localAuditTargets();
  const runId = "uxqa-" + randomUUID();
  const dir = join("test-results", "quality-audit", runId);
  await mkdir(dir, { recursive: true });
  let writes = 0, auditGets = 0, noteGets = 0;
  const evidence: Evidence[] = [];
  async function pass(page: Page, actionId: string, role: Evidence["role"], state: string, assertion: string) {
    const filename = actionId + "-" + state + ".png";
    await page.screenshot({ path: join(dir, filename), animations: "disabled" });
    evidence.push({ actionId, role, state, assertion, screenshot: filename });
  }

  const customer = await browser.newContext({ viewport: {width:390,height:844}, reducedMotion:"reduce" });
  await establishSeedRoleSession(customer, request, "customer");
  await customer.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD","OPTIONS"].includes(req.method())) {
      writes++; await route.abort("blockedbyclient"); return;
    }
    if (req.method()==="GET" && url.pathname==="/api/v1/notifications") {
      noteGets++;
      const items = url.searchParams.get("read")==="false" ? [noteA]
        : url.searchParams.get("read")==="true" ? [noteB]
        : url.searchParams.has("cursor") ? [noteB] : [noteA];
      const cursor = url.searchParams.has("cursor") || url.searchParams.has("read") ? null : "uxqa-notifications-page-two";
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items, nextCursor: cursor } }) });return;
    }
    await route.continue();
  });
  try {
    const page=await customer.newPage();
    await page.goto(frontend+"/notifications/",{waitUntil:"domcontentloaded"});
    await expect(page.getByText(noteA.title)).toBeVisible({timeout:16000});
    const filters=page.getByRole("group",{name:"กรองการแจ้งเตือน"});
    await filters.getByRole("button",{name:"ยังไม่อ่าน"}).click();
    await expect(filters.getByRole("button",{name:"ยังไม่อ่าน"})).toHaveAttribute("aria-pressed","true");
    await expect(page.getByText(noteA.title)).toBeVisible();
    await pass(page,"FE-UX-12-03","customer","unread-filter","Query read=false and UI selects Unread");
    await filters.getByRole("button",{name:"อ่านแล้ว",exact:true}).click();
    await expect(filters.getByRole("button",{name:"อ่านแล้ว",exact:true})).toHaveAttribute("aria-pressed","true");
    await expect(page.getByText(noteB.title)).toBeVisible();
    await pass(page,"FE-UX-12-04","customer","read-filter","Query read=true and UI selects Read");
    await filters.getByRole("button",{name:"ทั้งหมด"}).click();
    await expect(filters.getByRole("button",{name:"ทั้งหมด"})).toHaveAttribute("aria-pressed","true");
    await expect(page.getByText(noteA.title)).toBeVisible();
    await pass(page,"FE-UX-12-02","customer","all-filter","Clear read query and show all notifications");
    const before=noteGets;
    await page.getByRole("button",{name:"รีเฟรชรายการ"}).click();
    await expect.poll(()=>noteGets).toBeGreaterThan(before);
    await expect(page.getByText(/อัปเดตรายการแจ้งเตือนล่าสุดแล้ว/)).toBeVisible();
    await pass(page,"FE-UX-12-01","customer","manual-refresh","Refetches the same filter without a write");
    const more=page.getByRole("button",{name:"โหลดเพิ่มเติม"});
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.getByText(noteB.title)).toBeVisible();
    await pass(page,"FE-UX-12-07","customer","opaque-cursor","Loads next page without submitting mutation");
    await page.close();
  } finally { await customer.close(); }

  const admin=await browser.newContext({ viewport: {width:390,height:844}, reducedMotion:"reduce" });
  await establishSeedRoleSession(admin,request,"organizationAdmin");
  await admin.route("**/*",async route=>{
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD","OPTIONS"].includes(req.method())) {
      writes++;await route.abort("blockedbyclient");return;
    }
    if(req.method()==="GET" && url.pathname===orgPath) {
      auditGets++;
      const cursor=url.searchParams.get("cursor"), filtered=url.searchParams.has("actorId")
        || url.searchParams.has("action") || url.searchParams.has("resourceType") || url.searchParams.has("resourceId");
      const items=filtered?[auditB]:cursor?[auditB]:Array.from({length:10},(_,i)=>({...auditA,auditId:auditA.auditId+"-"+i}));
      const nextCursor=filtered||cursor?null:"uxqa-audit-page-two";
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:{items,nextCursor}})});return;
    }
    await route.continue();
  });
  try {
    const page=await admin.newPage();
    await page.goto(frontend+"/org/audit/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"อนุมัติการชำระเงิน"}).first()).toBeVisible({timeout:16000});
    await page.getByRole("button",{name:"ดูรายละเอียด PAYMENT_APPROVED uxqa-audit-a-0",exact:true}).click();
    const detail=page.getByRole("dialog",{name:"รายละเอียดเหตุการณ์"});
    await expect(detail.getByText(/"synthetic": true/)).toBeVisible();
    await detail.getByRole("button",{name:"ปิด",exact:true}).first().click();
    await pass(page,"FE-UX-25-07","organizationAdmin","metadata-expand","Audit metadata details reveal read-only JSON");
    const more=page.getByRole("button",{name:"ถัดไป"});
    await more.click();
    await expect(page.getByRole("heading",{name:"ยืนยันการรับสินค้า"})).toBeVisible();
    await pass(page,"FE-UX-25-08","organizationAdmin","cursor-load-more","Loaded second audit item with cursor");

    await page.getByRole("button",{name:"ตัวกรอง"}).click();
    const filter=page.getByRole("dialog",{name:"ตัวกรองเหตุการณ์"});
    for(const entry of [
      {field:"#audit-actor-id",value:"  uxqa-staff-b  ",id:"FE-UX-25-01"},
      {field:"#audit-action",value:"  PICKUP_CONFIRMED  ",id:"FE-UX-25-02"},
      {field:"#audit-resource-type",value:"  PICKUP  ",id:"FE-UX-25-03"},
      {field:"#audit-resource-id",value:"  uxqa-pickup-b  ",id:"FE-UX-25-04"},
    ]) {
      await page.locator(entry.field).fill(entry.value);
      await expect(page.locator(entry.field)).toHaveValue(entry.value);
      await pass(page,entry.id,"organizationAdmin","draft-filter","Draft filter stores entered text without API write");
    }
    await filter.getByRole("button",{name:"ค้นหา / กรอง"}).click();
    await expect.poll(()=>auditGets).toBeGreaterThan(1);
    await expect(page.getByText(/แสดง 1 เหตุการณ์ตามตัวกรอง/)).toBeVisible();
    await expect(page.locator("#audit-search-success")).toBeFocused();
    await expect.poll(() => page.locator("#audit-search-success").evaluate(el => {
      const rect=el.getBoundingClientRect();return rect.top < innerHeight && rect.bottom > 0;
    })).toBe(true);
    await expect(page.getByRole("group",{name:"ตัวกรองที่ใช้อยู่"})).toContainText("uxqa-staff-b");
    await pass(page,"FE-UX-25-05","organizationAdmin","server-search","Trimmed filter submitted as GET and applied");
    await page.getByRole("button",{name:"ล้างทั้งหมด"}).click();
    await expect(page.getByRole("group",{name:"ตัวกรองที่ใช้อยู่"})).toHaveCount(0);
    await expect(page.getByText(/แสดง Audit Log ทั้งหมดที่โหลด/)).toBeVisible();
    await expect(page.locator("#audit-search-success")).toBeFocused();
    await pass(page,"FE-UX-25-06","organizationAdmin","clear-filters","Clear button resets draft and applied server filters");
    await page.close();
  }finally{await admin.close();}
  expect(writes).toBe(0);
  expect(evidence).toHaveLength(13);

  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions: Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],
    notes:"All action states not yet directly executed: "+a.statesToTest.join(", "),
  }));
  for(const item of evidence) {
    entries.push({actionId:item.actionId,role:item.role,state:item.state,viewport:"390x844",
      status:"PASS",testRunId:runId,evidence:[item.screenshot],notes:item.assertion+"; GET-only synthetic fixture, not a full state certification."});
  }
  await writeActionLedger(runId, entries);
  await writeFile(join(dir,"read-only-filter-probes.json"), JSON.stringify({
    runId, passes:evidence.length, auditGets, noteGets, writes, evidence,
    note:"No mutation was submitted or reached the backend. All API content is synthetic GET-only.",
  },null,2)+"\n");
});
