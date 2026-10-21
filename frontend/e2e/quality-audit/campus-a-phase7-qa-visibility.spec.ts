import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase7");
mkdirSync(evidence, { recursive: true });

type DirectoryOrg = {
  organization: { organizationId: string; name: string; description: string; status: string };
  stores: Array<{ storeId: string; organizationId: string; name: string; description: string; status: string }>;
};
const org = (id: string, name: string, description: string, count: number): DirectoryOrg => ({
  organization: { organizationId: id, name, description, status: "ACTIVE" },
  stores: Array.from({ length: count }, (_, n) => ({
    storeId: id + "-" + (n + 1), organizationId: id,
    name: "ร้าน " + name + " " + (n + 1), description: "เปิดให้เข้าชม", status: "ACTIVE",
  })),
});
const mixed: DirectoryOrg[] = [
  org("club-a", "ชมรมงานฝีมือ", "สินค้าชมรม", 15),
  org("club-b", "Demo QA Student Club", "ชมรมจริงที่มีคำว่า QA", 2),
  org("club-c", "ชมรมถ่ายภาพ", "ยังไม่มีร้าน", 0),
  org("test-compound", "QA Commerce Org phase5-1791131669701-2", "Disposable frontend Customer commerce fixture", 2),
  org("55555555-5555-4555-8555-555555555555", "UniStore Local Demo", "Deterministic local/demo organization", 1),
  org("test-empty", "Tenant Org B harness-phase5-1790760715", "Disposable tenant B", 0),
];

