import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listMyOrders: vi.fn(),
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
    listMyOrders: mocks.listMyOrders,
  },
}));

import { MyOrdersView } from "./my-orders-view";

function makeOrder(
  orderId: string,
  overrides: Partial<OrderDTO> = {},
): OrderDTO {
  return {
    orderId,
    organizationId: "org-1",
    campaignId: "campaign-1",
    customerId: "customer-1",
    status: "PENDING_PAYMENT",
    subtotal: 25000,
    total: 25000,
    items: [],
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-02T08:00:00.000Z",
    ...overrides,
  };
}

describe("MyOrdersView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prioritizes actionable state and exposes contextual order links", async () => {
    mocks.listMyOrders.mockResolvedValue({
      items: [
        makeOrder("order-action"),
        makeOrder("order-done", { status: "RECEIVED", total: 45000 }),
      ],
      nextCursor: null,
    });

    render(<MyOrdersView />);

    expect(
      await screen.findByRole("heading", { name: "คำสั่งซื้อของฉัน" }),
    ).toBeInTheDocument();

    expect(screen.getAllByText("รอชำระเงิน").length).toBeGreaterThan(0);
    expect(screen.getAllByText("รับสินค้าแล้ว").length).toBeGreaterThan(0);

    expect(
      screen.getByRole("link", {
        name: "ดำเนินการต่อ คำสั่งซื้อ order-action",
      }),
    ).toHaveAttribute("href", "/my/order?orderId=order-action");
    expect(
      screen.getByRole("link", {
        name: "ดูรายละเอียด คำสั่งซื้อ order-done",
      }),
    ).toHaveAttribute("href", "/my/order?orderId=order-done");

    expect(screen.getByRole("status")).toHaveTextContent(
      "รายการที่แสดง2 รายการ",
    );
  });

  it("retries the initial order list in place after a recoverable error", async () => {
    mocks.listMyOrders
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        items: [makeOrder("order-retry")],
        nextCursor: null,
      });

    render(<MyOrdersView />);

    fireEvent.click(
      await screen.findByRole("button", { name: "ลองโหลดอีกครั้ง" }),
    );

    expect(mocks.listMyOrders).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("order-retry")).toBeInTheDocument();
  });

  it("announces a meaningful loaded-item count after loading another page", async () => {
    mocks.listMyOrders
      .mockResolvedValueOnce({
        items: [makeOrder("order-1")],
        nextCursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        items: [makeOrder("order-2", { status: "IN_PRODUCTION" })],
        nextCursor: null,
      });

    render(<MyOrdersView />);

    expect(await screen.findByText("order-1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "รายการที่แสดง1 รายการ",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "โหลดคำสั่งซื้อเพิ่มเติม" }),
    );

    await waitFor(() => {
      expect(screen.getByText("order-2")).toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "รายการที่แสดง2 รายการ",
    );
    expect(mocks.listMyOrders).toHaveBeenLastCalledWith({
      cursor: "cursor-2",
    });
  });
});
