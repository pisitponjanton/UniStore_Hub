import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

test("all four My Orders status filters visible and reachable at narrow widths", async ({ browser, request }) => {
  test.setTimeout(65_000);
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
  await establishSeedRoleSession(ctx, request, "customer");
  let writes = 0;
  await ctx.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes++; await route.abort("blockedbyclient");
    } else await route.continue();
  });
  const results: Array<Record<string, unknown>> = [];
  const dir = join("test-results", "quality-audit", "uxqa-" + randomUUID(), "phase6-filters");
  await mkdir(dir, { recursive: true });
  try {
    const page = await ctx.newPage();
    await page.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
    const group = page.getByRole("group", { name: "กรองคำสั่งซื้อที่โหลดแล้ว" });
    await expect(group).toBeVisible({ timeout: 18000 });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const buttons = group.getByRole("button");
      await expect(buttons).toHaveCount(4);
      const boxes = await buttons.evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect();
        return { name: node.textContent?.trim(), left: r.left, right: r.right };
      }));
      for (const b of boxes) {
        expect(b.left, b.name).toBeGreaterThanOrEqual(-1);
        expect(b.right, b.name).toBeLessThanOrEqual(width+1);
      }
      await buttons.nth(3).click();
      await expect(buttons.nth(3)).toHaveAttribute("aria-pressed", "true");
      await buttons.nth(0).click();
      await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "true");
      results.push({ width, buttons: boxes, outcome: "PASS" });
      await page.screenshot({ path: join(dir, "my-orders-"+width+".png"), animations: "disabled" });
    }
    await page.close();
    expect(writes).toBe(0);
  } finally { await ctx.close(); }
  await writeFile(join(dir,"filter-tabs.json"),JSON.stringify({results},null,2)+"\n");
});
