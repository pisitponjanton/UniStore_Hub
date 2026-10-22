/**
 * Campus Commerce A — behavior-focused browser regression suite.
 * Consolidated from historical work-item files; all test cases and mock guards retained.
 * Add related cases here; never introduce milestone-numbered spec files.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

test.describe("Store grid", () => {
const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-storefront");
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
  test("store-first grid / filters / pagination / responsiveness — " + theme, async ({ browser }) => {
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
});

test.describe("Qa visibility", () => {
const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-fixture-visibility");
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
  test("fixture isolation, legitimate lookalikes, search, filters and paging / " + theme, async ({ browser }) => {
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

  test("loading, network failure and retry, authoritative empty / " + theme, async ({ browser }) => {
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

  test("live local dev seed is not shown as a shopper store by default / " + theme, async ({ browser }) => {
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
});

test.describe("Public commerce", () => {
const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-public-commerce");
mkdirSync(evidence, { recursive: true });

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeId = "66666666-6666-4666-8666-111111111111";
const productId = "77777777-7777-4777-8777-111111111111";
const variantA = "88888888-8888-4888-8888-111111111111";
const variantB = "88888888-8888-4888-8888-222222222222";
const openId = "99999999-9999-4999-8999-111111111111";
const closedId = "99999999-9999-4999-8999-222222222222";
const when = "2026-10-10T08:00:00.000Z";
const store = { organizationId, storeId, name: "ชมรมสร้างสรรค์", description: "สินค้าและกิจกรรมสำหรับสมาชิก", status: "ACTIVE" };
const products = [
  { organizationId, storeId, productId, name: "เสื้อชมรม", description: "เสื้อกิจกรรมรุ่นใหม่", imageUrl: null, status: "ACTIVE", createdAt: when, updatedAt: when,
    variants: [
      { variantId: variantA, organizationId, productId, name: "Size M", price: 25000, status: "ACTIVE", createdAt: when, updatedAt: when },
      { variantId: variantB, organizationId, productId, name: "Size L", price: 30000, status: "ACTIVE", createdAt: when, updatedAt: when },
    ],
  },
  { organizationId, storeId, productId: "77777777-7777-4777-8777-333333333333", name: "กระเป๋าชมรม", description: "กระเป๋าผ้าใส่หนังสือ", imageUrl: null, status: "ACTIVE", createdAt: when, updatedAt: when },
];
const campaign = (campaignId: string, name: string, status: "OPEN" | "CLOSED") => ({
  campaignId, organizationId, storeId, name, status,
  openAt: when, closeAt: "2026-11-30T08:00:00.000Z",
  paymentDeadline: "2026-12-03T08:00:00.000Z", pickupAt: "2026-12-15T08:00:00.000Z",
  createdAt: when, updatedAt: when,
});
const campaigns = [campaign(openId, "รอบเปิดรับ", "OPEN"), campaign(closedId, "รอบปิดรับ", "CLOSED")];
const prefix = "/api/v1/storefront/organizations/" + organizationId;
const storePath = prefix + "/stores/" + storeId;
const routes = {
  store: "/stores/view/?organizationId=" + organizationId + "&storeId=" + storeId,
  product: "/products/view/?organizationId=" + organizationId + "&productId=" + productId,
  campaign: "/campaigns/view/?organizationId=" + organizationId + "&campaignId=" + openId,
  closed: "/campaigns/view/?organizationId=" + organizationId + "&campaignId=" + closedId,
};

async function installSafeFixture(
  context: import("@playwright/test").BrowserContext,
  configuration: { emptyCampaignProducts?: boolean } = {},
) {
  let writes = 0;
  const getWrites = () => writes;
  await context.route("**/*", async route => {
    if (blockBrowserApiWrites(api)(route.request().url(), route.request().method())) {
      writes++;
      return route.abort("blockedbyclient");
    }
    const { pathname } = new URL(route.request().url());
    if (route.request().method() !== "GET" || !pathname.startsWith("/api/v1/storefront/")) return route.continue();
    const map = new Map<string, unknown>([
      [prefix + "/stores", { items: [store], nextCursor: null }],
      [storePath, store],
      [storePath + "/products", { items: configuration.emptyCampaignProducts ? [] : products, nextCursor: null }],
      [storePath + "/products/" + productId, products[0]],
      [storePath + "/campaigns", { items: campaigns, nextCursor: null }],
      [storePath + "/campaigns/" + openId, campaigns[0]],
      [storePath + "/campaigns/" + closedId, campaigns[1]],
    ]);
    if (map.has(pathname)) return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: map.get(pathname) }),
    });
    return route.continue();
  });
  return getWrites;
}

