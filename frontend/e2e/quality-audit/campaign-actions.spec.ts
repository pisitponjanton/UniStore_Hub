import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const root="/api/v1/organizations/"+ids.organizationId;
const stores=root+"/stores",campaigns=root+"/campaigns",stamp="2026-10-17T09:00:00.000Z";
const storeA={storeId:"uxqa-camp-store-a",organizationId:ids.organizationId,name:"UXQA Campaign Shop",status:"ACTIVE",description:"Synthetic",createdAt:stamp,updatedAt:stamp};
const storeB={...storeA,storeId:"uxqa-camp-store-b",name:"UXQA Empty Shop"};
const draft={campaignId:"uxqa-campaign-draft",organizationId:ids.organizationId,storeId:storeA.storeId,name:"UXQA Preorder Draft",
  openAt:null,closeAt:null,paymentDeadline:null,pickupAt:null,status:"DRAFT",createdAt:stamp,updatedAt:stamp};
const statusList=["DRAFT","OPEN","CLOSED","PRODUCING","READY_FOR_PICKUP","COMPLETED","CANCELLED"] as const;
const campaignList=statusList.map((status,i)=>({...draft,campaignId:"uxqa-campaign-"+i,name:"UXQA Campaign "+status,status}));
const meta=[
  {id:"FE-UX-19-21",status:"DRAFT",button:"เปิดรับคำสั่งซื้อ",dialog:"ยืนยันการเปิดรับคำสั่งซื้อ"},
  {id:"FE-UX-19-22",status:"OPEN",button:"ปิดรับคำสั่งซื้อ",dialog:"ยืนยันการปิดรับคำสั่งซื้อ"},
  {id:"FE-UX-19-23",status:"CLOSED",button:"เริ่มการผลิต",dialog:"ยืนยันการเริ่มผลิต"},
  {id:"FE-UX-19-24",status:"PRODUCING",button:"แจ้งพร้อมรับสินค้า",dialog:"ยืนยันว่าพร้อมรับสินค้า"},
  {id:"FE-UX-19-25",status:"READY_FOR_PICKUP",button:"ปิดแคมเปญเป็นเสร็จสิ้น",dialog:"ยืนยันการเสร็จสิ้นแคมเปญ"},
  {id:"FE-UX-19-26",status:"DRAFT",button:"ยกเลิกแคมเปญ",dialog:"ยืนยันการยกเลิกแคมเปญ"},
] as const;
type Evidence={id:string;state:string;details:string;image:string};

