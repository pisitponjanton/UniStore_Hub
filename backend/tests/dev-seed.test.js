'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');

const {
  DEV_SEED,
  DEV_SEED_PASSWORD,
  assertDevSeedConfig,
  buildDevSeedItems,
  createDevSeeder,
} = require('../scripts/dev-seed');

function findEntity(items, type) {
  return items.find(
    (item) => item.entityType === type,
  );
}

function findUser(items, email) {
  return items.find(
    (item) =>
      item.entityType === 'User' &&
      item.email === email,
  );
}

test('dev seed config is local-only and refuses production or non-local AWS endpoints', () => {
  assert.throws(
    () =>
      assertDevSeedConfig({
        nodeEnv: 'production',
        awsEndpointUrl:
          'http://localhost:4566',
        appTableName:
          'unistore-hub-dev-local',
      }),
    (error) =>
      error.code ===
      'DEV_SEED_FORBIDDEN',
  );

  assert.throws(
    () =>
      assertDevSeedConfig({
        nodeEnv: 'development',
        awsEndpointUrl:
          'https://dynamodb.us-east-1.amazonaws.com',
        appTableName:
          'unistore-hub-dev-local',
      }),
    (error) =>
      error.code ===
      'DEV_SEED_FORBIDDEN',
  );

  assert.doesNotThrow(() =>
    assertDevSeedConfig({
      nodeEnv: 'development',
      awsEndpointUrl:
        'http://localhost:4566',
      appTableName:
        'unistore-hub-dev-local',
    }),
  );
});

test('dev seed builds deterministic canonical demo identities and roles', async () => {
  const first =
    await buildDevSeedItems();
  const second =
    await buildDevSeedItems();

  assert.deepEqual(second, first);
  assert.equal(first.length, 15);

  const platformAdmin = findUser(
    first,
    DEV_SEED.users.platformAdmin.email,
  );
  const customer = findUser(
    first,
    DEV_SEED.users.customer.email,
  );
  const organizationAdmin = findUser(
    first,
    DEV_SEED.users.organizationAdmin.email,
  );
  const staff = findUser(
    first,
    DEV_SEED.users.staff.email,
  );

  assert.equal(
    platformAdmin.platformRole,
    'PLATFORM_ADMIN',
  );
  assert.equal(customer.platformRole, null);
  assert.equal(
    organizationAdmin.platformRole,
    null,
  );
  assert.equal(staff.platformRole, null);

  for (const user of [
    platformAdmin,
    customer,
    organizationAdmin,
    staff,
  ]) {
    assert.equal(user.status, 'ACTIVE');
    assert.equal(
      await bcrypt.compare(
        DEV_SEED_PASSWORD,
        user.passwordHash,
      ),
      true,
    );
    assert.equal(
      user.GSI1PK,
      `EMAIL#${user.email}`,
    );
  }

  const platformLinks = first.filter(
    (item) =>
      item.entityType ===
      'PlatformUserLink',
  );
  assert.equal(platformLinks.length, 4);
  assert.ok(
    platformLinks.every(
      (item) =>
        item.PK === 'PLATFORM#USERS',
    ),
  );
});

test('dev seed contains one active tenant with canonical memberships, catalog and OPEN Campaign', async () => {
  const items =
    await buildDevSeedItems();

  const organization = findEntity(
    items,
    'Organization',
  );
  assert.equal(
    organization.organizationId,
    DEV_SEED.organizationId,
  );
  assert.equal(
    organization.status,
    'ACTIVE',
  );
  assert.equal(
    organization.GSI1PK,
    'ORGS',
  );

  const memberships = items.filter(
    (item) =>
      item.entityType ===
      'OrganizationMember',
  );
  assert.equal(memberships.length, 2);
  assert.deepEqual(
    memberships
      .map((item) => item.role)
      .sort(),
    ['ORGANIZATION_ADMIN', 'STAFF'],
  );
  assert.ok(
    memberships.every(
      (item) =>
        item.status === 'ACTIVE' &&
        item.organizationId ===
          DEV_SEED.organizationId,
    ),
  );

  const store = findEntity(
    items,
    'Store',
  );
  const product = findEntity(
    items,
    'Product',
  );
  const variant = findEntity(
    items,
    'ProductVariant',
  );
  const campaign = findEntity(
    items,
    'Campaign',
  );

  assert.equal(store.status, 'ACTIVE');
  assert.equal(product.status, 'ACTIVE');
  assert.equal(variant.status, 'ACTIVE');
  assert.equal(
    variant.price,
    19900,
  );
  assert.equal(campaign.status, 'OPEN');
  assert.equal(
    product.storeId,
    store.storeId,
  );
  assert.equal(
    campaign.storeId,
    store.storeId,
  );
  assert.equal(
    variant.productId,
    product.productId,
  );
});

test('dev seeder writes the whole deterministic dataset in one idempotent transaction shape', async () => {
  const writes = [];
  const seeder = createDevSeeder({
    repository: {
      async transactWrite(input) {
        writes.push(input);
      },
    },
  });

  const result = await seeder.seed();

  assert.equal(writes.length, 1);
  assert.equal(
    writes[0].TransactItems.length,
    15,
  );
  assert.ok(
    writes[0].TransactItems.every(
      (item) =>
        item.Put?.Item &&
        !item.Put.ConditionExpression,
    ),
  );
  assert.equal(result.itemCount, 15);
  assert.equal(
    result.organizationId,
    DEV_SEED.organizationId,
  );
  assert.equal(
    result.campaignId,
    DEV_SEED.campaignId,
  );
});

test('dev seed result exposes demo identities without password or passwordHash', async () => {
  const seeder = createDevSeeder({
    repository: {
      async transactWrite() {},
    },
  });

  const result = await seeder.seed();
  const serialized =
    JSON.stringify(result);

  assert.equal(
    serialized.includes(
      DEV_SEED_PASSWORD,
    ),
    false,
  );
  assert.equal(
    /passwordHash/i.test(serialized),
    false,
  );
  assert.equal(
    result.users.platformAdmin.email,
    DEV_SEED.users.platformAdmin.email,
  );
});