for (const theme of ["light", "dark"] as const) {
  test("store/product/campaign task flow and responsive / " + theme, async ({ browser }) => {
    test.setTimeout(125_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const getWrites = await installSafeFixture(context);
    const page = await context.newPage();
    const measurements: Array<Record<string, string | number>> = [];
    try {
      await page.goto(frontend + routes.store, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: store.name })).toBeVisible();
      await expect(page.getByRole("heading", { name: "รอบพรีออเดอร์ของร้าน" })).toBeVisible();
      const openFilter = page.getByRole("combobox", { name: "สถานะรอบขาย" });
      await expect(openFilter).toHaveValue("all");
      await expect(page.locator('a[class*="campaignCard"]')).toHaveCount(2);
      await openFilter.selectOption("open");
      await expect(page.locator('a[class*="campaignCard"]')).toHaveCount(1);
      await expect(page.locator('a[class*="campaignCard"]').first()).toHaveAttribute("href", /campaignId=99999999-9999-4999-8999-111111111111/);
      await openFilter.selectOption("all");
      const search = page.getByRole("searchbox", { name: "ค้นหาสินค้าในร้าน" });
      await search.fill("กระเป๋า");
      await expect(page.locator('a[class*="productCard"]')).toHaveCount(1);
      await search.fill("ไม่พบสิ่งนี้");
      await expect(page.getByText("ไม่พบสินค้าที่ตรงกับการค้นหา")).toBeVisible();
      await page.getByRole("button", { name: "ล้างคำค้นหา" }).click();
      await expect(page.locator('a[class*="productCard"]')).toHaveCount(2);
      for (const width of [320, 390, 768, 1024, 1440, 1920, 2560, 3840]) {
        await page.setViewportSize({ width, height: 950 });
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(overflow, theme + " store overflow " + width).toBeLessThanOrEqual(1);
        measurements.push({ route: "store", theme, width, overflow });
        if ([320, 390, 768, 1440, 3840].includes(width)) await page.screenshot({ path: resolve(evidence, theme + "-store-" + width + ".png"), animations: "disabled" });
      }
      await page.setViewportSize({ width: 1440, height: 950 });
      await page.goto(frontend + routes.campaign, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "รอบเปิดรับ" })).toBeVisible();
      await expect(page.getByRole("link", { name: /ดูสินค้าและตรวจสอบตัวเลือก/ })).toBeVisible();
      await expect(page.getByRole("link", { name: store.name, exact: true })).toHaveAttribute("href", /storeId=66666666/);
      await page.goto(frontend + routes.closed, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "รอบปิดรับ" })).toBeVisible();
      await expect(page.getByRole("link", { name: /ดูสินค้าและตรวจสอบตัวเลือก/ })).toHaveCount(0);
      await expect(page.getByText("รอบนี้ยังสั่งซื้อเพิ่มไม่ได้ แต่ยังดูรายละเอียดและสินค้าได้")).toBeVisible();
      await page.goto(frontend + routes.product, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "เสื้อชมรม" })).toBeVisible();
      await expect(page.getByRole("list", { name: "ขั้นตอนการเริ่มสั่งซื้อ" })).toContainText("ตรวจยอดและดำเนินการต่อ");
      await page.locator("#product-variant").selectOption(variantB);
      await page.locator("#product-quantity").fill("3");
      await expect(page.getByText(/Size L.*฿300.00.*× 3/)).toBeVisible();
      await expect(page.locator('output[for*="product-quantity"]')).toContainText("฿900.00");
      await page.locator("#product-campaign").selectOption(closedId);
      await expect(page.getByText("รอบพรีออเดอร์ที่เลือกยังไม่เปิดรับคำสั่งซื้อ", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" })).toHaveCount(0);
      await page.locator("#product-campaign").selectOption(openId);
      const order = page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" });
      await expect(order).toBeVisible();
      const target = new URL((await order.getAttribute("href")) ?? "", "http://localhost:3000");
      expect(target.pathname).toMatch(/^\/login\/?$/);
      expect(target.searchParams.get("returnTo")).toContain("variantId=" + variantB);
      for (const width of [320, 390, 768, 1440, 3840]) {
        await page.setViewportSize({ width, height: 950 });
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(overflow, theme + " product overflow " + width).toBeLessThanOrEqual(1);
        measurements.push({ route: "product", theme, width, overflow });
        await page.screenshot({ path: resolve(evidence, theme + "-product-" + width + ".png") });
      }
      await page.goto(frontend + routes.campaign, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "รอบเปิดรับ" })).toBeVisible();
      for (const width of [320, 390, 768, 1440, 3840]) {
        await page.setViewportSize({ width, height: 950 });
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(overflow, theme + " campaign overflow " + width).toBeLessThanOrEqual(1);
        measurements.push({ route: "campaign", theme, width, overflow });
        await page.screenshot({ path: resolve(evidence, theme + "-campaign-" + width + ".png") });
      }
      expect(getWrites()).toBe(0);
      writeFileSync(resolve(evidence, "guest-detail-" + theme + ".json"), JSON.stringify({ theme, writes: getWrites(), measurements }, null, 2) + "\n");
    } finally { await context.close(); }
  });

  test("OPEN campaign with no available products has no misleading purchase CTA / " + theme, async ({ browser }) => {
    test.setTimeout(45_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 } });
    const getWrites = await installSafeFixture(context, { emptyCampaignProducts: true });
    const page = await context.newPage();
    try {
      await page.goto(frontend + routes.campaign, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "รอบเปิดรับ" })).toBeVisible();
      await expect(page.getByRole("link", { name: /ดูสินค้าและตรวจสอบตัวเลือก/ })).toHaveCount(0);
      await expect(page.getByText(/ยังไม่มีสินค้าให้เลือก/)).toBeVisible();
      await expect(page.getByText("ร้านนี้ยังไม่มีสินค้าที่เปิดให้เข้าชม")).toBeVisible();
      expect(getWrites()).toBe(0);
    } finally { await context.close(); }
  });
}
});
