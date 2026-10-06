import {
  expect,
  test,
  unexpectedDiagnostics,
  type QaDiagnosticEvent,
} from "./support/qa-fixture";
import {
  apiJson,
  createReadyForPickupFixture,
} from "./support/customer-commerce-fixtures";
import {
  createStaffPaymentReviewFixture,
  createStaffPendingOrderFixture,
} from "./support/staff-operational-fixtures";
import {
  establishSeedRoleSession,
  getSeedRoleToken,
  LOCAL_SEED_ENTITY_IDS,
} from "./support/seed-auth";

function allowDuplicatePickupConflict(
  event: QaDiagnosticEvent,
): boolean {
  return (
    (event.kind === "http-error" &&
      event.status === 409 &&
      event.url.includes("/pickups/") &&
      event.url.endsWith("/confirm")) ||
    (event.kind === "console-error" &&
      event.message.includes("409"))
  );
}

test("Staff can select the seed Organization, sees only operational navigation, and is blocked from admin-only routes", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  await establishSeedRoleSession(
    context,
    request,
    "staff",
  );

  await page.goto("/org/select/");

  await expect(
    page.getByRole("heading", {
      name: "เลือกหน่วยงานที่จะทำงาน",
      level: 1,
    }),
  ).toBeVisible();

  const seedOrganization = page
    .locator("li")
    .filter({
      hasText: LOCAL_SEED_ENTITY_IDS.organizationId,
    })
    .first();

  await expect(seedOrganization).toBeVisible();
  await seedOrganization
    .getByRole("button", {
      name: /^เข้าใช้งาน /,
    })
    .click();

  await expect(page).toHaveURL(
    new RegExp(
      `/org/orders/\\?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
    ),
  );
  await expect(
    page.getByRole("heading", {
      name: "คำสั่งซื้อของหน่วยงาน",
      level: 1,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "คำสั่งซื้อ", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "ตรวจสอบการชำระเงิน",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "รับสินค้า" }),
  ).toBeVisible();

  for (const adminLabel of [
    "แดชบอร์ด",
    "ข้อมูลหน่วยงาน",
    "บุคลากร",
    "ร้านค้า",
    "สินค้า",
    "แคมเปญ",
    "สรุปการผลิต",
    "ประวัติการทำรายการ",
  ]) {
    await expect(
      page.getByRole("link", {
        name: adminLabel,
        exact: true,
      }),
    ).toHaveCount(0);
  }

  const adminOnlyRoutes = [
    "/org/dashboard/",
    "/org/settings/",
    "/org/staff/",
    "/org/stores/",
    "/org/products/",
    "/org/campaigns/",
    "/org/production/",
    "/org/audit/",
  ];

  for (const route of adminOnlyRoutes) {
    await page.goto(
      `${route}?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
    );
    await expect(
      page.getByRole("heading", {
        name: "ไม่มีสิทธิ์เข้าถึง",
        level: 1,
      }),
    ).toBeVisible();
  }

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Staff can filter Organization Orders, open a real detail, and cannot use the admin-only cancel action", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createStaffPendingOrderFixture(
    request,
    `orders-${Date.now()}-${testInfo.workerIndex}`,
  );

  await establishSeedRoleSession(
    context,
    request,
    "staff",
  );

  await page.goto(
    `/org/orders/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
  );

  await page
    .locator("#organization-orders-campaign")
    .fill(LOCAL_SEED_ENTITY_IDS.campaignId);
  await page
    .locator("#organization-orders-customer")
    .fill(fixture.customerId);
  await page
    .locator("#organization-orders-status")
    .selectOption("PENDING_PAYMENT");

  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const row = page.getByRole("article", {
    name: new RegExp(
      `คำสั่งซื้อ ${fixture.orderId} ·`,
    ),
  });
  await expect(row).toBeVisible();
  await expect(
    page.getByRole("group", {
      name: "ตัวกรองที่ใช้อยู่",
    }),
  ).toContainText(fixture.customerId);

  await page
    .getByRole("button", {
      name: "แสดงทั้งหมด",
    })
    .click();

  await expect(
    page.getByRole("group", {
      name: "ตัวกรองที่ใช้อยู่",
    }),
  ).toContainText("แสดงทุกคำสั่งซื้อ");

  await page
    .locator("#organization-orders-campaign")
    .fill(LOCAL_SEED_ENTITY_IDS.campaignId);
  await page
    .locator("#organization-orders-customer")
    .fill(fixture.customerId);
  await page
    .locator("#organization-orders-status")
    .selectOption("PENDING_PAYMENT");
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const filteredRow = page.getByRole("article", {
    name: new RegExp(
      `คำสั่งซื้อ ${fixture.orderId} ·`,
    ),
  });
  await filteredRow
    .getByRole("link", {
      name: `ดูรายละเอียดคำสั่งซื้อ ${fixture.orderId}`,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "รายละเอียดคำสั่งซื้อ",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(`Order ${fixture.orderId}`),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "ยกเลิกคำสั่งซื้อ",
    }),
  ).toHaveCount(0);

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Staff can inspect the Payment slip and approve a real PAYMENT_REVIEW item", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createStaffPaymentReviewFixture(
    request,
    `approve-${Date.now()}-${testInfo.workerIndex}`,
  );

  await establishSeedRoleSession(
    context,
    request,
    "staff",
  );

  await page.goto(
    `/org/payments/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
  );

  await page
    .locator("#payment-review-status")
    .selectOption("PENDING_REVIEW");
  await page
    .locator("#payment-review-order")
    .fill(fixture.orderId);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const row = page.getByRole("article", {
    name: new RegExp(
      `การชำระเงิน ${fixture.paymentId} ·`,
    ),
  });
  await expect(row).toBeVisible();

  await row
    .getByRole("button", {
      name: `ตรวจสอบ การชำระเงิน ${fixture.paymentId}`,
    })
    .click();

  const detail = page.locator(
    'aside[aria-label="รายละเอียดการชำระเงิน"]',
  );
  await expect(detail).toContainText(
    `Payment ${fixture.paymentId}`,
  );
  await expect(detail).toContainText(
    `Order ${fixture.orderId}`,
  );

  await detail
    .getByRole("button", { name: "เปิดสลิป" })
    .click();

  const temporarySlip = detail.getByRole("link", {
    name: "เปิดสลิปในแท็บใหม่",
  });
  await expect(temporarySlip).toBeVisible();
  await expect(temporarySlip).toHaveAttribute(
    "target",
    "_blank",
  );
  await expect(temporarySlip).toHaveAttribute(
    "href",
    /.+/,
  );

  await detail
    .getByRole("button", {
      name: "อนุมัติการชำระเงิน",
    })
    .click();

  const dialog = page.getByRole("dialog", {
    name: "ยืนยันการอนุมัติการชำระเงิน",
  });
  await expect(dialog).toBeVisible();
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
  await expect(
    detail.getByText("อนุมัติแล้ว", {
      exact: true,
    }).first(),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", {
      name: "อนุมัติการชำระเงิน",
    }),
  ).toHaveCount(0);

  const staffToken = await getSeedRoleToken(
    request,
    "staff",
  );
  const order = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/orders/${fixture.orderId}`,
    {
      token: staffToken,
      expectedStatus: 200,
    },
  );
  expect(order.status).toBe("PAID");

  const payment = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/payments/${fixture.paymentId}`,
    {
      token: staffToken,
      expectedStatus: 200,
    },
  );
  expect(payment.status).toBe("APPROVED");

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Staff reject dialog records Back and validation behavior, then rejects a real Payment with the reason preserved", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createStaffPaymentReviewFixture(
    request,
    `reject-${Date.now()}-${testInfo.workerIndex}`,
  );
  const rejectionReason =
    "ยอดเงินในสลิปไม่ตรงกับยอดคำสั่งซื้อ";

  await establishSeedRoleSession(
    context,
    request,
    "staff",
  );

  await page.goto(
    `/org/payments/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
  );

  await page
    .locator("#payment-review-order")
    .fill(fixture.orderId);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const row = page.getByRole("article", {
    name: new RegExp(
      `การชำระเงิน ${fixture.paymentId} ·`,
    ),
  });
  await row
    .getByRole("button", {
      name: `ตรวจสอบ การชำระเงิน ${fixture.paymentId}`,
    })
    .click();

  const detail = page.locator(
    'aside[aria-label="รายละเอียดการชำระเงิน"]',
  );

  await detail
    .getByRole("button", {
      name: "ปฏิเสธการชำระเงิน",
    })
    .click();

  let dialog = page.getByRole("dialog", {
    name: "ปฏิเสธการชำระเงิน",
  });
  await expect(dialog).toBeVisible();

  await dialog
    .getByRole("button", {
      name: "กลับ",
    })
    .click();

  await expect(dialog).not.toBeVisible();

  await detail
    .getByRole("button", {
      name: "ปฏิเสธการชำระเงิน",
    })
    .click();

  dialog = page.getByRole("dialog", {
    name: "ปฏิเสธการชำระเงิน",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันปฏิเสธ",
    })
    .click();

  const rejectSummary = page.locator(
    "#payment-reject-error-summary",
  );
  await expect(rejectSummary).toBeVisible();
  await expect(
    page.locator("#payment-reject-reason-error"),
  ).toHaveText(
    "กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน",
  );

  await expect(rejectSummary).toBeFocused();

  await page
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
  await expect(
    detail.getByText("ปฏิเสธแล้ว", {
      exact: true,
    }).first(),
  ).toBeVisible();
  await expect(
    detail.getByText(rejectionReason),
  ).toBeVisible();

  const staffToken = await getSeedRoleToken(
    request,
    "staff",
  );
  const order = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/orders/${fixture.orderId}`,
    {
      token: staffToken,
      expectedStatus: 200,
    },
  );
  expect(order.status).toBe("PAYMENT_REJECTED");

  const payment = await apiJson<{
    status: string;
    rejectReason: string | null;
  }>(
    request,
    `/organizations/${LOCAL_SEED_ENTITY_IDS.organizationId}/payments/${fixture.paymentId}`,
    {
      token: staffToken,
      expectedStatus: 200,
    },
  );
  expect(payment.status).toBe("REJECTED");
  expect(payment.rejectReason).toBe(rejectionReason);

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Staff can filter and confirm a READY Pickup and duplicate confirmation refreshes stale UI safely", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  test.setTimeout(80_000);

  const suffix =
    `${Date.now()}-${testInfo.workerIndex}`;
  const normal = await createReadyForPickupFixture(
    request,
    `staff-normal-${suffix}`,
  );
  const duplicate = await createReadyForPickupFixture(
    request,
    `staff-duplicate-${suffix}`,
  );

  await establishSeedRoleSession(
    context,
    request,
    "staff",
  );

  await page.goto(
    `/org/pickups/?organizationId=${normal.organizationId}`,
  );

  await page
    .locator("#pickup-token-filter")
    .fill(normal.pickupToken);
  await page
    .locator("#pickup-status-filter")
    .selectOption("READY");
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const normalRow = page.getByRole("article", {
    name: new RegExp(
      `Pickup ${normal.pickupId} ·`,
    ),
  });
  await expect(normalRow).toBeVisible();
  await normalRow
    .getByRole("button", {
      name: `ดูรายละเอียด Pickup ${normal.pickupId}`,
    })
    .click();

  let detail = page.locator(
    'aside[aria-label="รายละเอียด Pickup"]',
  );
  await expect(detail).toContainText(
    normal.pickupToken,
  );

  await detail
    .getByRole("button", {
      name: "ยืนยันรับสินค้า",
    })
    .click();

  let dialog = page.getByRole("dialog", {
    name: "ยืนยันการรับสินค้า",
  });
  await expect(dialog).toBeVisible();
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
  await expect(
    detail.getByText(
      /Pickup นี้รับสินค้าเรียบร้อยแล้ว/,
    ),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", {
      name: "ยืนยันรับสินค้า",
    }),
  ).toHaveCount(0);

  const staffToken = await getSeedRoleToken(
    request,
    "staff",
  );
  const receivedOrder = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${normal.organizationId}/orders/${normal.orderId}`,
    {
      token: staffToken,
      expectedStatus: 200,
    },
  );
  expect(receivedOrder.status).toBe("RECEIVED");

  await page.goto(
    `/org/pickups/?organizationId=${duplicate.organizationId}`,
  );

  await page
    .locator("#pickup-token-filter")
    .fill(duplicate.pickupToken);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const duplicateRow = page.getByRole("article", {
    name: new RegExp(
      `Pickup ${duplicate.pickupId} ·`,
    ),
  });
  await duplicateRow
    .getByRole("button", {
      name: `ดูรายละเอียด Pickup ${duplicate.pickupId}`,
    })
    .click();

  detail = page.locator(
    'aside[aria-label="รายละเอียด Pickup"]',
  );
  await expect(
    detail.getByRole("button", {
      name: "ยืนยันรับสินค้า",
    }),
  ).toBeVisible();

  await apiJson(
    request,
    `/organizations/${duplicate.organizationId}/pickups/${duplicate.pickupId}/confirm`,
    {
      method: "POST",
      token: staffToken,
      expectedStatus: 200,
    },
  );

  await detail
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
      "รายการรับสินค้านี้ถูกยืนยันไปแล้ว ระบบได้โหลดสถานะล่าสุดมาให้",
    ),
  ).toBeVisible();

  await expect(
    detail.getByText(
      /Pickup นี้รับสินค้าเรียบร้อยแล้ว/,
    ),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", {
      name: "ยืนยันรับสินค้า",
    }),
  ).toHaveCount(0);

  expect(
    unexpectedDiagnostics(
      qaEvents,
      allowDuplicatePickupConflict,
    ),
  ).toEqual([]);
});
