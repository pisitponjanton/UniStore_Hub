import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`customer shop discovery keeps workspace navigation and filters: ${theme} ${width}px`, async ({ browser, request }) => {
      test.setTimeout(70_000);
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
        await route.continue();
      });
      const page = await context.newPage();
      const useCustomerLink = async (label: string) => {
        if (width <= 900) {
          await page.getByRole("button", { name: "เปิดเมนูหลัก" }).click();
        }
        await page.getByRole("navigation", { name: "เมนูหลัก" })
          .getByRole("link", { name: label }).click();
      };
      try {
        await page.goto(frontend + "/my/orders/", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("navigation", { name: "เปลี่ยนพื้นที่ใช้งาน" }))
          .toBeVisible({ timeout: 20_000 });
        await useCustomerLink("ร้านค้า");
        await expect(page).toHaveURL(/\/shops\/?$/);
        await expect(page.getByRole("heading", { name: "เลือกร้านค้า", level: 1 }))
          .toBeVisible();
        await expect(page.locator('[class*="loadingArea"]')).toHaveCount(0, { timeout: 15_000 });
        const screenshots = join("quality-audit", ".evidence", "customer-shop-navigation");
        await mkdir(screenshots, { recursive: true });
        await page.screenshot({
          path: join(screenshots, `shops-${theme}-${width}.png`),
          animations: "disabled",
        });
        await expect(page.getByText("เริ่มใช้งานใน 3 ขั้นตอน")).toHaveCount(0);
        if (width <= 900) {
          await expect(page.getByRole("button", { name: "เปิดเมนูหลัก" })).toBeVisible();
        } else {
          await expect(page.getByRole("navigation", { name: "เมนูหลัก" })).toBeVisible();
        }

        const search = page.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" });
        await search.fill("ร้านตัวอย่าง");
        await page.getByLabel("แสดงรายการ").selectOption("with-stores");
        await useCustomerLink("คำสั่งซื้อของฉัน");
        await expect(page).toHaveURL(/\/my\/orders\/?$/);
        await useCustomerLink("ร้านค้า");
        await expect(search).toHaveValue("ร้านตัวอย่าง");
        await expect(page.getByLabel("แสดงรายการ")).toHaveValue("with-stores");

        for (const responsiveWidth of [320, 390, 768, 1440, 3840]) {
          await page.setViewportSize({ width: responsiveWidth, height: 900 });
          const overflow = await page.evaluate(() =>
            Math.max(0, document.documentElement.scrollWidth - innerWidth));
          expect(overflow, `${theme} ${responsiveWidth}px`).toBeLessThanOrEqual(1);
        }
        expect(mutations).toBe(0);
      } finally {
        await context.close();
      }
    });
  }
}

test("customer returns from a store detail to /shops with previous filters", async ({ browser, request }) => {
  test.setTimeout(70_000);
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await establishSeedRoleSession(context, request, "customer");
  const page = await context.newPage();
  try {
    await page.goto(frontend + "/shops/", { waitUntil: "domcontentloaded" });
    const toggle = page.getByRole("button", { name: "แสดงข้อมูล E2E/QA" });
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await toggle.click();
    const cards = page.locator('a[class*="storeCard"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const query = (await cards.first().locator("h3").innerText()).trim().slice(0, 6);
    await page.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" }).fill(query);
    await expect(cards.first()).toBeVisible();
    await cards.first().click();
    await expect(page).toHaveURL(/\/stores\/view\/?\?/);
    await page.getByRole("link", { name: "ร้านค้าทั้งหมด" }).click();
    await expect(page).toHaveURL(/\/shops\/?$/);
    await expect(page.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" }))
      .toHaveValue(query);
    await expect(page.getByRole("button", { name: "ซ่อนข้อมูล E2E/QA" }))
      .toBeVisible();
  } finally {
    await context.close();
  }
});

test("anonymous user cannot browse customer-only /shops directory", async ({ page }) => {
  const { frontend } = localAuditTargets();
  await page.goto(frontend + "/shops/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "เลือกร้านค้า", level: 1 }))
    .toHaveCount(0);
  await expect(page.getByRole("link", { name: /เข้าสู่ระบบ/ })).toBeVisible();
});
