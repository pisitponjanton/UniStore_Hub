import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

type Scenario = "409-stale" | "500-error" | "pending-success";
const scenarios: Scenario[] = ["409-stale", "500-error", "pending-success"];
test("synthetic Platform approval 409, 500, pending and success in browser with intercepted writes", async ({ browser, request }) => {
  test.setTimeout(155_000);
  const { frontend } = localAuditTargets();
  const runId = "uxqa-" + randomUUID();
  const out = join("test-results", "quality-audit", runId, "transition");
  await mkdir(out, { recursive: true });
  const rows: Array<Record<string, unknown>> = [];
  for (const scenario of scenarios) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await establishSeedRoleSession(ctx, request, "platformAdmin");
    const syntheticId = randomUUID();
    const synthetic = {
      organizationId: syntheticId,
      name: "UXQA Approval " + scenario,
      description: "Browser-only synthetic network response; never stored in backend",
      status: "PENDING",
      createdBy: "uxqa-synthetic",
      createdAt: "2026-10-17T00:00:00.000Z",
      updatedAt: "2026-10-17T00:00:00.000Z",
    };
    let listReads = 0;
    let conflictReturned = false;
    let interceptedConfirm = 0;
    let unauthorizedWrite = 0;
    const pendingGate: { release?: () => void } = {};
    const listPath = "/api/v1/platform/organizations";
    const approvePath = listPath + "/" + syntheticId + "/approve";
    await ctx.route("**/*", async route => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (req.method() === "GET" && path === listPath) {
        listReads++;
        const org = scenario === "409-stale" && conflictReturned
          ? { ...synthetic, status: "ACTIVE" }
          : synthetic;
        await route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { items: [org], nextCursor: null } }) });
        return;
      }
      if (req.method() === "POST" && path === approvePath) {
        // Only this request, to a fresh random UUID supplied solely by this test,
        // is allowed to reach an in-browser mock. It MUST NOT reach the backend.
        interceptedConfirm++;
        if (scenario === "pending-success") {
          await new Promise<void>(resolve => { pendingGate.release = resolve; });
        }
        if (scenario === "409-stale") {
          conflictReturned = true;
          await route.fulfill({ status: 409, contentType: "application/json",
            body: JSON.stringify({ success: false, error: {
              code: "INVALID_STATUS_TRANSITION", message: "Synthetic stale transition",
            } }) });
        } else if (scenario === "500-error") {
          await route.fulfill({ status: 500, contentType: "application/json",
            body: JSON.stringify({ success: false, error: {
              code: "INTERNAL_ERROR", message: "Synthetic temporary backend failure",
            } }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json",
            body: JSON.stringify({ success: true, data: { ...synthetic, status: "ACTIVE" } }) });
        }
        return;
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
        unauthorizedWrite++;
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    try {
      const page = await ctx.newPage();
      await page.goto(frontend + "/platform/organizations/", { waitUntil: "domcontentloaded" });
      const row = page.getByRole("article", { name: /UXQA Approval/ });
      await expect(row).toBeVisible({ timeout: 16000 });
      const trigger = row.getByRole("button", { name: "อนุมัติ", exact: true });
      await trigger.click();
      const dlg = page.getByRole("dialog", { name: "อนุมัติ " + synthetic.name + "?" });
      await expect(dlg).toBeVisible();
      await dlg.getByRole("button", { name: "ยืนยันอนุมัติ" }).click();
      if (scenario === "pending-success") {
        const pending = dlg.getByRole("button", { name: "กำลังดำเนินการ" });
        await expect(pending).toBeDisabled();
        await expect(dlg.getByRole("button", { name: "ยกเลิก" })).toBeDisabled();
        await page.keyboard.press("Escape");
        await expect(dlg).toBeVisible();
        await page.screenshot({ path: join(out, scenario + "-pending-390.png"), animations: "disabled" });
        expect(pendingGate.release).toBeDefined();
        pendingGate.release?.();
        await expect(page.getByText("อนุมัติหน่วยงาน " + synthetic.name + " เรียบร้อยแล้ว")).toBeVisible();
        await expect(row.getByRole("button", { name: "อนุมัติ" })).toHaveCount(0);
      } else if (scenario === "409-stale") {
        await expect(page.getByText(/สถานะหน่วยงานเปลี่ยนไปแล้ว/)).toBeVisible();
        await expect.poll(() => listReads).toBeGreaterThan(1);
        await expect(row.getByRole("button", { name: "อนุมัติ" })).toHaveCount(0);
      } else {
        await expect(page.getByText("เปลี่ยนสถานะไม่สำเร็จ")).toBeVisible();
        await expect(row.getByRole("button", { name: "อนุมัติ", exact: true })).toBeVisible();
      }
      const feedback = page.locator("#platform-action-feedback");
      await expect(feedback).toBeVisible();
      await expect(feedback).toBeFocused({ timeout: 5000 });
      await expect.poll(() => feedback.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 0;
      })).toBe(true);
      await page.screenshot({ path: join(out, scenario + "-result-390.png"), animations: "disabled" });
      expect(interceptedConfirm, scenario).toBe(1);
      expect(unauthorizedWrite, scenario).toBe(0);
      rows.push({ scenario, interceptedConfirm, unauthorizedWrite, listReads, status: "PASS",
        assertion: scenario === "409-stale" ? "conflict alert plus list refresh" :
          scenario === "500-error" ? "recoverable error and enabled retry action" :
            "disabled confirmation and cancel while pending, Escape guarded, success transition" });
      await page.close();
    } finally {
      pendingGate.release?.();
      await ctx.close();
    }
  }
  await writeFile(join(out, "transition-matrix.json"), JSON.stringify({
    scope: "Synthetic UUID; all POST requests fulfilled by Playwright only; zero backend writes",
    scenarios: rows,
  }, null, 2) + "\n");
  expect(rows).toHaveLength(3);
  const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as {
    actions: Array<{ id: string; roles: string[]; statesToTest: string[] }>;
    shellActions: Array<{ id: string; roles: string[]; statesToTest: string[] }>;
  };
  const untested: ActionOutcome[] = [...baseline.actions, ...baseline.shellActions].map(a => ({
    actionId: a.id, role: a.roles[0]!, state: "all-declared-states",
    viewport: "not-executed", status: "NOT_TESTED", testRunId: runId,
    evidence: [], notes: "Not exhaustively verified: " + a.statesToTest.join(", "),
  }));
  const stateProof: ActionOutcome[] = scenarios.map(scenario => ({
    actionId: "FE-UX-27-01", role: "platformAdmin",
    state: scenario, viewport: "390x844", status: "PASS", testRunId: runId,
    evidence: ["transition/" + scenario + "-result-390.png"],
    notes: "Synthetic organization only; intercepted POST never reached backend; verified " + rows.find(row => row.scenario === scenario)?.assertion,
  }));
  await writeActionLedger(runId, [...untested, ...stateProof]);
});
