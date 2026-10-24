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

  it("keeps a page-level heading above the empty order state", async () => {
    mocks.listMyOrders.mockResolvedValue({ items: [], nextCursor: null });

    render(<MyOrdersView />);

    expect(
      await screen.findByRole("heading", { name: "ยังไม่มีคำสั่งซื้อ", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "คำสั่งซื้อของฉัน", level: 1 }),
    ).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "เลือกสินค้า" })).toHaveAttribute(
      "href",
      "/shops",
    );
    expect(document.querySelector("main [data-empty-artwork]")).toHaveAttribute(
      "src",
      "/images/empty.png",
    );
  });

  it("preserves the page heading while loading and after a recoverable error", async () => {
    mocks.listMyOrders.mockRejectedValue(new Error("network"));

    render(<MyOrdersView />);

    expect(
      screen.getByRole("heading", { name: "คำสั่งซื้อของฉัน", level: 1 }),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "ไม่สามารถโหลดคำสั่งซื้อได้" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
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

    expect(await screen.findByRole("link", { name: "ชำระเงิน คำสั่งซื้อ order-action" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "คำสั่งซื้อของฉัน", level: 1 }),
    ).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    expect(screen.getAllByText("รอชำระเงิน").length).toBeGreaterThan(0);
    expect(screen.getAllByText("รับสินค้าแล้ว").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /ดูทั้งหมด 2/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /เสร็จสิ้น 1/ }));
    expect(screen.getAllByText("รับสินค้าแล้ว").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /ดูทั้งหมด 2/ }));

    expect(
      screen.getByRole("link", {
        name: "ชำระเงิน คำสั่งซื้อ order-action",
      }),
    ).toHaveAttribute("href", "/my/payment?orderId=order-action");
    expect(
      screen.getByRole("link", {
        name: "ดูรายละเอียด คำสั่งซื้อ order-done",
      }),
    ).toHaveAttribute("href", "/my/order?orderId=order-done");

    expect(screen.getAllByRole("article")).toHaveLength(2);
    const detail = screen.getByRole("link", { name: "ดูรายละเอียด คำสั่งซื้อ order-done" });
    expect(detail.querySelector("svg.lucide-arrow-up-right")).toBeInTheDocument();
    expect(detail.textContent).toBe("ดูรายละเอียด ");
    expect(screen.queryByRole("region", { name: "ภาพรวมคำสั่งซื้อที่โหลดอยู่" })).not.toBeInTheDocument();
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
    expect(await screen.findByText("อ้างอิง order-re")).toBeInTheDocument();
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

    expect(await screen.findByText("อ้างอิง order-1")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: "โหลดคำสั่งซื้อเพิ่มเติม" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /กำลังดำเนินการ 1/ })).toBeInTheDocument();
    });
    // All loaded orders are visible by default.
    expect(screen.getAllByRole("article")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /กำลังดำเนินการ 1/ }));
    expect(screen.getByText("อ้างอิง order-2")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /ดูทั้งหมด 2/ }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(mocks.listMyOrders).toHaveBeenLastCalledWith({
      cursor: "cursor-2",
    });
  });
  it("uses an accessible mobile select and separated all-orders action without extra summary copy", async () => {
    mocks.listMyOrders.mockResolvedValue({
      items: [
        makeOrder("pay-now"),
        makeOrder("in-production", { status: "IN_PRODUCTION" }),
        makeOrder("received", { status: "RECEIVED" }),
      ],
      nextCursor: null,
    });
    render(<MyOrdersView />);
    await screen.findByRole("link", { name: "ชำระเงิน คำสั่งซื้อ pay-now" });

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.queryByText(/ยังไม่มีงานที่ต้องทำต่อในรายการที่โหลดอยู่/)).not.toBeInTheDocument();
    const toolbar = screen.getByRole("group", { name: "กรองคำสั่งซื้อที่โหลดแล้ว" });
    const allButton = screen.getByRole("button", { name: /ดูทั้งหมด 3/ });
    expect(toolbar).toContainElement(allButton);
    expect(allButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /ต้องทำต่อ 1/ })).toHaveAttribute("aria-pressed", "false");

    const select = screen.getByRole("combobox", { name: "เลือกสถานะคำสั่งซื้อ" });
    expect(select).toHaveValue("all");
    fireEvent.change(select, { target: { value: "progress" } });
    expect(screen.getByText("อ้างอิง in-produ")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(allButton);
    expect(select).toHaveValue("all");
    expect(allButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

});
