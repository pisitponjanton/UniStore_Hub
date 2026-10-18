import { expect, test } from "@playwright/test";
import { LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";

test("public Store/Campaign/Product recover from 503 with page identity intact", async ({ browser }) => {
  test.setTimeout(100_000);
  const query = "?organizationId=" + ids.organizationId;
  const cases = [
    { path: "/stores/view/" + query + "&storeId=" + ids.storeId, title: "รายละเอียดร้านค้า" },
    { path: "/campaigns/view/" + query + "&campaignId=" + ids.campaignId, title: "รายละเอียดแคมเปญ" },
    { path: "/products/view/" + query + "&productId=" + ids.productId + "&campaignId=" + ids.campaignId, title: "รายละเอียดสินค้า" },
  ];
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    let fail = true;
    await ctx.route("**/api/v1/**", async route => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        await route.abort("blockedbyclient");
        return;
      }
      if (fail && !new URL(route.request().url()).pathname.endsWith("/me")) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Simulated outage" } }),
        });
        return;
      }
      await route.continue();
    });
    const page = await ctx.newPage();
    await page.goto("http://localhost:3000" + c.path, { waitUntil: "domcontentloaded" });
    const retry = page.getByRole("button", { name: "ลองใหม่" });
    await expect(retry, c.title).toBeVisible({ timeout: 16000 });
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main h1")).toHaveText(c.title);
    fail = false;
    await retry.click();
    await expect(page.getByRole("button", { name: "ลองใหม่" })).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator("main h1")).toHaveCount(1);
    await ctx.close();
  }
});
