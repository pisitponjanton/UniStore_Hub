import {
  expect,
  test,
  unexpectedDiagnostics,
  type QaDiagnosticEvent,
} from "./support/qa-fixture";
import {
  apiJson,
  createReadyForPickupFixture,
  createSeedPendingOrder,
  establishTokenSession,
  registerDisposableCustomer,
  tinyPng,
} from "./support/customer-commerce-fixtures";
import {
  establishSeedRoleSession,
  getSeedRoleToken,
  LOCAL_SEED_ENTITY_IDS,
} from "./support/seed-auth";

function isExpectedInitialPaymentNotFound(
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

test("Customer can select a product, validate quantity, create an Order, and upload a real Payment slip", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  await establishSeedRoleSession(
    context,
    request,
    "customer",
  );

  const {
    organizationId,
    productId,
    campaignId,
  } = LOCAL_SEED_ENTITY_IDS;

  await page.goto(
    `/products/view/?organizationId=${organizationId}&productId=${productId}&campaignId=${campaignId}`,
  );

  await expect(
    page.getByRole("heading", {
      name: "Local Demo Product",
      level: 1,
    }),
  ).toBeVisible();

  await expect(
    page.getByLabel("ตัวเลือกสินค้า"),
  ).not.toHaveValue("");
  await expect(page.getByLabel("แคมเปญ")).toHaveValue(
    campaignId,
  );

  await page.getByLabel("จำนวน").fill("2");
  await expect(page.locator("output[data-numeric]")).not.toHaveText(
    "ยังไม่คำนวณ",
  );

  await page
    .getByRole("link", { name: "ดำเนินการสั่งซื้อ" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "ตรวจสอบคำสั่งซื้อ",
      level: 1,
    }),
  ).toBeVisible();

  let createRequests = 0;
  page.on("request", (httpRequest) => {
    if (
      httpRequest.method() === "POST" &&
      httpRequest.url().includes(
        `/organizations/${organizationId}/orders`,
      )
    ) {
      createRequests += 1;
    }
  });

  const confirmForm = page.locator(
    'form[aria-labelledby="confirm-heading"]',
  );
  await expect(confirmForm).toHaveAttribute("novalidate", "");

  const quantity = page.getByRole("spinbutton", {
    name: "จำนวน",
  });
  await quantity.fill("0");
  const createOrderButton = page.getByRole("button", {
    name: "ยืนยันสร้างคำสั่งซื้อ",
  });
  await expect(createOrderButton).toHaveAttribute(
    "formnovalidate",
    "",
  );
  await createOrderButton.click();

  const orderErrorSummary = page.locator(
    "#order-create-error-summary",
  );
  await expect(orderErrorSummary).toBeVisible();
  await expect(
    page.locator("#order-quantity-error"),
  ).toHaveText("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป");

  await expect(orderErrorSummary).toBeFocused();
  expect(createRequests).toBe(0);

  await quantity.fill("2");
  await createOrderButton.click();

  await expect(
    page.getByRole("heading", {
      name: "สร้างคำสั่งซื้อสำเร็จ",
      level: 1,
    }),
  ).toBeVisible();
  expect(createRequests).toBe(1);

  const orderTechnicalText = await page
    .locator("[data-technical]")
    .filter({ hasText: "เลขคำสั่งซื้อ" })
    .textContent();
  const orderId = orderTechnicalText?.match(
    /[0-9a-f]{8}-[0-9a-f-]{27,}/i,
  )?.[0];

  expect(orderId).toBeTruthy();

  await page
    .getByRole("link", { name: "ไปชำระเงิน" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "ชำระและส่งหลักฐาน",
      level: 1,
    }),
  ).toBeVisible();

  const slip = page.locator("#payment-slip");

  await page
    .getByRole("button", {
      name: "ส่งหลักฐานการชำระเงิน",
    })
    .click();
  await expect(slip).toBeFocused();
  await expect(
    page.locator("#payment-slip-error"),
  ).toHaveText("กรุณาเลือกไฟล์หลักฐานการชำระเงิน");

  await slip.setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.locator("#payment-slip-error"),
  ).toHaveText("รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP");

  await slip.setInputFiles({
    name: "phase5-slip.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(
    page.getByText("phase5-slip.png"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "ส่งหลักฐานการชำระเงิน",
    })
    .click();

  await expect(
    page.getByText(
      "ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ",
    ),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("รอตรวจสอบการชำระเงิน").first(),
  ).toBeVisible();
  await expect(
    page.getByText("รอตรวจสอบ", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "กลับรายละเอียดคำสั่งซื้อ",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "รายละเอียดคำสั่งซื้อ",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("สถานะและขั้นตอนถัดไป")
      .getByText("กำลังตรวจสอบการชำระเงิน"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "ยกเลิกคำสั่งซื้อ",
    }),
  ).toHaveCount(0);

  await page
    .getByRole("link", {
      name: "กลับรายการคำสั่งซื้อ",
    })
    .click();

  const orderRow = page.getByRole("article", {
    name: `คำสั่งซื้อ ${orderId}`,
  });
  await expect(orderRow).toBeVisible();
  await expect(
    orderRow.getByText("กำลังตรวจสอบการชำระเงิน"),
  ).toBeVisible();

  await orderRow
    .getByRole("link", {
      name: `ดูรายละเอียด คำสั่งซื้อ ${orderId}`,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "รายละเอียดคำสั่งซื้อ",
      level: 1,
    }),
  ).toBeVisible();

  expect(
    unexpectedDiagnostics(
      qaEvents,
      isExpectedInitialPaymentNotFound,
    ),
  ).toEqual([]);
});

