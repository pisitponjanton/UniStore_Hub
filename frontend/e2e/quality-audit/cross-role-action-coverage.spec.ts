import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

type Role = "guest" | "customer" | "staff" | "organizationAdmin" | "platformAdmin";
type BaselineAction = { id: string; roles: string[]; statesToTest: string[] };
test("state-scoped safe action probes against real local UI with auditable ledger", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { frontend } = localAuditTargets();
  const runId = "uxqa-" + randomUUID();
  const out = join("test-results", "quality-audit", runId);
  await mkdir(out, { recursive: true });
  const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as {
    actions: BaselineAction[]; shellActions: BaselineAction[];
  };
  const all = [...baseline.actions, ...baseline.shellActions];
  expect(all).toHaveLength(257);
  const results: ActionOutcome[] = all.map(x => ({
    actionId: x.id, role: x.roles[0]!, state: "all-declared-states", viewport: "not-executed",
    status: "NOT_TESTED", testRunId: runId, evidence: [],
    notes: "Complete action/state coverage not executed: " + x.statesToTest.join(", "),
  }));
  const observations: Array<{ id:string; role:Role; asserted:string; evidence:string }> = [];
  const prove = async (page:Page, id:string, role:Role, asserted:string) => {
    const file = "proof-" + id + "-" + role + ".png";
    await page.screenshot({ path: join(out, file), animations: "disabled" });
    results.push({ actionId:id, role, state:"loaded-specific-action", viewport:"390x844",
      status:"PASS", testRunId:runId, evidence:[file],
      notes:asserted + ". Narrow result only: other declared action states still NOT_TESTED." });
    observations.push({id,role,asserted,evidence:file});
  };
  let actualWrites = 0;
  const guest = await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await guest.route("**/*", async route => {
    if (!["GET","HEAD","OPTIONS"].includes(route.request().method())) {
      actualWrites++; await route.abort("blockedbyclient");
    } else await route.continue();
  });
  try {
    const page=await guest.newPage();
    await page.goto(frontend+"/login/",{waitUntil:"domcontentloaded"});
    const e=page.locator("#login-email"), p=page.locator("#login-password");
    await e.fill("test-local@example.com");
    await expect(e).toHaveValue("test-local@example.com");
    await prove(page,"FE-UX-02-01","guest","Typed email remains in controlled login input");
    await p.fill("fixture-only-not-submitted");
    await expect(p).toHaveValue("fixture-only-not-submitted");
    await prove(page,"FE-UX-02-02","guest","Typed password remains in login input; submit not attempted");
    await page.getByRole("button",{name:"แสดงรหัสผ่าน"}).click();
    await expect(p).toHaveAttribute("type","text");
    await expect(page.getByRole("button",{name:"ซ่อนรหัสผ่าน"})).toHaveAttribute("aria-pressed","true");
    await page.getByRole("button",{name:"ซ่อนรหัสผ่าน"}).click();
    await expect(p).toHaveAttribute("type","password");
    await prove(page,"FE-UX-02-03","guest","Show/hide password toggles type and aria-pressed twice");
    await page.getByRole("link",{name:"สมัครสมาชิก"}).click();
    await expect(page).toHaveURL(/\/register\/?/);
    await prove(page,"FE-UX-02-05","guest","Register link navigated to /register/");

    for(const field of [
      {selector:"#register-name",text:"Student E2E Only",action:"FE-UX-03-01"},
      {selector:"#register-email",text:"test-local@example.com",action:"FE-UX-03-02"},
      {selector:"#register-password",text:"fixture-only-not-submitted",action:"FE-UX-03-03"},
    ]){
      const f=page.locator(field.selector);
      await f.fill(field.text);
      await expect(f).toHaveValue(field.text);
      await prove(page,field.action,"guest","Typed value remains in controlled registration input "+field.selector);
    }
    await page.getByRole("button",{name:"แสดงรหัสผ่าน"}).click();
    await expect(page.locator("#register-password")).toHaveAttribute("type","text");
    await page.getByRole("button",{name:"ซ่อนรหัสผ่าน"}).click();
    await expect(page.locator("#register-password")).toHaveAttribute("type","password");
    await prove(page,"FE-UX-03-04","guest","Register password visibility toggles both directions");
    await page.getByRole("link",{name:"เข้าสู่ระบบ"}).click();
    await expect(page).toHaveURL(/\/login\/?/);
    await prove(page,"FE-UX-03-06","guest","Registration login link returns to /login/");
    await page.getByRole("link",{name:"กลับหน้าร้านค้า"}).click();
    await expect(page).toHaveURL(frontend+"/");
    await prove(page,"FE-UX-02-06","guest","Login back link returned to storefront");
    await page.goto(frontend+"/register/",{waitUntil:"domcontentloaded"});
    await page.getByRole("link",{name:"กลับหน้าร้านค้า"}).click();
    await expect(page).toHaveURL(frontend+"/");
    await prove(page,"FE-UX-03-07","guest","Registration back link returned to storefront");
    await page.close();

    const shellFlows: Array<{role:Exclude<Role,"guest">;url:string;prefix:string}> = [
      {role:"customer",url:"/my/orders/",prefix:"CUSTOMER"},
      {role:"staff",url:"/org/orders/?organizationId="+ids.organizationId,prefix:"STAFF"},
      {role:"organizationAdmin",url:"/org/dashboard/?organizationId="+ids.organizationId,prefix:"ORGANIZATIONADMIN"},
      {role:"platformAdmin",url:"/platform/organizations/",prefix:"PLATFORMADMIN"},
    ];
    for(const flow of shellFlows){
      const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
      await establishSeedRoleSession(ctx,request,flow.role);
      await ctx.route("**/*",async route=>{
        if(!["GET","HEAD","OPTIONS"].includes(route.request().method())) {
          actualWrites++;await route.abort("blockedbyclient");
        }else await route.continue();
      });
      try{
        const tab=await ctx.newPage();
        await tab.goto(frontend+flow.url,{waitUntil:"domcontentloaded"});
        const open=tab.getByRole("button",{name:"เปิดเมนูหลัก"});
        await expect(open).toBeVisible({timeout:15000});
        await open.click();
        const drawer=tab.getByRole("dialog",{name:"เมนูหลัก"});
        await expect(drawer).toBeVisible();
        await prove(tab,"FE-UX-SHELL-"+flow.prefix+"-"+String(flow.prefix==="ORGANIZATIONADMIN"?"16":flow.prefix==="STAFF"?"8":flow.prefix==="CUSTOMER"?"7":"7").padStart(2,"0"),flow.role,"Opened mobile navigation drawer");
        await drawer.getByRole("button",{name:"ปิดเมนูหลัก"}).click();
        await expect(drawer).not.toBeVisible();
        await expect(open).toBeFocused();
        await prove(tab,"FE-UX-SHELL-"+flow.prefix+"-"+String(flow.prefix==="ORGANIZATIONADMIN"?"17":flow.prefix==="STAFF"?"9":flow.prefix==="CUSTOMER"?"8":"8").padStart(2,"0"),flow.role,"Closed mobile drawer with close button and restored focus");
        await open.click();
        await expect(drawer).toBeVisible();
        await tab.keyboard.press("Escape");
        await expect(drawer).not.toBeVisible();
        await expect(open).toBeFocused();
        await prove(tab,"FE-UX-SHELL-"+flow.prefix+"-"+String(flow.prefix==="ORGANIZATIONADMIN"?"18":flow.prefix==="STAFF"?"10":flow.prefix==="CUSTOMER"?"9":"9").padStart(2,"0"),flow.role,"Escape dismissed modal navigation and returned focus to open button");
        await tab.close();
      }finally{await ctx.close();}
    }
  }finally{await guest.close();}
  expect(actualWrites).toBe(0);
  // Per-role action ID uniqueness remains enforced by writeActionLedger.
  await writeActionLedger(runId,results);
  await writeFile(join(out,"safe-interaction-probes.json"),JSON.stringify({
    runId,baselineActions:257,specificPasses:observations.length,actualWrites,observations,
    note:"Each PASS only covers the specific action/state asserted, not a full state-matrix certification",
  },null,2)+"\n");
  expect(observations.length).toBeGreaterThanOrEqual(20);
});
