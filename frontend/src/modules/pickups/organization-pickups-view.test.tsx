import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services";
import type { OrderDTO, PickupDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listOrganizationPickups: vi.fn(),
  getOrganizationPickup: vi.fn(),
  confirmOrganizationPickup: vi.fn(),
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

vi.mock("./pickup-service", () => ({
  pickupService: {
    listOrganizationPickups: mocks.listOrganizationPickups,
    getOrganizationPickup: mocks.getOrganizationPickup,
    confirmOrganizationPickup:
      mocks.confirmOrganizationPickup,
  },
}));

import { OrganizationPickupsView } from "./organization-pickups-view";

function pickup(
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
    status: "READY_FOR_PICKUP",
    subtotal: 25000,
    total: 25000,
    items: [],
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
    ...overrides,
  };
}

async function openDetail() {
  await screen.findByText("Pickup pickup-1");
  fireEvent.click(
    screen.getByRole("button", {
      name: "ดูรายละเอียด Pickup pickup-1",
    }),
  );
  await screen.findByText("Order ที่เกี่ยวข้อง");
}

function clickConfirmFlow() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "ยืนยันรับสินค้า",
    }),
  );

  const confirmButtons = screen.getAllByRole("button", {
    name: "ยืนยันรับสินค้า",
  });

  fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
}

describe("OrganizationPickupsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.listOrganizationPickups.mockResolvedValue({
      items: [pickup()],
      nextCursor: null,
    });
    mocks.getOrganizationPickup.mockResolvedValue(pickup());
    mocks.getOrganizationOrder.mockResolvedValue(order());
  });

  it("loads Staff/Admin pickups and searches with the documented token/order/campaign/status filters", async () => {
    render(
      <OrganizationPickupsView organizationId="org-1" />,
    );

    await screen.findByText("Pickup pickup-1");

    fireEvent.change(screen.getByLabelText("Pickup token"), {
      target: { value: "  token-search  " },
    });
    fireEvent.change(screen.getByLabelText("Order ID"), {
      target: { value: "  order-2  " },
    });
    fireEvent.change(screen.getByLabelText("Campaign ID"), {
      target: { value: "  campaign-2  " },
    });
    fireEvent.change(screen.getByLabelText("สถานะ Pickup"), {
      target: { value: "RECEIVED" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "ใช้ตัวกรอง",
      }),
    );

    await waitFor(() => {
      expect(
        mocks.listOrganizationPickups,
      ).toHaveBeenLastCalledWith("org-1", {
        campaignId: "campaign-2",
        status: "RECEIVED",
        token: "token-search",
        orderId: "order-2",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "แสดง 1 รายการรับสินค้า · รับสินค้าแล้ว",
    );
  });

  it("loads fresh Pickup and Order detail before confirmation", async () => {
    render(
      <OrganizationPickupsView organizationId="org-1" />,
    );

    await openDetail();

    expect(mocks.getOrganizationPickup).toHaveBeenCalledWith(
      "org-1",
      "pickup-1",
    );
    expect(mocks.getOrganizationOrder).toHaveBeenCalledWith(
      "org-1",
      "order-1",
    );

    expect(
      screen.getByRole("button", {
        name: "ยืนยันรับสินค้า",
      }),
    ).toBeInTheDocument();
  });

  it("confirms READY pickup then refreshes both Pickup and Order from Backend", async () => {
    const receivedPickup = pickup({
      status: "RECEIVED",
      receivedBy: "staff-1",
      receivedAt: "2026-09-30T02:00:00.000Z",
      updatedAt: "2026-09-30T02:00:00.000Z",
    });
    const receivedOrder = order({
      status: "RECEIVED",
      updatedAt: "2026-09-30T02:00:00.000Z",
    });

    mocks.getOrganizationPickup
      .mockResolvedValueOnce(pickup())
      .mockResolvedValueOnce(receivedPickup);
    mocks.getOrganizationOrder
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(receivedOrder);
    mocks.confirmOrganizationPickup.mockResolvedValue(
      receivedPickup,
    );

    render(
      <OrganizationPickupsView organizationId="org-1" />,
    );

    await openDetail();
    clickConfirmFlow();

    await waitFor(() => {
      expect(
        mocks.confirmOrganizationPickup,
      ).toHaveBeenCalledWith("org-1", "pickup-1");
      expect(
        mocks.getOrganizationPickup,
      ).toHaveBeenCalledTimes(2);
      expect(
        mocks.getOrganizationOrder,
      ).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByText(
        "ยืนยันการรับสินค้าเรียบร้อยแล้ว",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "ยืนยันรับสินค้า",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Pickup นี้รับสินค้าเรียบร้อยแล้ว/),
    ).toBeInTheDocument();
  });

  it("handles duplicate confirmation as PICKUP_ALREADY_RECEIVED and refreshes displayed state", async () => {
    const receivedPickup = pickup({
      status: "RECEIVED",
      receivedBy: "staff-2",
      receivedAt: "2026-09-30T02:10:00.000Z",
    });
    const receivedOrder = order({
      status: "RECEIVED",
    });

    mocks.confirmOrganizationPickup.mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "PICKUP_ALREADY_RECEIVED",
        kind: "conflict",
      }),
    );
    mocks.getOrganizationPickup
      .mockResolvedValueOnce(pickup())
      .mockResolvedValueOnce(receivedPickup);
    mocks.getOrganizationOrder
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(receivedOrder);

    render(
      <OrganizationPickupsView organizationId="org-1" />,
    );

    await openDetail();
    clickConfirmFlow();

    expect(
      await screen.findByText(
        "รายการรับสินค้านี้ถูกยืนยันไปแล้ว ระบบได้โหลดสถานะล่าสุดมาให้",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        mocks.getOrganizationPickup,
      ).toHaveBeenCalledTimes(2);
      expect(
        mocks.getOrganizationOrder,
      ).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.queryByRole("button", {
        name: "ยืนยันรับสินค้า",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Pickup นี้รับสินค้าเรียบร้อยแล้ว/),
    ).toBeInTheDocument();
  });
});
