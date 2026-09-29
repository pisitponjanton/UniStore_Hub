import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertIsoUtcTimestamp, assertUuidV4 } from '../helpers/assertions.mjs';

const requireFromHere = createRequire(import.meta.url);
const { createId } = requireFromHere('../../backend/src/utils/id.js');
const { nowIsoUtc, isIsoUtcTimestamp } = requireFromHere('../../backend/src/utils/time.js');
const keys = requireFromHere('../../backend/src/repositories/keys.js');
const { ORGANIZATION_ROLE, MEMBERSHIP_STATUS } = requireFromHere(
  '../../backend/src/modules/members/member.constants.js',
);

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const storeId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
const variantId = '55555555-5555-4555-8555-555555555555';
const campaignId = '66666666-6666-4666-8666-666666666666';
const orderId = '77777777-7777-4777-8777-777777777777';
const orderItemId = '88888888-8888-4888-8888-888888888888';
const paymentId = '99999999-9999-4999-8999-999999999999';
const pickupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const auditId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const notificationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const createdAt = '2026-09-29T07:30:00.000Z';

test('DATA-001 generated entity IDs are UUID v4', () => {
  const id = createId();
  assertUuidV4(id, 'createId()');
});

test('DATA-002 persisted timestamp utility emits canonical ISO 8601 UTC with milliseconds', () => {
  const timestamp = nowIsoUtc();
  assertIsoUtcTimestamp(timestamp, 'nowIsoUtc()');
  assert.equal(isIsoUtcTimestamp(timestamp), true);
  assert.equal(isIsoUtcTimestamp('2026-09-29T07:30:00Z'), false);
});

test('DATA-003 organization membership roles remain STAFF and ORGANIZATION_ADMIN', () => {
  assert.deepEqual(
    [...Object.values(ORGANIZATION_ROLE)].sort(),
    ['ORGANIZATION_ADMIN', 'STAFF'],
  );
  assert.deepEqual(
    [...Object.values(MEMBERSHIP_STATUS)].sort(),
    ['ACTIVE', 'INACTIVE'],
  );
});

test('DATA-004 core PK/SK key builders match the single-table contract', () => {
  assert.deepEqual(keys.userProfileKey(userId), {
    PK: `USER#${userId}`,
    SK: 'PROFILE',
  });
  assert.deepEqual(keys.organizationProfileKey(organizationId), {
    PK: `ORG#${organizationId}`,
    SK: 'PROFILE',
  });
  assert.deepEqual(keys.organizationMemberKey(organizationId, userId), {
    PK: `ORG#${organizationId}`,
    SK: `MEMBER#${userId}`,
  });
  assert.deepEqual(keys.storeKey(organizationId, storeId), {
    PK: `ORG#${organizationId}`,
    SK: `STORE#${storeId}`,
  });
  assert.deepEqual(keys.productKey(organizationId, productId), {
    PK: `ORG#${organizationId}`,
    SK: `PRODUCT#${productId}`,
  });
  assert.deepEqual(keys.productVariantKey(organizationId, productId, variantId), {
    PK: `ORG#${organizationId}`,
    SK: `PRODUCT#${productId}#VARIANT#${variantId}`,
  });
  assert.deepEqual(keys.campaignKey(organizationId, campaignId), {
    PK: `ORG#${organizationId}`,
    SK: `CAMPAIGN#${campaignId}`,
  });
  assert.deepEqual(keys.orderKey(organizationId, orderId), {
    PK: `ORG#${organizationId}`,
    SK: `ORDER#${orderId}`,
  });
});

test('DATA-005 GSI1 builders use tenant/user-qualified lookup prefixes', () => {
  assert.deepEqual(keys.userEmailIndex('student@example.test', userId), {
    GSI1PK: 'EMAIL#student@example.test',
    GSI1SK: `USER#${userId}`,
  });
  assert.deepEqual(keys.membershipUserIndex(userId, organizationId), {
    GSI1PK: `USER#${userId}`,
    GSI1SK: `ORG#${organizationId}`,
  });
  assert.deepEqual(keys.productStoreIndex(organizationId, storeId, productId), {
    GSI1PK: `ORG#${organizationId}#STORE#${storeId}`,
    GSI1SK: `PRODUCT#${productId}`,
  });
  assert.deepEqual(
    keys.campaignStoreIndex(organizationId, storeId, createdAt, campaignId),
    {
      GSI1PK: `ORG#${organizationId}#STORE#${storeId}`,
      GSI1SK: `CAMPAIGN#${createdAt}#${campaignId}`,
    },
  );
  assert.deepEqual(keys.customerOrderIndex(userId, createdAt, orderId), {
    GSI1PK: `USER#${userId}`,
    GSI1SK: `ORDER#${createdAt}#${orderId}`,
  });
  assert.deepEqual(
    keys.paymentReviewIndex(organizationId, 'PENDING_REVIEW', createdAt, paymentId),
    {
      GSI1PK: `ORG#${organizationId}`,
      GSI1SK: `PAYMENT#PENDING_REVIEW#${createdAt}#${paymentId}`,
    },
  );
});

