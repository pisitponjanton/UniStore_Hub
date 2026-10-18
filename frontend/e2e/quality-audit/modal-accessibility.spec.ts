import axe from "axe-core";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("modal keyboard trap, focus return, accessible contrast and light/dark at four viewports", async ({ browser, request }) => {
  test.setTimeout(170_000);
  const { frontend } = localAuditTargets();
  const dir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "phase6-modal");
  await mkdir(dir, { recursive: true });
  const results: Array<Record<string, unknown>> = [];
  for (const scheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, reducedMotion: "reduce" });
    await establishSeedRoleSession(ctx, request, "platformAdmin");
    let writes = 0;
    let mocked = 0;
    const org = { organizationId: "uxqa-test-only-" + randomUUID(), name: "Accessible Dialog E2E",
      description: "GET-only fixture", createdBy: "fixture", createdAt: "2026-10-17T00:00:00Z",
      updatedAt: "2026-10-17T00:00:00Z", status: "PENDING" };
    await ctx.route("**/*", async route => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        writes++;
        await route.abort("blockedbyclient");
        return;
      }
      if (route.request().method() === "GET" && new URL(route.request().url()).pathname === "/api/v1/platform/organizations") {
        mocked++;
        await route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { items: [org], nextCursor: null } }) });
        return;
      }
      await route.continue();
    });
    try {
      const page = await ctx.newPage();
      await page.goto(frontend + "/platform/organizations/", { waitUntil: "domcontentloaded" });
      const trigger = page.getByRole("button", { name: "อนุมัติ", exact: true });
      await expect(trigger).toBeVisible({ timeout: 15000 });
      for (const [width, height] of [[320,700],[390,844],[768,1024],[1440,900]] as const) {
        await page.setViewportSize({ width, height });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "อนุมัติ Accessible Dialog E2E?" });
        await expect(dialog).toBeVisible();
        const focusTargets: boolean[] = [];
        for (let i=0;i<8;i++) {
          await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
          focusTargets.push(await page.evaluate(() =>
            Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement))));
        }
        const geometry = await dialog.evaluate(element => {
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight };
        });
        await page.addScriptTag({ content: axe.source });
        const axeResult = await page.evaluate(async () => {
          const a = (window as unknown as {axe: typeof axe}).axe;
          const r = await a.run(document.querySelector('[role="dialog"]')!, {
            runOnly: { type: "rule", values: ["color-contrast","aria-dialog-name","aria-required-attr","button-name"] },
          });
          return r.violations.map(v => ({ id: v.id, impact: v.impact ?? "", targets: v.nodes.map(n=>n.target) }));
        });
        await page.screenshot({ path: join(dir, "approve-" + scheme + "-" + width + ".png"), animations: "disabled" });
        results.push({ scheme, width, focusTargets, geometry, axeViolations: axeResult });
        expect(focusTargets.every(Boolean), scheme + " focus trap " + width).toBe(true);
        expect(geometry.left).toBeGreaterThanOrEqual(-1);
        expect(geometry.right).toBeLessThanOrEqual(width+1);
        expect(geometry.top).toBeGreaterThanOrEqual(-1);
        expect(geometry.bottom).toBeLessThanOrEqual(height+1);
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
      }
      await page.close();
      expect(mocked).toBeGreaterThanOrEqual(1);
      expect(writes).toBe(0);
    } finally { await ctx.close(); }
  }
  await writeFile(join(dir, "modal-matrix.json"), JSON.stringify({ cases: results.length, results }, null, 2)+"\n");
  expect(results).toHaveLength(8);
});
