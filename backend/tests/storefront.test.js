'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const {
  CAMPAIGN_STATUS,
} = require('../src/modules/campaigns/campaign.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('../src/modules/products/product.constants');
const {
  STORE_STATUS,
} = require('../src/modules/stores/store.constants');
const {
  createStorefrontService,
} = require('../src/modules/storefront/storefront.service');

const FIXED_TIME = '2026-09-29T10:15:00.000Z';

function makeOrganization(overrides = {}) {
  return {
    organizationId: 'org-1',
    name: 'IT Club',
    description: 'Student organization',
    status: ORGANIZATION_STATUS.ACTIVE,
    createdBy: 'private-creator-id',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    internalSecret: 'must-not-leak',
    ...overrides,
  };
}

function makeStore(overrides = {}) {
  return {
    storeId: 'store-1',
    organizationId: 'org-1',
    name: 'Main Store',
    description: 'Faculty merchandise',
    status: STORE_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    privateNote: 'must-not-leak',
    ...overrides,
  };
}

function makeProduct(overrides = {}) {
  return {
    productId: 'product-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt',
    description: 'Pre-order shirt',
    imageKey: 'products/org-1/product-1/image-1',
    status: PRODUCT_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    paymentSecret: 'must-not-leak',
    ...overrides,
  };
}

function makeVariant(overrides = {}) {
  return {
    variantId: 'variant-1',
    organizationId: 'org-1',
    productId: 'product-1',
    name: 'Size M',
    price: 25000,
    status: VARIANT_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    internalSecret: 'must-not-leak',
    ...overrides,
  };
}

function makeCampaign(overrides = {}) {
  return {
    campaignId: 'campaign-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt Pre-order',
    openAt: FIXED_TIME,
    closeAt: '2026-10-10T23:59:59.000Z',
    paymentDeadline: '2026-10-11T23:59:59.000Z',
    pickupAt: '2026-10-25T09:00:00.000Z',
    status: CAMPAIGN_STATUS.OPEN,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    auditMetadata: 'must-not-leak',
    ...overrides,
  };
}

function baseDependencies(overrides = {}) {
  return {
    organizationRepository: {
      async getById() {
        return makeOrganization();
      },
      async listPlatform() {
        return {
          items: [makeOrganization()],
          lastEvaluatedKey: null,
        };
      },
      ...overrides.organizationRepository,
    },
    storeRepository: {
      async getById() {
        return makeStore();
      },
      async listByOrganization() {
        return [makeStore()];
      },
      ...overrides.storeRepository,
    },
    productRepository: {
      async getProduct() {
        return makeProduct();
      },
      async listProductsByStore() {
        return {
          items: [makeProduct()],
          lastEvaluatedKey: null,
        };
      },
      async listVariants() {
        return [makeVariant()];
      },
      ...overrides.productRepository,
    },
    campaignRepository: {
      async getById() {
        return makeCampaign();
      },
      async listByStorePage() {
        return {
          items: [makeCampaign()],
          lastEvaluatedKey: null,
        };
      },
      ...overrides.campaignRepository,
    },
    createProductImageUrl: async () =>
      'https://signed.example/product-image',
    ...overrides.topLevel,
  };
}

test('storefront organizations expose only ACTIVE public-safe organization fields', async () => {
  const service = createStorefrontService(
    baseDependencies({
      organizationRepository: {
        async listPlatform() {
          return {
            items: [
              makeOrganization(),
              makeOrganization({
                organizationId: 'org-pending',
                status: ORGANIZATION_STATUS.PENDING,
              }),
              makeOrganization({
                organizationId: 'org-suspended',
                status: ORGANIZATION_STATUS.SUSPENDED,
              }),
            ],
            lastEvaluatedKey: null,
          };
        },
      },
    }),
  );

  const organizations = await service.listOrganizations();

  assert.equal(organizations.length, 1);
  assert.deepEqual(organizations[0], {
    organizationId: 'org-1',
    name: 'IT Club',
    description: 'Student organization',
    status: ORGANIZATION_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  });

  const serialized = JSON.stringify(organizations);
  assert.equal(serialized.includes('createdBy'), false);
  assert.equal(serialized.includes('internalSecret'), false);
});

test('storefront organization listing follows Platform GSI pages without Scan', async () => {
  const calls = [];
  const service = createStorefrontService(
    baseDependencies({
      organizationRepository: {
        async listPlatform({ exclusiveStartKey }) {
          calls.push(exclusiveStartKey ?? null);

          if (!exclusiveStartKey) {
            return {
              items: [makeOrganization()],
              lastEvaluatedKey: {
                GSI1PK: 'ORGS',
                GSI1SK: 'CREATED#cursor',
              },
            };
          }

          return {
            items: [
              makeOrganization({
                organizationId: 'org-2',
              }),
            ],
            lastEvaluatedKey: null,
          };
        },
      },
    }),
  );

  const organizations = await service.listOrganizations();

  assert.deepEqual(calls, [
    null,
    {
      GSI1PK: 'ORGS',
      GSI1SK: 'CREATED#cursor',
    },
  ]);
  assert.deepEqual(
    organizations.map((organization) => organization.organizationId),
    ['org-1', 'org-2'],
  );
});

test('inactive Organization is hidden from nested storefront routes', async () => {
  const service = createStorefrontService(
    baseDependencies({
      organizationRepository: {
        async getById() {
          return makeOrganization({
            status: ORGANIZATION_STATUS.SUSPENDED,
          });
        },
      },
    }),
  );

  await assert.rejects(
    service.listStores('org-1'),
    (error) =>
      error.code === 'ORGANIZATION_NOT_FOUND' &&
      error.httpStatus === 404,
  );
});

test('storefront lists only ACTIVE Stores and sanitizes internal fields', async () => {
  const service = createStorefrontService(
    baseDependencies({
      storeRepository: {
        async listByOrganization() {
          return [
            makeStore(),
            makeStore({
              storeId: 'store-inactive',
              status: STORE_STATUS.INACTIVE,
            }),
          ];
        },
      },
    }),
  );

  const stores = await service.listStores('org-1');

  assert.equal(stores.length, 1);
  assert.equal(stores[0].storeId, 'store-1');
  assert.equal('privateNote' in stores[0], false);
});

test('storefront rejects a Store returned from another tenant', async () => {
  const service = createStorefrontService(
    baseDependencies({
      storeRepository: {
        async getById() {
          return makeStore({
            organizationId: 'org-other',
          });
        },
      },
    }),
  );

  await assert.rejects(
    service.getStore('org-1', 'store-1'),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

test('storefront Product list includes only ACTIVE Products from the requested Store', async () => {
  const signed = [];
  const service = createStorefrontService(
    baseDependencies({
      productRepository: {
        async listProductsByStore() {
          return {
            items: [
              makeProduct(),
              makeProduct({
                productId: 'product-inactive',
                status: PRODUCT_STATUS.INACTIVE,
              }),
              makeProduct({
                productId: 'product-other-store',
                storeId: 'store-other',
              }),
            ],
            lastEvaluatedKey: null,
          };
        },
      },
      topLevel: {
        createProductImageUrl: async (input) => {
          signed.push(input);
          return 'https://signed.example/image';
        },
      },
    }),
  );

  const products = await service.listProducts(
    'org-1',
    'store-1',
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].productId, 'product-1');
  assert.equal(products[0].imageUrl, 'https://signed.example/image');
  assert.equal('imageKey' in products[0], false);
  assert.deepEqual(signed, [
    {
      organizationId: 'org-1',
      productId: 'product-1',
      imageKey: 'products/org-1/product-1/image-1',
    },
  ]);
});

test('storefront signs only the stored Product imageKey and ignores arbitrary client query keys', async () => {
  const signed = [];
  const storefrontService = createStorefrontService(
    baseDependencies({
      topLevel: {
        createProductImageUrl: async (input) => {
          signed.push(input);
          return 'https://signed.example/stored-image';
        },
      },
    }),
  );

  const response = await request(
    createApp({
      storefront: {
        storefrontService,
      },
    }),
  )
    .get(
      '/api/v1/storefront/organizations/org-1/stores/store-1/products/product-1?imageKey=payments/org-1/order-1/forged',
    )
    .expect(200);

  assert.equal(
    response.body.data.imageUrl,
    'https://signed.example/stored-image',
  );
  assert.equal('imageKey' in response.body.data, false);
  assert.deepEqual(signed, [
    {
      organizationId: 'org-1',
      productId: 'product-1',
      imageKey: 'products/org-1/product-1/image-1',
    },
  ]);
});

test('storefront Product detail returns only ACTIVE Variants and no private storage fields', async () => {
  const service = createStorefrontService(
    baseDependencies({
      productRepository: {
        async listVariants() {
          return [
            {
              ...makeVariant(),
              PK: 'ORG#org-1',
              SK: 'PRODUCT#product-1#VARIANT#variant-1',
            },
            makeVariant({
              variantId: 'variant-inactive',
              status: VARIANT_STATUS.INACTIVE,
            }),
            makeVariant({
              variantId: 'variant-other-product',
              productId: 'product-other',
            }),
          ];
        },
      },
    }),
  );

  const product = await service.getProduct(
    'org-1',
    'store-1',
    'product-1',
  );

  assert.equal(product.variants.length, 1);
  assert.equal(product.variants[0].variantId, 'variant-1');

  const serialized = JSON.stringify(product);
  assert.equal(serialized.includes('imageKey'), false);
  assert.equal(serialized.includes('"PK"'), false);
  assert.equal(serialized.includes('"SK"'), false);
  assert.equal(serialized.includes('internalSecret'), false);
  assert.equal(serialized.includes('paymentSecret'), false);
});

test('inactive or cross-store Product is not visible by storefront detail', async () => {
  for (const product of [
    makeProduct({
      status: PRODUCT_STATUS.INACTIVE,
    }),
    makeProduct({
      storeId: 'store-other',
    }),
  ]) {
    const service = createStorefrontService(
      baseDependencies({
        productRepository: {
          async getProduct() {
            return product;
          },
        },
      }),
    );

    await assert.rejects(
      service.getProduct(
        'org-1',
        'store-1',
        'product-1',
      ),
      (error) =>
        error.code === 'PRODUCT_NOT_FOUND' &&
        error.httpStatus === 404,
    );
  }
});

test('storefront Campaign list exposes only OPEN same-store campaigns', async () => {
  const service = createStorefrontService(
    baseDependencies({
      campaignRepository: {
        async listByStorePage() {
          return {
            items: [
              makeCampaign(),
              makeCampaign({
                campaignId: 'campaign-draft',
                status: CAMPAIGN_STATUS.DRAFT,
              }),
              makeCampaign({
                campaignId: 'campaign-closed',
                status: CAMPAIGN_STATUS.CLOSED,
              }),
              makeCampaign({
                campaignId: 'campaign-other-store',
                storeId: 'store-other',
              }),
            ],
            lastEvaluatedKey: null,
          };
        },
      },
    }),
  );

  const campaigns = await service.listCampaigns(
    'org-1',
    'store-1',
  );

  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].campaignId, 'campaign-1');
  assert.equal(campaigns[0].status, CAMPAIGN_STATUS.OPEN);
  assert.equal('auditMetadata' in campaigns[0], false);
});

test('storefront Campaign detail rejects non-OPEN or wrong-store campaigns', async () => {
  for (const campaign of [
    makeCampaign({
      status: CAMPAIGN_STATUS.CLOSED,
    }),
    makeCampaign({
      storeId: 'store-other',
    }),
  ]) {
    const service = createStorefrontService(
      baseDependencies({
        campaignRepository: {
          async getById() {
            return campaign;
          },
        },
      }),
    );

    await assert.rejects(
      service.getCampaign(
        'org-1',
        'store-1',
        'campaign-1',
      ),
      (error) =>
        error.code === 'CAMPAIGN_NOT_FOUND' &&
        error.httpStatus === 404,
    );
  }
});

test('public storefront routes do not require Bearer authentication', async () => {
  const storefrontService = {
    async listOrganizations() {
      return [
        {
          organizationId: 'org-1',
          name: 'IT Club',
          description: 'Student organization',
          status: ORGANIZATION_STATUS.ACTIVE,
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
        },
      ];
    },
  };

  const response = await request(
    createApp({
      storefront: {
        storefrontService,
      },
    }),
  )
    .get('/api/v1/storefront/organizations')
    .expect(200);

  assert.deepEqual(response.body, {
    success: true,
    data: {
      items: [
        {
          organizationId: 'org-1',
          name: 'IT Club',
          description: 'Student organization',
          status: ORGANIZATION_STATUS.ACTIVE,
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
        },
      ],
      nextCursor: null,
    },
  });
});

test('storefront response cannot leak member, payment, audit or private-file fields from source records', async () => {
  const service = createStorefrontService(
    baseDependencies({
      productRepository: {
        async getProduct() {
          return {
            ...makeProduct(),
            member: {
              userId: 'private-member',
            },
            payment: {
              slipKey: 'payments/org-1/order-1/private',
            },
            audit: {
              actorId: 'private-actor',
            },
            privateFileKey:
              'payments/org-1/order-1/private',
          };
        },
        async listVariants() {
          return [];
        },
      },
    }),
  );

  const product = await service.getProduct(
    'org-1',
    'store-1',
    'product-1',
  );
  const serialized = JSON.stringify(product);

  for (const privateField of [
    'member',
    'payment',
    'slipKey',
    'audit',
    'actorId',
    'privateFileKey',
    'imageKey',
  ]) {
    assert.equal(
      serialized.includes(privateField),
      false,
      `must not expose ${privateField}`,
    );
  }
});
