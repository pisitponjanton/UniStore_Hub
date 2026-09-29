'use strict';

const { AppError } = require('../../errors/app-error');
const {
  requireTenantMatch,
} = require('../../policies/organization.policy');
const {
  CAMPAIGN_STATUS,
} = require('../campaigns/campaign.constants');
const {
  createCampaignRepository,
} = require('../campaigns/campaign.repository');
const { createFileService } = require('../files/file.service');
const {
  ORGANIZATION_STATUS,
} = require('../organizations/organization.constants');
const {
  createOrganizationRepository,
} = require('../organizations/organization.repository');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('../products/product.constants');
const {
  createProductRepository,
} = require('../products/product.repository');
const {
  STORE_STATUS,
} = require('../stores/store.constants');
const {
  createStoreRepository,
} = require('../stores/store.repository');
const {
  toStorefrontCampaignDto,
  toStorefrontOrganizationDto,
  toStorefrontProductDto,
  toStorefrontStoreDto,
} = require('./storefront.mapper');

function notFound(code, message) {
  return new AppError({
    code,
    message,
    httpStatus: 404,
  });
}

function createStorefrontService(options = {}) {
  let organizationRepository = options.organizationRepository;
  let storeRepository = options.storeRepository;
  let productRepository = options.productRepository;
  let campaignRepository = options.campaignRepository;
  let fileService = options.fileService;

  function getFileService() {
    if (!fileService) {
      fileService = createFileService({
        s3Adapter: options.s3Adapter,
      });
    }

    return fileService;
  }

  const createProductImageUrl =
    options.createProductImageUrl ||
    ((input) =>
      getFileService().createStoredProductImageUrl(input));

  function getOrganizationRepository() {
    if (!organizationRepository) {
      organizationRepository = createOrganizationRepository();
    }

    return organizationRepository;
  }

  function getStoreRepository() {
    if (!storeRepository) {
      storeRepository = createStoreRepository();
    }

    return storeRepository;
  }

  function getProductRepository() {
    if (!productRepository) {
      productRepository = createProductRepository();
    }

    return productRepository;
  }

  function getCampaignRepository() {
    if (!campaignRepository) {
      campaignRepository = createCampaignRepository();
    }

    return campaignRepository;
  }

  async function requireActiveOrganization(organizationId) {
    const organization =
      await getOrganizationRepository().getById(organizationId);

    if (
      !organization ||
      organization.status !== ORGANIZATION_STATUS.ACTIVE
    ) {
      throw notFound(
        'ORGANIZATION_NOT_FOUND',
        'Organization not found',
      );
    }

    requireTenantMatch(organization, organizationId);
    return organization;
  }

  async function requireActiveStore(organizationId, storeId) {
    await requireActiveOrganization(organizationId);

    const store = await getStoreRepository().getById(
      organizationId,
      storeId,
    );

    if (!store || store.status !== STORE_STATUS.ACTIVE) {
      throw notFound('STORE_NOT_FOUND', 'Store not found');
    }

    requireTenantMatch(store, organizationId);
    return store;
  }

  async function requireActiveProduct(
    organizationId,
    storeId,
    productId,
  ) {
    await requireActiveStore(organizationId, storeId);

    const product = await getProductRepository().getProduct(
      organizationId,
      productId,
    );

    if (
      !product ||
      product.status !== PRODUCT_STATUS.ACTIVE ||
      product.storeId !== storeId
    ) {
      throw notFound(
        'PRODUCT_NOT_FOUND',
        'Product not found',
      );
    }

    requireTenantMatch(product, organizationId);
    return product;
  }

  async function mapPublicProduct(product, { includeVariants } = {}) {
    const imageUrl = product.imageKey
      ? await createProductImageUrl({
          organizationId: product.organizationId,
          productId: product.productId,
          imageKey: product.imageKey,
        })
      : null;

    if (!includeVariants) {
      return toStorefrontProductDto(product, { imageUrl });
    }

    const variants =
      await getProductRepository().listVariants(
        product.organizationId,
        product.productId,
      );

    const activeVariants = variants.filter((variant) => {
      requireTenantMatch(variant, product.organizationId);

      return (
        variant.productId === product.productId &&
        variant.status === VARIANT_STATUS.ACTIVE
      );
    });

    return toStorefrontProductDto(product, {
      imageUrl,
      variants: activeVariants,
    });
  }

  async function collectOrganizations() {
    const items = [];
    let exclusiveStartKey;

    do {
      const result =
        await getOrganizationRepository().listPlatform({
          exclusiveStartKey,
        });

      items.push(...result.items);
      exclusiveStartKey = result.lastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }

  async function collectProducts(organizationId, storeId) {
    const items = [];
    let exclusiveStartKey;

    do {
      const result =
        await getProductRepository().listProductsByStore(
          organizationId,
          storeId,
          { exclusiveStartKey },
        );

      items.push(...result.items);
      exclusiveStartKey = result.lastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }

  async function collectCampaigns(organizationId, storeId) {
    const items = [];
    let exclusiveStartKey;

    do {
      const result =
        await getCampaignRepository().listByStorePage(
          organizationId,
          storeId,
          { exclusiveStartKey },
        );

      items.push(...result.items);
      exclusiveStartKey = result.lastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }

  return {
    async listOrganizations() {
      const organizations = await collectOrganizations();

      return organizations
        .filter(
          (organization) =>
            organization.status === ORGANIZATION_STATUS.ACTIVE,
        )
        .map(toStorefrontOrganizationDto);
    },

    async listStores(organizationId) {
      await requireActiveOrganization(organizationId);

      const stores =
        await getStoreRepository().listByOrganization(
          organizationId,
        );

      return stores
        .filter((store) => {
          requireTenantMatch(store, organizationId);
          return store.status === STORE_STATUS.ACTIVE;
        })
        .map(toStorefrontStoreDto);
    },

    async getStore(organizationId, storeId) {
      return toStorefrontStoreDto(
        await requireActiveStore(organizationId, storeId),
      );
    },

    async listProducts(organizationId, storeId) {
      await requireActiveStore(organizationId, storeId);
      const products = await collectProducts(
        organizationId,
        storeId,
      );
      const activeProducts = products.filter((product) => {
        requireTenantMatch(product, organizationId);

        return (
          product.storeId === storeId &&
          product.status === PRODUCT_STATUS.ACTIVE
        );
      });

      return Promise.all(
        activeProducts.map((product) =>
          mapPublicProduct(product),
        ),
      );
    },

    async getProduct(organizationId, storeId, productId) {
      const product = await requireActiveProduct(
        organizationId,
        storeId,
        productId,
      );

      return mapPublicProduct(product, {
        includeVariants: true,
      });
    },

    async listCampaigns(organizationId, storeId) {
      await requireActiveStore(organizationId, storeId);
      const campaigns = await collectCampaigns(
        organizationId,
        storeId,
      );

      return campaigns
        .filter((campaign) => {
          requireTenantMatch(campaign, organizationId);

          return (
            campaign.storeId === storeId &&
            campaign.status === CAMPAIGN_STATUS.OPEN
          );
        })
        .map(toStorefrontCampaignDto);
    },

    async getCampaign(
      organizationId,
      storeId,
      campaignId,
    ) {
      await requireActiveStore(organizationId, storeId);

      const campaign =
        await getCampaignRepository().getById(
          organizationId,
          campaignId,
        );

      if (
        !campaign ||
        campaign.storeId !== storeId ||
        campaign.status !== CAMPAIGN_STATUS.OPEN
      ) {
        throw notFound(
          'CAMPAIGN_NOT_FOUND',
          'Campaign not found',
        );
      }

      requireTenantMatch(campaign, organizationId);
      return toStorefrontCampaignDto(campaign);
    },
  };
}

module.exports = {
  createStorefrontService,
};
