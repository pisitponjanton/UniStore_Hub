'use strict';

function toCampaignDto(campaign) {
  if (!campaign) {
    return null;
  }

  return {
    campaignId: campaign.campaignId,
    organizationId: campaign.organizationId,
    storeId: campaign.storeId,
    name: campaign.name,
    openAt: campaign.openAt ?? null,
    closeAt: campaign.closeAt ?? null,
    paymentDeadline: campaign.paymentDeadline ?? null,
    pickupAt: campaign.pickupAt ?? null,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

module.exports = {
  toCampaignDto,
};
