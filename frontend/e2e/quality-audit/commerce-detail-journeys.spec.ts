import { expect, test, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { localAuditTargets } from "./fixture-guard";

const org = "55555555-5555-4555-8555-555555555555";
const shop = "66666666-6666-4666-8666-666666666666";
const item = "77777777-7777-4777-8777-777777777777";
const option = "88888888-8888-4888-8888-888888888888";
const openId = "99999999-9999-4999-8999-999999999999";
const closedId = "99999999-9999-4999-8999-999999999998";
const root = "/storefront/organizations/" + org;
const storeRoot = root + "/stores/" + shop;
const store = { storeId: shop, organizationId: org, name: "ร้านเสื้อชมรม (ข้อมูลทดสอบเบราว์เซอร์)",
  description: "สินค้าจากชมรมสำหรับสมาชิกมหาวิทยาลัย", status: "ACTIVE" };
const product = { productId: item, organizationId: org, storeId: shop, name: "เสื้อชมรม (ข้อมูลทดสอบเบราว์เซอร์)",
  description: "เสื้อสำหรับกิจกรรม มีให้เลือกขนาดและจำนวน", status: "ACTIVE", imageUrl: null,
  variants: [{ variantId: option, organizationId: org, productId: item, name: "M", price: 19900,
    status: "ACTIVE", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" }],
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
const campaign = (id: string, status: "OPEN" | "CLOSED") => ({
  campaignId: id, organizationId: org, storeId: shop,
  name: status === "OPEN" ? "รอบเปิดรับเดือนพฤศจิกายน" : "รอบที่ปิดรับแล้ว",
  status, openAt: "2026-10-01T00:00:00.000Z", closeAt: "2026-11-30T00:00:00.000Z",
  paymentDeadline: "2026-12-02T00:00:00.000Z", pickupAt: "2026-12-12T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
});
const openCampaign = campaign(openId, "OPEN");
const closedCampaign = campaign(closedId, "CLOSED");
const list = (items: unknown[]) => ({ items, nextCursor: null });

async function guardedPage(browser: Browser) {
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  let writes = 0;
  await context.route("**/api/v1/**", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes++;
      await route.abort("blockedbyclient");
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    let data: unknown;
    if (path.endsWith("/me")) {
      await route.fulfill({ status: 401, contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Anonymous browser fixture" } }) });
      return;
    }
    if (path === root + "/stores") data = list([store]);
    else if (path === storeRoot) data = store;
    else if (path === storeRoot + "/products") data = list([product]);
    else if (path === storeRoot + "/products/" + item) data = product;
    else if (path === storeRoot + "/campaigns") data = list([closedCampaign, openCampaign]);
    else if (path === storeRoot + "/campaigns/" + openId) data = openCampaign;
    else if (path === storeRoot + "/campaigns/" + closedId) data = closedCampaign;
    else {
      await route.fulfill({ status: 404, contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Browser fixture not found" } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  const page = await context.newPage();
  const evidence = join("test-results", "quality-audit", "commerce-detail-" + randomUUID());
  await mkdir(evidence, { recursive: true });
  return { context, page, frontend, evidence, writes: () => writes };
}

async function widths(page: import("@playwright/test").Page, label: string, evidence: string) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    expect(overflow, label + " overflow at " + width).toBeLessThanOrEqual(1);
    if (width === 390 || width === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(evidence, label + "-" + width + ".png"), animations: "disabled" });
    }
  }
}

test("Store detail prioritizes active preorder and links actual product and campaign", async ({ browser }) => {
  test.setTimeout(75000);
  const fixture = await guardedPage(browser);
  try {
    await fixture.page.goto(fixture.frontend + "/stores/view/?organizationId=" + org + "&storeId=" + shop, { waitUntil: "domcontentloaded" });
    await expect(fixture.page.getByRole("heading", { name: store.name })).toBeVisible({ timeout: 20000 });
    await expect(fixture.page.getByRole("status").filter({ hasText: "1 รอบที่เปิดรับคำสั่งซื้อ" })).toBeVisible();
    await expect(fixture.page.getByRole("navigation", { name: "เส้นทางร้านค้า" })).toBeVisible();
    await expect(fixture.page.getByRole("navigation", { name: "เส้นทางร้านค้า" }).getByRole("link", { name: "ร้านค้าทั้งหมด" })).toHaveAttribute("href", "/");
    await expect(fixture.page.getByRole("link", { name: "ดูรอบพรีออเดอร์" })).toHaveAttribute("href", "#campaign-heading");
    await expect(fixture.page.getByRole("link", { name: "เลือกดูสินค้า" })).toHaveAttribute("href", "#product-heading");
    const campaignLinks = fixture.page.locator('a[class*="campaignCard"]');
    await expect(campaignLinks.first()).toHaveAttribute("href", new RegExp("campaignId=" + openId));
    await expect(fixture.page.locator('a[class*="productCard"]').filter({ has: fixture.page.getByRole("heading", { name: product.name, exact: true }) })).toHaveAttribute("href", new RegExp("productId=" + item));
    await widths(fixture.page, "store", fixture.evidence);
    await fixture.page.setViewportSize({ width: 390, height: 844 });
    await fixture.page.getByRole("link", { name: "เลือกดูสินค้า" }).click();
    await expect(fixture.page.getByRole("heading", { name: "สินค้าของร้าน" })).toBeFocused();
    expect(fixture.writes()).toBe(0);
  } finally { await fixture.context.close(); }
});

test("Open campaign shows deadline, timeline and jump; closed campaign never promises checkout", async ({ browser }) => {
  test.setTimeout(75000);
  const fixture = await guardedPage(browser);
  try {
    await fixture.page.goto(fixture.frontend + "/campaigns/view/?organizationId=" + org + "&campaignId=" + openId,
      { waitUntil: "domcontentloaded" });
    await expect(fixture.page.getByRole("heading", { name: openCampaign.name })).toBeVisible({ timeout: 20000 });
    await expect(fixture.page.getByRole("link", { name: "เลือกสินค้าที่สั่งได้" })).toHaveAttribute("href", "#campaign-products");
    await expect(fixture.page.getByText("ปิดรับคำสั่งซื้อ", { exact: true }).first()).toBeVisible();
    await expect(fixture.page.getByRole("heading", { name: "เลือกสินค้าที่ต้องการ" })).toBeVisible();
    await expect(fixture.page.getByRole("navigation", { name: "เส้นทางรอบพรีออเดอร์" }).getByRole("link", { name: store.name })).toHaveAttribute("href", new RegExp("storeId=" + shop));
    await expect(fixture.page.locator('a[class*="productCard"]').first()).toHaveAttribute("href", new RegExp("campaignId=" + openId));
    await widths(fixture.page, "campaign-open", fixture.evidence);
    await fixture.page.goto(fixture.frontend + "/campaigns/view/?organizationId=" + org + "&campaignId=" + closedId,
      { waitUntil: "domcontentloaded" });
    await expect(fixture.page.getByRole("heading", { name: closedCampaign.name })).toBeVisible({ timeout: 20000 });
    await expect(fixture.page.getByRole("link", { name: "เลือกสินค้าที่สั่งได้" })).toHaveCount(0);
    await expect(fixture.page.getByText("รอบนี้ยังสั่งซื้อเพิ่มไม่ได้", { exact: false })).toBeVisible();
    expect(fixture.writes()).toBe(0);
  } finally { await fixture.context.close(); }
});

test("Product detail preserves real variant pricing and login-gated purchase selection", async ({ browser }) => {
  test.setTimeout(75000);
  const fixture = await guardedPage(browser);
  try {
    await fixture.page.goto(fixture.frontend + "/products/view/?organizationId=" + org + "&productId=" + item + "&campaignId=" + openId,
      { waitUntil: "domcontentloaded" });
    await expect(fixture.page.getByRole("heading", { name: product.name })).toBeVisible({ timeout: 20000 });
    await expect(fixture.page.getByText("ยังไม่มีรูปสินค้า")).toBeVisible();
    await expect(fixture.page.getByRole("status").filter({ hasText: "มีรอบพรีออเดอร์" })).toBeVisible();
    await expect(fixture.page.getByRole("link", { name: "เลือกตัวเลือกและคำนวณยอด" })).toHaveAttribute("href", "#product-selection");
    await expect(fixture.page.getByText("ราคาเริ่มต้น")).toBeVisible();
    const quantity = fixture.page.getByRole("spinbutton", { name: "จำนวน" });
    await expect(fixture.page.locator("output")).toContainText("199.00");
    await quantity.fill("2");
    await expect(fixture.page.locator("output")).toContainText("398.00");
    await expect(fixture.page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" })).toHaveAttribute("href", /returnTo=/);
    await expect(fixture.page.getByRole("navigation", { name: "เส้นทางสินค้า" }).getByRole("link", { name: store.name })).toHaveAttribute("href", new RegExp("storeId=" + shop));
    await expect(fixture.page.getByRole("link", { name: "ดูรายละเอียดแคมเปญ" })).toHaveAttribute("href", new RegExp("campaignId=" + openId));
    await fixture.page.getByRole("combobox", { name: "รอบพรีออเดอร์" }).selectOption(closedId);
    await expect(fixture.page.getByText("รอบพรีออเดอร์ที่เลือกยังไม่เปิดรับคำสั่งซื้อ")).toBeVisible();
    await expect(fixture.page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" })).toHaveCount(0);
    await fixture.page.getByRole("combobox", { name: "รอบพรีออเดอร์" }).selectOption(openId);
    await expect(fixture.page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" })).toBeVisible();
    await quantity.fill("0");
    await expect(fixture.page.getByText("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป")).toBeVisible();
    await expect(fixture.page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" })).toHaveCount(0);
    await quantity.fill("1");
    await widths(fixture.page, "product", fixture.evidence);
    await fixture.page.goto(fixture.frontend + "/products/view/?organizationId=" + org + "&productId=" + item + "&campaignId=" + closedId,
      { waitUntil: "domcontentloaded" });
    await expect(fixture.page.getByRole("heading", { name: product.name })).toBeVisible({ timeout: 20000 });
    await expect(fixture.page.getByText("รอบพรีออเดอร์ที่เลือกยังไม่เปิดรับคำสั่งซื้อ")).toBeVisible();
    await expect(fixture.page.getByRole("status").filter({ hasText: "รอบที่เลือกยังไม่เปิดรับคำสั่งซื้อ" })).toBeVisible();
    await expect(fixture.page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" })).toHaveCount(0);
    expect(fixture.writes()).toBe(0);
  } finally { await fixture.context.close(); }
});
