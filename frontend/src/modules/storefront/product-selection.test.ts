import { describe, expect, it } from "vitest";

import type { CampaignDTO, ProductVariantDTO } from "@/types";

import {
  buildOrderEntryHref,
  calculateEstimatedTotal,
  findCampaign,
  firstOpenCampaign,
  parseQuantityInput,
} from "./product-selection";

const variant: ProductVariantDTO = {
  variantId: "variant 1",
  organizationId: "org 1",
  productId: "product 1",
  name: "Size M",
  price: 25000,
  status: "ACTIVE",
  createdAt: "2026-09-28T14:30:00.000Z",
  updatedAt: "2026-09-28T14:30:00.000Z",
};

const campaign = (status: CampaignDTO["status"]): CampaignDTO => ({
  campaignId: `campaign-${status}`,
  organizationId: "org 1",
  storeId: "store-1",
  name: status,
  openAt: null,
  closeAt: null,
  paymentDeadline: null,
  pickupAt: null,
  status,
  createdAt: "2026-09-28T14:30:00.000Z",
  updatedAt: "2026-09-28T14:30:00.000Z",
});

describe("product selection helpers", () => {
  it("accepts only positive integer quantity", () => {
    expect(parseQuantityInput("1")).toBe(1);
    expect(parseQuantityInput("12")).toBe(12);
    expect(parseQuantityInput("0")).toBeNull();
    expect(parseQuantityInput("-1")).toBeNull();
    expect(parseQuantityInput("1.5")).toBeNull();
  });

  it("calculates a non-authoritative estimate in integer satang", () => {
    expect(calculateEstimatedTotal(variant, 3)).toBe(75000);
    expect(calculateEstimatedTotal(undefined, 3)).toBeNull();
  });

  it("builds the order-entry route with identifiers only", () => {
    const href = buildOrderEntryHref({
      organizationId: "org 1",
      campaignId: "campaign 1",
      productId: "product 1",
      variantId: "variant 1",
    });

    expect(href).toBe(
      "/orders/new/?organizationId=org+1&campaignId=campaign+1&productId=product+1&variantId=variant+1",
    );
    expect(href).not.toContain("quantity=");
  });

  it("finds explicit and fallback open campaign context", () => {
    const campaigns = [campaign("CLOSED"), campaign("OPEN")];

    expect(
      findCampaign(campaigns, "campaign-CLOSED")?.status,
    ).toBe("CLOSED");
    expect(firstOpenCampaign(campaigns)?.status).toBe("OPEN");
  });
});
