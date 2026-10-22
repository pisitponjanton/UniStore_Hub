/**
 * Campus Commerce A — behavior-focused browser regression suite.
 * Consolidated from historical work-item files; all test cases and mock guards retained.
 * Add related cases here; never introduce milestone-numbered spec files.
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test.describe("Customer workspace", () => {
const base = "http://127.0.0.1:3000";
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-customer-journeys");
mkdirSync(evidence, { recursive: true });
const org = "55555555-5555-4555-8555-555555555555";
const store = "66666666-6666-4666-8666-666666666666";
const product = "77777777-7777-4777-8777-777777777778";
const variant = "88888888-8888-4888-8888-888888888888";
const campaign = "99999999-9999-4999-8999-999999999998";
const orderA = "11111111-1111-4111-8111-111111111111";
const orderB = "22222222-2222-4222-8222-222222222222";
const orderC = "33333333-3333-4333-8333-333333333333";
const createdAt = "2026-09-29T10:00:00.000Z";
const order = (orderId: string, status: string) => ({
  orderId, organizationId: org, campaignId: campaign, customerId: "customer-1",
  status, subtotal: 50000, total: 50000,
  items: [{ orderItemId: "item-" + orderId, productId: product, variantId: variant,
    productName: "เสื้อชมรม", variantName: "Size M", unitPrice: 25000, quantity: 2, totalPrice: 50000 }],
  createdAt, updatedAt: "2026-09-29T12:00:00.000Z",
});
const ownOrders = [order(orderA, "PENDING_PAYMENT"), order(orderB, "READY_FOR_PICKUP"), order(orderC, "CANCELLED")];
const item = { organizationId: org, storeId: store, productId: product, name: "เสื้อชมรม",
  description: "สินค้าในมหาวิทยาลัย", imageUrl: null, status: "ACTIVE",
  variants: [{ variantId: variant, organizationId: org, productId: product, name: "Size M", price: 25000, status: "ACTIVE" }] };
const campaignDto = { organizationId: org, storeId: store, campaignId: campaign, name: "รอบพรีออเดอร์",
  status: "OPEN", openAt: createdAt, closeAt: "2026-11-30T08:00:00.000Z",
  paymentDeadline: "2026-12-03T08:00:00.000Z", pickupAt: "2026-12-15T08:00:00.000Z" };
const notifications = [
  { notificationId: "notice-1", userId: "customer-1", type: "PAYMENT_REJECTED",
    title: "ตรวจสอบการชำระเงิน", message: "ตรวจรายละเอียดก่อนส่งหลักฐานใหม่",
    resourceType: "ORDER", resourceId: orderA, readAt: null as string | null, createdAt },
  { notificationId: "notice-2", userId: "customer-1", type: "READY_FOR_PICKUP",
    title: "พร้อมรับสินค้า", message: "คำสั่งซื้อของคุณพร้อมรับแล้ว",
    resourceType: "ORDER", resourceId: orderB, readAt: null as string | null, createdAt },
];
async function install(context: BrowserContext) {
  const counters = { simulatedMutations: 0, unmockedWrites: 0, blockedPaths: [] as string[] };
  const scopedNotifications = notifications.map(item => ({ ...item }));
  const get = new Map<string, unknown>([
    ["/api/v1/me", { user: { userId: "customer-1", email: "test@example.com", name: "Test Customer",
      status: "ACTIVE", platformRole: null }, memberships: [] }],
    ["/api/v1/me/orders", { items: ownOrders, nextCursor: null }],
    ...ownOrders.map(o => ["/api/v1/me/orders/" + o.orderId, o] as [string, unknown]),
    ["/api/v1/me/orders/" + orderB + "/pickup", {
      pickupId: "pickup-1", organizationId: org, orderId: orderB,
      token: "local-test-pickup-token-abcdefghijkl", status: "READY", receivedBy: null,
      receivedAt: null, createdAt, updatedAt: createdAt,
    }],
    ["/api/v1/storefront/organizations/" + org + "/stores", {
      items: [{ organizationId: org, storeId: store, name: "ร้านชมรม", description: "", status: "ACTIVE" }],
      nextCursor: null,
    }],
    ["/api/v1/storefront/organizations/" + org + "/stores/" + store + "/products", { items: [item], nextCursor: null }],
    ["/api/v1/storefront/organizations/" + org + "/stores/" + store + "/products/" + product, item],
    ["/api/v1/storefront/organizations/" + org + "/stores/" + store + "/campaigns", { items: [campaignDto], nextCursor: null }],
  ]);
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const respond = (status: number, data: unknown, success = true) => route.fulfill({
      status, contentType: "application/json",
      body: JSON.stringify(success ? { success: true, data } : { success: false, error: data }),
    });
    if (method === "GET" && url.pathname === "/api/v1/notifications") {
      const filter = url.searchParams.get("read");
      return respond(200, { items: scopedNotifications.filter(n => filter === null || (filter === "true" ? n.readAt !== null : n.readAt === null)), nextCursor: null });
    }
    if (method === "GET" && url.pathname === "/api/v1/me/orders/" + orderA + "/payment") {
      return respond(404, { code: "PAYMENT_NOT_FOUND", message: "No slip yet" }, false);
    }
    if (method === "GET" && get.has(url.pathname)) return respond(200, get.get(url.pathname));
    if (method === "PATCH" && url.pathname === "/api/v1/notifications/notice-1/read") {
      counters.simulatedMutations++;
      scopedNotifications[0].readAt = "2026-09-29T13:00:00.000Z";
      return respond(200, scopedNotifications[0]);
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) { counters.unmockedWrites++; counters.blockedPaths.push(method + " " + url.pathname); }
    return route.abort("blockedbyclient");
  });
  return counters;
}

for (const theme of ["light", "dark"] as const) {
  test("customer workspace action/readability and 4K layout / " + theme, async ({ browser }) => {
    test.setTimeout(160_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 920 }, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("unistoreHub.accessToken", "browser-only-phase11"));
    const counters = await install(context);
    const page = await context.newPage();
    const measured: Array<Record<string, unknown>> = [];
    const routes = [
      { name: "checkout", href: "/orders/new/?organizationId=" + org + "&campaignId=" + campaign + "&productId=" + product + "&variantId=" + variant, heading: "ตรวจสอบคำสั่งซื้อ" },
      { name: "orders", href: "/my/orders/", heading: "คำสั่งซื้อของฉัน" },
      { name: "order-detail", href: "/my/order/?orderId=" + orderA, heading: "รายละเอียดคำสั่งซื้อ" },
      { name: "payment", href: "/my/payment/?orderId=" + orderA, heading: "ชำระและส่งหลักฐาน" },
      { name: "pickup", href: "/my/pickup/?orderId=" + orderB, heading: "ข้อมูลรับสินค้า" },
      { name: "notifications", href: "/notifications/", heading: "การแจ้งเตือน" },
    ];
    try {
      for (const route of routes) {
        await page.goto(base + route.href, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible({ timeout: 18000 });
        for (const width of [320, 390, 768, 1024, 1440, 1920, 2560, 3840]) {
          await page.setViewportSize({ width, height: 920 });
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const measure = await page.evaluate(() => {
            const media = document.querySelector('[class*="productMedia"]')?.getBoundingClientRect();
            const summary = document.querySelector('[class*="productSummary"]')?.getBoundingClientRect();
            const overlap = media && summary && Math.min(media.right, summary.right) > Math.max(media.left, summary.left) &&
              Math.min(media.bottom, summary.bottom) > Math.max(media.top, summary.top);
            return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
              overlap: Boolean(overlap), mediaWidth: media?.width ?? null, summaryWidth: summary?.width ?? null };
          });
          expect(measure.overflow, theme + " /" + route.name + " " + width).toBeLessThanOrEqual(1);
          if (route.name === "checkout") expect(measure.overlap, "checkout media collides with product text: " + width).toBe(false);
          measured.push({ theme, route: route.name, width, ...measure });
          if ([390, 1440].includes(width) || (width === 3840 && route.name === "checkout")) {
            await page.screenshot({ path: resolve(evidence, theme + "-" + route.name + "-" + width + ".png"), animations: "disabled" });
          }
        }
        await page.setViewportSize({ width: 1440, height: 920 });
        // Migrated customer headers are surface-first; they must not regress to the old dark hero.
        const primaryHeading = page.getByRole("heading", { level: 1, name: route.heading });
        const headerSkin = await primaryHeading.evaluate(el => {
          const header = el.closest('[class*="header"],[class*="detailHero"]');
          if (!header) return null;
          const style = getComputedStyle(header);
          return { background: style.backgroundColor, image: style.backgroundImage };
        });
        expect(headerSkin, "missing customer header /" + route.name).not.toBeNull();
        expect(headerSkin?.image, theme + " " + route.name + " should use formal surface, not gradient").toBe("none");
        expect(headerSkin?.background, theme + " " + route.name + " must not use historic teal").not.toBe("rgb(25, 59, 57)");
        if (route.name === "orders") {
          await expect(page.getByRole("link", { name: "ชำระเงิน คำสั่งซื้อ " + orderA })).toBeVisible();
          await page.getByRole("button", { name: /เสร็จสิ้น 1/ }).click();
          await expect(page.getByText("อ้างอิง " + orderC.slice(0, 8))).toBeVisible();
          await page.getByRole("button", { name: /ทั้งหมด 3/ }).click();
        }
        if (route.name === "order-detail") {
          await page.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }).click();
          await expect(page.getByRole("dialog", { name: "ยืนยันการยกเลิกคำสั่งซื้อ" })).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
        }
        if (route.name === "payment") {
          await page.getByRole("button", { name: "ส่งหลักฐานการชำระเงิน" }).click();
          await expect(page.getByText("กรุณาเลือกไฟล์หลักฐานการชำระเงิน")).toBeVisible();
        }
        if (route.name === "pickup") {
          await expect(page.getByText("local-test-pickup-token-abcdefghijkl")).toBeVisible();
          await expect(page.getByRole("heading", { name: /QR และ Pickup Token/ })).toBeVisible();
        }
        if (route.name === "notifications") {
          await page.getByRole("button", { name: "ทำเครื่องหมายว่าอ่านแล้ว" }).first().click();
          await expect(page.getByText(/ทำเครื่องหมาย.*ว่าอ่านแล้ว/).first()).toBeVisible();
          await page.getByRole("button", { name: "ยังไม่อ่าน", exact: true }).click();
          await expect(page.getByRole("heading", { name: "พร้อมรับสินค้า" })).toBeVisible();
        }
      }
      expect(counters.unmockedWrites, JSON.stringify(counters.blockedPaths)).toBe(0);
      expect(counters.simulatedMutations).toBe(1);
      writeFileSync(resolve(evidence, "customer-flow-" + theme + ".json"), JSON.stringify({ counters, measured }, null, 2) + "\n");
    } finally { await context.close(); }
  });
  test("customer empty/error/retry and pickup-not-ready states / " + theme, async ({ browser }) => {
    test.setTimeout(65_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("unistoreHub.accessToken", "browser-only-phase11"));
    const counters = await install(context);
    let recoverOrders = false;
    await context.route("**/api/v1/me/orders", async route => {
      if (route.request().method() !== "GET") return route.abort("blockedbyclient");
      return route.fulfill({
        status: recoverOrders ? 200 : 503,
        contentType: "application/json",
        body: JSON.stringify(recoverOrders
          ? { success: true, data: { items: ownOrders, nextCursor: null } }
          : { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Browser test outage" } }),
      });
    });
    const page = await context.newPage();
    try {
      await page.goto(base + "/my/orders/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "ไม่สามารถโหลดคำสั่งซื้อได้" })).toBeVisible();
      recoverOrders = true;
      await page.getByRole("button", { name: "ลองโหลดอีกครั้ง" }).click();
      await expect(page.getByRole("link", { name: "ชำระเงิน คำสั่งซื้อ " + orderA })).toBeVisible();

      await page.goto(base + "/my/pickup/?orderId=" + orderA, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "ยังไม่ต้องเดินทางไปรับสินค้า" })).toBeVisible();
      await expect(page.getByText("local-test-pickup-token-abcdefghijkl")).toHaveCount(0);
      await page.screenshot({ path: resolve(evidence, theme + "-pickup-not-ready-390.png") });

      await context.route("**/api/v1/notifications**", route => route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: [], nextCursor: null } }),
      }));
      await page.goto(base + "/notifications/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "ไม่มีการแจ้งเตือน" })).toBeVisible();
      expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth))).toBeLessThanOrEqual(1);
      await page.screenshot({ path: resolve(evidence, theme + "-notifications-empty-390.png") });
      expect(counters.unmockedWrites).toBe(0);
    } finally { await context.close(); }
  });

}
});
