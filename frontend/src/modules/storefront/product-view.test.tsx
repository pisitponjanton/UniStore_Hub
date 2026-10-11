import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StorefrontProductView } from "./storefront-service";

const mocks = vi.hoisted(() => ({
  getProductView: vi.fn(),
  useAuthSession: vi.fn(),
}));

vi.mock("@/modules/auth", async () => {
  const actual = await vi.importActual<typeof import("@/modules/auth")>(
    "@/modules/auth",
  );
  return { ...actual, useAuthSession: mocks.useAuthSession };
});

vi.mock("./storefront-service", () => ({
  storefrontService: { getProductView: mocks.getProductView },
}));

vi.mock("./storefront-header", () => ({
  StorefrontHeader: () => <header>UniStore Hub</header>,
}));

import { ProductView } from "./product-view";

const organizationId = "55555555-5555-4555-8555-555555555555";
const productId = "77777777-7777-4777-8777-777777777777";

function demoData(imageUrl: string | null): StorefrontProductView {
  return {
    store: {
      storeId: "66666666-6666-4666-8666-666666666666",
      organizationId,
      name: "Local Demo Store",
      description: "",
      status: "ACTIVE",
    },
    product: {
      productId,
      organizationId,
      storeId: "66666666-6666-4666-8666-666666666666",
      name: "Local Demo Product",
      description: "Product description",
      status: "ACTIVE",
      imageUrl,
      variants: [
        {
          variantId: "88888888-8888-4888-8888-888888888888",
          organizationId,
          productId,
          name: "Default",
          price: 19900,
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    campaigns: [
      {
        campaignId: "99999999-9999-4999-8999-999999999999",
        organizationId,
        storeId: "66666666-6666-4666-8666-666666666666",
        name: "Local Demo Campaign",
        openAt: "2026-10-01T00:00:00.000Z",
        closeAt: "2026-11-01T00:00:00.000Z",
        paymentDeadline: "2026-11-02T00:00:00.000Z",
        pickupAt: "2026-11-10T00:00:00.000Z",
        status: "OPEN",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("ProductView media and purchase regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthSession.mockReturnValue({ status: "anonymous" });
    window.history.replaceState(
      null,
      "",
      `/products/view/?organizationId=${organizationId}&productId=${productId}`,
    );
  });

  it("marks a no-photo product for compact mobile presentation without changing purchase behavior", async () => {
    mocks.getProductView.mockResolvedValue(demoData(null));
    const { container } = render(<ProductView />);
    expect(
      await screen.findByRole("heading", { name: "Local Demo Product" }),
    ).toBeInTheDocument();

    expect(
      container.querySelector('[data-has-image="false"][class*="productDetail"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-has-image="false"][class*="productDetailMedia"]'),
    ).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีรูปสินค้า")).toBeInTheDocument();
    const loginDestination = new URL(
      screen.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" }).getAttribute("href") ?? "",
      "https://unistore.local",
    );
    expect(["/login", "/login/"]).toContain(loginDestination.pathname);
    expect(loginDestination.searchParams.get("returnTo")).toContain("/orders/new/");
    const quantity = screen.getByRole("spinbutton", { name: "จำนวน" });
    expect(container.querySelector("output")).toHaveTextContent("฿199.00");
    fireEvent.change(quantity, { target: { value: "2" } });
    expect(container.querySelector("output")).toHaveTextContent("฿398.00");
    fireEvent.change(quantity, { target: { value: "0" } });
    expect(screen.getByText("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป")).toBeInTheDocument();
    expect(container.querySelector("output")).toHaveTextContent("ยังไม่คำนวณ");
  });

  it("keeps the real-image state and meaningful product image accessible", async () => {
    const imageUrl = "https://example.com/real-product.png";
    mocks.getProductView.mockResolvedValue(demoData(imageUrl));
    const { container } = render(<ProductView />);
    expect(
      await screen.findByRole("heading", { name: "Local Demo Product" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-has-image="true"][class*="productDetail"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-has-image="true"][class*="productDetailMedia"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Local Demo Product" })).toHaveAttribute(
      "src",
      imageUrl,
    );
    expect(screen.queryByText("ยังไม่มีรูปสินค้า")).not.toBeInTheDocument();
    expect(container.querySelector("output")).toHaveTextContent("฿199.00");
  });
});
