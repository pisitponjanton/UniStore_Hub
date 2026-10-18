import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

type BaselineAction = { id: string; roles: string[]; action: string; statesToTest: string[] };
test("honest 257-action outcome ledger with exact evidence only for exercised safe controls", async ({ browser }) => {
  test.setTimeout(70_000);
  const { frontend } = localAuditTargets();
  const runId = "uxqa-" + randomUUID();
  const evidenceDir = join("test-results", "quality-audit", runId);
  await mkdir(evidenceDir, { recursive: true });
  const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as {
    actions: BaselineAction[]; shellActions: BaselineAction[];
  };
  const actions = [...baseline.actions, ...baseline.shellActions];
  expect(actions).toHaveLength(257);
  const records: ActionOutcome[] = actions.map(action => ({
    actionId: action.id, role: action.roles[0]!, state: "all-declared-states",
    viewport: "not-executed", status: "NOT_TESTED", testRunId: runId,
    evidence: [],
    notes: "Not yet individually exercised across states: " + action.statesToTest.join(", ") + "; a responsive route visit is not action proof.",
  }));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let attemptedWrites = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      attemptedWrites++; await route.abort("blockedbyclient");
    } else await route.continue();
  });
  try {
    const page = await ctx.newPage();
    for (const info of [
      {path:"/login/",id:"FE-UX-02-03",label:"login",input:"#login-password"},
      {path:"/register/",id:"FE-UX-03-04",label:"register",input:"#register-password"},
    ]) {
      await page.goto(frontend + info.path, {waitUntil:"domcontentloaded"});
      const input = page.locator(info.input);
      const button = page.getByRole("button", { name:"แสดงรหัสผ่าน" });
      await expect(input).toHaveAttribute("type","password");
      await button.click();
      await expect(input).toHaveAttribute("type","text");
      await expect(page.getByRole("button",{name:"ซ่อนรหัสผ่าน"})).toHaveAttribute("aria-pressed","true");
      const file = info.label + "-password-visible-390.png";
      await page.screenshot({path:join(evidenceDir,file),animations:"disabled"});
      await page.getByRole("button",{name:"ซ่อนรหัสผ่าน"}).click();
      await expect(input).toHaveAttribute("type","password");
      records.push({
        actionId: info.id, role:"guest", state:"loaded-toggle", viewport:"390x844",
        status:"PASS", testRunId:runId, evidence:[file],
        notes:"Show toggles input type=password→text; hide restores password; aria-pressed reflects visibility. No auth submit.",
      });
    }
    await page.close();
    expect(attemptedWrites).toBe(0);
  } finally { await ctx.close(); }
  await writeActionLedger(runId, records);
  expect(records).toHaveLength(259);
});
