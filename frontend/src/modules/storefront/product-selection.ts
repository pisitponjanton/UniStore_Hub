import type {
  CampaignDTO,
  ProductVariantDTO,
  Satang,
} from "@/types";

export function parseQuantityInput(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const quantity = Number(value);

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return null;
  }

  return quantity;
}

export function calculateEstimatedTotal(
  variant: ProductVariantDTO | undefined,
  quantity: number | null,
): Satang | null {
  if (!variant || quantity === null) {
    return null;
  }

  const total = variant.price * quantity;

  return Number.isSafeInteger(total) ? total : null;
}

export function buildOrderEntryHref({
  organizationId,
  campaignId,
  productId,
  variantId,
}: {
  organizationId: string;
  campaignId: string;
  productId: string;
  variantId: string;
}): string {
  const params = new URLSearchParams({
    organizationId,
    campaignId,
    productId,
    variantId,
  });

  return `/orders/new/?${params.toString()}`;
}

export function findCampaign(
  campaigns: readonly CampaignDTO[],
  campaignId: string | null | undefined,
): CampaignDTO | null {
  if (!campaignId) {
    return null;
  }

  return (
    campaigns.find((campaign) => campaign.campaignId === campaignId) ?? null
  );
}

export function firstOpenCampaign(
  campaigns: readonly CampaignDTO[],
): CampaignDTO | null {
  return campaigns.find((campaign) => campaign.status === "OPEN") ?? null;
}
