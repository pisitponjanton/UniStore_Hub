import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  OrderDTO,
  PaymentDTO,
  PresignedDownloadDTO,
} from "@/types";

const mocks = vi.hoisted(() => ({
  listOrganizationPayments: vi.fn(),
  getOrganizationPayment: vi.fn(),
  requestPrivateDownloadUrl: vi.fn(),
  approvePayment: vi.fn(),
  rejectPayment: vi.fn(),
  getOrganizationOrder: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("@/modules/orders", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/orders")
  >("@/modules/orders");

  return {
    ...actual,
    orderService: {
      getOrganizationOrder: mocks.getOrganizationOrder,
    },
  };
});

vi.mock("./payment-service", () => ({
  paymentService: {
    listOrganizationPayments: mocks.listOrganizationPayments,
    getOrganizationPayment: mocks.getOrganizationPayment,
    requestPrivateDownloadUrl:
      mocks.requestPrivateDownloadUrl,
    approvePayment: mocks.approvePayment,
    rejectPayment: mocks.rejectPayment,
  },
}));

import { OrganizationPaymentsView } from "./organization-payments-view";

function payment(
  overrides: Partial<PaymentDTO> = {},
): PaymentDTO {
  return {
    paymentId: "payment-1",
    organizationId: "org-1",
    orderId: "order-1",
    customerId: "customer-1",
    slipKey:
      "payments/org-1/order-1/11111111-1111-4111-8111-111111111111",
    status: "PENDING_REVIEW",
    rejectReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-09-30T01:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
    ...overrides,
  };
}

function order(
  overrides: Partial<OrderDTO> = {},
): OrderDTO {
  return {
    orderId: "order-1",
    organizationId: "org-1",
    campaignId: "campaign-1",
    customerId: "customer-1",
    status: "PAYMENT_REVIEW",
    subtotal: 25000,
    total: 25000,
    items: [],
    createdAt: "2026-09-30T01:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
    ...overrides,
  };
}

describe("OrganizationPaymentsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listOrganizationPayments.mockResolvedValue({
      items: [payment()],
      nextCursor: null,
    });
    mocks.getOrganizationPayment.mockResolvedValue(payment());
    mocks.getOrganizationOrder.mockResolvedValue(order());
  });

  it("loads detail and exposes only an authorized temporary slip link", async () => {
    const download: PresignedDownloadDTO = {
      url: "https://download.example.test/private-slip",
      method: "GET",
      expiresInSeconds: 900,
    };
    mocks.requestPrivateDownloadUrl.mockResolvedValue(download);

    render(
      <OrganizationPaymentsView organizationId="org-1" />,
    );

    await screen.findByText("Payment payment-1");

    fireEvent.click(
      screen.getByRole("button", { name: "ตรวจสอบ" }),
    );

    expect(
      await screen.findByText("Order order-1"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "ขอลิงก์ดูสลิป",
      }),
    );

    const link = await screen.findByRole("link", {
      name: "เปิดสลิปในแท็บใหม่",
    });

    expect(
      mocks.requestPrivateDownloadUrl,
    ).toHaveBeenCalledWith(
      "org-1",
      "payments/org-1/order-1/11111111-1111-4111-8111-111111111111",
    );
    expect(link).toHaveAttribute(
      "href",
      "https://download.example.test/private-slip",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("confirms approve and refreshes Payment and Order state from Backend", async () => {
    const approved = payment({
      status: "APPROVED",
      reviewedBy: "staff-1",
      reviewedAt: "2026-09-30T02:00:00.000Z",
      updatedAt: "2026-09-30T02:00:00.000Z",
    });
    const paidOrder = order({
      status: "PAID",
      updatedAt: "2026-09-30T02:00:00.000Z",
    });

    mocks.getOrganizationPayment
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce(approved);
    mocks.getOrganizationOrder
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(paidOrder);
    mocks.approvePayment.mockResolvedValue(approved);

    render(
      <OrganizationPaymentsView organizationId="org-1" />,
    );

    await screen.findByText("Payment payment-1");
    fireEvent.click(
      screen.getByRole("button", { name: "ตรวจสอบ" }),
    );
    await screen.findByText("Order order-1");

    fireEvent.click(
      screen.getByRole("button", { name: "อนุมัติ" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "ยืนยันอนุมัติ",
      }),
    );

    await waitFor(() => {
      expect(mocks.approvePayment).toHaveBeenCalledWith(
        "org-1",
        "payment-1",
      );
      expect(
        mocks.getOrganizationPayment,
      ).toHaveBeenCalledTimes(2);
      expect(
        mocks.getOrganizationOrder,
      ).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByText(
        "อนุมัติการชำระเงินเรียบร้อยแล้ว",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "อนุมัติ" }),
    ).not.toBeInTheDocument();
  });

  it("requires a reject reason, trims it, and refreshes the rejected result", async () => {
    const rejected = payment({
      status: "REJECTED",
      rejectReason: "Slip amount mismatch",
      reviewedBy: "staff-1",
      reviewedAt: "2026-09-30T02:00:00.000Z",
      updatedAt: "2026-09-30T02:00:00.000Z",
    });
    const rejectedOrder = order({
      status: "PAYMENT_REJECTED",
      updatedAt: "2026-09-30T02:00:00.000Z",
    });

    mocks.getOrganizationPayment
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce(rejected);
    mocks.getOrganizationOrder
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(rejectedOrder);
    mocks.rejectPayment.mockResolvedValue(rejected);

    render(
      <OrganizationPaymentsView organizationId="org-1" />,
    );

    await screen.findByText("Payment payment-1");
    fireEvent.click(
      screen.getByRole("button", { name: "ตรวจสอบ" }),
    );
    await screen.findByText("Order order-1");

    fireEvent.click(
      screen.getByRole("button", { name: "ปฏิเสธ" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "ยืนยันปฏิเสธ",
      }),
    );

    expect(
      await screen.findByText(
        "กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน",
      ),
    ).toBeInTheDocument();
    expect(mocks.rejectPayment).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByLabelText(/เหตุผลที่ปฏิเสธ/),
      {
        target: { value: "  Slip amount mismatch  " },
      },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "ยืนยันปฏิเสธ",
      }),
    );

    await waitFor(() => {
      expect(mocks.rejectPayment).toHaveBeenCalledWith(
        "org-1",
        "payment-1",
        "Slip amount mismatch",
      );
    });

    expect(
      await screen.findByText(
        "ปฏิเสธการชำระเงินและบันทึกเหตุผลแล้ว",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Slip amount mismatch"),
    ).toBeInTheDocument();
  });
});
