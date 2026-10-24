import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { localAuditTargets } from "./fixture-guard";

const ORG = "55555555-5555-4555-8555-555555555555";
const ORG_OTHER = "55555555-5555-4555-8555-555555555556";
const account = (role: "guest" | "customer" | "staff" | "organizationAdmin" | "platformAdmin") => ({
  user: {
    userId: "browser-only-" + role,
    email: role + "@browser.local.test",
    name: "ทดสอบ " + role,
    status: "ACTIVE",
    platformRole: role === "platformAdmin" ? "PLATFORM_ADMIN" : null,
  },
  memberships: role === "staff" || role === "organizationAdmin"
    ? [
        { organizationId: ORG, role: role === "staff" ? "STAFF" : "ORGANIZATION_ADMIN", status: "ACTIVE" },
        { organizationId: ORG_OTHER, role: "STAFF", status: "ACTIVE" },
      ]
    : [],
});
const organizations = [
  {
    organizationId: ORG, name: "ชมรมไอที (ทดสอบเบราว์เซอร์)", description: "หน่วยงานทดสอบที่มีสิทธิ์เข้า",
    status: "ACTIVE", createdBy: "browser-only", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    organizationId: ORG_OTHER, name: "ชมรมดนตรี (ทดสอบเบราว์เซอร์)", description: "หน่วยงานอีกแห่งเพื่อเลือกสิทธิ์",
    status: "ACTIVE", createdBy: "browser-only", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  },
];
type Role = "guest" | "customer" | "staff" | "organizationAdmin" | "platformAdmin";

async function readOnlyContext(browser: Browser, role: Role) {
  const { frontend } = localAuditTargets();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const roleSession = account(role);
  if (role !== "guest") {
    await context.addInitScript(() => {
      window.sessionStorage.setItem("unistoreHub.accessToken", "browser-only-ui-token");
    });
  }
  let nonRead = 0;
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      nonRead++;
      await route.abort("blockedbyclient");
      return;
    }
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (path === "/me") {
      await route.fulfill({ status: role === "guest" ? 401 : 200, contentType: "application/json",
        body: role === "guest"
          ? JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Browser fixture anonymous" } })
          : JSON.stringify({ success: true, data: roleSession }) });
      return;
    }
    if (path === "/organizations") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: organizations, nextCursor: null } }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json",
      body: JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Not part of browser fixture" } }) });
  });
  const page = await context.newPage();
  const evidence = join("test-results", "quality-audit", "account-entry-" + randomUUID());
  await mkdir(evidence, { recursive: true });
  return { context, page, frontend, evidence, nonRead: () => nonRead };
}

async function checkWidths(page: Page, evidence: string, label: string) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    expect(overflow, label + " horizontal overflow at " + width).toBeLessThanOrEqual(1);
    if (width === 390 || width === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(evidence, label + "-" + width + ".png"), animations: "disabled" });
    }
  }
}

