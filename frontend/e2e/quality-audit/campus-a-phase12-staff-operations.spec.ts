import { expect, test, type BrowserContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = "http://127.0.0.1:3000";
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase12");
mkdirSync(evidence, { recursive: true });
const org = "55555555-5555-4555-8555-555555555555";
const otherOrg = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orderId = "11111111-1111-4111-8111-111111111111";
const paymentId = "22222222-2222-4222-8222-222222222222";
const pickupId = "33333333-3333-4333-8333-333333333333";
const campaignId = "99999999-9999-4999-8999-999999999998";
const createdAt = "2026-09-30T01:00:00.000Z";
const order = { orderId, organizationId: org, campaignId, customerId: "buyer-1",
  status: "PAYMENT_REVIEW", subtotal: 25000, total: 25000,
  items: [{ orderItemId: "item-1", productId: "product-1", variantId: "variant-1",
    productName: "เสื้อชมรม", variantName: "Size M", quantity: 1, unitPrice: 25000, totalPrice: 25000 }],
  createdAt, updatedAt: createdAt };
const pickupOrder = { ...order, status: "READY_FOR_PICKUP" };
const payment = { paymentId, organizationId: org, orderId, customerId: "buyer-1",
  status: "PENDING_REVIEW", slipKey: "payments/" + org + "/" + orderId + "/proof",
  rejectReason: null, reviewedBy: null, reviewedAt: null, createdAt, updatedAt: createdAt };
const pickup = { pickupId, organizationId: org, orderId, token: "browser-only-staff-token",
  status: "READY", receivedBy: null, receivedAt: null, createdAt, updatedAt: createdAt };

async function setup(context: BrowserContext, role: "STAFF" | "ORGANIZATION_ADMIN" = "STAFF") {
  await context.addInitScript(() => sessionStorage.setItem("unistoreHub.accessToken", "browser-only-staff"));
  const stats = { unmockedWrites: 0, blockedPaths: [] as string[] };
  const session = { user: { userId: "staff-1", email: "staff@example.com", name: "Staff Preview",
    status: "ACTIVE", platformRole: null },
    memberships: [{ organizationId: org, role, status: "ACTIVE", userId: "staff-1", membershipId: "membership-1" }] };
  const records = new Map<string, unknown>([
    ["/api/v1/me", session],
    ["/api/v1/organizations/" + org + "/orders", { items: [order], nextCursor: null }],
    ["/api/v1/organizations/" + org + "/orders/" + orderId, order],
    ["/api/v1/organizations/" + org + "/payments", { items: [payment], nextCursor: null }],
    ["/api/v1/organizations/" + org + "/payments/" + paymentId, payment],
    ["/api/v1/organizations/" + org + "/pickups", { items: [pickup], nextCursor: null }],
    ["/api/v1/organizations/" + org + "/pickups/" + pickupId, pickup],
    ["/api/v1/organizations/" + org + "/production", { campaignId, products: [{
      productId: "product-1", productName: "เสื้อชมรม", variants: [
        { variantId: "variant-1", variantName: "Size M", quantity: 24 },
        { variantId: "variant-2", variantName: "Size L", quantity: 12 },
      ],
    }] }],
  ]);
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const fulfill = (status: number, data: unknown, success = true) => route.fulfill({
      status, contentType: "application/json",
      body: JSON.stringify(success ? { success: true, data } : { success: false, error: data }),
    });
    if (method === "GET" && url.pathname === "/api/v1/organizations/" + org + "/orders/" + orderId) {
      // Review Payment and Pickup each require a fresh authoritative order.
      return fulfill(200, url.searchParams.has("pickup") ? pickupOrder : order);
    }
    if (method === "GET" && records.has(url.pathname)) return fulfill(200, records.get(url.pathname));
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      stats.unmockedWrites++;
      stats.blockedPaths.push(method + " " + url.pathname);
    }
    return route.abort("blockedbyclient");
  });
  return stats;
}

