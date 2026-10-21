import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const evidence = resolve(process.cwd(), "quality-audit/.evidence/campus-a-phase9");
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
  test("Phase 9 Login/Register design, responsive and text scaling — " + theme, async ({ browser }) => {
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

  test("Phase 9 validation, password, returnTo and intercepted server rejection — " + theme, async ({ browser }) => {
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
