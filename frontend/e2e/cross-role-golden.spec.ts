import type { Page } from "@playwright/test";

import {
  expect,
  test,
  unexpectedDiagnostics,
  type QaDiagnosticEvent,
} from "./support/qa-fixture";
import {
  apiJson,
  registerDisposableCustomer,
  tinyPng,
} from "./support/customer-commerce-fixtures";
import {
  getSeedRoleToken,
  LOCAL_SEED_USERS,
} from "./support/seed-auth";

async function switchBrowserSession(
  page: Page,
  token: string,
  organizationId?: string,
): Promise<void> {
  if (page.url() === "about:blank") {
    await page.goto("/");
  }

  await page.evaluate(
    ({ accessToken, activeOrganizationId }) => {
      window.sessionStorage.setItem(
        "unistoreHub.accessToken",
        accessToken,
      );

      if (activeOrganizationId) {
        window.sessionStorage.setItem(
          "unistoreHub.activeOrganizationId",
          activeOrganizationId,
        );
      } else {
        window.sessionStorage.removeItem(
          "unistoreHub.activeOrganizationId",
        );
      }
    },
    {
      accessToken: token,
      activeOrganizationId: organizationId,
    },
  );
}

async function waitForCustomerOrderStatus(
  request: Parameters<typeof apiJson>[0],
  token: string,
  orderId: string,
  expectedStatus: string,
): Promise<{ status: string }> {
  let latest = { status: "" };

  for (let attempt = 0; attempt < 40; attempt += 1) {
    latest = await apiJson<{ status: string }>(
      request,
      `/me/orders/${orderId}`,
      {
        token,
        expectedStatus: 200,
      },
    );

    if (latest.status === expectedStatus) {
      return latest;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250),
    );
  }

  throw new Error(
    `Order ${orderId} did not reach ${expectedStatus}; latest status was ${latest.status}`,
  );
}

async function waitForCampaignStatus(
  request: Parameters<typeof apiJson>[0],
  token: string,
  organizationId: string,
  campaignId: string,
  expectedStatus: string,
): Promise<{ status: string }> {
  let latest = { status: "" };

  for (let attempt = 0; attempt < 40; attempt += 1) {
    latest = await apiJson<{ status: string }>(
      request,
      `/organizations/${organizationId}/campaigns/${campaignId}`,
      {
        token,
        expectedStatus: 200,
      },
    );

    if (latest.status === expectedStatus) {
      return latest;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250),
    );
  }

  throw new Error(
    `Campaign ${campaignId} did not reach ${expectedStatus}; latest status was ${latest.status}`,
  );
}

function allowExpectedFirstPaymentLookup(
  event: QaDiagnosticEvent,
): boolean {
  return (
    (event.kind === "http-error" &&
      event.status === 404 &&
      event.url.includes("/me/orders/") &&
      event.url.endsWith("/payment")) ||
    (event.kind === "console-error" &&
      event.message.includes("404"))
  );
}

