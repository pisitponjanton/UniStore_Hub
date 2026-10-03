import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  getProductView: vi.fn(),
  createOrder: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("@/modules/storefront", () => ({
  calculateEstimatedTotal: (
    variant: { price: number } | undefined,
    quantity: number | null,
  ) => (variant && quantity !== null ? variant.price * quantity : null),
  CampaignStatusBadge: ({ status }: { status: string }) => (
    <span>{status}</span>
  ),
  parseQuantityInput: (value: string) => {
    if (!/^\d+$/.test(value.trim())) {
      return null;
    }

    const quantity = Number(value);
    return Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : null;
  },
  productHref: ({
    organizationId,
    productId,
    campaignId,
  }: {
    organizationId: string;
    productId: string;
    campaignId?: string;
  }) => {
    const params = new URLSearchParams({
      organizationId,
      productId,
      ...(campaignId ? { campaignId } : {}),
    });
    return `/products/view/?${params.toString()}`;
  },
  StorefrontHeader: () => <header>UniStore Hub</header>,
  storefrontService: {
    getProductView: mocks.getProductView,
  },
}));

vi.mock("./order-service", () => ({
  orderService: {
    createOrder: mocks.createOrder,
  },
}));

import { OrderCreateView } from "./order-create";

const productView = {
  store: {
    storeId: "store-1",
    organizationId: "org-1",
    name: "ร้านชมรม",
    description: "",
    status: "ACTIVE" as const,
  },
  product: {
    productId: "product-1",
    organizationId: "org-1",
    storeId: "store-1",
    name: "เสื้อชมรม",
    description: "เสื้อกิจกรรม",
    imageUrl: "https://example.com/shirt.webp",
    status: "ACTIVE" as const,
    variants: [
      {
        variantId: "variant-1",
        organizationId: "org-1",
        productId: "product-1",
        name: "Size M",
        price: 25000,
        status: "ACTIVE" as const,
        createdAt: "2026-10-01T08:00:00.000Z",
        updatedAt: "2026-10-01T08:00:00.000Z",
      },
    ],
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
  },
  campaigns: [
    {
      campaignId: "campaign-1",
      organizationId: "org-1",
      storeId: "store-1",
      name: "รอบตุลาคม",
      openAt: "2026-10-01T08:00:00.000Z",
      closeAt: "2026-10-10T08:00:00.000Z",
      paymentDeadline: "2026-10-12T08:00:00.000Z",
      pickupAt: "2026-10-20T08:00:00.000Z",
      status: "OPEN" as const,
      createdAt: "2026-10-01T08:00:00.000Z",
      updatedAt: "2026-10-01T08:00:00.000Z",
    },
  ],
};

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
    createdAt: "2026-10-03T04:00:00.000Z",
    updatedAt: "2026-10-03T04:00:00.000Z",
    ...overrides,
  };
}

describe("OrderCreateView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      {},
      "",
      "/orders/new/?organizationId=org-1&campaignId=campaign-1&productId=product-1&variantId=variant-1",
    );
    mocks.getProductView.mockResolvedValue(productView);
  });

  it("shows selected commerce context and focuses a summary when quantity validation fails", async () => {
    render(<OrderCreateView />);

    expect(
      await screen.findByRole("heading", { name: "ตรวจสอบคำสั่งซื้อ" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "เสื้อชมรม" })).toBeInTheDocument();
    expect(screen.getByText("Size M", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getAllByText("฿250.00")).toHaveLength(2);

    const quantity = screen.getByLabelText("จำนวน");
    fireEvent.change(quantity, { target: { value: "0" } });

    const submit = screen.getByRole("button", {
      name: "ยืนยันสร้างคำสั่งซื้อ",
    });
    expect(submit).toBeEnabled();
    fireEvent.submit(submit.closest("form")!);

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("link", {
        name: "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป",
      }),
    ).toHaveAttribute("href", "#order-quantity");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("submits only identifiers and quantity, then presents the authoritative backend total", async () => {
    mocks.createOrder.mockResolvedValue(makeOrder());

    render(<OrderCreateView />);

    const quantity = await screen.findByLabelText("จำนวน");
    fireEvent.change(quantity, { target: { value: "2" } });

    expect(screen.getByText("฿500.00")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "ยืนยันสร้างคำสั่งซื้อ" }),
    );

    await waitFor(() => {
      expect(mocks.createOrder).toHaveBeenCalledWith("org-1", {
        campaignId: "campaign-1",
        items: [
          {
            productId: "product-1",
            variantId: "variant-1",
            quantity: 2,
          },
        ],
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: "สร้างคำสั่งซื้อสำเร็จ",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("ยอดที่ระบบบันทึก")).toBeInTheDocument();
    expect(screen.getByText("฿500.00")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ไปชำระเงิน" }),
    ).toBeInTheDocument();
  });
});