for (const theme of ["light", "dark"] as const) {
  test("Phase 12 STAFF queues, detail, confirmation safety and 4K layout / " + theme, async ({ browser }) => {
    test.setTimeout(160_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const stats = await setup(context);
    const page = await context.newPage();
    const measures: Array<Record<string, unknown>> = [];
    const routes = [
      { name: "staff-orders", url: "/org/orders/?organizationId=" + org, heading: "คำสั่งซื้อของหน่วยงาน" },
      { name: "staff-order-detail", url: "/org/orders/view/?organizationId=" + org + "&orderId=" + orderId, heading: "รายละเอียดคำสั่งซื้อ" },
      { name: "staff-payments", url: "/org/payments/?organizationId=" + org, heading: "ตรวจสอบการชำระเงิน" },
      { name: "staff-pickups", url: "/org/pickups/?organizationId=" + org, heading: "จุดรับสินค้า" },
    ];
    try {
      for (const r of routes) {
        await page.goto(root + r.url, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1, name: r.heading })).toBeVisible({ timeout: 18000 });
        for (const width of [320, 390, 768, 1024, 1440, 2560, 3840]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const layout = await page.evaluate(() => {
            const main = document.querySelector("main")?.getBoundingClientRect();
            const panel = document.querySelector('[class*="detailPanel"]')?.getBoundingClientRect();
            return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
              mainWidth: Math.round(main?.width ?? 0), detailWidth: Math.round(panel?.width ?? 0) };
          });
          expect(layout.overflow, theme + " " + r.name + " width " + width).toBeLessThanOrEqual(1);
          measures.push({ route: r.name, theme, width, ...layout });
          if ([390, 1440, 3840].includes(width)) {
            await page.screenshot({ path: resolve(evidence, theme + "-" + r.name + "-" + width + ".png"), animations: "disabled" });
          }
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        if (r.name === "staff-orders") {
          await expect(page.getByRole("link", { name: "ดูรายละเอียดคำสั่งซื้อ " + orderId })).toBeVisible();
          await page.getByRole("button", { name: "ใช้ตัวกรอง" }).click();
          await expect(page.getByRole("status")).toBeVisible();
        }
        if (r.name === "staff-payments") {
          await page.getByRole("button", { name: "ตรวจสอบ การชำระเงิน " + paymentId }).click();
          await expect(page.getByRole("region", { name: "ลำดับการตรวจสอบการชำระเงิน" })).toBeVisible();
          await page.screenshot({ path: resolve(evidence, theme + "-payments-selected-1440.png") });
          await page.getByRole("button", { name: "อนุมัติการชำระเงิน", exact: true }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
        }
        if (r.name === "staff-pickups") {
          await page.getByRole("button", { name: "ดูรายละเอียด Pickup " + pickupId }).click();
          await expect(page.getByRole("complementary", { name: "รายละเอียด Pickup" }).getByText("browser-only-staff-token")).toBeVisible();
          await page.screenshot({ path: resolve(evidence, theme + "-pickups-selected-1440.png") });
          await page.getByRole("button", { name: "ยืนยันรับสินค้า" }).first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
        }
      }
      expect(stats.unmockedWrites, JSON.stringify(stats.blockedPaths)).toBe(0);
      writeFileSync(resolve(evidence, "staff-measures-" + theme + ".json"), JSON.stringify({ stats, measures }, null, 2) + "\n");
    } finally { await context.close(); }
  });

  test("Phase 12 STAFF must not access admin-only production, organization isolation / " + theme, async ({ browser }) => {
    test.setTimeout(50_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
    const stats = await setup(context);
    const page = await context.newPage();
    try {
      await page.goto(root + "/org/production/?organizationId=" + org + "&campaignId=" + campaignId, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /ไม่มีสิทธิ์/ })).toBeVisible({ timeout: 18000 });
      await expect(page.getByRole("heading", { name: "สรุปงานผลิต" })).toHaveCount(0);
      await page.goto(root + "/org/payments/?organizationId=" + otherOrg, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /ไม่มีสิทธิ์/ })).toBeVisible({ timeout: 18000 });
      await expect(page.getByRole("heading", { name: "ตรวจสอบการชำระเงิน" })).toHaveCount(0);
      expect(stats.unmockedWrites).toBe(0);
    } finally { await context.close(); }
  });
  test("Phase 12 admin-only production report styling and accessible validation / " + theme, async ({ browser }) => {
    test.setTimeout(70_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const stats = await setup(context, "ORGANIZATION_ADMIN");
    const page = await context.newPage();
    try {
      await page.goto(root + "/org/production/?organizationId=" + org + "&campaignId=" + campaignId, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "สรุปงานผลิต", level: 1 })).toBeVisible({ timeout: 18000 });
      await expect(page.getByText("เสื้อชมรม").first()).toBeVisible();
      await expect(page.getByText("Size M").first()).toBeVisible();
      for (const width of [320, 390, 768, 1440, 3840]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth))).toBeLessThanOrEqual(1);
        if ([390, 1440].includes(width)) await page.screenshot({
          path: resolve(evidence, theme + "-admin-production-" + width + ".png"), animations: "disabled",
        });
      }
      expect(stats.unmockedWrites).toBe(0);
    } finally { await context.close(); }
  });

}