test("golden cross-role flow propagates Platform approval, Customer payment reject/resubmit, Staff approval, Admin lifecycle, Pickup, and Audit", async ({
  page,
  request,
  qaEvents,
}, testInfo) => {
  test.setTimeout(120_000);

  const runId =
    `golden-${Date.now()}-${testInfo.workerIndex}`;

  const [
    platformToken,
    adminToken,
    staffToken,
    customer,
  ] = await Promise.all([
    getSeedRoleToken(request, "platformAdmin"),
    getSeedRoleToken(request, "organizationAdmin"),
    getSeedRoleToken(request, "staff"),
    registerDisposableCustomer(request, runId),
  ]);

  const organizationName = `Golden Org ${runId}`;
  const organization = await apiJson<{
    organizationId: string;
    status: string;
  }>(request, "/organizations", {
    method: "POST",
    token: adminToken,
    data: {
      name: organizationName,
      description:
        "Disposable cross-role golden journey Organization",
    },
    expectedStatus: 201,
  });
  const organizationId = organization.organizationId;
  expect(organization.status).toBe("PENDING");

  // Platform Admin: approve the Organization through the visible UI.
  await switchBrowserSession(page, platformToken);
  await page.goto("/platform/organizations/");

  let organizationRow = page
    .locator("article")
    .filter({ hasText: organizationName })
    .first();
  await expect(organizationRow).toContainText("รออนุมัติ");

  await organizationRow
    .getByRole("button", {
      name: "อนุมัติ",
      exact: true,
    })
    .click();

  let dialog = page.getByRole("dialog", {
    name: `อนุมัติ ${organizationName}?`,
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันอนุมัติ",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      `อนุมัติหน่วยงาน ${organizationName} เรียบร้อยแล้ว`,
    ),
  ).toBeVisible();

  let authoritativeOrganization = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${organizationId}`,
    {
      token: adminToken,
      expectedStatus: 200,
    },
  );
  expect(authoritativeOrganization.status).toBe("ACTIVE");

  // Organization Admin: add the real seeded Staff account through the UI.
  await switchBrowserSession(page, adminToken, organizationId);
  await page.goto(
    `/org/staff/?organizationId=${organizationId}`,
  );

  await page.locator("#staff-email").fill(
    LOCAL_SEED_USERS.staff,
  );
  await page.locator("#staff-role").selectOption("STAFF");
  await page
    .getByRole("button", {
      name: "เพิ่มสมาชิก",
    })
    .click();

  const staffCard = page
    .locator("article")
    .filter({ hasText: LOCAL_SEED_USERS.staff })
    .first();
  await expect(staffCard).toBeVisible();
  await expect(
    staffCard.getByLabel("บทบาท"),
  ).toHaveValue("STAFF");

  // Setup catalog through the authoritative API. The cross-role test focuses
  // browser coverage on handoffs, while Phase 7 already covers catalog CRUD.
  const storeName = `Golden Store ${runId}`;
  const store = await apiJson<{
    storeId: string;
  }>(
    request,
    `/organizations/${organizationId}/stores`,
    {
      method: "POST",
      token: adminToken,
      data: {
        name: storeName,
        description: "Golden journey Store",
      },
      expectedStatus: 201,
    },
  );

  const productName = `Golden Product ${runId}`;
  const product = await apiJson<{
    productId: string;
  }>(
    request,
    `/organizations/${organizationId}/products`,
    {
      method: "POST",
      token: adminToken,
      data: {
        storeId: store.storeId,
        name: productName,
        description: "Golden journey Product",
      },
      expectedStatus: 201,
    },
  );

  const variantName = "Golden Variant";
  const variant = await apiJson<{
    variantId: string;
  }>(
    request,
    `/organizations/${organizationId}/products/${product.productId}/variants`,
    {
      method: "POST",
      token: adminToken,
      data: {
        name: variantName,
        price: 15900,
      },
      expectedStatus: 201,
    },
  );

  const campaignName = `Golden Campaign ${runId}`;
  const campaign = await apiJson<{
    campaignId: string;
  }>(
    request,
    `/organizations/${organizationId}/campaigns`,
    {
      method: "POST",
      token: adminToken,
      data: {
        storeId: store.storeId,
        name: campaignName,
        openAt: "2032-01-01T09:00:00.000Z",
        closeAt: "2032-01-10T18:00:00.000Z",
        paymentDeadline: "2032-01-11T18:00:00.000Z",
        pickupAt: "2032-01-20T09:00:00.000Z",
      },
      expectedStatus: 201,
    },
  );

  // Organization Admin: publish the Campaign through the UI.
  await page.goto(
    `/org/campaigns/?organizationId=${organizationId}`,
  );

  let campaignCard = page
    .locator("article")
    .filter({ hasText: campaignName })
    .first();
  await campaignCard
    .getByRole("button", {
      name: /ดูรายละเอียด|ดูและแก้ไข/,
    })
    .click();

  await page
    .getByRole("button", {
      name: "เปิดรับคำสั่งซื้อ",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "เปิดรับคำสั่งซื้อ",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "สถานะเปลี่ยนเป็น “เปิดรับคำสั่งซื้อ” แล้ว",
    ),
  ).toBeVisible();

  // Customer: create the Order from the Product page and submit Payment.
  await switchBrowserSession(page, customer.token);
  await page.goto(
    `/products/view/?organizationId=${organizationId}&productId=${product.productId}&campaignId=${campaign.campaignId}`,
  );

  await expect(
    page.getByRole("heading", {
      name: productName,
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByLabel("ตัวเลือกสินค้า")
    .selectOption(variant.variantId);
  await page
    .getByLabel("แคมเปญ")
    .selectOption(campaign.campaignId);
  await page.getByLabel("จำนวน").fill("2");

  await page
    .getByRole("link", {
      name: "ดำเนินการสั่งซื้อ",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "ตรวจสอบคำสั่งซื้อ",
      level: 1,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "ยืนยันสร้างคำสั่งซื้อ",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "สร้างคำสั่งซื้อสำเร็จ",
      level: 1,
    }),
  ).toBeVisible();

  const orderTechnicalText = await page
    .locator("[data-technical]")
    .filter({ hasText: "เลขคำสั่งซื้อ" })
    .textContent();
  const orderId = orderTechnicalText?.match(
    /[0-9a-f]{8}-[0-9a-f-]{27,}/i,
  )?.[0];
  expect(orderId).toBeTruthy();

  await page
    .getByRole("link", {
      name: "ไปชำระเงิน",
    })
    .click();

  await page.locator("#payment-slip").setInputFiles({
    name: "golden-first-slip.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page
    .getByRole("button", {
      name: "ส่งหลักฐานการชำระเงิน",
    })
    .click();

  await expect(
    page.getByText(
      "ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ",
    ),
  ).toBeVisible({ timeout: 15_000 });

  // Staff: see the Customer Payment and reject it with a real reason.
  await switchBrowserSession(page, staffToken, organizationId);
  await page.goto(
    `/org/payments/?organizationId=${organizationId}`,
  );

  await page
    .locator("#payment-review-order")
    .fill(orderId!);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  let paymentRow = page
    .getByRole("article")
    .filter({ hasText: orderId! })
    .first();
  await expect(paymentRow).toBeVisible();

  await paymentRow
    .getByRole("button", {
      name: /ตรวจสอบ การชำระเงิน/,
    })
    .click();

  let paymentDetail = page.locator(
    'aside[aria-label="รายละเอียดการชำระเงิน"]',
  );
  await paymentDetail
    .getByRole("button", {
      name: "ปฏิเสธการชำระเงิน",
    })
    .click();

  const rejectionReason =
    "สลิปไม่ชัดเจน กรุณาส่งหลักฐานใหม่";
  dialog = page.getByRole("dialog", {
    name: "ปฏิเสธการชำระเงิน",
  });
  await dialog
    .locator("#payment-reject-reason")
    .fill(rejectionReason);
  await dialog
    .getByRole("button", {
      name: "ยืนยันปฏิเสธ",
    })
    .click();

  await expect(
    page.getByText(
      "ปฏิเสธการชำระเงินและบันทึกเหตุผลแล้ว",
    ),
  ).toBeVisible();

  let customerOrder = await apiJson<{
    status: string;
  }>(
    request,
    `/me/orders/${orderId}`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  expect(customerOrder.status).toBe("PAYMENT_REJECTED");

  // Customer: rejection reason propagates back and the same Order can resubmit.
  await switchBrowserSession(page, customer.token);
  await page.goto(
    `/my/payment/?orderId=${orderId}`,
  );

  await expect(
    page.getByText(
      "เหตุผลที่หลักฐานไม่ผ่านการตรวจสอบ",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(rejectionReason),
  ).toBeVisible();

  await page.locator("#payment-slip").setInputFiles({
    name: "golden-resubmitted-slip.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page
    .getByRole("button", {
      name: "ส่งหลักฐานใหม่",
    })
    .click();

  await expect(
    page.getByText(
      "ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ",
    ),
  ).toBeVisible({ timeout: 15_000 });

  customerOrder = await apiJson<{
    status: string;
  }>(
    request,
    `/me/orders/${orderId}`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  expect(customerOrder.status).toBe("PAYMENT_REVIEW");

  // Staff: the resubmission returns to the review queue and can be approved.
  await switchBrowserSession(page, staffToken, organizationId);
  await page.goto(
    `/org/payments/?organizationId=${organizationId}`,
  );
  await page
    .locator("#payment-review-order")
    .fill(orderId!);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  paymentRow = page
    .getByRole("article")
    .filter({ hasText: orderId! })
    .first();
  await paymentRow
    .getByRole("button", {
      name: /ตรวจสอบ การชำระเงิน/,
    })
    .click();

  paymentDetail = page.locator(
    'aside[aria-label="รายละเอียดการชำระเงิน"]',
  );
  await paymentDetail
    .getByRole("button", {
      name: "อนุมัติการชำระเงิน",
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: "ยืนยันการอนุมัติการชำระเงิน",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันอนุมัติ",
    })
    .click();

  await expect(
    page.getByText(
      "อนุมัติการชำระเงินเรียบร้อยแล้ว",
    ),
  ).toBeVisible();

  customerOrder = await apiJson<{
    status: string;
  }>(
    request,
    `/me/orders/${orderId}`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  expect(customerOrder.status).toBe("PAID");

  // Customer observes Staff approval.
  await switchBrowserSession(page, customer.token);
  await page.goto(
    `/my/order/?orderId=${orderId}`,
  );
  await expect(
    page.getByText("ชำระเงินแล้ว", {
      exact: true,
    }).first(),
  ).toBeVisible();

  // Organization Admin: close, start production, and mark ready through UI.
  await switchBrowserSession(page, adminToken, organizationId);
  await page.goto(
    `/org/campaigns/?organizationId=${organizationId}`,
  );

  campaignCard = page
    .locator("article")
    .filter({ hasText: campaignName })
    .first();
  await campaignCard
    .getByRole("button", {
      name: /ดูรายละเอียด|ดูและแก้ไข/,
    })
    .click();

  for (const action of [
    "ปิดรับคำสั่งซื้อ",
    "เริ่มการผลิต",
    "แจ้งพร้อมรับสินค้า",
  ]) {
    await page
      .getByRole("button", {
        name: action,
        exact: true,
      })
      .click();

    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", {
        name: action,
        exact: true,
      })
      .click();
  }

  await waitForCustomerOrderStatus(
    request,
    customer.token,
    orderId!,
    "READY_FOR_PICKUP",
  );

  const pickup = await apiJson<{
    pickupId: string;
    token: string;
    status: string;
  }>(
    request,
    `/me/orders/${orderId}/pickup`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  expect(pickup.status).toBe("READY");

  // Customer: READY state, QR/Token, and notification propagate from Admin action.
  await switchBrowserSession(page, customer.token);
  await page.goto(
    `/my/order/?orderId=${orderId}`,
  );
  await expect(
    page.getByText("พร้อมรับสินค้า", {
      exact: true,
    }).first(),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "เปิดข้อมูลรับสินค้า",
    })
    .click();

  await expect(
    page.getByRole("img", {
      name: "QR สำหรับรับสินค้า",
    }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator("code").filter({
      hasText: pickup.token,
    }),
  ).toBeVisible();

  await page.goto("/notifications/");
  const readyNotification = page
    .getByRole("article")
    .filter({ hasText: "Ready for Pickup" })
    .first();
  await expect(readyNotification).toBeVisible({
    timeout: 10_000,
  });

  // Staff: confirm handoff using the propagated Pickup Token.
  await switchBrowserSession(page, staffToken, organizationId);
  await page.goto(
    `/org/pickups/?organizationId=${organizationId}`,
  );
  await page
    .locator("#pickup-token-filter")
    .fill(pickup.token);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const pickupRow = page
    .getByRole("article")
    .filter({ hasText: pickup.pickupId })
    .first();
  await expect(pickupRow).toBeVisible();
  await pickupRow
    .getByRole("button", {
      name: /ดูรายละเอียด Pickup/,
    })
    .click();

  const pickupDetail = page.locator(
    'aside[aria-label="รายละเอียด Pickup"]',
  );
  await pickupDetail
    .getByRole("button", {
      name: "ยืนยันรับสินค้า",
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: "ยืนยันการรับสินค้า",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันรับสินค้า",
    })
    .click();

  await expect(
    page.getByText(
      "ยืนยันการรับสินค้าเรียบร้อยแล้ว",
    ),
  ).toBeVisible();

  // Customer observes the final RECEIVED state.
  await switchBrowserSession(page, customer.token);
  await page.goto(
    `/my/order/?orderId=${orderId}`,
  );
  await expect(
    page.getByText("รับสินค้าแล้ว", {
      exact: true,
    }).first(),
  ).toBeVisible();

  customerOrder = await apiJson<{
    status: string;
  }>(
    request,
    `/me/orders/${orderId}`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  expect(customerOrder.status).toBe("RECEIVED");

  const receivedPickup = await apiJson<{
    status: string;
  }>(
    request,
    `/me/orders/${orderId}/pickup`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  expect(receivedPickup.status).toBe("RECEIVED");

  // Organization Admin: complete the Campaign and inspect lifecycle Audit.
  await switchBrowserSession(page, adminToken, organizationId);
  await page.goto(
    `/org/campaigns/?organizationId=${organizationId}`,
  );

  campaignCard = page
    .locator("article")
    .filter({ hasText: campaignName })
    .first();
  await campaignCard
    .getByRole("button", {
      name: /ดูรายละเอียด|ดูและแก้ไข/,
    })
    .click();

  await page
    .getByRole("button", {
      name: "ปิดแคมเปญเป็นเสร็จสิ้น",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "ปิดแคมเปญเป็นเสร็จสิ้น",
      exact: true,
    })
    .click();

  await expect(
    page
      .getByLabel("สถานะและขั้นตอนถัดไป")
      .getByText("เสร็จสิ้น"),
  ).toBeVisible();

  const finalCampaign = await waitForCampaignStatus(
    request,
    adminToken,
    organizationId,
    campaign.campaignId,
    "COMPLETED",
  );
  expect(finalCampaign.status).toBe("COMPLETED");

  await page.goto(
    `/org/audit/?organizationId=${organizationId}`,
  );
  await page
    .locator("#audit-resource-id")
    .fill(campaign.campaignId);
  await page
    .getByRole("button", {
      name: "ค้นหา / กรอง",
    })
    .click();

  const campaignAuditRows = page
    .locator("tbody tr")
    .filter({ hasText: campaign.campaignId });
  await expect(campaignAuditRows.first()).toBeVisible();
  expect(await campaignAuditRows.count()).toBeGreaterThan(0);

  // Platform Admin still sees the Organization as ACTIVE after business flow.
  await switchBrowserSession(page, platformToken);
  await page.goto("/platform/organizations/");
  organizationRow = page
    .locator("article")
    .filter({ hasText: organizationName })
    .first();
  await expect(organizationRow).toContainText("ใช้งาน");

  authoritativeOrganization = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${organizationId}`,
    {
      token: adminToken,
      expectedStatus: 200,
    },
  );
  expect(authoritativeOrganization.status).toBe("ACTIVE");

  expect(
    unexpectedDiagnostics(
      qaEvents,
      allowExpectedFirstPaymentLookup,
    ),
  ).toEqual([]);
});
