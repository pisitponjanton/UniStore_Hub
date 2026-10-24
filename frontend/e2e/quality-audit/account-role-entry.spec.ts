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
    await expect(page.getByRole("heading", { name: "หน่วยงานของฉัน" }))
      .toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("heading", { name: "หน่วยงาน (2)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "เปลี่ยนหน่วยงาน" })).toHaveCount(0);
    await expect(page.locator("footer button").filter({ hasText: "ออกจากระบบ" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "เข้าใช้งาน ชมรมไอที (ทดสอบเบราว์เซอร์)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "เข้าใช้งาน ชมรมดนตรี (ทดสอบเบราว์เซอร์)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "สร้างหน่วยงาน" })).toBeVisible();
    const technical = page.getByText("ดูรหัสหน่วยงาน", { exact: true }).first();
    await expect(technical).toBeVisible();
    await technical.click();
    await expect(page.getByText(ORG, { exact: true })).toBeVisible();
    await technical.click();
    await expect(page.getByText(ORG, { exact: true })).toBeHidden();
    await expect(page.getByRole("searchbox", { name: "ค้นหาหน่วยงานที่เข้าถึงได้" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "สร้างหน่วยงาน" })).toHaveCount(0);
    const open = page.getByRole("button", { name: "สร้างหน่วยงาน" });
    await expect(open.locator("span")).toHaveCSS("white-space", "nowrap");
    await open.click();
    const dialog = page.getByRole("dialog", { name: "สร้างหน่วยงาน" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "ชื่อหน่วยงาน" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "ส่งคำขอ" }).locator("span").first()).toHaveCSS("white-space", "nowrap");
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
        await expect(dialog).toBeVisible();
        const rect = await dialog.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect!.x).toBeGreaterThanOrEqual(-1);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width + 1);
        expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth))).toBeLessThanOrEqual(1);
        if (width === 390 || width === 1440) {
          await page.screenshot({ path: join(fixture.evidence, "org-create-modal-" + scheme + "-" + width + ".png"), animations: "disabled" });
        }
      }
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(dialog).toHaveCount(0);
    await checkWidths(page, fixture.evidence, "org-select-staff");
    await page.emulateMedia({ colorScheme: "light" });
    await checkWidths(page, fixture.evidence, "org-select-staff-light");
    expect(fixture.nonRead()).toBe(0);
  } finally { await fixture.context.close(); }
});


test("Customer without an organization can reach the first-time application form", async ({ browser }) => {
  const fixture = await readOnlyContext(browser, "customer");
  try {
    const { page, frontend } = fixture;
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(frontend + "/org/select/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "สมัครเปิดร้านสำหรับหน่วยงาน" }))
      .toBeVisible({ timeout: 18000 });
    await expect(page.getByRole("heading", { name: "ข้อมูลหน่วยงาน" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ขั้นตอนการเปิดร้าน" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "ชื่อหน่วยงาน" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "เลือกพื้นที่เพื่อเริ่มงาน" })).toHaveCount(0);
    await checkWidths(page, fixture.evidence, "first-organization");
    expect(fixture.nonRead()).toBe(0);
  } finally { await fixture.context.close(); }
});

test("First organization stays stable through reload and native focus restoration", async ({ browser }) => {
  test.setTimeout(90000);
  const fixture = await readOnlyContext(browser, "customer");
  try {
    const { page, frontend, evidence } = fixture;
    await page.route("**/api/v1/organizations*", async route => {
      if (route.request().method() !== "GET") return route.abort("blockedbyclient");
      await new Promise(resolve => setTimeout(resolve, 380));
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: organizations, nextCursor: null } }) });
    });
    for (const mode of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: mode });
      for (let reload = 0; reload < 2; reload++) {
        await page.goto(frontend + "/org/select/", { waitUntil: "domcontentloaded" });
        // The selection page must never be displayed to a first-time customer.
        await expect(page.locator('[data-page="organization-entry"][data-loading="loading"]')).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole("heading", { name: "วันนี้จะทำงานกับหน่วยงานไหน?" })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "สมัครเปิดร้านสำหรับหน่วยงาน" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "ขั้นตอนการเปิดร้าน" })).toBeVisible();
        await expect(page.locator("#organization-create-error-summary")).toHaveCount(0);
        const nameField = page.getByRole("textbox", { name: "ชื่อหน่วยงาน" });
        await nameField.focus();
        await page.getByRole("textbox", { name: "คำอธิบาย" }).focus();
        await expect(nameField).not.toHaveAttribute("aria-invalid", "true");
        await expect(page.locator("#organization-create-error-summary")).toHaveCount(0);
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(await page.evaluate(() => Math.max(0,document.documentElement.scrollWidth - innerWidth))).toBeLessThanOrEqual(1);
          if (width === 1440) {
            const metrics = await page.locator('[data-onboarding="true"] > main').evaluate(element => {
              const form = element.querySelector('form')!.getBoundingClientRect();
              const guide = element.querySelector('aside')!.getBoundingClientRect();
              const region = element.getBoundingClientRect();
              return { formWidth: form.width, guideWidth: guide.width, regionWidth: region.width, aligned: Math.abs(form.top-guide.top) };
            });
            expect(metrics.formWidth).toBeGreaterThan(550);
            expect(metrics.guideWidth).toBeGreaterThan(220);
            expect(metrics.regionWidth).toBeGreaterThan(850);
            expect(metrics.aligned).toBeLessThan(120);
          }
        }
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await page.screenshot({ path: join(evidence, "first-organization-" + mode + ".png"), animations: "disabled", fullPage: true });
    }
    const nameField = page.getByRole("textbox", { name: "ชื่อหน่วยงาน" });
    await nameField.fill("  ");
    await page.getByRole("textbox", { name: "คำอธิบาย" }).focus();
    await expect(nameField).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#organization-create-error-summary")).toHaveCount(0);
    await page.getByRole("button", { name: "ส่งคำขอสมัครหน่วยงาน" }).click();
    await expect(nameField).toBeFocused();
    await expect(page.locator("#organization-name-error")).toContainText("กรุณาระบุชื่อหน่วยงาน");
    await expect(page.locator("#organization-create-error-summary")).toHaveCount(0);
    expect(fixture.nonRead()).toBe(0);
  } finally { await fixture.context.close(); }
});

