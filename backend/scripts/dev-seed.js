'use strict';

const bcrypt = require('bcryptjs');

const { config } = require('../src/config');
const {
  createDynamoRepository,
} = require('../src/aws/dynamodb');
const {
  USER_STATUS,
} = require('../src/modules/auth/auth.constants');
const {
  CAMPAIGN_STATUS,
} = require('../src/modules/campaigns/campaign.constants');
const {
  MEMBERSHIP_STATUS,
  ORGANIZATION_ROLE,
} = require('../src/modules/members/member.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  PLATFORM_ROLE,
} = require('../src/modules/platform-admin/platform-admin.constants');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('../src/modules/products/product.constants');
const {
  STORE_STATUS,
} = require('../src/modules/stores/store.constants');
const {
  campaignKey,
  campaignStoreIndex,
  membershipUserIndex,
  organizationMemberKey,
  organizationPlatformIndex,
  organizationProfileKey,
  platformUserLinkKey,
  productKey,
  productStoreIndex,
  productVariantKey,
  storeKey,
  userEmailIndex,
  userProfileKey,
} = require('../src/repositories/keys');

const DEV_SEED_PASSWORD =
  'unistore-local-demo-only';
const DEV_SEED_BCRYPT_SALT =
  '$2b$12$abcdefghijklmnopqrstuu';

const DEV_SEED = Object.freeze({
  timestamp: '2026-01-01T00:00:00.000Z',
  users: Object.freeze({
    platformAdmin: Object.freeze({
      userId:
        '11111111-1111-4111-8111-111111111111',
      email:
        'platform-admin@local.unistore.test',
      name: 'Local Platform Admin',
      platformRole:
        PLATFORM_ROLE.PLATFORM_ADMIN,
    }),
    customer: Object.freeze({
      userId:
        '22222222-2222-4222-8222-222222222222',
      email:
        'customer@local.unistore.test',
      name: 'Local Customer',
      platformRole: null,
    }),
    organizationAdmin: Object.freeze({
      userId:
        '33333333-3333-4333-8333-333333333333',
      email:
        'org-admin@local.unistore.test',
      name: 'Local Organization Admin',
      platformRole: null,
    }),
    staff: Object.freeze({
      userId:
        '44444444-4444-4444-8444-444444444444',
      email:
        'staff@local.unistore.test',
      name: 'Local Staff',
      platformRole: null,
    }),
  }),
  organizationId:
    '55555555-5555-4555-8555-555555555555',
  storeId:
    '66666666-6666-4666-8666-666666666666',
  productId:
    '77777777-7777-4777-8777-777777777777',
  variantId:
    '88888888-8888-4888-8888-888888888888',
  campaignId:
    '99999999-9999-4999-8999-999999999999',
});

const LOCAL_ENDPOINT_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'localstack',
]);

