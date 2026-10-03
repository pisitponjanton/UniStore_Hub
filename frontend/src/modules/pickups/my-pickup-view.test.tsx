import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDTO, PickupDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  getMyOrder: vi.fn(),
  getMyPickup: vi.fn(),
  createQr: vi.fn(),
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

vi.mock("./pickup-service", () => ({
  pickupService: {
    getMyPickup: mocks.getMyPickup,
  },
}));

vi.mock("./pickup-qr", () => ({
  createPickupQrDataUrl: mocks.createQr,
}));

import { MyPickupView } from "./my-pickup-view";

function makeOrder(
  overrides: Partial<OrderDTO> = {},
): OrderDTO {
  return {
    orderId: "order-1",
    organizationId: "org-1",
    campaignId: "campaign-1",
    customerId: "customer-1",
    status: "READY_FOR_PICKUP",
    subtotal: 20000,
    total: 20000,
    items: [],
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T12:00:00.000Z",
    ...overrides,
  };
}

function makePickup(
  overrides: Partial<PickupDTO> = {},
): PickupDTO {
  return {
    pickupId: "pickup-1",
    organizationId: "org-1",
    orderId: "order-1",
    token: "abcdefghijklmnopqrstuv",
    status: "READY",
    receivedBy: null,
    receivedAt: null,
    createdAt: "2026-09-29T12:00:00.000Z",
    updatedAt: "2026-09-29T12:00:00.000Z",
    ...overrides,
  };
}

describe("MyPickupView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      {},
      "",
      "/my/pickup/?orderId=order-1",
    );
    mocks.createQr.mockResolvedValue(
      "data:image/png;base64,token-only-qr",
    );
  });

  it("shows the Backend pickup token and token-only QR for a ready order", async () => {
    mocks.getMyOrder.mockResolvedValue(makeOrder());
    mocks.getMyPickup.mockResolvedValue(makePickup());

    render(<MyPickupView />);

    expect(
      await screen.findByText("abcdefghijklmnopqrstuv"),
    ).toBeInTheDocument();
    expect(
      await screen.findByAltText("QR สำหรับรับสินค้า"),
    ).toHaveAttribute(
      "src",
      "data:image/png;base64,token-only-qr",
    );
    expect(mocks.createQr).toHaveBeenCalledWith(
      "abcdefghijklmnopqrstuv",
    );
    expect(screen.getAllByText("พร้อมรับสินค้า").length).toBeGreaterThan(0);
  });

  it("keeps the backend token usable when local QR generation fails", async () => {
    mocks.getMyOrder.mockResolvedValue(makeOrder());
    mocks.getMyPickup.mockResolvedValue(makePickup());
    mocks.createQr.mockRejectedValue(new Error("QR failed"));

    render(<MyPickupView />);

    expect(
      await screen.findByText(
        "สร้าง QR ไม่สำเร็จ ใช้ Token ด้านข้างแทนได้",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("abcdefghijklmnopqrstuv")).toBeInTheDocument();
    expect(screen.queryByAltText("QR สำหรับรับสินค้า")).not.toBeInTheDocument();
  });

  it("renders a safe not-ready state without requesting a Pickup early", async () => {
    mocks.getMyOrder.mockResolvedValue(
      makeOrder({ status: "IN_PRODUCTION" }),
    );

    render(<MyPickupView />);

    expect(
      await screen.findByText("คำสั่งซื้อนี้ยังไม่พร้อมรับสินค้า"),
    ).toBeInTheDocument();
    expect(mocks.getMyPickup).not.toHaveBeenCalled();
    expect(mocks.createQr).not.toHaveBeenCalled();
  });

  it("shows the received state and keeps the authoritative Pickup token visible", async () => {
    mocks.getMyOrder.mockResolvedValue(
      makeOrder({ status: "RECEIVED" }),
    );
    mocks.getMyPickup.mockResolvedValue(
      makePickup({
        status: "RECEIVED",
        receivedBy: "staff-1",
        receivedAt: "2026-09-29T13:00:00.000Z",
      }),
    );

    render(<MyPickupView />);

    expect(
      await screen.findByText("รายการนี้รับสินค้าเรียบร้อยแล้ว", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("abcdefghijklmnopqrstuv"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("รับสินค้าแล้ว").length).toBeGreaterThan(0);
  });
});