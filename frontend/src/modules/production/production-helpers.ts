export function productionHref(
  organizationId: string,
  campaignId?: string | null,
): string {
  const params = new URLSearchParams({ organizationId });
  const normalizedCampaignId = campaignId?.trim();

  if (normalizedCampaignId) {
    params.set("campaignId", normalizedCampaignId);
  }

  return `/org/production/?${params.toString()}`;
}

export function normalizeCampaignId(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}
