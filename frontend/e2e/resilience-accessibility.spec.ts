import type { Page } from "@playwright/test";

import {
  expect,
  test,
  unexpectedDiagnostics,
  type QaDiagnosticEvent,
} from "./support/qa-fixture";
import {
  establishTokenSession,
  tinyPng,
} from "./support/customer-commerce-fixtures";
import {
  createStaffPendingOrderFixture,
} from "./support/staff-operational-fixtures";
import {
  establishSeedRoleSession,
} from "./support/seed-auth";

function allowExpiredSessionDiagnostics(
  event: QaDiagnosticEvent,
): boolean {
  return (
    (event.kind === "http-error" &&
      event.status === 401) ||
    (event.kind === "console-error" &&
      event.message.includes("401"))
  );
}

function allowNetworkRetryDiagnostics(
  event: QaDiagnosticEvent,
): boolean {
  return (
    event.kind === "request-failed" ||
    (event.kind === "console-error" &&
      /ERR_FAILED|Failed to fetch|NetworkError/i.test(
        event.message,
      ))
  );
}

function allowExpectedNotFoundDiagnostics(
  event: QaDiagnosticEvent,
): boolean {
  return (
    (event.kind === "http-error" &&
      event.status === 404 &&
      event.url.includes("/me/orders/")) ||
    (event.kind === "console-error" &&
      event.message.includes("404"))
  );
}

function allowPendingPaymentLookup(
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

async function activeElementInside(
  page: Page,
  selector: string,
): Promise<boolean> {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    return Boolean(
      target &&
        document.activeElement &&
        target.contains(document.activeElement),
    );
  }, selector);
}

test("expired authenticated session is cleared and protected Customer UI falls back to login recovery", async ({
  context,
  page,
  qaEvents,
}) => {
  await establishTokenSession(
    context,
    "e2e-expired-token",
  );

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "E2E expired session",
        },
      }),
    });
  });

  await page.route(
    "**/api/v1/me/orders",
    async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "E2E expired session",
          },
        }),
      });
    },
  );

  await page.goto("/my/orders/");

  await expect(
    page.getByRole("heading", {
      name: "กรุณาเข้าสู่ระบบ",
      level: 1,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", {
      name: "เข้าสู่ระบบ",
    }),
  ).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.sessionStorage.getItem(
            "unistoreHub.accessToken",
          ),
      ),
    )
    .toBeNull();

  expect(
    unexpectedDiagnostics(
      qaEvents,
      allowExpiredSessionDiagnostics,
    ),
  ).toEqual([]);
});

test("Customer network failure surfaces a recoverable error and retry restores real data", async ({
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

  let failNetwork = true;
  let abortedRequests = 0;

  await page.route(
    "**/api/v1/me/orders",
    async (route) => {
      if (failNetwork) {
        abortedRequests += 1;
        await route.abort("failed");
        return;
      }

      await route.continue();
    },
  );

  await page.goto("/my/orders/");

  await expect(
    page.getByRole("heading", {
      name: "ไม่สามารถโหลดคำสั่งซื้อได้",
    }),
  ).toBeVisible();
  expect(abortedRequests).toBeGreaterThan(0);

  failNetwork = false;

  await page
    .getByRole("button", {
      name: "ลองโหลดอีกครั้ง",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "คำสั่งซื้อของฉัน",
      level: 1,
    }),
  ).toBeVisible();

  expect(
    unexpectedDiagnostics(
      qaEvents,
      allowNetworkRetryDiagnostics,
    ),
  ).toEqual([]);
});