async function guard(context: import("@playwright/test").BrowserContext) {
  await context.route("**/*", async route => {
    if (blockBrowserApiWrites(api)(route.request().url(), route.request().method())) {
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
}
const data = (entries: DirectoryOrg[]) => ({ success: true, data: entries });

for (const theme of ["light", "dark"] as const) {
  test("Phase 7 fixture isolation, legitimate lookalikes, search, filters and paging / " + theme, async ({ browser }) => {
    test.setTimeout(110_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await guard(context);
    const page = await context.newPage();
    await page.route("**/storefront/directory", route =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data(mixed)) })
        : route.abort("blockedbyclient"));
    try {
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      const cards = page.locator('a[class*="storeCard"]');
      const showQa = page.getByRole("button", { name: /แสดงข้อมูล E2E\/QA \(3 หน่วยงาน\)/ });
      await expect(showQa).toBeVisible();
      await expect(cards).toHaveCount(12);
      await expect(page.getByText("หน้า 1 จาก 2")).toBeVisible();
      await expect(page.getByText(/พบ 17 ร้าน และ 1 หน่วยงานที่ยังไม่มีร้าน/)).toBeVisible();
      await expect(page.getByRole("option", { name: "Demo QA Student Club" })).toHaveCount(1);
      await expect(page.getByRole("option", { name: /QA Commerce Org/ })).toHaveCount(0);
      await expect(page.locator('a[data-qa-fixture="true"]')).toHaveCount(0);
      // Real organization names containing "QA" must remain discoverable.
      await page.getByLabel("ค้นหาร้านค้าหรือหน่วยงาน").fill("Demo QA");
      await expect(cards).toHaveCount(2);
      await expect(cards.first()).toContainText("Demo QA Student Club");
      await page.getByLabel("ค้นหาร้านค้าหรือหน่วยงาน").fill("QA Commerce Org");
      await expect(cards).toHaveCount(0);
      await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
      await page.getByRole("button", { name: "ถัดไป" }).click();
      await expect(cards).toHaveCount(5);
      await expect(page.locator('article[class*="emptyOrganization"]')).toHaveCount(1);
      await page.getByLabel("แสดงรายการ").selectOption("without-stores");
      await expect(page.locator('article[class*="emptyOrganization"]')).toHaveCount(1);
      await page.getByLabel("แสดงรายการ").selectOption("all");
      await page.getByLabel("หน่วยงาน", { exact: true }).selectOption("club-b");
      await expect(cards).toHaveCount(2);
      await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
      await showQa.click();
      await expect(page.getByText(/โหมดตรวจสอบ QA/)).toBeVisible();
      await expect(page.getByRole("button", { name: "ซ่อนข้อมูล E2E/QA" })).toBeVisible();
      await expect(page.getByText(/พบ 20 ร้าน และ 2 หน่วยงานที่ยังไม่มีร้าน/)).toBeVisible();
      await expect(page.locator('a[data-qa-fixture="true"]')).toHaveCount(0); // first page stays ordinary shops
      await page.getByLabel("หน่วยงาน", { exact: true }).selectOption("test-compound");
      await expect(cards).toHaveCount(2);
      await expect(page.locator('a[data-qa-fixture="true"]')).toHaveCount(2);
      await expect(page.getByText("ข้อมูลทดสอบ QA")).toHaveCount(2);
      await page.getByRole("button", { name: "ซ่อนข้อมูล E2E/QA" }).click();
      await expect(page.getByLabel("หน่วยงาน", { exact: true })).toHaveValue("");
      await expect(page.getByRole("option", { name: /QA Commerce Org/ })).toHaveCount(0);
      await expect(page.getByText(/พบ 17 ร้าน และ 1 หน่วยงานที่ยังไม่มีร้าน/)).toBeVisible();
      for (const width of [390, 768, 1440, 3840]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          theme + " width " + width).toBeLessThanOrEqual(1);
        if ([390, 1440, 3840].includes(width)) {
          await page.screenshot({ path: resolve(evidence, "mixed-" + theme + "-" + width + ".png") });
        }
      }
    } finally { await context.close(); }
  });

  test("Phase 7 loading, network failure and retry, authoritative empty / " + theme, async ({ browser }) => {
    test.setTimeout(80_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
    await guard(context);
    const page = await context.newPage();
    let attempts = 0;
    let allowSuccess = false;
    await page.route("**/storefront/directory", async route => {
      attempts++;
      if (!allowSuccess) {
        await new Promise(resolve => setTimeout(resolve, 300));
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Temporary test outage" } }) });
      } else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data([])) });
    });
    try {
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("กำลังโหลดร้านค้า", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "ไม่สามารถโหลดร้านค้าได้" })).toBeVisible();
      await page.screenshot({ path: resolve(evidence, "error-" + theme + "-390.png") });
      allowSuccess = true;
      await page.getByRole("button", { name: "ลองโหลดอีกครั้ง" }).click();
      await expect(page.getByRole("heading", { name: "ยังไม่มีร้านค้าที่เปิดให้เข้าชม" })).toBeVisible();
      await expect(page.getByRole("button", { name: /ข้อมูล E2E\/QA/ })).toHaveCount(0);
      await expect(page.locator('a[class*="storeCard"]')).toHaveCount(0);
      expect(attempts).toBeGreaterThanOrEqual(2);
      await page.screenshot({ path: resolve(evidence, "api-empty-" + theme + "-390.png") });
    } finally { await context.close(); }
  });

  test("Phase 7 live local dev seed is not shown as a shopper store by default / " + theme, async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await guard(context);
    const page = await context.newPage();
    try {
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: /แสดงข้อมูล E2E\/QA/ })).toBeVisible({ timeout: 16000 });
      const wasSeedHidden = await page.locator('a[class*="storeCard"]').filter({ hasText: "Local Demo Store" }).count();
      expect(wasSeedHidden).toBe(0);
      await expect(page.getByRole("heading", { name: "ยังไม่มีร้านค้าทั่วไปที่เปิดให้เข้าชม" })).toBeVisible();
      const before = await page.locator('[class*="resultSummary"]').first().textContent();
      await page.screenshot({ path: resolve(evidence, "local-default-" + theme + "-1440.png") });
      await page.getByRole("button", { name: /แสดงข้อมูล E2E\/QA/ }).click();
      await expect(page.getByText(/โหมดตรวจสอบ QA/)).toBeVisible();
      await expect(page.locator('a[data-qa-fixture="true"]').first()).toBeVisible();
      await page.screenshot({ path: resolve(evidence, "local-qa-mode-" + theme + "-1440.png") });
      const during = await page.locator('[class*="resultSummary"]').first().textContent();
      await page.getByRole("button", { name: "ซ่อนข้อมูล E2E/QA" }).click();
      await expect(page.locator('a[class*="storeCard"]')).toHaveCount(0);
      writeFileSync(resolve(evidence, "local-qa-metrics-" + theme + ".json"), JSON.stringify({
        theme, seedInitiallyHidden: true, before, during, browserWritesBlocked: true,
        note: "Read-only GET live local fixture census; no backend fixtures modified."
      }, null, 2) + "\n");
    } finally { await context.close(); }
  });
}
