import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";

test.use({ trace: "off", screenshot: "only-on-failure", video: "off" });

const org = "?organizationId=" + ids.organizationId;
const cases = [
  { name: "Staff Orders", role: "staff", path: "/org/orders/" + org, title: "คำสั่งซื้อของหน่วยงาน" },
  { name: "Staff Payments", role: "staff", path: "/org/payments/" + org, title: "ตรวจสอบการชำระเงิน" },
  { name: "Staff Pickups", role: "staff", path: "/org/pickups/" + org, title: "จุดรับสินค้า" },
  { name: "Org Staff", role: "organizationAdmin", path: "/org/staff/" + org, title: "บุคลากรและสิทธิ์" },
  { name: "Org Stores", role: "organizationAdmin", path: "/org/stores/" + org, title: "ร้านค้า" },
  { name: "Org Audit", role: "organizationAdmin", path: "/org/audit/" + org, title: "ประวัติการทำรายการ" },
  { name: "Platform Summary", role: "platformAdmin", path: "/platform/summary/", title: "ภาพรวม Platform" },
  { name: "Platform Orgs", role: "platformAdmin", path: "/platform/organizations/", title: "จัดการหน่วยงาน" },
  { name: "Platform Users", role: "platformAdmin", path: "/platform/users/", title: "ผู้ใช้ระดับ Platform" },
] as const;

test("nine management routes retain heading + explicit retry/back; recover without re-login", async ({ browser, request }) => {
  test.setTimeout(210_000);
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await establishSeedRoleSession(ctx, request, c.role);
    let fail = true;
    await ctx.route("**/api/v1/**", async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        await route.abort("blockedbyclient");
        return;
      }
      if (fail && !url.pathname.endsWith("/me") && !url.pathname.includes("/auth/")) {
        await route.fulfill({
          status: 503, contentType: "application/json",
          body: JSON.stringify({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Phase 1 simulated outage" } }),
        });
        return;
      }
      await route.continue();
    });
    const page = await ctx.newPage();
    await page.goto("http://localhost:3000" + c.path, { waitUntil: "domcontentloaded" });
    const fallback = page.locator('[data-page-status="error"]');
    await expect(fallback, c.name + " forced 503 should be recoverable").toBeVisible({ timeout: 20000 });
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main h1")).toHaveText(c.title);
    await expect(fallback.getByRole("button", { name: "ลองใหม่" })).toBeVisible();
    await expect(fallback.getByRole("link", { name: "กลับไปพื้นที่ทำงาน" })).toBeVisible();
    const token = await page.evaluate(() => sessionStorage.getItem("unistoreHub.accessToken"));
    expect(token, c.name).toBeTruthy();
    fail = false;
    await fallback.getByRole("button", { name: "ลองใหม่" }).click();
    await expect(page.locator('[data-page-status="error"]'), c.name + " retry did not recover").toHaveCount(0, { timeout: 25000 });
    await expect(page.locator("main h1")).toHaveCount(1);
    expect(await page.evaluate(() => sessionStorage.getItem("unistoreHub.accessToken"))).toBe(token);
    await ctx.close();
  }
});

test("shared fallback skeleton and semantic heading stable on small viewport", async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });
  await establishSeedRoleSession(ctx, request, "staff");
  await ctx.route("**/api/v1/organizations/*/payments*", async route => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.continue();
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/org/payments/" + org, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-status="loading"]')).toBeVisible();
  await expect(page.locator("main h1")).toHaveText("ตรวจสอบการชำระเงิน");
  await expect(page.getByTestId("page-loading-skeleton")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await ctx.close();
});


test("Store Workspace retries a transient Store GET failure without changing organization", async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  let count = 0;
  let unavailable = true;
  await ctx.route("**/organizations/" + ids.organizationId + "/stores/" + ids.storeId, async route => {
    count++;
    if (unavailable) {
      await route.fulfill({status: 503, contentType:"application/json", body:JSON.stringify({
        success:false, error:{code:"SERVICE_UNAVAILABLE",message:"Temporary outage"}
      })});
    } else await route.continue();
  });
  const page = await ctx.newPage();
  try {
    await page.goto("http://localhost:3000/org/stores/view/?organizationId=" + ids.organizationId +
      "&storeId=" + ids.storeId + "&tab=products");
    const error = page.locator('[data-page-status="error"]');
    await expect(error).toBeVisible({ timeout: 20000 });
    await expect(error.getByRole("button", {name:"ลองใหม่"})).toBeVisible();
    await expect(error.getByRole("link", {name:"กลับไปรายการร้านค้า"})).toHaveAttribute("href", /organizationId=/);
    const token = await page.evaluate(() => sessionStorage.getItem("unistoreHub.accessToken"));
    unavailable = false;
    await error.getByRole("button", {name:"ลองใหม่"}).click();
    await expect(page.getByRole("navigation", {name:"เมนูจัดการร้านค้า"})).toBeVisible({ timeout:20000 });
    await expect(page).toHaveURL(/tab=products/);
    expect(await page.evaluate(() => sessionStorage.getItem("unistoreHub.accessToken"))).toBe(token);
    expect(count).toBeGreaterThanOrEqual(2);
  } finally { await ctx.close(); }
});