test("Campaign filter, create/edit and lifecycle modal states are safe and state-scoped",async({browser,request})=>{
  test.setTimeout(200_000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID();
  const dir=join("test-results","quality-audit",runId);await mkdir(dir,{recursive:true});
  const evidence:Evidence[]=[];const getQueries:string[]=[];
  let actualWrites=0,filteredGets=0,detailGets=0,failedFilteredGet=false;
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(ctx,request,"organizationAdmin");
  await ctx.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==="GET"&&url.pathname===stores+"/"+storeA.storeId){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:storeA})});return;
    }
    if(req.method()==="GET"&&url.pathname===stores+"/"+storeB.storeId){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:storeB})});return;
    }
    if(req.method()==="GET"&&url.pathname===stores){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{items:[storeA,storeB],nextCursor:null}})});return;
    }
    if(req.method()==="GET"&&url.pathname===campaigns){
      filteredGets++;getQueries.push(url.search);
      if(url.searchParams.get("status")==="OPEN"&&!failedFilteredGet){
        failedFilteredGet=true;
        await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA simulated list error"}})});return;
      }
      const filtered=campaignList.filter(c=>!url.searchParams.get("storeId")||c.storeId===url.searchParams.get("storeId"))
        .filter(c=>!url.searchParams.get("status")||c.status===url.searchParams.get("status"));
      const pageItems=url.searchParams.has("cursor")?filtered.slice(5):url.searchParams.has("status")?filtered:filtered.slice(0,5);
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        success:true,data:{items:pageItems,nextCursor:url.searchParams.has("status")||url.searchParams.has("cursor")?null:"uxqa-cursor-page2"}
      })});return;
    }
    if(req.method()==="GET"&&url.pathname.startsWith(campaigns+"/")){
      detailGets++;const id=url.pathname.slice(campaigns.length+1);
      const found=campaignList.find(c=>c.campaignId===id)??draft;
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:found})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())){actualWrites++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function record(page:Page,id:string,state:string,details:string){
    const image=id+"-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
    evidence.push({id,state,details,image});
  }
  try{
    const page=await ctx.newPage();
    await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+storeA.storeId+"&tab=campaigns",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"แคมเปญ",level:2,exact:true})).toBeVisible({timeout:16000});
    await page.getByRole("button",{name:"โหลดเพิ่มเติม",exact:true}).click();
    await expect(page.getByRole("heading",{name:"UXQA Campaign COMPLETED"})).toBeVisible();
    expect(getQueries.some(x=>new URLSearchParams(x).get("cursor")==="uxqa-cursor-page2")).toBe(true);
    await record(page,"FE-UX-19-05","cursor-page2","Opaque cursor GET appends remaining campaigns");
    const search=page.locator("#campaigns-directory-search");
    await search.fill("never-match-uxqa-campaign");
    await expect(page.getByText("ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง")).toBeVisible();
    await record(page,"FE-UX-19-01","search-no-match","Local search no-match UI without API write");
    await page.getByRole("button",{name:"ล้างคำค้นหา"}).click();

    await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+storeB.storeId+"&tab=campaigns",{waitUntil:"domcontentloaded"});
    await expect(page.getByText("ไม่พบแคมเปญ",{exact:true})).toBeVisible();
    await record(page,"FE-UX-19-01","store-empty","Switching workspace reveals no campaigns in Store B");
    await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+storeA.storeId+"&tab=campaigns",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"UXQA Campaign DRAFT"})).toBeVisible();
    const statusFilter=page.locator("#campaign-status-filter");
    await statusFilter.selectOption("OPEN");
    await expect(page.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"UXQA Campaign DRAFT"})).toBeVisible();
    await record(page,"FE-UX-19-02","status-get-503","Failed status GET preserves original rows");
    await statusFilter.selectOption("CLOSED");
    await expect(page.getByRole("heading",{name:"UXQA Campaign CLOSED"})).toBeVisible();
    await record(page,"FE-UX-19-02","status-filter","Scoped status GET returns only matching campaign");
    await page.getByRole("button",{name:"แสดงทั้งหมด"}).click();
    await expect(statusFilter).toHaveValue("");
    await expect(page.getByRole("heading",{name:"UXQA Campaign DRAFT"})).toBeVisible();
    await record(page,"FE-UX-19-03","clear-filter","Clearing status keeps Store A context");

    await page.getByRole("button",{name:"+ สร้างแคมเปญ"}).click();
    await expect(page.locator("#campaign-create-store")).toHaveCount(0);
    await expect(page.getByRole("dialog",{name:"สร้างแคมเปญ"})).toContainText(storeA.name);
    await record(page,"FE-UX-19-06","store-context","Create campaign already knows Store A");

    const name=page.locator("#campaign-create-name");
    await name.fill("UXQA Upcoming Campaign");
    await record(page,"FE-UX-19-07","create-name-draft","Campaign name draft editable");
    const dates=[
      ["FE-UX-19-08","#campaign-create-open","2026-11-01T09:00"],
      ["FE-UX-19-09","#campaign-create-close","2026-11-05T09:00"],
      ["FE-UX-19-10","#campaign-create-payment","2026-11-06T09:00"],
      ["FE-UX-19-11","#campaign-create-pickup","2026-11-12T09:00"],
    ] as const;
    for(const [id,selector,value] of dates){await page.locator(selector).fill(value);await expect(page.locator(selector)).toHaveValue(value);await record(page,id,"create-date-draft","Editable local datetime value");}
    await name.fill("");
    await page.getByRole("button",{name:"สร้างแคมเปญ",exact:true}).click();
    const createSummary=page.locator("#campaign-create-error-summary");
    await expect(createSummary.getByRole("link",{name:"กรุณาระบุชื่อ Campaign"})).toBeVisible();
    await expect(createSummary).toBeFocused();
    await record(page,"FE-UX-19-12","create-invalid-submit","First invalid submit focuses validation summary and sends no POST");

    await page.getByRole("button",{name:"ปิดหน้าต่าง"}).click();
    await expect(page.getByRole("alertdialog",{name:"ยืนยันการทิ้งข้อมูล"})).toBeVisible();
    await page.getByRole("button",{name:"ทิ้งข้อมูล"}).click();
    const draftRow=page.getByRole("article").filter({has:page.getByRole("heading",{name:"UXQA Campaign DRAFT"})});
    await draftRow.getByRole("link",{name:"ดูและแก้ไข"}).click();
    await expect(page.locator("#campaign-edit-name")).toHaveValue("UXQA Campaign DRAFT");
    await record(page,"FE-UX-19-04","open-draft-detail","Detail loaded by fresh synthetic GET");
    const draftInputs=[
      ["FE-UX-19-15","#campaign-edit-name","UXQA Changed Campaign"],
      ["FE-UX-19-16","#campaign-edit-open","2026-11-01T09:00"],
      ["FE-UX-19-17","#campaign-edit-close","2026-11-05T09:00"],
      ["FE-UX-19-18","#campaign-edit-payment","2026-11-06T09:00"],
      ["FE-UX-19-19","#campaign-edit-pickup","2026-11-12T09:00"],
    ] as const;
    for(const [id,selector,value] of draftInputs) {
      await page.locator(selector).fill(value);
      await expect(page.locator(selector)).toHaveValue(value);
      await record(page,id,"edit-field-draft","Draft editor field changed locally");
    }
    await page.locator("#campaign-edit-name").fill("");
    await page.getByRole("button",{name:"บันทึกฉบับร่าง",exact:true}).click();
    const editSummary=page.locator("#campaign-edit-error-summary");
    await expect(editSummary.getByRole("link",{name:"กรุณาระบุชื่อ Campaign"})).toBeVisible();
    await expect(editSummary).toBeFocused();
    await record(page,"FE-UX-19-20","edit-invalid-submit","Invalid draft save focuses summary without PATCH");

    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("link",{name:/กลับไปรายการแคมเปญ/}).click();
    await expect(page.locator("#campaign-edit-name")).toHaveCount(0);
    await record(page,"FE-UX-19-13","close-detail","Closing detail leaves list unchanged");

    for(const m of meta){
      // The matching row is in the first loaded page except the final statuses.
      const target=page.getByRole("article").filter({has:page.getByRole("heading",{name:"UXQA Campaign "+m.status,exact:true})});
      if(await target.count()===0){
        await page.getByRole("button",{name:"โหลดเพิ่มเติม",exact:true}).click();
      }
      const row=page.getByRole("article").filter({has:page.getByRole("heading",{name:"UXQA Campaign "+m.status,exact:true})});
      await row.getByRole("link",{name:m.status==="DRAFT"?"ดูและแก้ไข":"ดูรายละเอียด"}).click();
      const scope=page.locator('[aria-labelledby="campaign-detail-title"]');
      await expect(scope).toBeVisible();
      const trigger=scope.getByRole("button",{name:m.button,exact:true});
      await trigger.click();
      const dialog=page.getByRole("dialog",{name:m.dialog});
      await expect(dialog).toBeVisible();
      await record(page,m.id,"dialog-open-"+m.status,"Correct lifecycle confirmation for current status");
      await dialog.getByRole("button",{name:"ยกเลิก",exact:true}).click();
      await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
      await record(page,m.id,"dialog-cancel-"+m.status,"Cancel restores focus and never sends transition POST");
      page.once("dialog", dialog => dialog.accept());
    await page.getByRole("link",{name:/กลับไปรายการแคมเปญ/}).click();
    }
    await page.close();
  }finally{await ctx.close();}
  expect(actualWrites).toBe(0);expect(detailGets).toBeGreaterThanOrEqual(7);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Exhaustive states unverified: "+a.statesToTest.join(", "),
  }));
  for(const x of evidence)entries.push({actionId:x.id,role:"organizationAdmin",state:x.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[x.image],notes:x.details+"; synthetic GET only, zero Backend writes"});
  await writeActionLedger(runId,entries);
  await writeFile(join(dir,"campaign-action-states.json"),JSON.stringify({
    states:evidence,distinctIds:[...new Set(evidence.map(x=>x.id))],actualWrites,filteredGets,detailGets,getQueries,
    limitation:"No real POST, PATCH, lifecycle status transition or persisted Campaign. Only state-scoped read-only and cancelled dialogs.",
  },null,2)+"\n");
});


