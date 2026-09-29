import { createHash } from 'node:crypto';

const DEFAULT_BASE_TIME = '2026-09-29T00:00:00.000Z';
const TEST_PASSWORD = 'TestOnly!234';

function safeSeed(seed) {
  const normalized = String(seed).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '') || 'fixture';
}

function uuidFromSeed(input) {
  const bytes = createHash('sha256').update(String(input)).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export function createFixtureFactory({
  seed = process.env.TEST_FIXTURE_SEED ?? 'local',
  baseTime = DEFAULT_BASE_TIME,
} = {}) {
  const namespace = safeSeed(seed);
  const origin = new Date(baseTime);

  if (Number.isNaN(origin.getTime())) {
    throw new TypeError(`Invalid fixture baseTime: ${baseTime}`);
  }

  const id = (entity, index = 1) => uuidFromSeed(`${namespace}:${entity}:${index}`);

  const timestamp = (offsetSeconds = 0) =>
    new Date(origin.getTime() + Number(offsetSeconds) * 1000).toISOString();

  const user = (label = 'customer-a', index = 1, overrides = {}) => ({
    userId: id('user', index),
    email: `${namespace}.${safeSeed(label)}.${index}@example.test`,
    name: `Test ${label}`,
    password: TEST_PASSWORD,
    status: 'ACTIVE',
    createdAt: timestamp(index),
    updatedAt: timestamp(index),
    ...overrides,
  });

  const organization = (label = 'org-a', index = 1, overrides = {}) => ({
    organizationId: id('organization', index),
    name: `Test ${label}`,
    status: 'APPROVED',
    createdAt: timestamp(index),
    updatedAt: timestamp(index),
    ...overrides,
  });

  const store = (organizationId, label = 'store-a', index = 1, overrides = {}) => ({
    storeId: id('store', index),
    organizationId,
    name: `Test ${label}`,
    status: 'OPEN',
    createdAt: timestamp(index),
    updatedAt: timestamp(index),
    ...overrides,
  });

  return Object.freeze({
    seed: namespace,
    password: TEST_PASSWORD,
    id,
    timestamp,
    user,
    organization,
    store,
  });
}

export function createTwoTenantFixture(options = {}) {
  const f = createFixtureFactory(options);
  const organizationA = f.organization('org-a', 1);
  const organizationB = f.organization('org-b', 2);

  return {
    factory: f,
    organizationA,
    organizationB,
    customerA: f.user('customer-a', 1),
    customerB: f.user('customer-b', 2),
    staffA: f.user('staff-a', 3),
    staffB: f.user('staff-b', 4),
    adminA: f.user('admin-a', 5),
    adminB: f.user('admin-b', 6),
    storeA: f.store(organizationA.organizationId, 'store-a', 1),
    storeB: f.store(organizationB.organizationId, 'store-b', 2),
  };
}

export const fixtureDefaults = Object.freeze({
  baseTime: DEFAULT_BASE_TIME,
  password: TEST_PASSWORD,
});
