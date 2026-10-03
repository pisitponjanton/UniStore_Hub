import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services";
import type {
  OrderDTO,
  PaymentDTO,
  PresignedUploadDTO,
} from "@/types";

const mocks = vi.hoisted(() => ({
  getMyOrder: vi.fn(),
  getMyPayment: vi.fn(),
  requestSlipUploadUrl: vi.fn(),
  submitPayment: vi.fn(),
  putFileToPresignedUrl: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("@/modules/orders", () => ({
  myOrderHref: (orderId: string) => `/my/order/?orderId=${orderId}`,
  OrderStatusBadge: ({ status }: { status: string }) => (
    <span>{status}</span>
  ),
  orderService: {
    getMyOrder: mocks.getMyOrder,
  },
}));

vi.mock("./payment-service", () => ({
  paymentService: {
    getMyPayment: mocks.getMyPayment,
    requestSlipUploadUrl: mocks.requestSlipUploadUrl,
    submitPayment: mocks.submitPayment,
  },
}));

vi.mock("./direct-upload", async () => {
  const actual = await vi.importActual<
    typeof import("./direct-upload")
  >("./direct-upload");

  return {
    ...actual,
    putFileToPresignedUrl: mocks.putFileToPresignedUrl,
  };
});

import { MyPaymentView } from "./my-payment-view";

function makeOrder(overrides: Partial<OrderDTO> = {}): OrderDTO {
  return {
    orderId: "order-1",
    organizationId: "org-1",
    campaignId: "campaign-1",
    customerId: "customer-1",
    status: "PAYMENT_REJECTED",
    subtotal: 19000,
    total: 19000,
    items: [],
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T11:00:00.000Z",
    ...overrides,
  };
}

function makePayment(
  overrides: Partial<PaymentDTO> = {},
): PaymentDTO {
  return {
    paymentId: "payment-1",
    organizationId: "org-1",
    orderId: "order-1",
    customerId: "customer-1",
    slipKey: "payments/org-1/order-1/slip-1",
    status: "REJECTED",
    rejectReason: "ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ",
    reviewedBy: "staff-1",
    reviewedAt: "2026-09-29T11:00:00.000Z",
    createdAt: "2026-09-29T10:15:00.000Z",
    updatedAt: "2026-09-29T11:00:00.000Z",
    ...overrides,
  };
}

describe("MyPaymentView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState(
      {},
      "",
      "/my/payment/?orderId=order-1",
    );
  });

  it("reloads the authoritative own Payment and displays the exact rejection reason", async () => {
    mocks.getMyOrder.mockResolvedValue(makeOrder());
    mocks.getMyPayment.mockResolvedValue(makePayment());

    render(<MyPaymentView />);

    expect(
      await screen.findByText("ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("สถานะหลักฐาน")).toBeInTheDocument();
    expect(screen.getByText("ไม่ผ่านการตรวจสอบ")).toBeInTheDocument();

    expect(mocks.getMyOrder).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mocks.getMyPayment).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("keeps submit available and focuses the file field when no proof is selected", async () => {
    mocks.getMyOrder.mockResolvedValue(
      makeOrder({ status: "PENDING_PAYMENT" }),
    );
    mocks.getMyPayment.mockRejectedValue(
      new ApiClientError({
        status: 404,
        code: "PAYMENT_NOT_FOUND",
        kind: "notFound",
      }),
    );

    render(<MyPaymentView />);

    const submitButton = await screen.findByRole("button", {
      name: "ส่งหลักฐานการชำระเงิน",
    });
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    expect(
      await screen.findByText("กรุณาเลือกไฟล์หลักฐานการชำระเงิน"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("หลักฐานการชำระเงิน")).toHaveFocus();
    });
    expect(mocks.requestSlipUploadUrl).not.toHaveBeenCalled();
  });

  it("submits a new slip through fresh presign -> direct PUT -> Backend slipKey -> authoritative refresh", async () => {
    const upload: PresignedUploadDTO = {
      objectKey:
        "payments/org-1/order-1/11111111-1111-4111-8111-111111111111",
      url: "https://upload.example.test/payment-slip",
      method: "PUT",
      expiresInSeconds: 900,
    };
    const submitted = makePayment({
      status: "PENDING_REVIEW",
      rejectReason: null,
      reviewedBy: null,
      reviewedAt: null,
      slipKey: upload.objectKey,
    });
    const refreshedOrder = makeOrder({
      status: "PAYMENT_REVIEW",
    });

    mocks.getMyOrder
      .mockResolvedValueOnce(
        makeOrder({ status: "PENDING_PAYMENT" }),
      )
      .mockResolvedValueOnce(refreshedOrder);
    mocks.getMyPayment
      .mockRejectedValueOnce(
        new ApiClientError({
          status: 404,
          code: "PAYMENT_NOT_FOUND",
          kind: "notFound",
        }),
      )
      .mockResolvedValueOnce(submitted);
    mocks.requestSlipUploadUrl.mockResolvedValue(upload);
    mocks.putFileToPresignedUrl.mockResolvedValue(undefined);
    mocks.submitPayment.mockResolvedValue(submitted);

    render(<MyPaymentView />);

    await screen.findByText(
      "คำสั่งซื้อนี้ยังรอหลักฐานการชำระเงิน",
    );

    const file = new File(["png-bytes"], "slip.png", {
      type: "image/png",
    });

    fireEvent.change(
      screen.getByLabelText("หลักฐานการชำระเงิน"),
      {
        target: { files: [file] },
      },
    );
    const submitButton = screen.getByRole("button", {
      name: "ส่งหลักฐานการชำระเงิน",
    });
    fireEvent.submit(submitButton.closest("form")!);

    await waitFor(() => {
      expect(mocks.requestSlipUploadUrl).toHaveBeenCalledWith(
        "org-1",
        "order-1",
        "image/png",
      );
      expect(
        mocks.putFileToPresignedUrl,
      ).toHaveBeenCalledWith({
        upload,
        file,
        contentType: "image/png",
      });
      expect(mocks.submitPayment).toHaveBeenCalledWith(
        "org-1",
        "order-1",
        upload.objectKey,
      );
      expect(mocks.getMyOrder).toHaveBeenCalledTimes(2);
      expect(mocks.getMyPayment).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByText(
        "ส่งหลักฐานแล้วและกำลังรอเจ้าหน้าที่ตรวจสอบ",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ส่งหลักฐานแล้ว ระบบกำลังรอเจ้าหน้าที่ตรวจสอบ"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "ส่งหลักฐานการชำระเงิน",
      }),
    ).not.toBeInTheDocument();
  });

  it("resubmits a rejected Payment with a fresh objectKey and replaces the rejection state after refresh", async () => {
    const rejected = makePayment();
    const upload: PresignedUploadDTO = {
      objectKey:
        "payments/org-1/order-1/22222222-2222-4222-8222-222222222222",
      url: "https://upload.example.test/replacement-slip",
      method: "PUT",
      expiresInSeconds: 900,
    };
    const resubmitted = makePayment({
      slipKey: upload.objectKey,
      status: "PENDING_REVIEW",
      rejectReason: null,
      reviewedBy: null,
      reviewedAt: null,
      updatedAt: "2026-09-29T12:00:00.000Z",
    });
    const refreshedOrder = makeOrder({
      status: "PAYMENT_REVIEW",
    });

    mocks.getMyOrder
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValueOnce(refreshedOrder);
    mocks.getMyPayment
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(resubmitted);
    mocks.requestSlipUploadUrl.mockResolvedValue(upload);
    mocks.putFileToPresignedUrl.mockResolvedValue(undefined);
    mocks.submitPayment.mockResolvedValue(resubmitted);

    render(<MyPaymentView />);

    expect(
      await screen.findByText(
        "ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ",
        { exact: false },
      ),
    ).toBeInTheDocument();

    const replacement = new File(
      ["replacement-webp"],
      "replacement.webp",
      { type: "image/webp" },
    );

    fireEvent.change(
      screen.getByLabelText("หลักฐานการชำระเงิน"),
      {
        target: { files: [replacement] },
      },
    );
    const resubmitButton = screen.getByRole("button", {
      name: "ส่งหลักฐานใหม่",
    });
    fireEvent.submit(resubmitButton.closest("form")!);

    await waitFor(() => {
      expect(mocks.requestSlipUploadUrl).toHaveBeenCalledWith(
        "org-1",
        "order-1",
        "image/webp",
      );
      expect(mocks.submitPayment).toHaveBeenCalledWith(
        "org-1",
        "order-1",
        upload.objectKey,
      );
    });

    expect(
      await screen.findByText(
        "ส่งหลักฐานแล้วและกำลังรอเจ้าหน้าที่ตรวจสอบ",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ",
        { exact: false },
      ),
    ).not.toBeInTheDocument();
  });

  it("treats PAYMENT_NOT_FOUND as the initial no-Payment state only for PENDING_PAYMENT", async () => {
    mocks.getMyOrder.mockResolvedValue(
      makeOrder({ status: "PENDING_PAYMENT" }),
    );
    mocks.getMyPayment.mockRejectedValue(
      new ApiClientError({
        status: 404,
        code: "PAYMENT_NOT_FOUND",
        kind: "notFound",
        message: "Payment not found",
      }),
    );

    render(<MyPaymentView />);

    expect(
      await screen.findByText(
        "คำสั่งซื้อนี้ยังรอหลักฐานการชำระเงิน",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("หลักฐานการชำระเงิน"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("ไม่สามารถโหลดข้อมูลการชำระเงินได้"),
    ).not.toBeInTheDocument();
  });
});
