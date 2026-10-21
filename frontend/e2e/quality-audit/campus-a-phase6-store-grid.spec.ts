import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase6");
mkdirSync(evidence, { recursive: true });

const stores = (organizationId: string, count: number, prefix: string) =>
  Array.from({ length: count }, (_, i) => ({
    storeId: organizationId + "-store-" + String(i + 1),
    organizationId,
    name: prefix + " " + String(i + 1).padStart(2, "0"),
    description: "จำหน่ายสินค้าสำหรับกิจกรรมในมหาวิทยาลัย",
    status: "ACTIVE",
  }));

const fixture = [
  { organization: { organizationId: "org-engineering", name: "คณะวิศวกรรม", description: "อุปกรณ์และบริการ", status: "ACTIVE" }, stores: stores("org-engineering", 15, "ร้านเครื่องเขียน") },
  { organization: { organizationId: "org-arts", name: "ชมรมศิลปะ", description: "ผลิตภัณฑ์ชมรม", status: "ACTIVE" }, stores: stores("org-arts", 11, "ร้านเสื้อ") },
  { organization: { organizationId: "org-music", name: "ชมรมดนตรี", description: "กิจกรรมนักศึกษา", status: "ACTIVE" }, stores: [] },
  { organization: { organizationId: "org-geography", name: "ชมรมภูมิศาสตร์", description: "กลุ่มนักศึกษา", status: "ACTIVE" }, stores: [] },
];

for (const theme of ["light", "dark"] as const) {
  test("Phase 6 store-first grid / filters / pagination / responsiveness — " + theme, async ({ browser }) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({ colorScheme: theme, reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const results: Array<Record<string, number | string>> = [];
    await context.route("**/*", async route => {
      if (blockBrowserApiWrites(api)(route.request().url(), route.request().method())) await route.abort("blockedbyclient");
      else await route.continue();
    });
    const page = await context.newPage();
    // GET-only deterministic data: no API write, backend mutation or fixtures persisted.
    await page.route("**/storefront/directory", async route => {
      if (route.request().method() !== "GET") return route.abort("blockedbyclient");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: fixture }) });
    });
    try {
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      const cards = page.locator('a[class*="storeCard"]');
      await expect(cards).toHaveCount(12, { timeout: 15000 });
      await expect(page.getByText("หน้า 1 จาก 3")).toBeVisible();
      await expect(page.getByText("พบ 26 ร้าน")).toBeVisible();
      await expect(page.getByRole("heading", { name: "เลือกร้านที่อยากซื้อ" })).toBeVisible();
      await expect(cards.first()).toHaveAttribute("href", /organizationId=org-engineering.*storeId=org-engineering-store-1/);
      await expect(cards.first().locator('[class*="storeCardMedia"]')).toContainText("ยังไม่มีรูปหน้าร้าน");
      await expect(page.locator('[class*="organizationList"]')).toHaveCount(0);
      for (const [width, columns] of [[320,1],[390,1],[768,2],[1024,3],[1440,4],[1920,5],[2560,6],[3840,6]] as const) {
        await page.setViewportSize({ width, height: 960 });
        const metrics = await page.locator('[class*="storeGrid"]').evaluate((node) => ({
          columns: getComputedStyle(node).gridTemplateColumns.split(" ").length,
          width: Math.round(node.getBoundingClientRect().width),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        }));
        expect(metrics.columns, theme + " grid columns at " + width).toBe(columns);
        expect(metrics.overflow, theme + " page overflow at " + width).toBeLessThanOrEqual(1);
        results.push({ theme, width, columns: metrics.columns, gridWidth: metrics.width, overflow: metrics.overflow });
        if ([390,1440,3840].includes(width)) await page.screenshot({ path: resolve(evidence, "grid-" + theme + "-" + width + ".png") });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole("button", { name: "ถัดไป" }).click();
      await expect(page.getByText("หน้า 2 จาก 3")).toBeVisible();
      await expect(cards).toHaveCount(12);
      await page.getByRole("button", { name: "ถัดไป" }).click();
      await expect(page.getByText("หน้า 3 จาก 3")).toBeVisible();
      await expect(cards).toHaveCount(2);
      await expect(page.locator('article[class*="emptyOrganization"]')).toHaveCount(2);
      await expect(page.getByRole("heading", { name: "หน่วยงานที่ยังไม่มีร้านค้า" })).toBeVisible();
      await expect(page.locator('article[class*="emptyOrganization"]').getByText("ชมรมดนตรี")).toBeVisible();
      // Filters cover the complete directory, not only the previously visible page.
      await page.getByLabel("แสดงรายการ").selectOption("without-stores");
      await expect(page.locator('article[class*="emptyOrganization"]')).toHaveCount(2);
      await expect(cards).toHaveCount(0);
      await expect(page.getByText("หน้า 3 จาก 3")).toHaveCount(0);
      await page.getByLabel("แสดงรายการ").selectOption("with-stores");
      await expect(cards).toHaveCount(12);
      await page.getByLabel("หน่วยงาน", { exact: true }).selectOption("org-arts");
      await expect(cards).toHaveCount(11);
      await expect(cards.first()).toContainText("ร้านเสื้อ");
      await page.getByLabel("หน่วยงาน", { exact: true }).selectOption("org-engineering");
      await expect(cards).toHaveCount(12);
      await expect(page.getByText("หน้า 1 จาก 2")).toBeVisible();
      await page.getByLabel("ค้นหาร้านค้าหรือหน่วยงาน").fill("ร้านเครื่องเขียน 15");
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toContainText("ร้านเครื่องเขียน 15");
      await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
      await expect(cards).toHaveCount(12);
      await page.getByLabel("ค้นหาร้านค้าหรือหน่วยงาน").fill("ไม่พบข้อมูล");
      await expect(page.getByText("ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา")).toBeVisible();
      await expect(cards).toHaveCount(0);
      await page.getByRole("button", { name: "แสดงรายการทั้งหมด" }).click();
      await expect(cards).toHaveCount(12);
      writeFileSync(resolve(evidence, "grid-metrics-" + theme + ".json"), JSON.stringify(results, null, 2) + "\n");
    } finally { await context.close(); }
  });
}
