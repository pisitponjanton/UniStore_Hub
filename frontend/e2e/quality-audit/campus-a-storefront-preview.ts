import type { Page } from "@playwright/test";

/**
 * Read-only deterministic shopper data for older visual/hover baseline tests.
 * The live development API currently contains E2E tenants, intentionally
 * hidden from normal visitor views by Phase 7. Do not depend on them.
 *
 * This intercepts GET only, creates no organization, and is never used
 * by Phase 7's separate live-local fixture exclusion checks.
 */
export async function installOrdinaryStorePreview(page: Page): Promise<void> {
  await page.route("**/storefront/directory", route => {
    if (route.request().method() !== "GET") return route.abort("blockedbyclient");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            organization: { organizationId: "browser-readonly-org", name: "ชมรมสินค้าตัวอย่าง", description: "เนื้อหาสำหรับทดสอบหน้าจอเท่านั้น", status: "ACTIVE" },
            stores: [
              { organizationId: "browser-readonly-org", storeId: "browser-readonly-1", name: "ร้านกิจกรรมตัวอย่าง", description: "สินค้าและรอบขายจากชมรม", status: "ACTIVE" },
              { organizationId: "browser-readonly-org", storeId: "browser-readonly-2", name: "ร้านหนังสือตัวอย่าง", description: "สินค้าในมหาวิทยาลัย", status: "ACTIVE" },
            ],
          },
        ],
      }),
    });
  });
}