test("Compact campaign management list groups loaded statuses, keeps API status filtering and fits mobile", async ({ browser, request }) => {
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  let campaignReads = 0;
  const campaignsInStore = [
    { ...draft, campaignId: "compact-1", name: "Compact Draft", status: "DRAFT" },
    { ...draft, campaignId: "compact-2", name: "Compact Open", status: "OPEN",
      openAt: "2026-10-24T02:00:00.000Z", closeAt: "2026-10-31T02:00:00.000Z" },
    { ...draft, campaignId: "compact-3", name: "Compact Cancelled", status: "CANCELLED" },
  ];
  await ctx.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    const ok = (data: unknown) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }),
    });
    if (req.method() === "GET" && url.pathname === stores + "/" + storeA.storeId) return ok(storeA);
    if (req.method() === "GET" && url.pathname === campaigns) {
      campaignReads++;
      const status = url.searchParams.get("status");
      return ok({ items: campaignsInStore.filter(item => !status || item.status === status), nextCursor: null });
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  try {
    await page.goto(frontend + "/org/stores/view/?organizationId=" + ids.organizationId +
      "&storeId=" + storeA.storeId + "&tab=campaigns");
    await expect(page.getByRole("heading", { name: "แคมเปญ", exact: true, level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "รายการแคมเปญ" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ทั้งหมด 3" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "สิ้นสุด 1" })).toBeVisible();
    const readCount = campaignReads;
    await page.getByRole("button", { name: "สิ้นสุด 1" }).click();
    await expect(page.getByRole("heading", { name: "Compact Cancelled" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compact Open" })).toHaveCount(0);
    expect(campaignReads).toBe(readCount);
    await page.getByRole("button", { name: "ทั้งหมด 3" }).click();
    await expect(page.getByRole("heading", { name: "Compact Open" })).toBeVisible();
    const row = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Compact Open" }),
    });
    await expect(row.getByText(/ต.ค./)).toBeVisible();
    await expect(row.getByText("ขั้นตอนถัดไป")).toHaveCount(0);
    const search = page.locator("#campaigns-directory-search");
    await search.fill("no-matching-campaign");
    await expect(page.getByText("ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง")).toBeVisible();
    await page.getByRole("button", { name: "ล้างคำค้นหา" }).click();
    await page.locator("#campaign-status-filter").selectOption("OPEN");
    await expect(page.getByRole("heading", { name: "Compact Open" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compact Draft" })).toHaveCount(0);
    await page.getByRole("button", { name: "แสดงทั้งหมด" }).click();
    await expect(page.getByRole("heading", { name: "Compact Draft" })).toBeVisible();

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)),
        "horizontal overflow at " + width).toBeLessThanOrEqual(2);
      await expect(page.getByRole("button", { name: "+ สร้างแคมเปญ" })).toBeVisible();
    }
    await page.getByRole("button", { name: "+ สร้างแคมเปญ" }).click();
    const modal = page.getByRole("dialog", { name: "สร้างแคมเปญ" });
    await expect(modal.getByText("วันเวลาเป็นข้อมูลวางแผน")).toBeVisible();
    await modal.getByText("วันเวลาเป็นข้อมูลวางแผน").click();
    await expect(modal.getByText(/ไม่ทำให้สถานะแคมเปญเปลี่ยนอัตโนมัติ/)).toBeVisible();
    expect(campaignReads).toBeGreaterThan(readCount);
  } finally {
    await ctx.close();
  }
});
