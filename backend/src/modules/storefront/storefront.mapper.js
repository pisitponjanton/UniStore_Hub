'use strict';

const { toCampaignDto } = require('../campaigns/campaign.mapper');
const { toVariantDto } = require('../products/product.mapper');

function toStorefrontOrganizationDto(organization) {
  return {
    organizationId: organization.organizationId,
    name: organization.name,
    description: organization.description,
    status: organization.status,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

function toStorefrontStoreDto(store) {
  return {
    storeId: store.storeId,
    organizationId: store.organizationId,
    name: store.name,
    description: store.description,
    status: store.status,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
}

function toStorefrontProductDto(product, options = {}) {
  const dto = {
    productId: product.productId,
    organizationId: product.organizationId,
    storeId: product.storeId,
    name: product.name,
    description: product.description,
    imageUrl: options.imageUrl ?? null,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (Array.isArray(options.variants)) {
    dto.variants = options.variants.map(toVariantDto);
  }

  return dto;
}

function toStorefrontCampaignDto(campaign) {
  return toCampaignDto(campaign);
}

module.exports = {
  toStorefrontOrganizationDto,
  toStorefrontStoreDto,
  toStorefrontProductDto,
  toStorefrontCampaignDto,
};
