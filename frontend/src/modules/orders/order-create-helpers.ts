import type {
  CampaignDTO,
  ProductVariantDTO,
  StorefrontProductDTO,
} from "@/types";

import type { CreateOrderRequest } from "./order-service";

export interface OrderEntryContext {
  organizationId: string;
  campaignId: string;
  productId: string;
  variantId: string;
}

export function resolveOrderEntrySelection({
  product,
  campaigns,
  context,
}: {
  product: StorefrontProductDTO;
  campaigns: readonly CampaignDTO[];
  context: OrderEntryContext;
}):
  | {
      ok: true;
      campaign: CampaignDTO;
      variant: ProductVariantDTO;
    }
  | {
      ok: false;
      reason: "PRODUCT_MISMATCH" | "CAMPAIGN_NOT_FOUND" | "VARIANT_NOT_FOUND";
    } {
  if (
    product.organizationId !== context.organizationId ||
    product.productId !== context.productId
  ) {
    return { ok: false, reason: "PRODUCT_MISMATCH" };
  }

  const campaign = campaigns.find(
    (item) => item.campaignId === context.campaignId,
  );

  if (!campaign) {
    return { ok: false, reason: "CAMPAIGN_NOT_FOUND" };
  }

  const variant = product.variants?.find(
    (item) =>
      item.variantId === context.variantId && item.status === "ACTIVE",
  );

  if (!variant) {
    return { ok: false, reason: "VARIANT_NOT_FOUND" };
  }

  return { ok: true, campaign, variant };
}

export function buildCreateOrderRequest({
  campaignId,
  productId,
  variantId,
  quantity,
}: OrderEntryContext & { quantity: number }): CreateOrderRequest {
  return {
    campaignId,
    items: [
      {
        productId,
        variantId,
        quantity,
      },
    ],
  };
}
