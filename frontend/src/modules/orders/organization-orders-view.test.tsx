import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listOrganizationOrders: vi.fn(),
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
    listOrganizationOrders: mocks.listOrganizationOrders,
  },
}));

import { OrganizationOrdersView } from "./organization-orders-view";

const order: OrderDTO = {
  orderId: "order-1",
  organizationId: "org-1",
  campaignId: "campaign-1",
  customerId: "customer-1",
  status: "PENDING_PAYMENT",
  subtotal: 25000,
  total: 25000,
  items: [],
  createdAt: "2026-09-30T01:00:00.000Z",
  updatedAt: "2026-09-30T01:00:00.000Z",
};

describe("OrganizationOrdersView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listOrganizationOrders.mockResolvedValue({
      items: [order],
      nextCursor: null,
    });
  });

  it("loads Staff/Admin organization Orders and links to query-based detail", async () => {
    render(
      <OrganizationOrdersView organizationId="org-1" />,
    );

    expect(
      await screen.findByText("Order order-1"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ดูรายละเอียด" }),
    ).toHaveAttribute(
      "href",
      "/org/orders/view/?organizationId=org-1&orderId=order-1",
    );
    expect(mocks.listOrganizationOrders).toHaveBeenCalledWith(
      "org-1",
      {
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("submits only documented campaignId, customerId, and status filters", async () => {
    render(
      <OrganizationOrdersView organizationId="org-1" />,
    );

    await screen.findByText("Order order-1");

    fireEvent.change(screen.getByLabelText("Campaign ID"), {
      target: { value: "  campaign-2  " },
    });
    fireEvent.change(screen.getByLabelText("Customer ID"), {
      target: { value: "  customer-2  " },
    });
    fireEvent.change(screen.getByLabelText("สถานะ Order"), {
      target: { value: "PAYMENT_REJECTED" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "ใช้ตัวกรอง" }),
    );

    await waitFor(() => {
      expect(
        mocks.listOrganizationOrders,
      ).toHaveBeenLastCalledWith("org-1", {
        campaignId: "campaign-2",
        customerId: "customer-2",
        status: "PAYMENT_REJECTED",
      });
    });
  });

  it("uses the opaque next cursor with the applied filters", async () => {
    mocks.listOrganizationOrders
      .mockResolvedValueOnce({
        items: [order],
        nextCursor: "opaque-next",
      })
      .mockResolvedValueOnce({
        items: [{ ...order, orderId: "order-2" }],
        nextCursor: null,
      });

    render(
      <OrganizationOrdersView organizationId="org-1" />,
    );

    await screen.findByText("Order order-1");

    fireEvent.click(
      screen.getByRole("button", { name: "โหลดเพิ่มเติม" }),
    );

    expect(
      await screen.findByText("Order order-2"),
    ).toBeInTheDocument();
    expect(
      mocks.listOrganizationOrders,
    ).toHaveBeenLastCalledWith("org-1", {
      campaignId: null,
      customerId: null,
      status: null,
      cursor: "opaque-next",
    });
  });
});
