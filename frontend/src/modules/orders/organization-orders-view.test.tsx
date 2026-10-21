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
  getOrganizationOrder: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  useAuthSession: () => ({
    status: "authenticated",
    user: {
      userId: "staff-1",
      email: "staff@example.com",
      name: "Staff",
      status: "ACTIVE",
      platformRole: null,
    },
    memberships: [
      {
        organizationId: "org-1",
        role: "STAFF",
        status: "ACTIVE",
      },
    ],
  }),
  getActiveMembership: (memberships: Array<{ organizationId: string }>, organizationId: string) =>
    memberships.find((membership) => membership.organizationId === organizationId),
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./order-service", () => ({
  orderService: {
    listOrganizationOrders: mocks.listOrganizationOrders,
    getOrganizationOrder: mocks.getOrganizationOrder,
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
    mocks.getOrganizationOrder.mockResolvedValue(order);
  });

  it("opens the order detail in a dialog without navigating away", async () => {
    render(
      <OrganizationOrdersView organizationId="org-1" />,
    );

    expect(
      await screen.findByText("Order order-1"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "ดูรายละเอียดคำสั่งซื้อ order-1",
      }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(mocks.getOrganizationOrder).toHaveBeenCalledWith(
      "org-1",
      "order-1",
      { signal: expect.any(AbortSignal) },
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
    fireEvent.click(screen.getByRole("combobox", { name: "สถานะ Order" }));
    fireEvent.click(
      screen.getByRole("option", { name: "การชำระเงินถูกปฏิเสธ" }),
    );
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

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(
      "แสดง 1 คำสั่งซื้อ · การชำระเงินถูกปฏิเสธ",
    );
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "โหลดเพิ่มเติมแล้ว ตอนนี้แสดง 2 คำสั่งซื้อ",
    );
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
