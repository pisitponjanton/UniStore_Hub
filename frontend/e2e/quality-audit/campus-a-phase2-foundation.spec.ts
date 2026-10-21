import { installOrdinaryStorePreview } from "./campus-a-storefront-preview";
import { test, expect } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS } from "../support/seed-auth";
import { localAuditTargets, blockBrowserApiWrites } from "./fixture-guard";

const { frontend, api } = localAuditTargets();

function rgb(value: string): number[] {
  const numbers = value.match(/[0-9.]+/g)?.slice(0, 3).map(Number);
  if (!numbers || numbers.length !== 3) throw new Error("Unrecognized rgb: " + value);
  return numbers;
}
function luminance(value: string): number {
  const [r, g, b] = rgb(value).map((n) => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a: string, b: string): number {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ["light", "dark"] as const) {
  test("Campus A text-only brand & readable store row in " + scheme, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
    await ctx.route("**/*", async (route) => {
      if (blockBrowserApiWrites(api)(route.request().url(), route.request().method()))
        await route.abort("blockedbyclient");
      else await route.continue();
    });
    try {
      const page = await ctx.newPage();
      await installOrdinaryStorePreview(page);
      for (const path of ["/", "/login/", "/register/"]) {
        await page.goto(frontend + path, { waitUntil: "domcontentloaded" });
        const brand = page.getByRole("link", { name: "UniStore Hub หน้าร้าน" });
        await expect(brand).toBeVisible();
        await expect(brand).toHaveText("UniStore Hub");
        expect(await brand.locator("svg, img, [class*='brandMark']").count()).toBe(0);
      }
      await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
      const row = page.locator("a[class*='storeCard']").first();
      await expect(row).toBeVisible({ timeout: 14000 });
      await row.hover();
      const pair = await row.evaluate((element) => ({
        foreground: getComputedStyle(element.querySelector('[class*="storeName"]')!).color,
        background: getComputedStyle(element).backgroundColor,
      }));
      expect(contrast(pair.foreground, pair.background), scheme + " hovered store row").toBeGreaterThanOrEqual(4.5);
      for (const width of [390, 1440, 3840]) {
        await page.setViewportSize({ width, height: 900 });
        const compactBrand = page.getByRole("link", { name: "UniStore Hub หน้าร้าน" });
        await expect(compactBrand).toBeVisible();
        await expect(compactBrand).toHaveText("UniStore Hub");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
    } finally { await ctx.close(); }
  });

  test("Campus A text-only app shell for every authenticated role in " + scheme, async ({ browser, request }) => {
    const org = LOCAL_SEED_ENTITY_IDS.organizationId;
    for (const [role, path] of [
      ["customer", "/my/orders/"],
      ["staff", "/org/select/"],
      ["organizationAdmin", "/org/dashboard/?organizationId=" + org],
      ["platformAdmin", "/platform/summary/"],
    ] as const) {
      const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
      try {
        await establishSeedRoleSession(context, request, role);
        await context.route("**/*", async (route) => {
          if (blockBrowserApiWrites(api)(route.request().url(), route.request().method()))
            await route.abort("blockedbyclient");
          else await route.continue();
        });
        const page = await context.newPage();
        await page.goto(frontend + path, { waitUntil: "domcontentloaded" });
        const brand = page.getByRole("link", { name: "UniStore Hub", exact: true }).first();
        await expect(brand, role).toBeVisible({ timeout: 15000 });
        await expect(brand).toHaveText("UniStore Hub");
        expect(await brand.locator("svg, img, [class*='brandMark']").count()).toBe(0);
      } finally { await context.close(); }
    }
  });
}
