import type { Locator, Page, TestInfo } from "@playwright/test";

import {
  expect,
  test,
  unexpectedDiagnostics,
  type QaDiagnosticEvent,
} from "./support/qa-fixture";
import {
  tinyPng,
} from "./support/customer-commerce-fixtures";
import {
  createStaffPaymentReviewFixture,
  createStaffPendingOrderFixture,
} from "./support/staff-operational-fixtures";
import {
  getSeedRoleToken,
  LOCAL_SEED_ENTITY_IDS,
} from "./support/seed-auth";

const responsiveViewports = [
  { width: 320, height: 700 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
] as const;

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

function allowExpectedPendingPaymentLookup(
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

async function assertNoPageOverflow(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  const overflowBy = Math.max(
    metrics.documentScrollWidth,
    metrics.bodyScrollWidth,
  ) - metrics.documentClientWidth;

  if (overflowBy > 1) {
    await testInfo.attach(
      `responsive-overflow-${label}`,
      {
        body: Buffer.from(
          JSON.stringify(
            {
              label,
              ...metrics,
              overflowBy,
              url: page.url(),
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      },
    );
  }

  expect(
    overflowBy,
    `${label} should not create page-level horizontal overflow`,
  ).toBeLessThanOrEqual(1);
}

async function assertFullyReachable(
  locator: Locator,
  page: Page,
  label: string,
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();

  const [box, viewport] = await Promise.all([
    locator.boundingBox(),
    page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    })),
  ]);

  expect(box, `${label} should have a rendered box`).not.toBeNull();
  if (!box) {
    return;
  }

  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(-1);
  expect(
    box.x + box.width,
    `${label} right edge`,
  ).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(-1);
  expect(
    box.y + box.height,
    `${label} bottom edge`,
  ).toBeLessThanOrEqual(viewport.height + 1);
}

async function assertHorizontallyReachable(
  locator: Locator,
  page: Page,
  label: string,
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();

  const [box, viewportWidth] = await Promise.all([
    locator.boundingBox(),
    page.evaluate(() => window.innerWidth),
  ]);

  expect(box, `${label} should have a rendered box`).not.toBeNull();
  if (!box) {
    return;
  }

  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(-1);
  expect(
    box.x + box.width,
    `${label} right edge`,
  ).toBeLessThanOrEqual(viewportWidth + 1);
}

async function exerciseResponsiveNavigation(
  page: Page,
  width: number,
): Promise<void> {
  const menuButton = page.getByRole("button", {
    name: "เปิดเมนูหลัก",
  });

  if (width <= 900) {
    await expect(menuButton).toBeVisible();
    await assertFullyReachable(
      menuButton,
      page,
      `${width}px mobile menu trigger`,
    );

    if (width <= 620) {
      const menuBox = await menuButton.boundingBox();
      expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await menuButton.click();

    const drawer = page.getByRole("dialog", {
      name: "เมนูหลัก",
    });
    await expect(drawer).toBeVisible();
    await expect
      .poll(async () => {
        const box = await drawer.boundingBox();
        return box?.x ?? Number.NEGATIVE_INFINITY;
      })
      .toBeGreaterThanOrEqual(-1);
    await assertFullyReachable(
      drawer,
      page,
      `${width}px navigation drawer`,
    );

    const bodyOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(bodyOverflow).toBe("hidden");

    const closeButton = drawer.getByRole("button", {
      name: "ปิดเมนูหลัก",
    });
    await expect(closeButton).toBeFocused();
    await closeButton.click();
    await expect(drawer).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  } else {
    await expect(menuButton).not.toBeVisible();
    await expect(
      page.getByRole("navigation", {
        name: "เมนูหลัก",
      }),
    ).toBeVisible();
  }
}

for (const viewport of responsiveViewports) {
  test(`responsive critical interactions remain reachable at ${viewport.width}px`, async ({
    page,
    request,
    qaEvents,
  }, testInfo) => {
    test.setTimeout(80_000);

    await page.setViewportSize(viewport);

    const suffix =
      `${viewport.width}-${Date.now()}-${testInfo.workerIndex}`;

    const pendingOrder = await createStaffPendingOrderFixture(
      request,
      `responsive-pending-${suffix}`,
    );
    const reviewPayment =
      await createStaffPaymentReviewFixture(
        request,
        `responsive-review-${suffix}`,
      );

    const [staffToken, adminToken] = await Promise.all([
      getSeedRoleToken(request, "staff"),
      getSeedRoleToken(request, "organizationAdmin"),
    ]);

    // Customer payment/upload surface: form, sticky mobile action, and shell.
    await switchBrowserSession(
      page,
      pendingOrder.customerToken,
    );
    await page.goto(
      `/my/payment/?orderId=${pendingOrder.orderId}`,
    );

    await expect(
      page.getByRole("heading", {
        name: "ชำระและส่งหลักฐาน",
        level: 1,
      }),
    ).toBeVisible();

    await assertNoPageOverflow(
      page,
      testInfo,
      `${viewport.width}-customer-payment`,
    );
    await exerciseResponsiveNavigation(
      page,
      viewport.width,
    );

    const slip = page.locator("#payment-slip");
    await slip.setInputFiles({
      name: `responsive-${viewport.width}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await expect(
      page.getByText(
        `responsive-${viewport.width}.png`,
      ),
    ).toBeVisible();

    const submitPayment = page.getByRole("button", {
      name: "ส่งหลักฐานการชำระเงิน",
    });
    await assertFullyReachable(
      submitPayment,
      page,
      `${viewport.width}px payment submit`,
    );

    if (
      viewport.width === 320 ||
      viewport.width === 1440
    ) {
      await submitPayment.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(submitPayment).toBeFocused();

      const focusVisual =
        await submitPayment.evaluate((button) => {
          const style = getComputedStyle(button);
          return {
            focusVisible:
              button.matches(":focus-visible"),
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            outlineColor: style.outlineColor,
          };
        });

      const focusOutlineWidth = Number.parseFloat(
        focusVisual.outlineWidth,
      );

      if (
        !focusVisual.focusVisible ||
        focusOutlineWidth < 3
      ) {
        await testInfo.attach(
          `finding-phase10-global-focus-ring-${viewport.width}`,
          {
            body: Buffer.from(
              JSON.stringify(
                {
                  width: viewport.width,
                  route: "/my/payment/",
                  control:
                    "ส่งหลักฐานการชำระเงิน",
                  expected:
                    "project global :focus-visible rule renders a 3px focus outline",
                  actual: focusVisual,
                },
                null,
                2,
              ),
            ),
            contentType: "application/json",
          },
        );
      }

      expect(focusVisual.focusVisible).toBe(true);
      expect(focusOutlineWidth).toBeGreaterThanOrEqual(3);
    }

    if (viewport.width <= 620) {
      const stickyPosition =
        await submitPayment.evaluate((button) => {
          const parent = button.parentElement;
          return parent
            ? getComputedStyle(parent).position
            : "";
        });
      expect(stickyPosition).toBe("sticky");
    }

    // Staff payment-review surface: filters, selected detail, and dialog.
    await switchBrowserSession(
      page,
      staffToken,
      LOCAL_SEED_ENTITY_IDS.organizationId,
    );
    await page.goto(
      `/org/payments/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
    );

    await assertNoPageOverflow(
      page,
      testInfo,
      `${viewport.width}-staff-payments`,
    );

    await page
      .locator("#payment-review-order")
      .fill(reviewPayment.orderId);
    const applyFilter = page.getByRole("button", {
      name: "ใช้ตัวกรอง",
    });
    await assertFullyReachable(
      applyFilter,
      page,
      `${viewport.width}px payment filter action`,
    );
    await applyFilter.click();

    const paymentRow = page
      .getByRole("article")
      .filter({ hasText: reviewPayment.paymentId })
      .first();
    await expect(paymentRow).toBeVisible();

    const inspectPayment = paymentRow.getByRole(
      "button",
      {
        name: /ตรวจสอบ การชำระเงิน/,
      },
    );
    await assertFullyReachable(
      inspectPayment,
      page,
      `${viewport.width}px payment row action`,
    );
    await inspectPayment.click();

    const paymentDetail = page.locator(
      'aside[aria-label="รายละเอียดการชำระเงิน"]',
    );
    await expect(paymentDetail).toBeVisible();
    await assertNoPageOverflow(
      page,
      testInfo,
      `${viewport.width}-staff-payment-detail`,
    );

    const approve = paymentDetail.getByRole(
      "button",
      {
        name: "อนุมัติการชำระเงิน",
      },
    );
    await assertFullyReachable(
      approve,
      page,
      `${viewport.width}px approve payment`,
    );
    await approve.click();

    const approvalDialog = page.getByRole("dialog", {
      name: "ยืนยันการอนุมัติการชำระเงิน",
    });
    await expect(approvalDialog).toBeVisible();
    await assertFullyReachable(
      approvalDialog,
      page,
      `${viewport.width}px approval dialog`,
    );

    const cancelApproval = approvalDialog.getByRole(
      "button",
      {
        name: "ยกเลิก",
        exact: true,
      },
    );
    await assertFullyReachable(
      cancelApproval,
      page,
      `${viewport.width}px dialog cancel`,
    );

    if (viewport.width <= 620) {
      const confirm = approvalDialog.getByRole(
        "button",
        {
          name: "ยืนยันอนุมัติ",
        },
      );
      const [cancelBox, confirmBox, computed] =
        await Promise.all([
          cancelApproval.boundingBox(),
          confirm.boundingBox(),
          cancelApproval.evaluate((button) => {
            const style = getComputedStyle(button);
            const root = getComputedStyle(
              document.documentElement,
            );

            return {
              renderedHeight:
                button.getBoundingClientRect().height,
              minHeight: style.minHeight,
              controlHeight:
                root.getPropertyValue(
                  "--control-height",
                ),
              targetMin:
                root.getPropertyValue("--target-min"),
            };
          }),
        ]);

      const minRendered = Math.min(
        cancelBox?.height ?? 0,
        confirmBox?.height ?? 0,
      );

      if (
        minRendered < 44 ||
        computed.controlHeight.trim() !== "44px" ||
        computed.targetMin.trim() !== "44px"
      ) {
        await testInfo.attach(
          `finding-phase10-dialog-touch-target-${viewport.width}`,
          {
            body: Buffer.from(
              JSON.stringify(
                {
                  width: viewport.width,
                  cancelHeight:
                    cancelBox?.height ?? null,
                  confirmHeight:
                    confirmBox?.height ?? null,
                  computed,
                  expectedMinimum: 44,
                  route: "/org/payments/",
                  dialog:
                    "ยืนยันการอนุมัติการชำระเงิน",
                },
                null,
                2,
              ),
            ),
            contentType: "application/json",
          },
        );
      }

      expect(minRendered).toBeGreaterThanOrEqual(44);
      expect(computed.controlHeight.trim()).toBe("44px");
      expect(computed.targetMin.trim()).toBe("44px");
    }

    await cancelApproval.click();
    await expect(approvalDialog).toHaveCount(0);

    // Organization Admin audit table: page stays bounded while the table
    // provides its own horizontal scrolling on narrow viewports.
    await switchBrowserSession(
      page,
      adminToken,
      LOCAL_SEED_ENTITY_IDS.organizationId,
    );
    await page.goto(
      `/org/audit/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
    );

    await expect(
      page.getByRole("heading", {
        name: "ประวัติการทำรายการ",
        level: 1,
      }),
    ).toBeVisible();

    await assertNoPageOverflow(
      page,
      testInfo,
      `${viewport.width}-admin-audit`,
    );

    const tableFrame = page
      .getByRole("region", {
        name: /รายการ Audit Log ของหน่วยงาน/,
      })
      .first();
    await expect(tableFrame).toBeVisible();
    await assertHorizontallyReachable(
      tableFrame,
      page,
      `${viewport.width}px audit table viewport`,
    );

    const tableMetrics =
      await tableFrame.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        scrollLeft: element.scrollLeft,
      }));

    expect(tableMetrics.clientWidth).toBeLessThanOrEqual(
      viewport.width,
    );

    if (viewport.width < 820) {
      expect(tableMetrics.scrollWidth).toBeGreaterThan(
        tableMetrics.clientWidth,
      );

      await tableFrame.evaluate((element) => {
        element.scrollLeft = 160;
      });

      const scrolledLeft =
        await tableFrame.evaluate(
          (element) => element.scrollLeft,
        );
      expect(scrolledLeft).toBeGreaterThan(0);
    }

    await assertNoPageOverflow(
      page,
      testInfo,
      `${viewport.width}-admin-audit-after-scroll`,
    );

    expect(
      unexpectedDiagnostics(
        qaEvents,
        allowExpectedPendingPaymentLookup,
      ),
    ).toEqual([]);
  });
}
