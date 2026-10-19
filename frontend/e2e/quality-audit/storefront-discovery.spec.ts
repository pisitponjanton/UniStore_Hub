import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { localAuditTargets } from "./fixture-guard";

const organization = {
  organizationId: "browser-only-campus-org",
  name: "คณะไอที (ข้อมูลทดสอบเบราว์เซอร์)",
  description: "ร้านของหน่วยงานสำหรับการทดสอบ UX โดยไม่สร้างข้อมูลจริง",
  status: "ACTIVE",
};
const directory = [
  {
    organization,
    stores: Array.from({ length: 15 }, (_, i) => ({
      storeId: "demo-store-" + (i + 1),
      organizationId: organization.organizationId,
      name: "ร้านตัวอย่าง " + (i + 1),
      description: "สินค้าของชมรมและรอบพรีออเดอร์ ดูรายละเอียดในร้าน",
      status: "ACTIVE",
    })),
  },
  {
    organization: {
      organizationId: "browser-only-empty-org",
      name: "ชมรมดนตรี (ข้อมูลทดสอบเบราว์เซอร์)",
      description: "",
      status: "ACTIVE",
    },
    stores: [],
  },
];

test("Storefront discovery uses real API-shaped data and preserves search, pagination and mobile orientation", async ({ browser }) => {
  test.setTimeout(95_000);
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  let writes = 0;
  await context.route("**/api/v1/**", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes++;
      await route.abort("blockedbyclient");
      return;
    }
    if (new URL(route.request().url()).pathname.endsWith("/storefront/directory")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: directory }) });
      return;
    }
    if (new URL(route.request().url()).pathname.endsWith("/me")) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Browser-only anonymous session" } }) });
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  const evidence = join("test-results", "quality-audit", "storefront-" + randomUUID());
  await mkdir(evidence, { recursive: true });
  try {
    await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /ร้านค้าและพรีออเดอร์/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "เข้าร้าน ร้านตัวอย่าง 1" })).toBeVisible({ timeout: 18000 });
    await expect(page.getByRole("link", { name: /เปิดหน้าร้าน/ }).first()).toHaveAttribute("href", /storeId=demo-store-2/);
    await expect(page.getByRole("link", { name: /ดูทุกร้าน/ })).toHaveAttribute("href", "#storefront-heading");
    await expect(page.getByRole("link", { name: /เลือกดูร้านค้า/ })).toHaveAttribute("href", "#storefront-heading");
    const catalogFirst = page.locator('a[class*="storeRow"]').filter({
      has: page.getByRole("heading", { name: "ร้านตัวอย่าง 1", exact: true }),
    });
    await expect(catalogFirst).toHaveAttribute("href", /storeId=demo-store-1/);
    await expect(page.getByText("หน้า 1 จาก 2")).toBeVisible();
    await expect(page.getByRole("link", { name: "ติดตามคำสั่งซื้อ" })).toHaveAttribute("href", /\/login\/?\?returnTo=/);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      expect(overflow, "horizontal overflow at width " + width).toBeLessThanOrEqual(1);
      const link = page.getByRole("link", { name: "เข้าร้าน ร้านตัวอย่าง 1" });
      await expect(link).toHaveAttribute("href", /storeId=demo-store-1/);
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: join(evidence, "populated-" + width + ".png"), animations: "disabled" });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: /เลือกดูร้านค้า/ }).click();
    await expect(page).toHaveURL(/#storefront-heading$/);
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(page.getByText("หน้า 2 จาก 2")).toBeVisible();
    await page.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" }).fill("ร้านตัวอย่าง 15");
    await expect(page.getByRole("heading", { name: "ร้านตัวอย่าง 15" })).toBeVisible();
    await expect(page.getByText(/แสดง 1–1 จาก 1 รายการ/)).toBeVisible();
    await page.getByRole("searchbox", { name: "ค้นหาร้านค้าหรือหน่วยงาน" }).fill("ไม่พบร้านนี้แน่ ๆ");
    await expect(page.getByText("ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา")).toBeVisible();
    await page.getByRole("button", { name: "แสดงรายการทั้งหมด" }).click();
    await page.getByRole("combobox", { name: "แสดงรายการ" }).selectOption("without-stores");
    await expect(page.getByRole("heading", { name: "ชมรมดนตรี (ข้อมูลทดสอบเบราว์เซอร์)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ร้านตัวอย่าง 1", exact: true })).toHaveCount(0);
    expect(writes).toBe(0);
  } finally {
    await context.close();
  }
});

for (const kind of ["empty", "error"] as const) {
  test("Storefront " + kind + " state gives accurate next action without inventing stores", async ({ browser }) => {
    const { frontend } = localAuditTargets();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    let tries = 0;
    let failUntilRetry = kind === "error";
    await context.route("**/api/v1/**", async route => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        await route.abort("blockedbyclient");
        return;
      }
      if (new URL(route.request().url()).pathname.endsWith("/storefront/directory")) {
        tries++;
        if (failUntilRetry) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Browser-only outage" } }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
        return;
      }
      await route.continue();
    });
    try {
      const page = await context.newPage();
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      if (kind === "error") {
        await expect(page.getByRole("heading", { name: "ไม่สามารถโหลดร้านค้าได้" })).toBeVisible({ timeout: 16000 });
        failUntilRetry = false;
        await page.getByRole("button", { name: "ลองโหลดอีกครั้ง" }).click();
        expect(tries).toBeGreaterThanOrEqual(2);
      }
      await expect(page.getByRole("heading", { name: "ยังไม่มีร้านค้าที่เปิดให้เข้าชม" })).toBeVisible({ timeout: 16000 });
      await expect(page.getByRole("link", { name: /เข้าร้าน ร้านตัวอย่าง/ })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
