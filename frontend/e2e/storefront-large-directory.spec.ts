import { expect, test } from "./support/qa-fixture";

// Synthetic browser-scale dataset: no database writes or shared seed mutations.
const totalOrgs = 1_200;
const emptyOrgs = 100;
const data = Array.from({ length: totalOrgs }, (_, index) => ({
  organization: {
    organizationId: `synthetic-org-${index}`,
    name: `University Organization ${index}`,
    description: "",
    status: "ACTIVE",
  },
  stores: index < emptyOrgs
    ? []
    : Array.from({ length: 2 }, (_, storeIndex) => ({
        storeId: `synthetic-store-${index}-${storeIndex}`,
        organizationId: `synthetic-org-${index}`,
        name: index === totalOrgs - 1 && storeIndex === 1
          ? "Unique Final Campus Shop"
          : `Campus Shop ${index} / ${storeIndex}`,
        description: "",
        status: "ACTIVE",
      })),
}));

test("large public directory remains searchable and paginated without a network fanout", async ({
  page,
}) => {
  test.setTimeout(45_000);
  let directoryRequests = 0;
  await page.route("**/api/v1/storefront/directory", async (route) => {
    directoryRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({ success: true, data }),
    });
  });

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const start = Date.now();
    await page.goto("/");
    await expect(page.getByRole("status").filter({ hasText: "2200" })).toBeVisible();
    const elapsedMs = Date.now() - start;
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      links: document.querySelectorAll('a[href*="/stores/view"]').length,
      renderedElements: document.querySelectorAll("*").length,
    }));

    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.links).toBeLessThanOrEqual(16);
    expect(metrics.renderedElements).toBeLessThan(850);

    // Search must include the last store in the complete 2,300-entry directory,
    // not just the first 12 items rendered on the current page.
    await page.locator("#storefront-search").fill("Unique Final Campus Shop");
    await expect(page.getByText("Unique Final Campus Shop")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "1 ร้าน" })).toBeVisible();

    await page.locator("#storefront-search").fill("University Organization 0");
    await page.locator("#storefront-filter").selectOption("without-stores");
    await expect(page.getByRole("status").filter({ hasText: "1 หน่วยงาน" })).toBeVisible();
    console.log(`SYNTHETIC_DIRECTORY width=${width} loadMs=${elapsedMs} totalEntries=2300 DOM=${metrics.renderedElements} renderedStoreLinks=${metrics.links}`);
  }

  expect(directoryRequests).toBeGreaterThanOrEqual(2);
  expect(directoryRequests).toBeLessThanOrEqual(4);
});
