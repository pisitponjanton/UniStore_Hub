import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services";
import type { OrderDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  getMyOrder: vi.fn(),
  cancelMyOrder: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./order-service", () => ({
  orderService: {
    getMyOrder: mocks.getMyOrder,
    cancelMyOrder: mocks.cancelMyOrder,
  },
}));

import { MyOrderView } from "./my-order-view";

function makeOrder(overrides: Partial<OrderDTO> = {}): OrderDTO {
  return {
    orderId: "order-1",
    organizationId: "org-1",
    campaignId: "campaign-1",
    customerId: "customer-1",
    status: "PENDING_PAYMENT",
    subtotal: 50000,
    total: 50000,
    items: [
      {
        orderItemId: "item-1",
        productId: "product-1",
        variantId: "variant-1",
        productName: "เสื้อชมรม",
        variantName: "Size M",
        unitPrice: 25000,
        quantity: 2,
        totalPrice: 50000,
      },
    ],
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-02T08:00:00.000Z",
    ...overrides,
  };
}

describe("MyOrderView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/my/order/?orderId=order-1");
  });

  it("shows authoritative state, next action, lifecycle text, and recorded item totals", async () => {
    mocks.getMyOrder.mockResolvedValue(
      makeOrder({ status: "IN_PRODUCTION" }),
    );

    render(<MyOrderView />);

    expect(
      await screen.findByRole("heading", {
        name: "รายละเอียดคำสั่งซื้อ",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("กำลังผลิตสินค้า").length).toBeGreaterThan(0);
    expect(screen.getByText("เสื้อชมรม")).toBeInTheDocument();
    expect(screen.getAllByText("฿500.00").length).toBeGreaterThan(0);

    expect(
      screen.getByRole("list", { name: /ขั้นตอนคำสั่งซื้อ/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("ขั้นตอนปัจจุบัน")).toBeInTheDocument();
    expect(screen.getAllByText("เสร็จแล้ว")).toHaveLength(2);
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });

  it("retries loading order detail in place after a recoverable error", async () => {
    mocks.getMyOrder
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(makeOrder());

    render(<MyOrderView />);

    fireEvent.click(
      await screen.findByRole("button", { name: "ลองโหลดอีกครั้ง" }),
    );

    expect(mocks.getMyOrder).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole("heading", { name: "รายละเอียดคำสั่งซื้อ" }),
    ).toBeInTheDocument();
  });

  it("refreshes authoritative state when cancellation conflicts with a newer backend status", async () => {
    mocks.getMyOrder
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValueOnce(makeOrder({ status: "PAYMENT_REVIEW" }));
    mocks.cancelMyOrder.mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "INVALID_STATUS_TRANSITION",
        kind: "conflict",
      }),
    );

    render(<MyOrderView />);

    fireEvent.click(
      await screen.findByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "ยืนยันยกเลิก" }),
    );

    await waitFor(() => {
      expect(mocks.getMyOrder).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว จึงไม่สามารถยกเลิกจากสถานะปัจจุบันได้",
    );
    expect(
      screen.getAllByText("กำลังตรวจสอบการชำระเงิน").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }),
    ).not.toBeInTheDocument();
  });

  it("requires confirmation before cancellation and reports the refreshed success state", async () => {
    mocks.getMyOrder
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValueOnce(makeOrder({ status: "CANCELLED" }));
    mocks.cancelMyOrder.mockResolvedValue(undefined);

    render(<MyOrderView />);

    const cancel = await screen.findByRole("button", {
      name: "ยกเลิกคำสั่งซื้อ",
    });
    expect(mocks.cancelMyOrder).not.toHaveBeenCalled();

    fireEvent.click(cancel);

    expect(
      screen.getByRole("dialog", { name: "ยืนยันการยกเลิกคำสั่งซื้อ" }),
    ).toBeInTheDocument();
    expect(mocks.cancelMyOrder).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "ยืนยันยกเลิก" }),
    );

    await waitFor(() => {
      expect(mocks.cancelMyOrder).toHaveBeenCalledWith("order-1");
      expect(mocks.getMyOrder).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("ยกเลิกคำสั่งซื้อแล้ว");
    expect(screen.getByText("คำสั่งซื้อนี้สิ้นสุดแล้ว")).toBeInTheDocument();
  });
});
