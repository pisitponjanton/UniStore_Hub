/**
 * Campus Commerce A — behavior-focused browser regression suite.
 * Consolidated from historical work-item files; all test cases and mock guards retained.
 * Add related cases here; never introduce milestone-numbered spec files.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test.describe("Auth layout", () => {
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-authentication");
mkdirSync(evidence, { recursive: true });
const frontend = "http://127.0.0.1:3000";
const returnTo = "/orders/new/?organizationId=55555555-5555-4555-8555-555555555555&campaignId=99999999-9999-4999-8999-999999999998&productId=77777777-7777-4777-8777-777777777778";
const withReturn = (route: string) => frontend + route + "?returnTo=" + encodeURIComponent(returnTo);

async function installReadOnlySession(context: BrowserContext) {
  let authPosts = 0;
  let accidentalWrites = 0;
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() === "POST" && /^\/api\/v1\/auth\/(login|register)$/.test(pathname)) {
      authPosts++;
      // Synthetic server authentication error; NEVER send credentials to backend.
      await new Promise(resolve => setTimeout(resolve, 260));
      await route.fulfill({
        status: 401, contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Browser-only credentials rejected" } }),
      });
      return;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      accidentalWrites++;
      await route.abort("blockedbyclient");
      return;
    }
    if (pathname.endsWith("/me") || pathname.endsWith("/auth/me")) {
      await route.fulfill({
        status: 401, contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Browser-only anonymous visitor" } }),
      });
      return;
    }
    await route.continue();
  });
  return { counts: () => ({ authPosts, accidentalWrites }) };
}

async function waitForForm(page: Page, variant: "login" | "register") {
  await expect(page.getByRole("heading", {
    level: 2, name: variant === "login" ? "เข้าสู่ระบบเพื่อทำรายการต่อ" : "สร้างบัญชีสำหรับสั่งซื้อ",
  })).toBeVisible({ timeout: 18000 });
}

for (const theme of ["light", "dark"] as const) {
  test("Login/Register design, responsive and text scaling — " + theme, async ({ browser }) => {
    test.setTimeout(165_000);
    const context = await browser.newContext({
      colorScheme: theme, reducedMotion: "reduce", viewport: { width: 1440, height: 920 },
    });
    const guard = await installReadOnlySession(context);
    const page = await context.newPage();
    const metrics: Array<Record<string, string | number>> = [];
    try {
      for (const route of ["login", "register"] as const) {
        await page.goto(frontend + "/" + route + "/", { waitUntil: "domcontentloaded" });
        await waitForForm(page, route);
        await expect(page.getByRole("link", { name: "UniStore Hub หน้าร้าน" })).toHaveAttribute("href", "/");
        await expect(page.locator('a[class*="brand"] img')).toHaveCount(0);
        await expect(page.getByRole("textbox", { name: "อีเมล" })).toHaveAttribute("autocomplete", "email");
        await expect(page.getByLabel("รหัสผ่าน")).toHaveAttribute("type", "password");
        if (route === "register") {
          await expect(page.getByRole("textbox", { name: "ชื่อที่แสดง" })).toHaveAttribute("autocomplete", "name");
          await expect(page.getByLabel("รหัสผ่าน")).toHaveAttribute("autocomplete", "new-password");
        }
        await page.getByRole("button", { name: "แสดงรหัสผ่าน" }).click();
        await expect(page.getByLabel("รหัสผ่าน")).toHaveAttribute("type", "text");
        await expect(page.getByRole("button", { name: "ซ่อนรหัสผ่าน" })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "ซ่อนรหัสผ่าน" }).click();
        await expect(page.getByLabel("รหัสผ่าน")).toHaveAttribute("type", "password");

        for (const width of [320, 390, 768, 1024, 1440, 1920, 2560, 3840]) {
          await page.setViewportSize({ width, height: 920 });
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const layout = await page.evaluate(() => {
            const panel = document.querySelector('[class*="panelInner"]')!.getBoundingClientRect();
            const main = document.querySelector("main")!.getBoundingClientRect();
            return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
              panelWidth: Math.round(panel.width), mainWidth: Math.round(main.width) };
          });
          expect(layout.overflow, theme + " /" + route + "/ " + width).toBeLessThanOrEqual(1);
          expect(layout.panelWidth, "form too wide " + width).toBeLessThanOrEqual(595);
          expect(layout.panelWidth, "form too narrow " + width).toBeGreaterThan(Math.min(width - 36, 270));
          metrics.push({ theme, route, width, ...layout });
          if ([390, 1440, 3840].includes(width)) {
            await page.screenshot({ path: resolve(evidence, theme + "-" + route + "-" + width + ".png"), animations: "disabled" });
          }
        }
        for (const width of [390, 768, 960, 1920]) {
          await page.setViewportSize({ width, height: 920 });
          await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
          const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
          expect(overflow, theme + " /" + route + "/ 200% text " + width).toBeLessThanOrEqual(1);
          metrics.push({ theme, route, width, scale: "200% text", overflow });
          await page.goto(frontend + "/" + route + "/", { waitUntil: "domcontentloaded" });
          await waitForForm(page, route);
        }
      }
      expect(guard.counts().accidentalWrites).toBe(0);
      writeFileSync(resolve(evidence, "responsive-" + theme + ".json"), JSON.stringify(metrics, null, 2) + "\n");
    } finally { await context.close(); }
  });

  test("validation, password, returnTo and intercepted server rejection — " + theme, async ({ browser }) => {
    test.setTimeout(105_000);
    const context = await browser.newContext({
      colorScheme: theme, reducedMotion: "reduce", viewport: { width: 390, height: 900 },
    });
    const guard = await installReadOnlySession(context);
    const page = await context.newPage();
    try {
      await page.goto(withReturn("/login/"), { waitUntil: "domcontentloaded" });
      await waitForForm(page, "login");
      await expect(page.getByText(/เข้าสู่ระบบสำเร็จแล้วระบบจะพากลับไปยังหน้านั้น/)).toBeVisible();
      const register = page.getByRole("link", { name: "สมัครสมาชิก" });
      expect(new URL(await register.getAttribute("href") ?? "", frontend).searchParams.get("returnTo")).toBe(returnTo);
      await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect(page.getByRole("link", { name: "กรุณากรอกอีเมล" })).toHaveAttribute("href", "#login-email");
      await expect(page.getByRole("link", { name: "รหัสผ่านต้องมีอย่างน้อย 8 ไบต์" })).toHaveAttribute("href", "#login-password");
      await page.getByLabel("อีเมล").fill("person@example.com");
      await page.getByLabel("รหัสผ่าน").fill("example123");
      await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
      await expect(page.getByRole("button", { name: /กำลังเข้าสู่ระบบ/ })).toBeDisabled();
      await expect(page.getByText("เข้าสู่ระบบไม่สำเร็จ")).toBeVisible();
      expect(guard.counts().authPosts).toBe(1);
      await page.screenshot({ path: resolve(evidence, theme + "-login-error-390.png") });

      await register.click();
      await waitForForm(page, "register");
      const backToLogin = page.getByRole("link", { name: "เข้าสู่ระบบ", exact: true });
      expect(new URL(await backToLogin.getAttribute("href") ?? "", frontend).searchParams.get("returnTo")).toBe(returnTo);
      await page.getByRole("button", { name: "สร้างบัญชี" }).click();
      await expect(page.getByRole("link", { name: "กรุณากรอกชื่อ" })).toBeVisible();
      await expect(page.getByRole("link", { name: "กรุณากรอกอีเมล" })).toBeVisible();
      await page.getByLabel("ชื่อที่แสดง").fill("ทดสอบ UI เท่านั้น");
      await page.getByLabel("อีเมล").fill("person@example.com");
      await page.getByLabel("รหัสผ่าน").fill("example123");
      await page.getByRole("button", { name: "สร้างบัญชี" }).click();
      await expect(page.getByRole("button", { name: /กำลังสร้างบัญชี/ })).toBeDisabled();
      await expect(page.getByText("สมัครสมาชิกไม่สำเร็จ")).toBeVisible();
      expect(guard.counts().authPosts).toBe(2);
      expect(guard.counts().accidentalWrites).toBe(0);
      await page.screenshot({ path: resolve(evidence, theme + "-register-error-390.png") });
    } finally { await context.close(); }
  });
}
});

test.describe("Return to order", () => {
const frontend = "http://127.0.0.1:3000";
const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-commerce-return-navigation");
mkdirSync(evidence, { recursive: true });

const organizationId = "55555555-5555-4555-8555-555555555555";
const storeId = "66666666-6666-4666-8666-666666666666";
const productId = "77777777-7777-4777-8777-777777777778";
const variantId = "88888888-8888-4888-8888-888888888888";
const campaignId = "99999999-9999-4999-8999-999999999998";
const orderUrl = "/orders/new/?organizationId=" + organizationId + "&campaignId=" + campaignId +
  "&productId=" + productId + "&variantId=" + variantId;
const sessionData = { user: { userId: "customer-1", email: "buyer@example.com", name: "Test Customer",
  status: "ACTIVE", platformRole: null }, memberships: [] };
const store = { organizationId, storeId, name: "ร้านตัวอย่างเพื่อทดสอบ", description: "", status: "ACTIVE" };
const product = { organizationId, storeId, productId, name: "เสื้อกิจกรรม", description: "สินค้าชมรม",
  status: "ACTIVE", imageUrl: null, variants: [{ organizationId, productId, variantId,
    name: "Size M", price: 25000, status: "ACTIVE" }] };
const campaign = { organizationId, storeId, campaignId, name: "รอบพรีออเดอร์",
  status: "OPEN", openAt: "2026-10-10T08:00:00Z", closeAt: "2026-11-30T08:00:00Z",
  paymentDeadline: "2026-12-03T08:00:00Z", pickupAt: "2026-12-15T08:00:00Z" };

async function install(context: BrowserContext, opts: { slowSession?: boolean; expired?: boolean; forbiddenProduct?: boolean } = {}) {
  let loginCount = 0;
  let unmockedWrites = 0;
  const prefix = "/api/v1/storefront/organizations/" + organizationId + "/stores/" + storeId;
  const fixtures = new Map<string, unknown>([
    ["/api/v1/storefront/organizations/" + organizationId + "/stores", { items: [store], nextCursor: null }],
    [prefix, store],
    [prefix + "/products", { items: [product], nextCursor: null }],
    [prefix + "/products/" + productId, product],
    [prefix + "/campaigns", { items: [campaign], nextCursor: null }],
  ]);
  await context.route("**/api/v1/**", async route => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    const response = async (status: number, data: unknown, success = true) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(success ? { success, data } :
        { success, error: data }) });
    if (pathname === "/api/v1/auth/login" && method === "POST") {
      loginCount++;
      return response(200, { token: "browser-only-new-token" });
    }
    if (pathname === "/api/v1/me" && method === "GET") {
      if (opts.slowSession) await new Promise(done => setTimeout(done, 500));
      return opts.expired
        ? response(401, { code: "TOKEN_EXPIRED", message: "Expired" }, false)
        : response(200, sessionData);
    }
    if (method === "GET" && opts.forbiddenProduct && pathname.endsWith("/products/" + productId)) {
      return response(403, { code: "FORBIDDEN", message: "No access" }, false);
    }
    if (method === "GET" && fixtures.has(pathname)) return response(200, fixtures.get(pathname));
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) unmockedWrites++;
    return route.abort("blockedbyclient");
  });
  return { stats: () => ({ loginCount, unmockedWrites }) };
}

for (const theme of ["light", "dark"] as const) {
  test("anonymous checkout → login → same checkout without losing query context / " + theme, async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
    const guard = await install(context);
    const page = await context.newPage();
    try {
      await page.goto(frontend + orderUrl, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "กรุณาเข้าสู่ระบบ" })).toBeVisible();
      const loginLink = page.getByRole("link", { name: "เข้าสู่ระบบเพื่อทำรายการต่อ" });
      expect(new URL((await loginLink.getAttribute("href"))!, frontend).searchParams.get("returnTo")).toBe(orderUrl);
      const back = page.getByRole("link", { name: "กลับไปดูสินค้า" });
      await expect(back).toHaveAttribute("href", /\/products\/view\//);
      await page.screenshot({ path: resolve(evidence, theme + "-anonymous-390.png") });
      await loginLink.click();
      await expect(page.getByRole("heading", { name: "เข้าสู่ระบบเพื่อทำรายการต่อ" })).toBeVisible();
      await expect(page.getByRole("link", { name: "กลับไปดูสินค้า" })).toHaveAttribute("href", /\/products\/view\//);
      await page.getByLabel("อีเมล").fill("buyer@example.com");
      await page.getByLabel("รหัสผ่าน").fill("example123");
      await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/orders/new/.*variantId=" + variantId), { timeout: 18000 });
      await expect(page.getByRole("heading", { name: "ตรวจสอบคำสั่งซื้อ" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("heading", { name: "เสื้อกิจกรรม" })).toBeVisible();
      expect(guard.stats()).toEqual({ loginCount: 1, unmockedWrites: 0 });
      for (const width of [390, 1440, 3840]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        if (width !== 3840) await page.screenshot({ path: resolve(evidence, theme + "-order-ready-" + width + ".png") });
      }
    } finally { await context.close(); }
  });

  test("delayed existing session never flashes login, expired session recovers / " + theme, async ({ browser }) => {
    test.setTimeout(65_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => sessionStorage.setItem("unistoreHub.accessToken", "preexisting-test-token"));
    await install(context, { slowSession: true });
    const page = await context.newPage();
    try {
      await page.goto(frontend + orderUrl, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "กำลังตรวจสอบบัญชี" })).toBeVisible();
      await expect(page.getByRole("link", { name: "เข้าสู่ระบบเพื่อทำรายการต่อ" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "ตรวจสอบคำสั่งซื้อ" })).toBeVisible({ timeout: 15000 });
    } finally { await context.close(); }

    const expired = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 } });
    await expired.addInitScript(() => sessionStorage.setItem("unistoreHub.accessToken", "expired-test-token"));
    await install(expired, { expired: true });
    const expiredPage = await expired.newPage();
    try {
      await expiredPage.goto(frontend + orderUrl, { waitUntil: "domcontentloaded" });
      await expect(expiredPage.getByRole("link", { name: "เข้าสู่ระบบเพื่อทำรายการต่อ" })).toBeVisible({ timeout: 15000 });
      expect(await expiredPage.evaluate(() => sessionStorage.getItem("unistoreHub.accessToken"))).toBeNull();
      await expect(expiredPage.getByRole("link", { name: "กลับไปดูสินค้า" })).toBeVisible();
    } finally { await expired.close(); }
  });

  test("authenticated forbidden product does not expose checkout / " + theme, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 } });
    await context.addInitScript(() => sessionStorage.setItem("unistoreHub.accessToken", "test-token"));
    const guard = await install(context, { forbiddenProduct: true });
    const page = await context.newPage();
    try {
      await page.goto(frontend + orderUrl, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("ไม่มีสิทธิ์เปิดรายการนี้")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("link", { name: "ดูร้านค้าทั้งหมด" })).toBeVisible();
      await expect(page.getByRole("button", { name: /ยืนยันคำสั่งซื้อ/ })).toHaveCount(0);
      expect(guard.stats().unmockedWrites).toBe(0);
    } finally { await context.close(); }
  });
  test("already-authenticated login returnTo offers the correct next action / " + theme, async ({ browser }) => {
    test.setTimeout(55_000);
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => sessionStorage.setItem("unistoreHub.accessToken", "existing-test-token"));
    const guard = await install(context, { slowSession: true });
    const page = await context.newPage();
    try {
      const authUrl = frontend + "/login/?returnTo=" + encodeURIComponent(orderUrl);
      await page.goto(authUrl, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "กำลังตรวจสอบบัญชี" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "พร้อมใช้งานแล้ว" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByLabel("รหัสผ่าน")).toHaveCount(0);
      const next = page.getByRole("link", { name: "กลับไปตรวจสอบคำสั่งซื้อ" });
      await expect(next).toHaveAttribute("href", orderUrl);
      await next.click();
      await expect(page.getByRole("heading", { name: "ตรวจสอบคำสั่งซื้อ" })).toBeVisible({ timeout: 15000 });
      expect(guard.stats()).toEqual({ loginCount: 0, unmockedWrites: 0 });
    } finally { await context.close(); }
  });

}
});