function assertDevSeedConfig(
  seedConfig = config,
) {
  if (seedConfig.nodeEnv === 'production') {
    const error = new Error(
      'Dev seed cannot run with NODE_ENV=production',
    );
    error.code = 'DEV_SEED_FORBIDDEN';
    throw error;
  }

  if (!seedConfig.awsEndpointUrl) {
    const error = new Error(
      'AWS_ENDPOINT_URL is required for the Dev seed',
    );
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  let endpoint;

  try {
    endpoint = new URL(
      seedConfig.awsEndpointUrl,
    );
  } catch {
    const error = new Error(
      'AWS_ENDPOINT_URL must be a valid LocalStack URL',
    );
    error.code = 'CONFIG_INVALID';
    throw error;
  }

  if (
    !LOCAL_ENDPOINT_HOSTS.has(
      endpoint.hostname,
    )
  ) {
    const error = new Error(
      'Dev seed requires a localhost or LocalStack AWS endpoint',
    );
    error.code = 'DEV_SEED_FORBIDDEN';
    throw error;
  }

  if (!seedConfig.appTableName) {
    const error = new Error(
      'APP_TABLE_NAME is required for the Dev seed',
    );
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return seedConfig;
}

async function buildDevSeedItems() {
  const createdAt = DEV_SEED.timestamp;
  const passwordHash = await bcrypt.hash(
    DEV_SEED_PASSWORD,
    DEV_SEED_BCRYPT_SALT,
  );
  const userItems = [];

  for (const user of Object.values(
    DEV_SEED.users,
  )) {
    userItems.push({
      ...userProfileKey(user.userId),
      ...userEmailIndex(
        user.email,
        user.userId,
      ),
      entityType: 'User',
      userId: user.userId,
      email: user.email,
      passwordHash,
      name: user.name,
      status: USER_STATUS.ACTIVE,
      platformRole: user.platformRole,
      createdAt,
      updatedAt: createdAt,
    });

    userItems.push({
      ...platformUserLinkKey(
        createdAt,
        user.userId,
      ),
      entityType: 'PlatformUserLink',
      userId: user.userId,
      status: USER_STATUS.ACTIVE,
      createdAt,
    });
  }

  const organizationAdmin =
    DEV_SEED.users.organizationAdmin;
  const staff = DEV_SEED.users.staff;

  const organization = {
    ...organizationProfileKey(
      DEV_SEED.organizationId,
    ),
    ...organizationPlatformIndex(
      createdAt,
      DEV_SEED.organizationId,
    ),
    entityType: 'Organization',
    organizationId:
      DEV_SEED.organizationId,
    name: 'UniStore Local Demo',
    description:
      'Deterministic local/demo organization',
    status: ORGANIZATION_STATUS.ACTIVE,
    createdBy:
      organizationAdmin.userId,
    createdAt,
    updatedAt: createdAt,
  };

  const memberships = [
    {
      ...organizationMemberKey(
        DEV_SEED.organizationId,
        organizationAdmin.userId,
      ),
      ...membershipUserIndex(
        organizationAdmin.userId,
        DEV_SEED.organizationId,
      ),
      entityType: 'OrganizationMember',
      organizationId:
        DEV_SEED.organizationId,
      userId:
        organizationAdmin.userId,
      role:
        ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      status: MEMBERSHIP_STATUS.ACTIVE,
      createdAt,
      updatedAt: createdAt,
    },
    {
      ...organizationMemberKey(
        DEV_SEED.organizationId,
        staff.userId,
      ),
      ...membershipUserIndex(
        staff.userId,
        DEV_SEED.organizationId,
      ),
      entityType: 'OrganizationMember',
      organizationId:
        DEV_SEED.organizationId,
      userId: staff.userId,
      role: ORGANIZATION_ROLE.STAFF,
      status: MEMBERSHIP_STATUS.ACTIVE,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const store = {
    ...storeKey(
      DEV_SEED.organizationId,
      DEV_SEED.storeId,
    ),
    entityType: 'Store',
    storeId: DEV_SEED.storeId,
    organizationId:
      DEV_SEED.organizationId,
    name: 'Local Demo Store',
    description:
      'Store for local development and E2E',
    status: STORE_STATUS.ACTIVE,
    createdAt,
    updatedAt: createdAt,
  };

  const product = {
    ...productKey(
      DEV_SEED.organizationId,
      DEV_SEED.productId,
    ),
    ...productStoreIndex(
      DEV_SEED.organizationId,
      DEV_SEED.storeId,
      DEV_SEED.productId,
    ),
    entityType: 'Product',
    productId: DEV_SEED.productId,
    organizationId:
      DEV_SEED.organizationId,
    storeId: DEV_SEED.storeId,
    name: 'Local Demo Product',
    description:
      'Product for local development and E2E',
    imageKey: null,
    status: PRODUCT_STATUS.ACTIVE,
    createdAt,
    updatedAt: createdAt,
  };

  const variant = {
    ...productVariantKey(
      DEV_SEED.organizationId,
      DEV_SEED.productId,
      DEV_SEED.variantId,
    ),
    entityType: 'ProductVariant',
    variantId: DEV_SEED.variantId,
    organizationId:
      DEV_SEED.organizationId,
    productId: DEV_SEED.productId,
    name: 'Default',
    price: 19900,
    status: VARIANT_STATUS.ACTIVE,
    createdAt,
    updatedAt: createdAt,
  };

  const campaign = {
    ...campaignKey(
      DEV_SEED.organizationId,
      DEV_SEED.campaignId,
    ),
    ...campaignStoreIndex(
      DEV_SEED.organizationId,
      DEV_SEED.storeId,
      createdAt,
      DEV_SEED.campaignId,
    ),
    entityType: 'Campaign',
    campaignId: DEV_SEED.campaignId,
    organizationId:
      DEV_SEED.organizationId,
    storeId: DEV_SEED.storeId,
    name: 'Local Demo Campaign',
    openAt: '2026-01-01T00:00:00.000Z',
    closeAt: '2030-12-31T23:59:59.000Z',
    paymentDeadline:
      '2031-01-02T23:59:59.000Z',
    pickupAt:
      '2031-01-05T09:00:00.000Z',
    status: CAMPAIGN_STATUS.OPEN,
    createdAt,
    updatedAt: createdAt,
  };

  return [
    ...userItems,
    organization,
    ...memberships,
    store,
    product,
    variant,
    campaign,
  ];
}

function createDevSeeder(options = {}) {
  const repository =
    options.repository ||
    createDynamoRepository(
      options.repositoryOptions,
    );

  return {
    async seed() {
      const items =
        await buildDevSeedItems();

      await repository.transactWrite({
        TransactItems: items.map(
          (item) => ({
            Put: {
              Item: item,
            },
          }),
        ),
      });

      return {
        itemCount: items.length,
        organizationId:
          DEV_SEED.organizationId,
        storeId: DEV_SEED.storeId,
        productId: DEV_SEED.productId,
        variantId: DEV_SEED.variantId,
        campaignId: DEV_SEED.campaignId,
        users: Object.fromEntries(
          Object.entries(
            DEV_SEED.users,
          ).map(([name, user]) => [
            name,
            {
              userId: user.userId,
              email: user.email,
            },
          ]),
        ),
      };
    },
  };
}

async function main() {
  assertDevSeedConfig();

  const result =
    await createDevSeeder().seed();

  process.stdout.write(
    `${JSON.stringify({
      seeded: true,
      itemCount: result.itemCount,
      organizationId:
        result.organizationId,
      campaignId: result.campaignId,
      users: result.users,
    })}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `dev-seed failed: ${error.code || error.name || 'ERROR'}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = {
  DEV_SEED,
  DEV_SEED_PASSWORD,
  DEV_SEED_BCRYPT_SALT,
  LOCAL_ENDPOINT_HOSTS,
  assertDevSeedConfig,
  buildDevSeedItems,
  createDevSeeder,
  main,
};
