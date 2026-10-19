import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import {
  establishSeedRoleSession,
  LOCAL_SEED_ENTITY_IDS as ids,
  type SeedRole,
} from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

const cases: {
  role: SeedRole;
  path: string;
  current: string;
  options: string[];
}[] = [
  { role: "customer", path: "/my/orders/", current: "ซื้อสินค้า", options: ["ซื้อสินค้า"] },
  { role: "staff", path: `/org/orders/?organizationId=${ids.organizationId}`,
    current: "จัดการหน่วยงาน", options: ["ซื้อสินค้า", "จัดการหน่วยงาน"] },
  { role: "organizationAdmin", path: `/org/dashboard/?organizationId=${ids.organizationId}`,
    current: "จัดการหน่วยงาน", options: ["ซื้อสินค้า", "จัดการหน่วยงาน"] },
  { role: "platformAdmin", path: "/platform/summary/", current: "ดูแลแพลตฟอร์ม",
    options: ["ซื้อสินค้า", "ดูแลแพลตฟอร์ม"] },
];

for (const scenario of cases) {
  test(`Workspace shell identifies authorized ${scenario.role} areas, mobile drawer and focus`, async ({ browser, request }) => {
    test.setTimeout(85_000);
    const { frontend } = localAuditTargets();
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await establishSeedRoleSession(ctx, request, scenario.role);
    let attemptedWrite = 0;
    await ctx.route("**/*", async route => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        attemptedWrite += 1;
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    const page = await ctx.newPage();
    const evidence = join("test-results", "quality-audit", "foundation-" + randomUUID());
    await mkdir(evidence, { recursive: true });
    try {
      await page.goto(frontend + scenario.path, { waitUntil: "domcontentloaded" });
      const workArea = page.getByRole("navigation", { name: "เปลี่ยนพื้นที่ใช้งาน" });
      await expect(workArea).toBeVisible({ timeout: 20000 });
      await expect(workArea.getByRole("link")).toHaveCount(scenario.options.length);
      for (const label of scenario.options) {
        await expect(workArea.getByRole("link", { name: label })).toBeVisible();
      }
      await expect(workArea.getByRole("link", { name: scenario.current })).toHaveAttribute("aria-current", "location");
      const menu = page.getByRole("button", { name: "เปิดเมนูหลัก" });
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(page.getByRole("dialog", { name: "เมนูหลัก" })).toBeVisible();
      await expect(page.getByRole("dialog", { name: "เมนูหลัก" }).getByRole("button", { name: "ปิดเมนูหลัก" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "เมนูหลัก" })).not.toBeVisible();
      await expect(menu).toBeFocused();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(workArea).toBeVisible();
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(overflow, `${scenario.role} at ${width}px`).toBeLessThanOrEqual(1);
        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: join(evidence, `${scenario.role}-shell-${width}.png`),
            animations: "disabled",
          });
        }
      }
      expect(attemptedWrite).toBe(0);
    } finally {
      await ctx.close();
    }
  });
}
