import {
  act,
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
  isDefinitiveSessionFailure: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: mocks.isDefinitiveSessionFailure,
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
    mocks.isDefinitiveSessionFailure.mockImplementation(
      (error: unknown) => error instanceof Error && error.message === "TOKEN_EXPIRED",
    );
    mocks.listOrganizationPayments.mockResolvedValue({
      items: [payment()],
      nextCursor: null,
    });
    mocks.getOrganizationPayment.mockResolvedValue(payment());
    mocks.getOrganizationOrder.mockResolvedValue(order());
  });

  it("provides task-first shortcuts without changing review and filter actions", async () => {
    render(<OrganizationPaymentsView organizationId="org-1" />);

    expect(await screen.findByText("หลักฐาน payment-1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ดูคิวตรวจสลิป/ }),
    ).toHaveAttribute("href", "#payment-review-list");
    expect(
      screen.getByRole("link", { name: "ตัวกรองรายการ" }),
    ).toHaveAttribute("href", "#payment-filter-title");
    expect(
      screen.getByRole("link", { name: /ดูคิวตรวจสลิป/ }),
    ).toHaveTextContent("1 รอตรวจสอบ");
    expect(screen.getByLabelText("สถานะ Payment")).toBeInTheDocument();
    expect(screen.getByLabelText("Campaign ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Order ID")).toBeInTheDocument();
  });

  it("announces applied payment queue filters with useful context", async () => {
    mocks.listOrganizationPayments
      .mockResolvedValueOnce({
        items: [payment()],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [payment()],
        nextCursor: null,
      });

    render(
      <OrganizationPaymentsView organizationId="org-1" />,
    );

    await screen.findByText("หลักฐาน payment-1");

    fireEvent.change(screen.getByLabelText("สถานะ Payment"), {
      target: { value: "PENDING_REVIEW" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "ใช้ตัวกรอง" }),
    );

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("แสดง 1 การชำระเงิน · รอตรวจสอบ");
    expect(
      mocks.listOrganizationPayments,
    ).toHaveBeenLastCalledWith("org-1", {
      status: "PENDING_REVIEW",
      campaignId: null,
      orderId: null,
    });
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

    await screen.findByText("หลักฐาน payment-1");

    fireEvent.click(
      screen.getByRole("button", {
        name: "ตรวจสอบ การชำระเงิน payment-1",
      }),
    );

    expect(
      await screen.findByText("คำสั่งซื้อ order-1"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "เปิดสลิป",
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

    await screen.findByText("หลักฐาน payment-1");
    fireEvent.click(
      screen.getByRole("button", {
        name: "ตรวจสอบ การชำระเงิน payment-1",
      }),
    );
    await screen.findByText("คำสั่งซื้อ order-1");

    fireEvent.click(
      screen.getByRole("button", { name: "อนุมัติการชำระเงิน" }),
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
      screen.queryByRole("button", { name: "อนุมัติการชำระเงิน" }),
    ).not.toBeInTheDocument();
  });

  it("announces committed approval before the follow-up read completes", async () => {
    const approved = payment({ status: "APPROVED" });
    let finishRefresh!: (value: PaymentDTO) => void;
    const pendingRefresh = new Promise<PaymentDTO>((resolve) => {
      finishRefresh = resolve;
    });
    mocks.getOrganizationPayment
      .mockResolvedValueOnce(payment())
      .mockReturnValueOnce(pendingRefresh);
    mocks.approvePayment.mockResolvedValue(approved);

    render(<OrganizationPaymentsView organizationId="org-1" />);
    await screen.findByText("หลักฐาน payment-1");
    fireEvent.click(screen.getByRole("button", {
      name: "ตรวจสอบ การชำระเงิน payment-1",
    }));
    await screen.findByText("คำสั่งซื้อ order-1");

    fireEvent.click(screen.getByRole("button", {
      name: "อนุมัติการชำระเงิน",
    }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันอนุมัติ" }));

    // The page must acknowledge the successful mutation *before* readback.
    expect(await screen.findByText("อนุมัติการชำระเงินเรียบร้อยแล้ว"))
      .toBeInTheDocument();
    expect(mocks.approvePayment).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", {
      name: "อนุมัติการชำระเงิน",
    })).not.toBeInTheDocument();
    await act(async () => {
      finishRefresh(approved);
    });
  });

  it("preserves approval success when the post-approval refresh fails", async () => {
    const approved = payment({ status: "APPROVED" });
    mocks.getOrganizationPayment
      .mockResolvedValueOnce(payment())
      .mockRejectedValueOnce(new Error("Post-approval readback unavailable"));
    mocks.approvePayment.mockResolvedValue(approved);

    render(<OrganizationPaymentsView organizationId="org-1" />);
    await screen.findByText("หลักฐาน payment-1");
    fireEvent.click(screen.getByRole("button", {
      name: "ตรวจสอบ การชำระเงิน payment-1",
    }));
    await screen.findByText("คำสั่งซื้อ order-1");
    fireEvent.click(screen.getByRole("button", {
      name: "อนุมัติการชำระเงิน",
    }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันอนุมัติ" }));

    expect(await screen.findByText(
      /อนุมัติการชำระเงินเรียบร้อยแล้ว แต่ยังโหลดรายละเอียดล่าสุดไม่ได้/,
    )).toBeInTheDocument();
    expect(mocks.approvePayment).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("ดำเนินการไม่สำเร็จ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "อนุมัติการชำระเงิน",
    })).not.toBeInTheDocument();
  });

  it("retains committed rejection feedback if the detail refresh fails", async () => {
    const rejected = payment({ status: "REJECTED", rejectReason: "Invalid proof" });
    mocks.getOrganizationPayment
      .mockResolvedValueOnce(payment())
      .mockRejectedValueOnce(new Error("readback offline"));
    mocks.rejectPayment.mockResolvedValue(rejected);

    render(<OrganizationPaymentsView organizationId="org-1" />);
    await screen.findByText("หลักฐาน payment-1");
    fireEvent.click(screen.getByRole("button", {
      name: "ตรวจสอบ การชำระเงิน payment-1",
    }));
    await screen.findByText("คำสั่งซื้อ order-1");
    fireEvent.click(screen.getByRole("button", {
      name: "ปฏิเสธการชำระเงิน",
    }));
    fireEvent.change(screen.getByLabelText(/เหตุผลที่ปฏิเสธ/), {
      target: { value: "Invalid proof" },
    });
    fireEvent.click(screen.getByRole("button", {
      name: "ยืนยันปฏิเสธ",
    }));

    expect(await screen.findByText(
      /ปฏิเสธการชำระเงินและบันทึกเหตุผลแล้ว แต่ยังโหลดรายละเอียดล่าสุดไม่ได้/,
    )).toBeInTheDocument();
    expect(mocks.rejectPayment).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("ดำเนินการไม่สำเร็จ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "ปฏิเสธการชำระเงิน",
    })).not.toBeInTheDocument();
  });

  it.each([
    ["approve", "APPROVED"],
    ["reject", "REJECTED"],
  ] as const)(
    "logs out on expired session during committed %s readback without repeating mutation",
    async (action, status) => {
      const reviewed = payment({ status, rejectReason: action === "reject" ? "Expired session" : null });
      mocks.getOrganizationPayment
        .mockResolvedValueOnce(payment())
        .mockRejectedValueOnce(new Error("TOKEN_EXPIRED"));
      if (action === "approve") {
        mocks.approvePayment.mockResolvedValue(reviewed);
      } else {
        mocks.rejectPayment.mockResolvedValue(reviewed);
      }

      render(<OrganizationPaymentsView organizationId="org-1" />);
      await screen.findByText("หลักฐาน payment-1");
      fireEvent.click(screen.getByRole("button", {
        name: "ตรวจสอบ การชำระเงิน payment-1",
      }));
      await screen.findByText("คำสั่งซื้อ order-1");

      if (action === "approve") {
        fireEvent.click(screen.getByRole("button", { name: "อนุมัติการชำระเงิน" }));
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันอนุมัติ" }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: "ปฏิเสธการชำระเงิน" }));
        fireEvent.change(screen.getByLabelText(/เหตุผลที่ปฏิเสธ/), {
          target: { value: "Expired session" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันปฏิเสธ" }));
      }

      await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
      expect(
        action === "approve"
          ? mocks.approvePayment
          : mocks.rejectPayment,
      ).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/แต่ยังโหลดรายละเอียดล่าสุดไม่ได้/))
        .not.toBeInTheDocument();
      expect(screen.queryByText("ดำเนินการไม่สำเร็จ")).not.toBeInTheDocument();
    },
  );

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

    await screen.findByText("หลักฐาน payment-1");
    fireEvent.click(
      screen.getByRole("button", {
        name: "ตรวจสอบ การชำระเงิน payment-1",
      }),
    );
    await screen.findByText("คำสั่งซื้อ order-1");

    fireEvent.click(
      screen.getByRole("button", { name: "ปฏิเสธการชำระเงิน" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "ยืนยันปฏิเสธ",
      }),
    );

    expect(
      await screen.findAllByText(
        "กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน",
      ),
    ).toHaveLength(2);

    const summary = screen.getByRole("alert");
    expect(
      screen.getByRole("link", {
        name: "กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน",
      }),
    ).toHaveAttribute("href", "#payment-reject-reason");
    await waitFor(() => expect(summary).toHaveFocus());
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