test("Pending organization remains in review until API confirms approval", async ({ browser }) => {
  const fixture = await readOnlyContext(browser, "organizationAdmin");
  try {
    const { page, frontend } = fixture;
    await page.emulateMedia({ colorScheme: "dark" });
    let status: "PENDING" | "ACTIVE" | "SUSPENDED" = "PENDING";
    await page.route("**/api/v1/organizations/" + ORG, route => {
      if (route.request().method() !== "GET") return route.abort("blockedbyclient");
      const value = { ...organizations[0], status };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: value }) });
    });
    await page.route("**/api/v1/organizations", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: { items: [{ ...organizations[0], status: "PENDING" }], nextCursor: null } }),
    }));
    await page.goto(frontend + "/org/select/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "หน่วยงาน (1)" })).toBeVisible();
    await expect(page.getByText("กำลังรอการตรวจสอบจากผู้ดูแลแพลตฟอร์ม")).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "ค้นหาหน่วยงานที่เข้าถึงได้" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "สร้างหน่วยงาน" })).toBeVisible();
    await checkWidths(page, fixture.evidence, "pending-selector");
    await page.getByRole("button", { name: "ดูสถานะคำขอ " + organizations[0]!.name }).click();
    await expect(page).toHaveURL(frontend + "/org/application/?organizationId=" + ORG);
    await expect(page.getByRole("heading", { name: "สถานะคำขอหน่วยงาน" })).toBeVisible({ timeout: 18000 });
    await expect(page.getByText("รออนุมัติ")).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "กำลังรอการตรวจสอบ" })).toBeVisible();
    const refresh = page.getByRole("button", { name: "รีเฟรชสถานะ" });
    await expect(refresh.locator("svg.lucide-refresh-cw")).toHaveCount(1);
    await expect(refresh).toHaveCSS("min-width", "44px");
    await expect(page.locator('[class*=applicationCard]')).toHaveCount(0);
    await expect(page.locator('[class*=applicationMessage]')).toHaveCount(0);
    await checkWidths(page, fixture.evidence, "pending-organization");
    await page.emulateMedia({ colorScheme: "light" });
    await checkWidths(page, fixture.evidence, "pending-organization-light");
    await page.setViewportSize({ width: 1440, height: 900 });
    const area = await page.locator("main[class*=applicationMain]").boundingBox();
    expect(area).not.toBeNull();
    expect(area!.width).toBeGreaterThan(850);
    status = "ACTIVE";
    await page.getByRole("button", { name: "รีเฟรชสถานะ" }).click();
    await expect(page.getByRole("link", { name: /เข้าสู่ Dashboard/ }))
      .toHaveAttribute("href", /\/org\/dashboard\/\?organizationId=/);
    await expect(page.getByRole("heading", { name: "พร้อมเปิดร้าน" })).toBeVisible();
    status = "SUSPENDED";
    await page.getByRole("button", { name: "รีเฟรชสถานะ" }).click();
    await expect(page.getByRole("heading", { name: "ไม่สามารถใช้งานหน่วยงานได้" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/ })).toHaveCount(0);
    expect(fixture.nonRead()).toBe(0);
  } finally { await fixture.context.close(); }
});
