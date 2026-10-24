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
  { role: "customer", path: "/my/orders/", current: "", options: [] },
  { role: "staff", path: `/org/orders/?organizationId=${ids.organizationId}`,
    current: "หน่วยงานของฉัน", options: ["หน่วยงานของฉัน"] },
  { role: "organizationAdmin", path: `/org/dashboard/?organizationId=${ids.organizationId}`,
    current: "หน่วยงานของฉัน", options: ["หน่วยงานของฉัน"] },
  { role: "platformAdmin", path: "/platform/summary/", current: "ดูแลแพลตฟอร์ม",
    options: ["ดูแลแพลตฟอร์ม"] },
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
      await expect(page.getByRole("navigation", { name: "เปลี่ยนพื้นที่ใช้งาน" })).toHaveCount(0);
      const themeButton = page.getByLabel("เปลี่ยนธีม");
      await expect(themeButton).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[aria-label="ตำแหน่งในระบบ"]').getByLabel("เปลี่ยนธีม")).toHaveCount(1);
      await expect(page.locator("footer").getByLabel("เปลี่ยนธีม")).toHaveCount(0);
      const menu = page.getByRole("button", { name: "เปิดเมนูหลัก" });
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(page.getByRole("dialog", { name: "เมนูหลัก" })).toBeVisible();
      const drawer = page.getByRole("dialog", { name: "เมนูหลัก" });
      await expect(drawer.getByRole("button", { name: "ปิดเมนูหลัก" })).toBeFocused();
      const navigation = drawer.getByRole("navigation", { name: "เมนูหลัก" });
      if (scenario.role === "customer") {
        await expect(navigation).toContainText("คำสั่งซื้อของฉัน");
        await expect(navigation).not.toContainText("ตรวจสอบการชำระเงิน");
      } else if (scenario.role === "platformAdmin") {
        await expect(navigation).toContainText("ภาพรวมระบบ");
        await expect(navigation).not.toContainText("คำสั่งซื้อของฉัน");
        await expect(navigation).not.toContainText("คำสั่งซื้อและการส่งมอบ");
      } else {
        await expect(navigation).toContainText("ตรวจสอบการชำระเงิน");
        await expect(navigation).not.toContainText("คำสั่งซื้อของฉัน");
        await expect(navigation).not.toContainText("การแจ้งเตือน");
        if (scenario.role === "staff") {
          await expect(navigation).not.toContainText("ตั้งค่า");
          await expect(navigation).not.toContainText("บุคลากร");
        } else {
          await expect(navigation).toContainText("บุคลากร");
        }
      }
      const currentArea = drawer.getByText("พื้นที่ปัจจุบัน");
      if (scenario.options.length > 0) {
        await expect(currentArea).toBeVisible();
        await currentArea.click();
        const choices = drawer.getByRole("navigation", { name: "สลับพื้นที่ใช้งาน" });
        await expect(choices.getByRole("link", { name: "บัญชีส่วนตัว" })).toHaveAttribute("href", /\/shops/);
        await expect(choices.getByRole("link", { name: scenario.current })).toHaveAttribute("aria-current", "location");
        if (scenario.role === "platformAdmin") {
          await expect(choices.getByRole("link", { name: "หน่วยงานของฉัน" })).toHaveCount(0);
        } else {
          await expect(choices.getByRole("link", { name: "หน่วยงานของฉัน" })).toBeVisible();
        }
        await page.keyboard.press("Escape");
      } else {
        await expect(currentArea).toHaveCount(0);
      }
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
      await expect(menu).toBeFocused();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole("navigation", { name: "เปลี่ยนพื้นที่ใช้งาน" })).toHaveCount(0);
        await expect(themeButton).toBeVisible();
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(overflow, `${scenario.role} at ${width}px`).toBeLessThanOrEqual(1);
        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: join(evidence, `${scenario.role}-shell-${width}.png`),
            animations: "disabled",
          });
        }
      }
      await page.emulateMedia({ colorScheme: "dark" });
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(themeButton).toBeVisible();
        expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth))).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: join(evidence, scenario.role + "-dark-shell-" + width + ".png"),
          animations: "disabled",
        });
      }
      expect(attemptedWrite).toBe(0);
    } finally {
      await ctx.close();
    }
  });
}
