import { expect, test, type BrowserContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const host = "http://127.0.0.1:3000";
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase13");
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
  test("Phase 13 admin route layouts and tenant-safe controls / " + theme, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const stats = await install(context);
    const page = await context.newPage();
    const observations: Array<Record<string, unknown>> = [];
    try {
      for (const route of routes) {
        await page.goto(host + route.path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("ห้ามเห็นหน่วยงานนี้")).toHaveCount(0);
        for (const width of [320, 390, 768, 1024, 1440, 1920, 2560, 3840]) {
          await page.setViewportSize({ width, height: 920 });
          await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
          await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
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

  test("Phase 13 denies STAFF cross-tenant admin screens / " + theme, async ({ browser }) => {
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