for (const form of ["login", "register"] as const) {
  test("Guest " + form + " makes contextual return route clear, keeps form and responsive state", async ({ browser }) => {
    test.setTimeout(90000);
    const fixture = await readOnlyContext(browser, "guest");
    try {
      const { page, frontend, evidence } = fixture;
      const returnTo = "/orders/new/?campaignId=fixture-only";
      await page.goto(frontend + "/" + form + "/?returnTo=" + encodeURIComponent(returnTo), { waitUntil: "domcontentloaded" });
      const submit = page.locator('form button[type="submit"]');
      await expect(submit).toBeVisible({ timeout: 18000 });
      await expect(page.getByRole("status").filter({ hasText: "กลับไปตรวจสอบคำสั่งซื้อ" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "อีเมล" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "แสดงรหัสผ่าน" })).toBeEnabled();
      const switchLink = page.getByRole("link", { name: form === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ" });
      const switchTarget = await switchLink.getAttribute("href");
      expect(switchTarget).toContain("returnTo=");
      expect(new URL(switchTarget!, frontend).searchParams.get("returnTo")).toBe(returnTo);
      await checkWidths(page, evidence, "guest-" + form);
      await submit.click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(fixture.nonRead()).toBe(0);
    } finally { await fixture.context.close(); }
  });
}

const roleCases: Array<{ role: Exclude<Role, "guest">; org: boolean; platform: boolean }> = [
  { role: "customer", org: false, platform: false },
  { role: "staff", org: true, platform: false },
  { role: "organizationAdmin", org: true, platform: false },
  { role: "platformAdmin", org: false, platform: true },
];
for (const scenario of roleCases) {
  test("Authenticated " + scenario.role + " sees only allowed next-action workspaces", async ({ browser }) => {
    test.setTimeout(90000);
    const fixture = await readOnlyContext(browser, scenario.role);
    try {
      const { page, frontend } = fixture;
      await page.goto(frontend + "/login/?returnTo=" + encodeURIComponent("/orders/new/?productId=fixture-only"),
        { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "พร้อมใช้งานแล้ว" })).toBeVisible({ timeout: 18000 });
      await expect(page.getByRole("link", { name: "กลับไปตรวจสอบคำสั่งซื้อ" }))
        .toHaveAttribute("href", /orders\/new\/?\?productId=fixture-only/);
      await expect(page.getByRole("link", { name: "คำสั่งซื้อของฉัน" })).toBeVisible();
      await expect(page.getByRole("link", { name: scenario.org ? "จัดการหน่วยงาน" : "เปิดร้าน / สมัครหน่วยงาน" })).toHaveAttribute("href", "/org/select/");
      await expect(page.getByRole("link", { name: "ดูแลแพลตฟอร์ม" })).toHaveCount(scenario.platform ? 1 : 0);
      await checkWidths(page, fixture.evidence, "account-" + scenario.role);
      expect(fixture.nonRead()).toBe(0);
    } finally { await fixture.context.close(); }
  });
}

test("Organization entry lists only membership-backed workspaces, with clear selection before creation", async ({ browser }) => {
  test.setTimeout(90000);
  const fixture = await readOnlyContext(browser, "staff");
  try {
    const { page, frontend } = fixture;
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(frontend + "/org/select/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "วันนี้จะทำงานกับหน่วยงานไหน?" }))
      .toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("heading", { name: "เลือกพื้นที่เพื่อเริ่มงาน" })).toBeVisible();
    await expect(page.getByRole("button", { name: "เข้าใช้งาน ชมรมไอที (ทดสอบเบราว์เซอร์)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "เข้าใช้งาน ชมรมดนตรี (ทดสอบเบราว์เซอร์)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ต้องการพื้นที่ใหม่?" })).toBeVisible();
    const technical = page.getByText("ดูรหัสหน่วยงาน", { exact: true }).first();
    await expect(technical).toBeVisible();
    await technical.click();
    await expect(page.getByText(ORG, { exact: true })).toBeVisible();
    await technical.click();
    await expect(page.getByText(ORG, { exact: true })).toBeHidden();
    await page.getByRole("searchbox", { name: "ค้นหาหน่วยงานที่เข้าถึงได้" }).fill("ดนตรี");
    await expect(page.getByRole("button", { name: "เข้าใช้งาน ชมรมไอที (ทดสอบเบราว์เซอร์)" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "เข้าใช้งาน ชมรมดนตรี (ทดสอบเบราว์เซอร์)" })).toBeVisible();
    await page.getByRole("searchbox", { name: "ค้นหาหน่วยงานที่เข้าถึงได้" }).fill("");
    await checkWidths(page, fixture.evidence, "org-select-staff");
    expect(fixture.nonRead()).toBe(0);
  } finally { await fixture.context.close(); }
});


test("Customer without an organization can reach the first-time application form", async ({ browser }) => {
  const fixture = await readOnlyContext(browser, "customer");
  try {
    const { page, frontend } = fixture;
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(frontend + "/org/select/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "เริ่มต้นสร้างหน่วยงานของคุณ" }))
      .toBeVisible({ timeout: 18000 });
    await expect(page.getByRole("heading", { name: "สมัครหน่วยงาน" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "ชื่อหน่วยงาน" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "เลือกพื้นที่เพื่อเริ่มงาน" })).toHaveCount(0);
    await checkWidths(page, fixture.evidence, "first-organization");
    expect(fixture.nonRead()).toBe(0);
  } finally { await fixture.context.close(); }
});

test("Pending organization remains in review until API confirms approval", async ({ browser }) => {
  const fixture = await readOnlyContext(browser, "organizationAdmin");
  try {
    const { page, frontend } = fixture;
    await page.emulateMedia({ colorScheme: "dark" });
    let status: "PENDING" | "ACTIVE" = "PENDING";
    await page.route("**/api/v1/organizations/" + ORG, route => {
      if (route.request().method() !== "GET") return route.abort("blockedbyclient");
      const value = { ...organizations[0], status };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: value }) });
    });
    await page.goto(frontend + "/org/application/?organizationId=" + ORG, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /สถานะคำขอของ/ })).toBeVisible({ timeout: 18000 });
    await expect(page.getByText("รอการอนุมัติ")).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/ })).toHaveCount(0);
    await checkWidths(page, fixture.evidence, "pending-organization");
    status = "ACTIVE";
    await page.getByRole("button", { name: "ตรวจสอบสถานะล่าสุด" }).click();
    await expect(page.getByRole("link", { name: /เข้าสู่ Dashboard/ }))
      .toHaveAttribute("href", /\/org\/dashboard\/\?organizationId=/);
    expect(fixture.nonRead()).toBe(0);
  } finally { await fixture.context.close(); }
});
