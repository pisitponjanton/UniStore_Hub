import { describe, expect, it } from "vitest";

import type {
  CampaignDTO,
  StorefrontProductDTO,
} from "@/types";

import {
  buildCreateOrderRequest,
  resolveOrderEntrySelection,
} from "./order-create-helpers";

const product: StorefrontProductDTO = {
  productId: "product-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "Faculty Shirt",
  description: "",
  imageUrl: null,
  status: "ACTIVE",
  variants: [
    {
      variantId: "variant-1",
      organizationId: "org-1",
      productId: "product-1",
      name: "Size M",
      price: 25000,
      status: "ACTIVE",
      createdAt: "2026-09-28T14:30:00.000Z",
      updatedAt: "2026-09-28T14:30:00.000Z",
    },
  ],
  createdAt: "2026-09-28T14:30:00.000Z",
  updatedAt: "2026-09-28T14:30:00.000Z",
};

const campaign: CampaignDTO = {
  campaignId: "campaign-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "Pre-order",
  openAt: null,
  closeAt: null,
  paymentDeadline: null,
  pickupAt: null,
  status: "OPEN",
  createdAt: "2026-09-28T14:30:00.000Z",
  updatedAt: "2026-09-28T14:30:00.000Z",
};

describe("order create helpers", () => {
  it("builds the exact create-order payload without client prices or totals", () => {
    const payload = buildCreateOrderRequest({
      organizationId: "org-1",
      campaignId: "campaign-1",
      productId: "product-1",
      variantId: "variant-1",
      quantity: 2,
    });

    expect(payload).toEqual({
      campaignId: "campaign-1",
      items: [
        {
          productId: "product-1",
          variantId: "variant-1",
          quantity: 2,
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /unitPrice|totalPrice|subtotal|total/,
    );
  });

  it("resolves the requested active campaign/product/variant context", () => {
    expect(
      resolveOrderEntrySelection({
        product,
        campaigns: [campaign],
        context: {
          organizationId: "org-1",
          campaignId: "campaign-1",
          productId: "product-1",
          variantId: "variant-1",
        },
      }),
    ).toMatchObject({
      ok: true,
      campaign,
      variant: product.variants?.[0],
    });
  });

  it("rejects an inactive or missing variant before submit", () => {
    const inactiveProduct: StorefrontProductDTO = {
      ...product,
      variants: product.variants?.map((variant) => ({
        ...variant,
        status: "INACTIVE" as const,
      })),
    };

    expect(
      resolveOrderEntrySelection({
        product: inactiveProduct,
        campaigns: [campaign],
        context: {
          organizationId: "org-1",
          campaignId: "campaign-1",
          productId: "product-1",
          variantId: "variant-1",
        },
      }),
    ).toEqual({ ok: false, reason: "VARIANT_NOT_FOUND" });
  });
});