test('DATA-006 CampaignOrderLink key supports campaign order listing without Scan', () => {
  assert.deepEqual(
    keys.campaignOrderLinkKey(organizationId, campaignId, createdAt, orderId),
    {
      PK: `ORG#${organizationId}`,
      SK: `CAMPAIGN#${campaignId}#ORDER#${createdAt}#${orderId}`,
    },
  );
});

test('DATA-007 OrderItem, Payment, and Pickup child keys carry organizationId in the partition', () => {
  const partition = `ORG#${organizationId}#ORDER#${orderId}`;

  assert.equal(keys.orderChildPartition(organizationId, orderId), partition);
  assert.deepEqual(keys.orderItemKey(organizationId, orderId, orderItemId), {
    PK: partition,
    SK: `ITEM#${orderItemId}`,
  });
  assert.deepEqual(keys.paymentKey(organizationId, orderId, paymentId), {
    PK: partition,
    SK: `PAYMENT#${paymentId}`,
  });
  assert.deepEqual(keys.pickupKey(organizationId, orderId), {
    PK: partition,
    SK: 'PICKUP',
  });
});

test('DATA-008 Pickup lookup remains tenant-qualified', () => {
  assert.deepEqual(keys.pickupLinkKey(organizationId, pickupId), {
    PK: `ORG#${organizationId}`,
    SK: `PICKUP#${pickupId}`,
  });
  assert.deepEqual(
    keys.pickupTokenIndex(organizationId, 'PICKUP-TOKEN', pickupId, orderId),
    {
      GSI1PK: `ORG#${organizationId}#PICKUP_TOKEN#PICKUP-TOKEN`,
      GSI1SK: `PICKUP#${pickupId}#ORDER#${orderId}`,
    },
  );
});

test('DATA-009 Audit and Notification keys match their required namespaces', () => {
  assert.deepEqual(keys.auditKey(organizationId, createdAt, auditId), {
    PK: `ORG#${organizationId}`,
    SK: `AUDIT#${createdAt}#${auditId}`,
  });
  assert.deepEqual(keys.notificationKey(userId, createdAt, notificationId), {
    PK: `USER#${userId}`,
    SK: `NOTIFICATION#${createdAt}#${notificationId}`,
  });
});

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

test('DATA-010 normal backend request-path source does not depend on DynamoDB Scan', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const backendSrc = path.resolve(here, '../../backend/src');
  const files = await collectJavaScriptFiles(backendSrc);

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\bScanCommand\b/, `ScanCommand found in ${file}`);
    assert.doesNotMatch(source, /\.scan\s*\(/, `.scan() found in ${file}`);
  }
});

test(
  'DATA-011 Order/OrderItem monetary fields are persisted as integer satang and snapshots remain immutable',
  { todo: 'BLOCKED: requires implemented Order repository/service and persisted Order/OrderItem fixtures' },
  () => {},
);

test(
  'DATA-012 all Organization-owned persisted entities include explicit organizationId',
  { todo: 'BLOCKED: Store/Product/Campaign/Order/Payment/Pickup/Audit repositories are not fully implemented yet' },
  () => {},
);

test(
  'DATA-013 CampaignOrderLink item includes organizationId/campaignId/orderId/customerId/status and tracks status transactionally',
  { todo: 'BLOCKED: requires implemented Order lifecycle persistence and CampaignOrderLink transaction writes' },
  () => {},
);

test(
  'DATA-014 Worker-created Notification uses notificationId=eventId and createdAt=occurredAt with conditional put idempotency',
  { todo: 'BLOCKED: Notification Worker persistence is not implemented yet' },
  () => {},
);

test(
  'DATA-015 Payment and Pickup status persistence uses canonical enums',
  { todo: 'BLOCKED: Payment and Pickup persistence modules are not implemented yet' },
  () => {},
);
