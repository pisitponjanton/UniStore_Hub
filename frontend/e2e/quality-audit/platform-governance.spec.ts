/**
 * Campus Commerce A — behavior-focused browser regression suite.
 * Consolidated from historical work-item files; all test cases and mock guards retained.
 * Add related cases here; never introduce milestone-numbered spec files.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test.describe("Platform admin", () => {
const base = "http://127.0.0.1:3000";
const output = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-platform-admin");
mkdirSync(output, { recursive: true });
const timestamp = "2026-09-30T10:00:00.000Z";
const pendingId = "11111111-1111-4111-8111-111111111111";
const activeId = "22222222-2222-4222-8222-222222222222";
const orgs = [
  { organizationId: pendingId, name: "Campus Pending Club", description: "Pending campus activities", status: "PENDING", createdBy: "creator-1", createdAt: timestamp, updatedAt: timestamp },
  { organizationId: activeId, name: "Campus Active Store", description: "Student club supplies", status: "ACTIVE", createdBy: "creator-2", createdAt: timestamp, updatedAt: timestamp },
];
const users = [
  { userId: "platform-admin", name: "Operator Example", email: "platform@example.test", platformRole: "PLATFORM_ADMIN", status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp },
  { userId: "user-disabled", name: "Disabled Member", email: "disabled@example.test", platformRole: null, status: "DISABLED", createdAt: timestamp, updatedAt: timestamp },
];

type Role = "platformAdmin" | "guest" | "customer" | "staff" | "orgAdmin";

async function install(context: BrowserContext, role: Role) {
  const stats = { unapprovedWrites: [] as string[], mockedTransitions: [] as string[], unexpectedReads: [] as string[] };
  if (role !== "guest") await context.addInitScript((r: Role) => {
    sessionStorage.setItem("unistoreHub.accessToken", "browser-only-" + r);
  }, role);
  const summary = { organizationsByStatus: { PENDING: 1, ACTIVE: 1, SUSPENDED: 0 }, usersByStatus: { ACTIVE: 1, DISABLED: 1 } };
  const user = { userId: role === "platformAdmin" ? "platform-admin" : "other-user",
    name: "Browser Mock User", email: "browser@example.test", status: "ACTIVE",
    platformRole: role === "platformAdmin" ? "PLATFORM_ADMIN" : null };
  const memberships = role === "staff" || role === "orgAdmin"
    ? [{ organizationId: activeId, role: role === "staff" ? "STAFF" : "ORGANIZATION_ADMIN", status: "ACTIVE" }]
    : [];
  const records = new Map<string, unknown>([
    ["/api/v1/me", { user, memberships }],
    ["/api/v1/platform/summary", summary],
    ["/api/v1/platform/organizations", { items: orgs, nextCursor: null }],
    ["/api/v1/platform/users", { items: users, nextCursor: null }],
  ]);
  await context.route("**/api/v1/**", async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    // The one mutation simulator is explicitly scoped to our mock organization and ADMIN test.
    if (method === "POST" && role === "platformAdmin" && url.pathname === "/api/v1/platform/organizations/" + pendingId + "/approve") {
      stats.mockedTransitions.push(method + " " + url.pathname);
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: { ...orgs[0], status: "ACTIVE", updatedAt: timestamp } }) });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      stats.unapprovedWrites.push(method + " " + url.pathname);
      return route.abort("blockedbyclient");
    }
    if (records.has(url.pathname)) return route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: records.get(url.pathname) }),
    });
    stats.unexpectedReads.push(url.pathname);
    return route.abort("blockedbyclient");
  });
  return stats;
}

const paths = [
  { name: "summary", path: "/platform/summary/", heading: "ภาพรวม Platform" },
  { name: "organizations", path: "/platform/organizations/", heading: "จัดการหน่วยงาน" },
  { name: "users", path: "/platform/users/", heading: "ผู้ใช้ระดับ Platform" },
] as const;

async function waitForLoaded(page: Page, heading: string) {
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("navigation", { name: "ส่วนจัดการ Platform" })).toBeVisible({ timeout: 20000 });
  await expect(page.locator("main")).toBeVisible();
}

for (const theme of ["light", "dark"] as const) {
  test("responsive Platform Admin, real filters & modal safety — " + theme, async ({ browser }) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const stats = await install(context, "platformAdmin");
    const page = await context.newPage();
    const observations: Array<{ theme: string; route: string; viewport: number; mainWidth: number; overflow: number; orgColumns: number }> = [];
    try {
      for (const spec of paths) {
        await page.goto(base + spec.path, { waitUntil: "domcontentloaded" });
        await waitForLoaded(page, spec.heading);
        // The visual migration must keep a neutral heading, not the old decorative gradient.
        const headerSkin = await page.locator("main > header").first().evaluate(element => ({
          backgroundImage: getComputedStyle(element).backgroundImage,
          background: getComputedStyle(element).backgroundColor,
          borderBottomStyle: getComputedStyle(element).borderBottomStyle,
        }));
        expect(headerSkin.backgroundImage, theme + " / " + spec.name + " Platform heading").toBe("none");
        expect(headerSkin.borderBottomStyle).toBe("solid");
        expect(headerSkin.background).not.toBe("rgb(25, 59, 57)");
        if (spec.name === "organizations") await expect(page.getByText("Campus Pending Club").first()).toBeVisible();
        if (spec.name === "users") await expect(page.getByText("Operator Example").first()).toBeVisible();
        for (const width of [320, 390, 768, 1024, 1440, 1920, 2560, 3840]) {
          await page.setViewportSize({ width, height: 900 });
          let m = { mainWidth: 0, overflow: 0, orgColumns: 0 };
          await expect.poll(async () => {
            try {
              m = await page.locator("main").first().evaluate(el => {
                const main = el.getBoundingClientRect();
                const grid = document.querySelector<HTMLElement>('[aria-label="รายการหน่วยงานทั้งหมด"]');
                return { mainWidth: Math.round(main.width), overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
                  orgColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0 };
              });
            } catch { m = { mainWidth: 0, overflow: 0, orgColumns: 0 }; }
            return m.mainWidth;
          }, { timeout: 15000, intervals: [50, 100, 200] }).toBeGreaterThan(0);
          expect(m.overflow, theme + " " + spec.name + " width=" + width).toBeLessThanOrEqual(1);
          if (width === 3840) expect(m.mainWidth).toBeGreaterThan(2600);
          if (spec.name === "organizations" && width === 3840) expect(m.orgColumns).toBe(2);
          observations.push({ theme, route: spec.name, viewport: width, ...m });
          if ([390, 1440, 3840].includes(width)) await page.screenshot({
            path: resolve(output, theme + "-" + spec.name + "-" + width + ".png"), animations: "disabled",
          });
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        if (spec.name === "organizations") {
          await page.getByRole("button", { name: /รออนุมัติ/ }).first().click();
          await expect(page.getByText("Campus Pending Club").first()).toBeVisible();
          await expect(page.getByText("Campus Active Store")).toHaveCount(0);
          await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await expect(page.getByRole("button", { name: "ยืนยันอนุมัติ" })).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
          expect(stats.mockedTransitions).toHaveLength(0);
          await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
          await page.getByRole("button", { name: "ยืนยันอนุมัติ" }).click();
          await expect(page.getByText("อนุมัติหน่วยงาน Campus Pending Club เรียบร้อยแล้ว")).toBeVisible();
          expect(stats.mockedTransitions).toHaveLength(1);
        }
        if (spec.name === "users") {
          await page.getByRole("searchbox", { name: "ค้นหาผู้ใช้ที่โหลดแล้ว" }).fill("disabled@example.test");
          await expect(page.getByText("Disabled Member")).toBeVisible();
          await expect(page.getByText("Operator Example")).toHaveCount(0);
          await expect(page.getByText("รายการนี้เป็น read-only")).toBeVisible();
          await expect(page.getByRole("button", { name: /แก้ไขสิทธิ์|ลบผู้ใช้|ปิดบัญชี/ })).toHaveCount(0);
        }
      }
      expect(stats.unapprovedWrites, stats.unapprovedWrites.join(", ")).toHaveLength(0);
      expect(stats.unexpectedReads, stats.unexpectedReads.join(", ")).toHaveLength(0);
      writeFileSync(resolve(output, "admin-layout-" + theme + ".json"), JSON.stringify({ observations, stats }, null, 2) + "\n");
    } finally { await context.close(); }
  });

  test("non-platform roles cannot access Platform Admin routes — " + theme, async ({ browser }) => {
    test.setTimeout(100_000);
    for (const role of ["guest", "customer", "staff", "orgAdmin"] as const) {
      const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
      const stats = await install(context, role);
      const page = await context.newPage();
      try {
        for (const route of paths) {
          await page.goto(base + route.path, { waitUntil: "domcontentloaded" });
          if (role === "guest") await expect(page.getByRole("heading", { name: /เข้าสู่ระบบ|ไม่มีสิทธิ์/ })).toBeVisible({ timeout: 15000 });
          else await expect(page.getByRole("heading", { name: /ไม่มีสิทธิ์/ })).toBeVisible({ timeout: 15000 });
          await expect(page.getByRole("heading", { name: route.heading })).toHaveCount(0);
          await expect(page.getByRole("navigation", { name: "ส่วนจัดการ Platform" })).toHaveCount(0);
        }
        expect(stats.mockedTransitions).toHaveLength(0);
        expect(stats.unapprovedWrites).toHaveLength(0);
      } finally { await context.close(); }
    }
  });

  test("empty directory and recoverable API error — " + theme, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 860 }, reducedMotion: "reduce" });
    const stats = await install(context, "platformAdmin");
    await context.route("**/api/v1/platform/users", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: { items: [], nextCursor: null } }),
    }));
    await context.route("**/api/v1/platform/organizations", route => route.abort("failed"));
    const page = await context.newPage();
    try {
      await page.goto(base + "/platform/users/", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("ยังไม่มีผู้ใช้")).toBeVisible({ timeout: 15000 });
      const emptyVisual = await page.locator("main").first().evaluate(element => ({
        overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        panelCount: element.querySelectorAll('[class*="statePanel"]').length,
      }));
      expect(emptyVisual.overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: resolve(output, theme + "-users-empty-390.png"), animations: "disabled" });
      await page.goto(base + "/platform/organizations/", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("ไม่สามารถโหลดหน่วยงานได้")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("link", { name: "กลับไปพื้นที่ทำงาน" })).toBeVisible();
      await page.screenshot({ path: resolve(output, theme + "-organizations-error-390.png"), animations: "disabled" });
      expect(stats.unapprovedWrites).toHaveLength(0);
      expect(stats.mockedTransitions).toHaveLength(0);
    } finally { await context.close(); }
  });

}
});
