import { expect, test } from "./support/qa-fixture";
import {
  establishSeedRoleSession,
  LOCAL_SEED_ENTITY_IDS,
} from "./support/seed-auth";

const mobileSizes = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

for (const viewport of mobileSizes) {
  test(`mobile Staff payment queue shortcuts work at ${viewport.width}px`, async ({
    context,
    page,
    request,
  }, testInfo) => {
    await establishSeedRoleSession(context, request, "staff");
    await page.setViewportSize(viewport);
    await page.goto(
      `/org/payments/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
    );

    await expect(
      page.getByRole("heading", {
        name: "ตรวจสอบการชำระเงิน",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.locator("#payment-review-list")).toBeVisible();

    const shortcuts = page.getByRole("navigation", {
      name: "ทางลัดคิวตรวจสอบการชำระเงิน",
    });
    await expect(shortcuts).toBeVisible();

    const queueLink = shortcuts.getByRole("link", { name: /ดูคิวตรวจสลิป/ });
    const filterLink = shortcuts.getByRole("link", { name: "ตัวกรองรายการ" });
    await expect(queueLink).toHaveAttribute("href", "#payment-review-list");
    await expect(filterLink).toHaveAttribute("href", "#payment-filter-title");

    const shortcutBox = await shortcuts.boundingBox();
    expect(shortcutBox).not.toBeNull();
    expect(shortcutBox!.y + shortcutBox!.height).toBeLessThanOrEqual(
      viewport.height,
    );

    const kpiColumns = await page
      .locator('section[aria-label="สรุปคิวชำระเงินที่โหลด"]')
      .evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    expect(kpiColumns).toBe(2);

    // Visually compact helper text remains available to assistive technology.
    const filterHelp = page.getByText(
      "กรองด้วยสถานะ รหัสแคมเปญ หรือรหัสคำสั่งซื้อ",
    );
    await expect(filterHelp).toHaveCount(1);
    expect(
      await filterHelp.evaluate((element) => getComputedStyle(element).display),
    ).not.toBe("none");
    const accessibleFilter = await page
      .locator('section[aria-labelledby="payment-filter-title"]')
      .ariaSnapshot();
    expect(accessibleFilter).toContain(
      "กรองด้วยสถานะ รหัสแคมเปญ หรือรหัสคำสั่งซื้อ",
    );

    const summary = page.locator('section[aria-label="สรุปคิวชำระเงินที่โหลด"]');
    await expect(summary).toContainText("รายการที่โหลด");
    await expect(summary).toContainText("รอตรวจสอบ");
    await expect(summary).toContainText("อนุมัติแล้ว");
    await expect(summary).toContainText("ปฏิเสธแล้ว");

    const overflow = await page.evaluate(
      () => Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
      ) - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    if (viewport.width === 390) {
      await testInfo.attach("mobile-payment-review", {
        body: await page.screenshot({ type: "png" }),
        contentType: "image/png",
      });
    }

    await queueLink.click();
    await expect(page.locator("#payment-review-list")).toBeInViewport();

    await filterLink.click();
    await expect(page.locator("#payment-filter-title")).toBeInViewport();
    await expect(page.locator("#payment-review-status")).toBeVisible();
  });
}

test("Organization Admin retains payment filters and desktop KPI layout", async ({
  context,
  page,
  request,
}) => {
  await establishSeedRoleSession(context, request, "organizationAdmin");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `/org/payments/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
  );

  await expect(page.locator("#payment-review-list")).toBeVisible();
  await expect(
    page.getByRole("navigation", {
      name: "ทางลัดคิวตรวจสอบการชำระเงิน",
    }),
  ).toBeHidden();
  await expect(page.locator("#payment-review-status")).toBeVisible();
  await expect(page.locator("#payment-review-campaign")).toBeVisible();
  await expect(page.locator("#payment-review-order")).toBeVisible();

  const kpiColumns = await page
    .locator('section[aria-label="สรุปคิวชำระเงินที่โหลด"]')
    .evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
  expect(kpiColumns).toBe(4);
});
