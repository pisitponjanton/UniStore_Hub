import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CampaignDTO, StorefrontProductDTO } from "@/types";

import { CampaignCard, ProductCard } from "./storefront-presenters";

const product: StorefrontProductDTO = {
  productId: "product-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "เสื้อชมรม",
  description: "เสื้อกิจกรรมประจำปี",
  imageUrl: "https://example.com/product.webp",
  status: "ACTIVE",
  variants: [
    {
      variantId: "variant-1",
      organizationId: "org-1",
      productId: "product-1",
      name: "M",
      price: 25900,
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      variantId: "variant-2",
      organizationId: "org-1",
      productId: "product-1",
      name: "L",
      price: 27900,
      status: "INACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const campaign: CampaignDTO = {
  campaignId: "campaign-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "รอบตุลาคม",
  openAt: "2026-10-01T00:00:00.000Z",
  closeAt: "2026-10-10T00:00:00.000Z",
  paymentDeadline: "2026-10-12T00:00:00.000Z",
  pickupAt: "2026-10-20T00:00:00.000Z",
  status: "OPEN",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("storefront presenters", () => {
  it("presents meaningful product media, active option count, and price", () => {
    render(<ProductCard organizationId="org-1" product={product} />);

    expect(screen.getByRole("img", { name: "เสื้อชมรม" })).toHaveAttribute(
      "loading",
      "lazy",
    );
    expect(screen.getByText("1 ตัวเลือก")).toBeInTheDocument();
    expect(screen.getByText("฿259.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /เสื้อชมรม/ })).toHaveAttribute(
      "href",
      "/products/view?organizationId=org-1&productId=product-1",
    );
  });


  it("uses a generic accessible no-image fallback without inventing product media", () => {
    render(
      <ProductCard
        organizationId="org-1"
        product={{ ...product, imageUrl: null }}
      />,
    );

    expect(screen.getByText("ยังไม่มีรูปสินค้า")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-illustration="product"]'),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps campaign status visible alongside its schedule", () => {
    render(<CampaignCard campaign={campaign} />);

    expect(screen.getByText("เปิดรับคำสั่งซื้อ")).toBeInTheDocument();
    expect(screen.getByText("เริ่มรับ")).toBeInTheDocument();
    expect(screen.getByText("ปิดรับ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /รอบตุลาคม/ })).toHaveAttribute(
      "href",
      "/campaigns/view?organizationId=org-1&campaignId=campaign-1",
    );
  });
});