test("missing Customer Order returns a recoverable real 404 state", async ({
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

  const missingOrderId =
    "00000000-0000-4000-8000-000000000099";

  await page.goto(
    `/my/order/?orderId=${missingOrderId}`,
  );

  await expect(
    page.getByRole("heading", {
      name: "ไม่พบคำสั่งซื้อ",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", {
      name: "กลับรายการคำสั่งซื้อ",
    }),
  ).toBeVisible();

  expect(
    unexpectedDiagnostics(
      qaEvents,
      allowExpectedNotFoundDiagnostics,
    ),
  ).toEqual([]);
});

test("Payment upload rejects invalid files and double activation does not create duplicate submissions", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createStaffPendingOrderFixture(
    request,
    `phase11-upload-${Date.now()}-${testInfo.workerIndex}`,
  );

  await establishTokenSession(
    context,
    fixture.customerToken,
  );

  let presignRequests = 0;
  let submitRequests = 0;

  page.on("request", (httpRequest) => {
    const url = httpRequest.url();

    if (
      httpRequest.method() === "POST" &&
      url.includes(
        `/orders/${fixture.orderId}/payment-slip-upload-url`,
      )
    ) {
      presignRequests += 1;
    }

    if (
      httpRequest.method() === "POST" &&
      url.endsWith(
        `/orders/${fixture.orderId}/payment`,
      )
    ) {
      submitRequests += 1;
    }
  });

  await page.goto(
    `/my/payment/?orderId=${fixture.orderId}`,
  );

  const fileInput = page.locator("#payment-slip");

  await fileInput.setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid payment proof"),
  });

  await expect(
    page.getByText(
      "รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP",
    ),
  ).toBeVisible();

  const invalidValue = await fileInput.inputValue();
  if (invalidValue !== "") {
    await testInfo.attach(
      "finding-phase11-invalid-payment-file-input-retains-name",
      {
        body: Buffer.from(
          JSON.stringify(
            {
              regression: "F-011-01",
              inputValue: invalidValue,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      },
    );
  }
  expect(invalidValue).toBe("");

  await fileInput.setInputFiles({
    name: "phase11-valid-payment.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const submit = page.getByRole("button", {
    name: "ส่งหลักฐานการชำระเงิน",
  });

  await expect(submit).toBeEnabled();

  await submit.click({
    clickCount: 2,
    delay: 0,
  }).catch(() => {
    // A correct pending-state guard may disable the control before
    // Playwright can dispatch the second activation.
  });

  await expect(
    page.getByText(
      "ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ",
    ),
  ).toBeVisible({
    timeout: 15_000,
  });

  if (
    presignRequests !== 1 ||
    submitRequests !== 1
  ) {
    await testInfo.attach(
      "finding-phase11-payment-double-submit",
      {
        body: Buffer.from(
          JSON.stringify(
            {
              route: "/my/payment/",
              role: "Customer",
              orderId: fixture.orderId,
              expected: {
                presignRequests: 1,
                submitRequests: 1,
              },
              actual: {
                presignRequests,
                submitRequests,
              },
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      },
    );
  }

  expect(presignRequests).toBe(1);
  expect(submitRequests).toBe(1);

  expect(
    unexpectedDiagnostics(
      qaEvents,
      allowPendingPaymentLookup,
    ),
  ).toEqual([]);
});

test("keyboard-only mobile navigation and destructive dialog keep focus contained and return it on Escape", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createStaffPendingOrderFixture(
    request,
    `phase11-keyboard-${Date.now()}-${testInfo.workerIndex}`,
  );

  await establishTokenSession(
    context,
    fixture.customerToken,
  );

  await page.setViewportSize({
    width: 375,
    height: 812,
  });

  await page.goto(
    `/my/order/?orderId=${fixture.orderId}`,
  );

  const menuButton = page.getByRole("button", {
    name: "เปิดเมนูหลัก",
  });
  await menuButton.focus();
  await page.keyboard.press("Enter");

  const drawer = page.getByRole("dialog", {
    name: "เมนูหลัก",
  });
  await expect(drawer).toBeVisible();

  const drawerSelector =
    '[role="dialog"][aria-label="เมนูหลัก"]';

  await expect(
    drawer.getByRole("button", {
      name: "ปิดเมนูหลัก",
    }),
  ).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  expect(
    await activeElementInside(
      page,
      drawerSelector,
    ),
  ).toBe(true);

  await page.keyboard.press("Tab");
  expect(
    await activeElementInside(
      page,
      drawerSelector,
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(menuButton).toBeFocused();

  const cancelOrder = page.getByRole("button", {
    name: "ยกเลิกคำสั่งซื้อ",
  });
  await cancelOrder.scrollIntoViewIfNeeded();
  await cancelOrder.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", {
    name: "ยืนยันการยกเลิกคำสั่งซื้อ",
  });
  await expect(dialog).toBeVisible();

  const destructiveDialogSelector =
    '[role="dialog"][aria-labelledby]';

  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");

    const inside = await activeElementInside(
      page,
      destructiveDialogSelector,
    );

    if (!inside) {
      await testInfo.attach(
        "finding-phase11-dialog-focus-escape",
        {
          body: Buffer.from(
            JSON.stringify(
              {
                iteration: index,
                activeTag: await page.evaluate(
                  () =>
                    document.activeElement?.tagName ??
                    null,
                ),
                activeText: await page.evaluate(
                  () =>
                    document.activeElement?.textContent ??
                    null,
                ),
              },
              null,
              2,
            ),
          ),
          contentType: "application/json",
        },
      );
    }

    expect(inside).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(cancelOrder).toBeFocused();

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});


test("200% reflow-equivalent Customer order layout remains usable at a 640 CSS-pixel viewport", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createStaffPendingOrderFixture(
    request,
    `phase11-reflow-${Date.now()}-${testInfo.workerIndex}`,
  );

  await establishTokenSession(
    context,
    fixture.customerToken,
  );

  // A 1280 CSS-pixel desktop viewport at 200% browser zoom reflows to
  // approximately 640 CSS pixels. This checks the resulting layout/reachability
  // without relying on a browser-specific zoom control.
  await page.setViewportSize({
    width: 640,
    height: 900,
  });

  await page.goto(
    `/my/order/?orderId=${fixture.orderId}`,
  );

  await expect(
    page.getByRole("heading", {
      name: "รายละเอียดคำสั่งซื้อ",
      level: 1,
    }),
  ).toBeVisible();

  const layoutMetrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    documentScrollWidth:
      document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  const overflowBy =
    Math.max(
      layoutMetrics.documentScrollWidth,
      layoutMetrics.bodyScrollWidth,
    ) - layoutMetrics.clientWidth;

  if (overflowBy > 1) {
    await testInfo.attach(
      "finding-phase11-reflow-horizontal-overflow",
      {
        body: Buffer.from(
          JSON.stringify(
            {
              route: "/my/order/",
              viewport: {
                width: 640,
                height: 900,
              },
              interpretation:
                "1280px desktop at 200% reflow-equivalent CSS width",
              ...layoutMetrics,
              overflowBy,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      },
    );
  }

  expect(overflowBy).toBeLessThanOrEqual(1);

  const cancelOrder = page.getByRole("button", {
    name: "ยกเลิกคำสั่งซื้อ",
  });
  await cancelOrder.scrollIntoViewIfNeeded();
  await expect(cancelOrder).toBeVisible();

  const [buttonBox, viewportWidth] =
    await Promise.all([
      cancelOrder.boundingBox(),
      page.evaluate(() => window.innerWidth),
    ]);

  expect(buttonBox).not.toBeNull();
  expect(buttonBox?.x ?? -1).toBeGreaterThanOrEqual(-1);
  expect(
    (buttonBox?.x ?? 0) + (buttonBox?.width ?? 0),
  ).toBeLessThanOrEqual(viewportWidth + 1);

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});
