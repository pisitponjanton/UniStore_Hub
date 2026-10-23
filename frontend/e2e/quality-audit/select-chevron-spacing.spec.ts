import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { localAuditTargets } from "./fixture-guard";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeId = "66666666-6666-4666-8666-111111111111";
const productId = "77777777-7777-4777-8777-111111111111";
const variantId = "88888888-8888-4888-8888-111111111111";
const campaignId = "99999999-9999-4999-8999-111111111111";
const when = "2026-10-10T08:00:00.000Z";
const prefix = "/api/v1/storefront/organizations/" + organizationId;
const storePath = prefix + "/stores/" + storeId;
const product = {
  productId, organizationId, storeId, name: "QA Product for Select",
  description: "Read-only visual test", imageUrl: null, status: "ACTIVE",
  variants: [{ variantId, organizationId, productId, name: "Pickup fixture", price: 12345,
    status: "ACTIVE", createdAt: when, updatedAt: when }],
  createdAt: when, updatedAt: when,
};
const store = { storeId, organizationId, name: "QA Store", description: "Read-only", status: "ACTIVE" };
const campaign = { campaignId, organizationId, storeId, name: "รอบพรีออเดอร์ทดสอบ",
  status: "OPEN", openAt: when, closeAt: "2026-11-30T08:00:00.000Z",
  paymentDeadline: "2026-12-03T08:00:00.000Z", pickupAt: "2026-12-15T08:00:00.000Z",
  createdAt: when, updatedAt: when };

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`all native select arrows have a 16px edge inset: ${theme} ${width}px`, async ({ browser }) => {
      const { frontend } = localAuditTargets();
      const context = await browser.newContext({
        viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce",
      });
      let writes = 0;
      const evidence = join("quality-audit", ".evidence", "select-chevron-spacing");
      mkdirSync(evidence, { recursive: true });
      await context.route("**/*", async route => {
        const req = route.request();
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
          writes++;
          return route.abort("blockedbyclient");
        }
        const path = new URL(req.url()).pathname;
        const targets = new Map<string, unknown>([
          [prefix + "/stores", { items: [store], nextCursor: null }],
          [storePath, store],
          [storePath + "/products", { items: [product], nextCursor: null }],
          [storePath + "/products/" + productId, product],
          [storePath + "/campaigns", { items: [campaign], nextCursor: null }],
        ]);
        if (targets.has(path)) {
          return route.fulfill({
            status: 200, contentType: "application/json",
            body: JSON.stringify({ success: true, data: targets.get(path) }),
          });
        }
        return route.continue();
      });
      const page = await context.newPage();
      try {
        await page.goto(frontend + "/products/view/?" + new URLSearchParams({ organizationId, productId }),
          { waitUntil: "domcontentloaded" });
        await expect(page.locator("#product-variant")).toBeVisible({ timeout: 15_000 });
        await expect(page.locator("#product-campaign")).toBeVisible();
        for (const id of ["#product-variant", "#product-campaign"]) {
          const appearance = await page.locator(id).evaluate(element => {
            const style = getComputedStyle(element);
            return {
              appearance: style.appearance,
              image: style.backgroundImage,
              position: style.backgroundPosition,
              padding: parseFloat(style.paddingRight),
              repeat: style.backgroundRepeat,
            };
          });
          expect(appearance.appearance).toBe("none");
          expect(appearance.image).toContain("svg");
          expect(appearance.position).toContain("16px");
          expect(appearance.padding).toBeGreaterThanOrEqual(44);
          expect(appearance.repeat).toBe("no-repeat");
        }
        await expect(page.locator("#product-variant")).toContainText("Pickup fixture");
        await page.locator("#product-campaign").selectOption(campaignId);
        await expect(page.locator("#product-campaign")).toHaveValue(campaignId);
        await page.screenshot({
          path: join(evidence, `product-${theme}-${width}.png`), animations: "disabled",
        });
        await page.locator('[class*="selectionFields"]').first().screenshot({
          path: join(evidence, `product-select-fields-${theme}-${width}.png`),
          animations: "disabled",
        });

        await page.goto(frontend + "/", { waitUntil: "domcontentloaded" });
        for (const id of ["#storefront-filter", "#storefront-organization"]) {
          const dropdown = page.locator(id);
          await expect(dropdown).toBeVisible();
          await expect(dropdown).toHaveAttribute("data-custom-chevron", "true");
          const customArrow = await dropdown.evaluate(element => {
            const chevron = element.nextElementSibling;
            if (!chevron) return { inset: -1, count: 0, image: "" };
            const selectRect = element.getBoundingClientRect();
            const arrowRect = chevron.getBoundingClientRect();
            return { inset: selectRect.right - arrowRect.right, count: 1,
              image: getComputedStyle(element).backgroundImage };
          });
          expect(customArrow.count).toBe(1);
          expect(customArrow.inset).toBeGreaterThanOrEqual(13);
          expect(customArrow.inset).toBeLessThanOrEqual(19);
          expect(customArrow.image).toBe("none");
        }
        await page.getByLabel("แสดงรายการ").selectOption("with-stores");
        await expect(page.getByLabel("แสดงรายการ")).toHaveValue("with-stores");
        expect(writes).toBe(0);
      } finally {
        await context.close();
      }
    });
  }
}
