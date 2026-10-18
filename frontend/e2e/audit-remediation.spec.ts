import { expect, test } from "./support/qa-fixture";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS } from "./support/seed-auth";

// Read-only regression for local QA usability and responsive improvements.
test("localhost and 127 loopback hosts both render the public storefront", async ({ browser }) => {
  for (const host of ["localhost", "127.0.0.1"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://" + host + ":3000/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[class*="discoveryCard"]').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "เลือกซื้อจากร้านในมหาวิทยาลัย" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  }
});

test("Local QA listings are opt-in and can be restored without deleting data", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const show = page.getByRole("button", { name: /แสดงข้อมูล E2E\/QA/ });
  await expect(show).toBeVisible({ timeout: 20_000 });
  await expect(show).toHaveAttribute("aria-pressed", "false");
  await show.click();
  const hide = page.getByRole("button", { name: "ซ่อนข้อมูล E2E/QA" });
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('a[class*="discoveryCard"]')).toHaveCount(4);
  await hide.click();
  await expect(show).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('a[class*="discoveryCard"]')).toHaveCount(1);
});

test("Organization desktop/mobile shows friendly name, private details and payment-first metric", async ({ page, context, request }) => {
  await establishSeedRoleSession(context, request, "organizationAdmin");
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(
      "/org/dashboard/?organizationId=" + LOCAL_SEED_ENTITY_IDS.organizationId,
      { waitUntil: "domcontentloaded" },
    );
    await expect(
      page.getByRole("heading", { name: "ภาพรวมหน่วยงาน" }),
    ).toBeVisible({ timeout: 20_000 });
    if (width === 390) {
      await page.getByRole("button", { name: "เปิดเมนูหลัก" }).click();
    }
    const summary = page.locator('section[class*="workspaceSummary"]');
    await expect(summary.getByText("UniStore Local Demo")).toBeVisible({ timeout: 20_000 });
    const technical = summary.locator("details");
    await expect(technical).not.toHaveAttribute("open");
    if (width === 390) {
      await page.getByRole("dialog", { name: "เมนูหลัก" }).getByRole("button", { name: "ปิดเมนูหลัก" }).click();
    }
    await expect(
      page.getByRole("link", { name: "เปิดคิวตรวจการชำระเงิน" }),
    ).toBeVisible();
    const measured = await page.evaluate(() => {
      const main = document.querySelector("main");
      const hero = main?.querySelector('header[class*="header"]');
      const payment = main?.querySelector('article[class*="actionMetric"]');
      return {
        height: hero?.getBoundingClientRect().height ?? 0,
        firstMetricY: payment?.getBoundingClientRect().top ?? -1,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(measured.overflow).toBeLessThanOrEqual(1);
    if (width === 390) {
      expect(measured.height).toBeLessThan(265);
    }
  }
});
