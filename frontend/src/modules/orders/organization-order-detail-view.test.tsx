import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "@/modules/auth";
import type { OrderDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  getOrganizationOrder: vi.fn(),
  cancelOrganizationOrder: vi.fn(),
  logout: vi.fn(),
  authState: {
    current: {
      status: "authenticated" as const,
      user: {
        userId: "admin-user",
        email: "admin@example.com",
        name: "Admin User",
        status: "ACTIVE",
        platformRole: null,
      },
      memberships: [
        {
          organizationId: "org-1",
          role: "ORGANIZATION_ADMIN" as const,
          status: "ACTIVE" as const,
        },
      ],
    } as AuthState,
  },
}));

vi.mock("@/modules/auth", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/auth")
  >("@/modules/auth");

  return {
    ...actual,
    authSession: {
      logout: mocks.logout,
    },
    isDefinitiveSessionFailure: () => false,
    useAuthSession: () => mocks.authState.current,
  };
});

vi.mock("./order-service", () => ({
  orderService: {
    getOrganizationOrder: mocks.getOrganizationOrder,
    cancelOrganizationOrder: mocks.cancelOrganizationOrder,
  },
}));

import { OrganizationOrderDetailView } from "./organization-order-detail-view";

function makeOrder(
  overrides: Partial<OrderDTO> = {},
): OrderDTO {
  return {
    orderId: "order-1",
    organizationId: "org-1",
    campaignId: "campaign-1",
    customerId: "customer-1",
    status: "PENDING_PAYMENT",
    subtotal: 25000,
    total: 25000,
    items: [
      {
        orderItemId: "item-1",
        productId: "product-1",
        variantId: "variant-1",
        productName: "Faculty Shirt",
        variantName: "Size M",
        unitPrice: 25000,
        quantity: 1,
        totalPrice: 25000,
      },
    ],
    createdAt: "2026-09-30T01:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
    ...overrides,
  };
}

describe("OrganizationOrderDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.current = {
      status: "authenticated",
      user: {
        userId: "admin-user",
        email: "admin@example.com",
        name: "Admin User",
        status: "ACTIVE",
        platformRole: null,
      },
      memberships: [
        {
          organizationId: "org-1",
          role: "ORGANIZATION_ADMIN",
          status: "ACTIVE",
        },
      ],
    };
    mocks.getOrganizationOrder.mockResolvedValue(makeOrder());
  });

  it("shows Organization Admin cancellation only for cancellable Order states", async () => {
    render(
      <OrganizationOrderDetailView
        organizationId="org-1"
        orderId="order-1"
      />,
    );

    expect(
      await screen.findByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }),
    ).toBeInTheDocument();

    expect(mocks.getOrganizationOrder).toHaveBeenCalledWith(
      "org-1",
      "order-1",
      {
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("does not expose the general cancel action to Staff", async () => {
    mocks.authState.current = {
      status: "authenticated",
      user: {
        userId: "staff-user",
        email: "staff@example.com",
        name: "Staff User",
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
    };

    render(
      <OrganizationOrderDetailView
        organizationId="org-1"
        orderId="order-1"
      />,
    );

    await screen.findByText("Faculty Shirt");

    expect(
      screen.queryByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }),
    ).not.toBeInTheDocument();
  });

  it("confirms admin cancellation and applies the Backend-returned OrderDTO", async () => {
    const cancelled = makeOrder({
      status: "CANCELLED",
      updatedAt: "2026-09-30T02:00:00.000Z",
    });
    mocks.cancelOrganizationOrder.mockResolvedValue(cancelled);

    render(
      <OrganizationOrderDetailView
        organizationId="org-1"
        orderId="order-1"
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "ยกเลิกคำสั่งซื้อ",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "ยืนยันยกเลิกคำสั่งซื้อ",
      }),
    );

    await waitFor(() => {
      expect(
        mocks.cancelOrganizationOrder,
      ).toHaveBeenCalledWith("org-1", "order-1");
    });

    expect((await screen.findAllByText("ยกเลิก")).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }),
    ).not.toBeInTheDocument();
  });
});
