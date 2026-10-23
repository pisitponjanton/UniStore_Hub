import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`storefront header has one workspace shortcut when signed in: ${theme} ${width}`, async ({ browser, request }) => {
      const { frontend } = localAuditTargets();
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      await establishSeedRoleSession(context, request, "customer");
      let mutations = 0;
      await context.route("**/*", async route => {
        if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
          mutations++;
          await route.abort("blockedbyclient");
          return;
        }
        return route.continue();
      });
      const page = await context.newPage();
      try {
        await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
        const nav = page.getByRole("navigation", { name: "เมนูหน้าร้าน" });
        const workspace = nav.getByRole("link", { name: "พื้นที่ของฉัน" });
        await expect(workspace).toBeVisible({ timeout: 20_000 });
        await expect(workspace).toHaveAttribute("href", "/shops/");
        await expect(nav.getByRole("link")).toHaveCount(1);
        await expect(nav.getByRole("link", { name: "คำสั่งซื้อของฉัน" })).toHaveCount(0);
        await expect(nav.getByRole("link", { name: "การแจ้งเตือน" })).toHaveCount(0);
        await expect(nav.getByRole("link", { name: "ร้านค้า" })).toHaveCount(0);
        const screenshots = join("quality-audit", ".evidence", "storefront-header-shortcut");
        await mkdir(screenshots, { recursive: true });
        await page.screenshot({
          path: join(screenshots, `customer-${theme}-${width}.png`),
          animations: "disabled",
        });
        await workspace.click();
        await expect(page).toHaveURL(/\/shops\/?$/);
        await expect(page.getByRole("heading", { name: "เลือกร้านค้า", level: 1 })).toBeVisible();

        for (const viewportWidth of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width: viewportWidth, height: 900 });
          const overflow = await page.evaluate(() =>
            Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
          );
          expect(overflow, `viewport ${viewportWidth}`).toBeLessThanOrEqual(1);
        }
        expect(mutations).toBe(0);
      } finally {
        await context.close();
      }
    });

    test(`guest header only offers account entry: ${theme} ${width}`, async ({ browser }) => {
      const { frontend } = localAuditTargets();
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      try {
        await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
        const nav = page.getByRole("navigation", { name: "เมนูหน้าร้าน" });
        await expect(nav.getByRole("link", { name: "เข้าสู่ระบบ" })).toBeVisible();
        await expect(nav.getByRole("link", { name: "สมัครสมาชิก" })).toBeVisible();
        await expect(nav.getByRole("link")).toHaveCount(2);
        await expect(nav.getByRole("link", { name: "พื้นที่ของฉัน" })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "UniStore Hub หน้าร้าน" })).toHaveAttribute("href", "/");
        const screenshots = join("quality-audit", ".evidence", "storefront-header-shortcut");
        await mkdir(screenshots, { recursive: true });
        await page.screenshot({
          path: join(screenshots, `guest-${theme}-${width}.png`),
          animations: "disabled",
        });
      } finally {
        await context.close();
      }
    });
  }
}
