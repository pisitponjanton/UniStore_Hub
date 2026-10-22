/**
 * Campus Commerce A — behavior-focused browser regression suite.
 * Consolidated from historical work-item files; all test cases and mock guards retained.
 * Add related cases here; never introduce milestone-numbered spec files.
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test.describe("Staff operations", () => {
const root = "http://127.0.0.1:3000";
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-staff-operations");
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
  test("STAFF queues, detail, confirmation safety and 4K layout / " + theme, async ({ browser }) => {
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
        // Staff workbenches use the formal neutral header skin, retaining all existing queue controls.
        const headerSkin = await page.locator("main").locator('[class*="header"], [class*="detailHero"]').first().evaluate(el => ({
          backgroundImage: getComputedStyle(el).backgroundImage,
          backgroundColor: getComputedStyle(el).backgroundColor,
        }));
        expect(headerSkin.backgroundImage, theme + " / " + r.name + " should not inherit decorative gradients").toBe("none");
        expect(headerSkin.backgroundColor, theme + " / " + r.name + " should not retain historical teal").not.toBe("rgb(25, 59, 57)");

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

  test("STAFF must not access admin-only production, organization isolation / " + theme, async ({ browser }) => {
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
  test("admin-only production report styling and accessible validation / " + theme, async ({ browser }) => {
    test.setTimeout(70_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const stats = await setup(context, "ORGANIZATION_ADMIN");
    const page = await context.newPage();
    try {
      await page.goto(root + "/org/production/?organizationId=" + org + "&campaignId=" + campaignId, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "สรุปงานผลิต", level: 1 })).toBeVisible({ timeout: 18000 });
      const productionSkin = await page.locator("main").locator('[class*="header"]').first().evaluate(el => ({
        backgroundImage: getComputedStyle(el).backgroundImage,
        backgroundColor: getComputedStyle(el).backgroundColor,
      }));
      expect(productionSkin.backgroundImage, theme + " production header").toBe("none");

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
});

test.describe("Organization admin", () => {
const host = "http://127.0.0.1:3000";
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-organization-admin");
mkdirSync(evidence, { recursive: true });
const org = "55555555-5555-4555-8555-555555555555";
const outsider = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = "2026-10-01T09:00:00.000Z";
const organization = { organizationId: org, name: "ชมรมมหาวิทยาลัยทดสอบ", description: "ร้านค้าและกิจกรรมภายในมหาวิทยาลัย", status: "ACTIVE",
  createdBy: "admin-1", createdAt: now, updatedAt: now };
const member = { organizationId: org, userId: "admin-1", role: "ORGANIZATION_ADMIN", status: "ACTIVE",
  user: { userId: "admin-1", name: "Admin Demo", email: "admin@example.test" }, createdAt: now, updatedAt: now };
const report = { totalStores: 1, totalProducts: 2, campaignsByStatus: { OPEN: 1, CLOSED: 0 },
  ordersByStatus: { PAID: 4, RECEIVED: 2 }, pendingPaymentReviews: 1, paidOrderCount: 4, paidRevenueSatang: 250000 };
const audit = { auditId: "audit-1", organizationId: org, actorId: "admin-1", action: "PAYMENT_APPROVED",
  resourceType: "PAYMENT", resourceId: "payment-1", metadata: { orderId: "order-1" }, createdAt: now };
const routes = [
  { name: "select", path: "/org/select/" },
  { name: "dashboard", path: "/org/dashboard/?organizationId=" + org },
  { name: "settings", path: "/org/settings/?organizationId=" + org },
  { name: "staff", path: "/org/staff/?organizationId=" + org },
  { name: "stores", path: "/org/stores/?organizationId=" + org },
  { name: "products", path: "/org/products/?organizationId=" + org },
  { name: "campaigns", path: "/org/campaigns/?organizationId=" + org },
  { name: "audit", path: "/org/audit/?organizationId=" + org },
] as const;

async function install(context: BrowserContext, role: "ORGANIZATION_ADMIN" | "STAFF" = "ORGANIZATION_ADMIN") {
  await context.addInitScript(() => {
    sessionStorage.setItem("unistoreHub.accessToken", "browser-only-phase13");
    sessionStorage.setItem("unistoreHub.activeOrganizationId", "55555555-5555-4555-8555-555555555555");
  });
  const stats = { writes: 0, crossTenantReads: 0, unhandledReads: [] as string[] };
  const records = new Map<string, unknown>([
    ["/api/v1/me", { user: { userId: "admin-1", name: "Admin Demo", email: "admin@example.test", status: "ACTIVE", platformRole: null },
      memberships: [{ organizationId: org, userId: "admin-1", role, status: "ACTIVE" }] }],
    ["/api/v1/organizations", { items: [organization, { ...organization, organizationId: outsider, name: "ห้ามเห็นหน่วยงานนี้" }], nextCursor: null }],
    ["/api/v1/organizations/" + org, organization],
    ["/api/v1/organizations/" + org + "/reports", report],
    ["/api/v1/organizations/" + org + "/members", { items: [member], nextCursor: null }],
    ["/api/v1/organizations/" + org + "/stores", { items: [], nextCursor: null }],
    ["/api/v1/organizations/" + org + "/products", { items: [], nextCursor: null }],
    ["/api/v1/organizations/" + org + "/campaigns", { items: [], nextCursor: null }],
    ["/api/v1/organizations/" + org + "/audit-logs", { items: [audit], nextCursor: null }],
  ]);
  await context.route("**/api/v1/**", async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      stats.writes++;
      return route.abort("blockedbyclient");
    }
    if (url.pathname.includes(outsider)) {
      stats.crossTenantReads++;
      return route.abort("blockedbyclient");
    }
    if (records.has(url.pathname)) return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: records.get(url.pathname) }),
    });
    stats.unhandledReads.push(url.pathname);
    return route.abort("blockedbyclient");
  });
  return stats;
}

for (const theme of ["light", "dark"] as const) {
  test("admin route layouts and tenant-safe controls / " + theme, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const stats = await install(context);
    const page = await context.newPage();
    const observations: Array<Record<string, unknown>> = [];
    try {
      for (const route of routes) {
        await page.goto(host + route.path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
        const routeHeading = page.getByRole("heading", { level: 1 }).first();
        await expect(routeHeading).toBeVisible({ timeout: 15000 });
        await expect(routeHeading).not.toHaveText(/กำลังตรวจสอบบัญชี|กำลังโหลด/, { timeout: 15000 });
        const settledTitle = await routeHeading.innerText();
        await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("ห้ามเห็นหน่วยงานนี้")).toHaveCount(0);
        for (const width of [320, 390, 768, 1024, 1440, 1920, 2560, 3840]) {
          await page.setViewportSize({ width, height: 920 });
          await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
          await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
          // Do not capture a transient session-check/loading screen during responsive resizing.
          await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(settledTitle, { timeout: 15000 });
          let m = { width: 0, overflow: 0 };
          await expect.poll(async () => {
            try {
              m = await page.locator("main").first().evaluate(element => {
                const main = element.getBoundingClientRect();
                return { width: Math.round(main.width), overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
              });
            } catch { m = { width: 0, overflow: 0 }; }
            return m.width;
          }, { message: route.name + " main layout at " + width, timeout: 12000, intervals: [50, 100, 180] }).toBeGreaterThan(0);
          expect(m.overflow, theme + " " + route.name + " " + width).toBeLessThanOrEqual(1);
          if (width === 3840 && route.name === "dashboard") expect(m.width).toBeGreaterThan(2300);
          observations.push({ theme, route: route.name, viewport: width, ...m });
          if ([390, 1440, 3840].includes(width)) await page.screenshot({
            path: resolve(evidence, theme + "-" + route.name + "-" + width + ".png"),
            animations: "disabled",
          });
        }
        await page.setViewportSize({ width: 1440, height: 920 });
        if (route.name === "dashboard" || route.name === "settings" || route.name === "staff") {
          const nav = page.getByRole("navigation", { name: "พื้นที่จัดการหน่วยงาน" });
          await expect(nav).toBeVisible();
          await expect(nav.getByRole("link", { name: "เปลี่ยนหน่วยงาน" })).toHaveAttribute("href", "/org/select/");
          for (const link of await nav.locator('a[href*="organizationId="]').all()) {
            const href = (await link.getAttribute("href"))!;
            expect(new URL(href, host).searchParams.get("organizationId")).toBe(org);
          }
        }
        if (route.name === "select") {
          await expect(page.getByText(organization.name).first()).toBeVisible();
        }
        if (route.name === "settings") {
          const heading = page.getByRole("heading", { name: "ข้อมูลที่แสดง" });
          await expect(heading).toBeVisible();
          expect(await heading.evaluate(el => el.getBoundingClientRect().width), "settings heading must not shrink to a vertical word").toBeGreaterThan(145);
          const name = page.getByRole("textbox", { name: /ชื่อหน่วยงาน/ });
          await expect(name).toHaveValue(organization.name);
          await name.fill("");
          await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
          await expect(page.getByRole("link", { name: "กรุณาระบุชื่อหน่วยงาน" })).toHaveAttribute("href", "#organization-settings-name");
        }
        if (route.name === "staff") {
          await expect(page.getByRole("heading", { name: "Admin Demo" })).toBeVisible();
          await expect(page.getByRole("button", { name: "นำออก" }).first()).toBeDisabled();
        }
        if (route.name === "audit") {
          await expect(page.getByText("PAYMENT_APPROVED").first()).toBeVisible();
        }
      }
      expect(stats.writes).toBe(0);
      expect(stats.crossTenantReads).toBe(0);
      writeFileSync(resolve(evidence, theme + "-admin-routes.json"), JSON.stringify({ stats, observations }, null, 2) + "\n");
    } finally { await context.close(); }
  });

  test("denies STAFF cross-tenant admin screens / " + theme, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
    const stats = await install(context, "STAFF");
    const page = await context.newPage();
    try {
      for (const path of ["/org/settings/?organizationId=" + org, "/org/staff/?organizationId=" + outsider,
        "/org/audit/?organizationId=" + org]) {
        await page.goto(host + path, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: /ไม่มีสิทธิ์/ })).toBeVisible({ timeout: 15000 });
      }
      expect(stats.writes).toBe(0);
      expect(stats.crossTenantReads).toBe(0);
    } finally { await context.close(); }
  });
}
});
