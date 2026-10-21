import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { blockBrowserApiWrites, localAuditTargets } from "./fixture-guard";

const { frontend, api } = localAuditTargets();
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase8");
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
  test("Phase 8 store/product/campaign task flow and responsive / " + theme, async ({ browser }) => {
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
        if ([390, 1440, 3840].includes(width)) await page.screenshot({ path: resolve(evidence, theme + "-store-" + width + ".png") });
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
      for (const width of [390, 1440, 3840]) {
        await page.setViewportSize({ width, height: 950 });
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(overflow, theme + " product overflow " + width).toBeLessThanOrEqual(1);
        measurements.push({ route: "product", theme, width, overflow });
        await page.screenshot({ path: resolve(evidence, theme + "-product-" + width + ".png") });
      }
      await page.goto(frontend + routes.campaign, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "รอบเปิดรับ" })).toBeVisible();
      for (const width of [390, 1440, 3840]) {
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

  test("Phase 8 OPEN campaign with no available products has no misleading purchase CTA / " + theme, async ({ browser }) => {
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
