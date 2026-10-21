import { expect, test } from "./support/qa-fixture";
import { apiJson } from "./support/customer-commerce-fixtures";
import {
  createApprovedAdminOrganization,
  establishAdminOrganizationSession,
} from "./support/organization-admin-fixtures";
import {
  getSeedRoleToken,
} from "./support/seed-auth";

test("order detail and nested confirmation dialogs reflow and preserve keyboard focus", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  test.setTimeout(90_000);

  const runId = `responsive-dialog-${Date.now()}`;
  const organization = await createApprovedAdminOrganization(request, runId);
  const store = await apiJson<{ storeId: string }>(
    request,
    `/organizations/${organization.organizationId}/stores`,
    {
      method: "POST",
      token: organization.adminToken,
      data: { name: `Dialog Store ${runId}`, description: "Dialog responsive test" },
      expectedStatus: 201,
    },
  );
  const product = await apiJson<{ productId: string }>(
    request,
    `/organizations/${organization.organizationId}/products`,
    {
      method: "POST",
      token: organization.adminToken,
      data: {
        storeId: store.storeId,
        name: `Dialog Product ${runId}`,
        description: "Dialog responsive test",
      },
      expectedStatus: 201,
    },
  );
  const variant = await apiJson<{ variantId: string }>(
    request,
    `/organizations/${organization.organizationId}/products/${product.productId}/variants`,
    {
      method: "POST",
      token: organization.adminToken,
      data: { name: "Standard", price: 10000 },
      expectedStatus: 201,
    },
  );
  const campaign = await apiJson<{ campaignId: string }>(
    request,
    `/organizations/${organization.organizationId}/campaigns`,
    {
      method: "POST",
      token: organization.adminToken,
      data: {
        storeId: store.storeId,
        name: `Dialog Campaign ${runId}`,
        openAt: "2030-02-01T00:00:00.000Z",
        closeAt: "2030-02-10T23:59:59.000Z",
        paymentDeadline: "2030-02-11T23:59:59.000Z",
        pickupAt: "2030-02-25T09:00:00.000Z",
      },
      expectedStatus: 201,
    },
  );
  await apiJson(
    request,
    `/organizations/${organization.organizationId}/campaigns/${campaign.campaignId}/open`,
    { method: "POST", token: organization.adminToken, expectedStatus: 200 },
  );
  const customerToken = await getSeedRoleToken(request, "customer");
  const order = await apiJson<{ orderId: string; customerId: string }>(
    request,
    `/organizations/${organization.organizationId}/orders`,
    {
      method: "POST",
      token: customerToken,
      data: {
        campaignId: campaign.campaignId,
        items: [{ productId: product.productId, variantId: variant.variantId, quantity: 1 }],
      },
      expectedStatus: 201,
    },
  );
  await establishAdminOrganizationSession(context, organization);

  await page.setViewportSize({ width: 1440, height: 850 });
  await page.goto(
    `/org/orders/?organizationId=${organization.organizationId}`,
  );
  await page.locator("#organization-orders-campaign").fill(campaign.campaignId);
  await page.locator("#organization-orders-customer").fill(order.customerId);
  await page.locator("#organization-orders-status").click();
  await page.getByRole("option", { name: "รอชำระเงิน" }).click();
  await page.getByRole("button", { name: "ใช้ตัวกรอง" }).click();

  const row = page.getByRole("article", {
    name: new RegExp(`คำสั่งซื้อ ${order.orderId} ·`),
  });
  await expect(row).toBeVisible();

  const detailTrigger = row.getByRole("button", {
    name: `ดูรายละเอียดคำสั่งซื้อ ${order.orderId}`,
  });
  await detailTrigger.click();

  const detailDialog = page.getByRole("dialog", {
    name: `Order ${order.orderId}`,
  });
  await expect(detailDialog).toBeVisible();

  const summaryGrid = detailDialog.locator('[class*="summaryGrid"]');
  const dialogBody = detailDialog.locator('[class*="dialogBody"]');

  async function expectSummaryColumns(
    width: number,
    height: number,
    expectedColumns: number,
  ) {
    await page.setViewportSize({ width, height });

    await expect
      .poll(async () => {
        const template = await summaryGrid.evaluate(
          (element) => getComputedStyle(element).gridTemplateColumns,
        );
        return template.trim().split(/\s+/).length;
      })
      .toBe(expectedColumns);

    const [dialogBox, bodyMetrics] = await Promise.all([
      detailDialog.boundingBox(),
      dialogBody.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      })),
    ]);
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width + 1);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(height + 1);
    expect(bodyMetrics.scrollWidth).toBeLessThanOrEqual(bodyMetrics.clientWidth + 1);

    if (bodyMetrics.scrollHeight > bodyMetrics.clientHeight) {
      await dialogBody.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      expect(await dialogBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await dialogBody.evaluate((element) => {
        element.scrollTop = 0;
      });
    }
  }

  await expectSummaryColumns(1440, 850, 4);
  await expectSummaryColumns(768, 600, 2);
  await expectSummaryColumns(320, 480, 1);

  const cancelOrder = detailDialog.getByRole("button", {
    name: "ยกเลิกคำสั่งซื้อ",
  });
  await cancelOrder.focus();
  await page.keyboard.press("Enter");

  const confirmDialog = page.getByRole("dialog", {
    name: "ยืนยันการยกเลิกคำสั่งซื้อ",
  });
  await expect(confirmDialog).toBeVisible();
  // Radix hides the background modal from the accessibility tree while the
  // confirmation is active, so count the mounted modal surfaces in the DOM.
  await expect(page.locator('[role="dialog"]')).toHaveCount(2);
  await expect(confirmDialog.getByRole("button", { name: "ยืนยันยกเลิกคำสั่งซื้อ" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(confirmDialog).toHaveCount(0);
  await expect(cancelOrder).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(detailDialog).toHaveCount(0);
  await expect(detailTrigger).toBeFocused();

  expect(qaEvents.filter((event) => event.kind === "page-error")).toEqual([]);
});
