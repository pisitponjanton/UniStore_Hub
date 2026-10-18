import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const orgId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const emptyOrgId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const stores=Array.from({length:16},(_,i)=>({
  storeId:"66666666-6666-4666-8666-"+String(i+1).padStart(12,"0"),
  organizationId:orgId,name:i===15?"Last Campus Bakery":"Campus Shop "+String(i+1),
  description:"Test-only public directory",status:"ACTIVE",
}));
const directory=[
  {organization:{organizationId:orgId,name:"Campus Student Union",description:"Test-only storefront",status:"ACTIVE"},stores},
  {organization:{organizationId:emptyOrgId,name:"Campus Empty Organization",description:"No active stores",status:"ACTIVE"},stores:[]},
];
test("Storefront hero links, search, pagination, filters and 503 retry use read-only fixtures",async({browser})=>{
  test.setTimeout(165_000);
  const {frontend}=localAuditTargets();
  const runId="uxqa-"+randomUUID(), out=join("test-results","quality-audit",runId);
  await mkdir(out,{recursive:true});
  const outcomes:Array<{id:string;state:string;note:string;evidence:string}>=[];
  let writes=0,getDirectory=0,failDirectory=false;
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await ctx.route("**/*",async route=>{
    const req=route.request(), url=new URL(req.url());
    if(!["GET","HEAD","OPTIONS"].includes(req.method())) {
      writes++;await route.abort("blockedbyclient");return;
    }
    if(req.method()==="GET"&&url.pathname==="/api/v1/storefront/directory"){
      getDirectory++;
      if(failDirectory){await route.fulfill({status:503,contentType:"application/json",
        body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic storefront outage"}})});return;}
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({success:true,data:directory})});return;
    }
    await route.continue();
  });
  async function pass(page:Page,id:string,state:string,note:string) {
    const evidence=id+"-"+state+".png";
    await page.screenshot({path:join(out,evidence),animations:"disabled"});
    outcomes.push({id,state,note,evidence});
  }
  try {
    const page=await ctx.newPage();
    await page.goto(frontend+"/",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"ร้านที่เปิดให้เข้าชม",level:2})).toBeVisible({timeout:18000});
    await page.getByRole("link",{name:"ดูร้านที่เปิดอยู่"}).click();
    await expect(page).toHaveURL(/#storefront-heading$/);
    await pass(page,"FE-UX-01-01","loaded-hero-jump","Hero link navigates to the store-list anchor");

    await page.getByRole("link",{name:"ติดตามคำสั่งซื้อ"}).click();
    await expect(page).toHaveURL(/\/login\/\?returnTo=%2Fmy%2Forders%2F/);
    await pass(page,"FE-UX-01-02","guest-track-orders","Guest tracking CTA preserves return-to-orders context");
    await page.goto(frontend+"/",{waitUntil:"domcontentloaded"});
    await expect(page.getByRole("heading",{name:"เลือกร้านจากพื้นที่ที่เปิดอยู่",level:2})).toBeVisible();
    await page.getByRole("link",{name:"ดูทุกร้าน"}).click();
    await expect(page).toHaveURL(/#storefront-heading$/);
    await pass(page,"FE-UX-01-03","discovery-jump","Discovery jumps to complete catalog");

    await page.locator('a[class*="discoveryCard"]').first().click();
    await expect(page).toHaveURL(/\/stores\/view\/\?organizationId=.*&storeId=.*/);
    await pass(page,"FE-UX-01-04","discovery-store-navigation","Discovery card navigates to scoped store route");
    await page.goto(frontend+"/",{waitUntil:"domcontentloaded"});
    await page.locator('a[class*="storeRow"]').first().click();
    await expect(page).toHaveURL(/\/stores\/view\/\?organizationId=.*&storeId=.*/);
    await pass(page,"FE-UX-01-05","catalog-store-navigation","Catalog row navigates to scoped store route");

    await page.goto(frontend+"/",{waitUntil:"domcontentloaded"});
    const search=page.locator("#storefront-search");
    await expect(search).toBeVisible();
    await page.getByRole("navigation",{name:"การแบ่งหน้ารายการร้านค้า"}).getByRole("button",{name:"ถัดไป"}).click();
    await expect(page.getByText("หน้า 2 จาก 2")).toBeVisible();
    await expect(page.getByRole("heading",{name:"Last Campus Bakery"})).toBeVisible();
    await pass(page,"FE-UX-01-05","catalog-pagination","Second catalog page shows a store beyond first twelve");
    await search.fill("last campus bakery");
    await expect(page.getByRole("heading",{name:"Last Campus Bakery"})).toBeVisible();
    await expect(page.getByText(/พบ 1 ร้าน/)).toBeVisible();
    await pass(page,"FE-UX-01-05","search-all-pages","Local search finds store beyond initial visible page");
    await page.locator("#storefront-filter").selectOption("without-stores");
    await expect(page.getByText("ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา")).toBeVisible();
    await page.getByRole("button",{name:"แสดงรายการทั้งหมด"}).click();
    await expect(search).toHaveValue("");
    await expect(page.locator("#storefront-filter")).toHaveValue("all");
    await pass(page,"FE-UX-01-05","no-match-reset","Empty search state has working clear action");

    failDirectory=true;
    await page.reload({waitUntil:"domcontentloaded"});
    await expect(page.getByText("ไม่สามารถโหลดร้านค้าได้")).toBeVisible({timeout:16000});
    failDirectory=false;
    await page.getByRole("button",{name:"ลองโหลดอีกครั้ง"}).click();
    await expect(page.getByRole("heading",{name:"Campus Shop 1",exact:true}).first()).toBeVisible();
    await expect(page.getByText("ไม่สามารถโหลดร้านค้าได้")).toHaveCount(0);
    await pass(page,"FE-UX-01-06","503-retry-loaded","Public GET 503 recovers after Retry");
    await page.close();
  }finally{await ctx.close();}
  expect(writes).toBe(0);
  const manifest=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const ledger:ActionOutcome[]=[...manifest.actions,...manifest.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full states not tested: "+a.statesToTest.join(", "),
  }));
  for(const o of outcomes) ledger.push({actionId:o.id,role:"guest",state:o.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[o.evidence],notes:o.note+"; synthetic read-only storefront"});
  await writeActionLedger(runId,ledger);
  await writeFile(join(out,"storefront-safe-actions.json"),JSON.stringify({
    count:outcomes.length,distinctIds:[...new Set(outcomes.map(x=>x.id))],getDirectory,writes,outcomes,
  },null,2)+"\n");
});