test("Customer cancellation dialog supports backing out and then cancelling a PENDING_PAYMENT Order", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  const order = await createSeedPendingOrder(request);
  await establishSeedRoleSession(
    context,
    request,
    "customer",
  );

  await page.goto(
    `/my/order/?orderId=${order.orderId}`,
  );

  const cancel = page.getByRole("button", {
    name: "ยกเลิกคำสั่งซื้อ",
  });
  await expect(cancel).toBeVisible();

  await cancel.click();
  const dialog = page.getByRole("dialog", {
    name: "ยืนยันการยกเลิกคำสั่งซื้อ",
  });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "กลับ" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cancel).toBeVisible();

  await cancel.click();
  await page
    .getByRole("dialog", {
      name: "ยืนยันการยกเลิกคำสั่งซื้อ",
    })
    .getByRole("button", { name: "ยืนยันยกเลิก" })
    .click();

  await expect(
    page.getByText("ยกเลิกคำสั่งซื้อแล้ว"),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("สถานะและขั้นตอนถัดไป")
      .getByText("คำสั่งซื้อถูกยกเลิก"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "ยกเลิกคำสั่งซื้อ",
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /ชำระเงิน/ }),
  ).toHaveCount(0);

  const customerToken = await getSeedRoleToken(
    request,
    "customer",
  );
  const refreshed = await apiJson<{ status: string }>(
    request,
    `/me/orders/${order.orderId}`,
    {
      token: customerToken,
      expectedStatus: 200,
    },
  );
  expect(refreshed.status).toBe("CANCELLED");

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Customer can see READY_FOR_PICKUP QR and Token, then filter and mark the matching notification read", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  test.setTimeout(55_000);

  const runId =
    `phase5-${Date.now()}-${testInfo.workerIndex}`;
  const fixture = await createReadyForPickupFixture(
    request,
    runId,
  );

  await establishSeedRoleSession(
    context,
    request,
    "customer",
  );

  await page.goto(
    `/my/order/?orderId=${fixture.orderId}`,
  );

  await expect(
    page.getByText("พร้อมรับสินค้า", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "เปิดข้อมูลรับสินค้า",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "ข้อมูลรับสินค้า",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.locator("code").filter({
      hasText: fixture.pickupToken,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "QR สำหรับรับสินค้า",
    }),
  ).toBeVisible({
    timeout: 10_000,
  });

  await page.goto("/notifications/");

  await expect(
    page.getByRole("heading", {
      name: "การแจ้งเตือน",
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "ยังไม่อ่าน",
    })
    .click();

  const notification = page
    .getByRole("article")
    .filter({ hasText: fixture.notificationTitle })
    .first();
  await expect(notification).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    notification.getByText("ยังไม่อ่าน", {
      exact: true,
    }),
  ).toBeVisible();

  await notification
    .getByRole("button", {
      name: "ทำเครื่องหมายว่าอ่านแล้ว",
    })
    .click();

  await expect(notification).toHaveCount(0);

  await page
    .getByRole("button", {
      name: "อ่านแล้ว",
      exact: true,
    })
    .click();

  const readNotification = page
    .getByRole("article")
    .filter({ hasText: fixture.notificationTitle })
    .first();
  await expect(readNotification).toBeVisible();
  await expect(
    readNotification.getByText(/อ่านแล้ว/).first(),
  ).toBeVisible();

  const customerToken = await getSeedRoleToken(
    request,
    "customer",
  );
  const readNotifications = await apiJson<{
    items: Array<{
      notificationId: string;
      readAt: string | null;
    }>;
  }>(
    request,
    "/notifications?read=true",
    {
      token: customerToken,
      expectedStatus: 200,
    },
  );
  const exactNotification = readNotifications.items.find(
    (item) =>
      item.notificationId === fixture.notificationId,
  );
  expect(exactNotification?.readAt).not.toBeNull();

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Customer empty and retry states remain usable", async ({
  browser,
  request,
}) => {
  const runId = `empty-${Date.now()}`;
  const freshCustomer =
    await registerDisposableCustomer(request, runId);
  const emptyContext = await browser.newContext();
  await establishTokenSession(
    emptyContext,
    freshCustomer.token,
  );
  const emptyPage = await emptyContext.newPage();

  await emptyPage.goto("/my/orders/");
  await expect(
    emptyPage.getByRole("heading", {
      name: "ยังไม่มีคำสั่งซื้อ",
    }),
  ).toBeVisible();
  await expect(
    emptyPage.getByRole("link", {
      name: "เลือกสินค้า",
    }),
  ).toBeVisible();
  await emptyContext.close();

  const retryContext = await browser.newContext();
  await establishSeedRoleSession(
    retryContext,
    request,
    "customer",
  );
  const retryPage = await retryContext.newPage();
  let forceFailure = true;
  let intercepted = 0;

  await retryPage.route(
    "**/api/v1/me/orders",
    async (route) => {
      if (forceFailure) {
        intercepted += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: {
              code: "E2E_FORCED_FAILURE",
              message: "Forced Customer retry state",
            },
          }),
        });
        return;
      }

      await route.continue();
    },
  );

  await retryPage.goto("/my/orders/");
  await expect(
    retryPage.getByRole("heading", {
      name: "ไม่สามารถโหลดคำสั่งซื้อได้",
    }),
  ).toBeVisible();
  expect(intercepted).toBeGreaterThan(0);

  forceFailure = false;
  await retryPage
    .getByRole("button", {
      name: "ลองโหลดอีกครั้ง",
    })
    .click();

  await expect(
    retryPage.getByRole("heading", {
      name: "คำสั่งซื้อของฉัน",
      level: 1,
    }),
  ).toBeVisible();

  await retryContext.close();
});

test("invalid Customer detail links show recoverable states without issuing entity requests", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  await establishSeedRoleSession(
    context,
    request,
    "customer",
  );

  let entityRequests = 0;
  page.on("request", (httpRequest) => {
    if (
      httpRequest.url().includes("/api/v1/me/orders/") &&
      !httpRequest.url().endsWith("/api/v1/me/orders")
    ) {
      entityRequests += 1;
    }
  });

  await page.goto("/my/order/");

  await expect(
    page.getByRole("heading", {
      name: "ลิงก์คำสั่งซื้อไม่สมบูรณ์",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "กลับรายการคำสั่งซื้อ",
    }),
  ).toBeVisible();
  expect(entityRequests).toBe(0);

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});
