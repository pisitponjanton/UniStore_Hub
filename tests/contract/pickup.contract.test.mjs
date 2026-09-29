import test from 'node:test';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const fixture = createFixtureFactory({ seed: 'CT-PICKUP' });
const organizationId = fixture.id('organization', 1);
const pickupId = fixture.id('pickup', 1);
const orderId = fixture.id('order', 1);
const campaignId = fixture.id('campaign', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-PICKUP-001 organization pickup list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/pickups?campaignId=${campaignId}&status=READY&orderId=${orderId}`,
    });

    assertAuthRequired(result);
  });
});

test('CT-PICKUP-002 organization pickup detail requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/pickups/${pickupId}`,
    });

    assertAuthRequired(result);
  });
});

test('CT-PICKUP-003 pickup confirm requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/pickups/${pickupId}/confirm`,
      method: 'POST',
    });

    assertAuthRequired(result);
  });
});

test('CT-PICKUP-004 customer own pickup endpoint requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/me/orders/${orderId}/pickup`,
    });

    assertAuthRequired(result);
  });
});

test(
  'CT-PICKUP-005 Customer can obtain own Pickup token when eligible without Organization membership',
  { todo: 'BLOCKED: requires authenticated Customer, READY_FOR_PICKUP owned Order, and Pickup creation flow' },
  () => {},
);

test(
  'CT-PICKUP-006 Pickup token is 128-bit cryptographically secure base64url encoded as 22 unpadded characters',
  { todo: 'BLOCKED: requires implemented production Pickup token generator to validate generated tokens' },
  () => {},
);

test(
  'CT-PICKUP-007 ready-for-pickup flow creates canonical Pickup and Organization-scoped PickupLink',
  { todo: 'BLOCKED: requires Campaign ready-for-pickup transition plus persisted Order/Pickup/PickupLink fixtures' },
  () => {},
);

test(
  'CT-PICKUP-008 Staff can list own-Organization Pickups through PickupLink query without table Scan',
  { todo: 'BLOCKED: requires Pickup repository/list implementation and authenticated STAFF fixture' },
  () => {},
);

test(
  'CT-PICKUP-009 Staff resolves pickupId through tenant-scoped PickupLink before loading canonical Pickup',
  { todo: 'BLOCKED: requires Pickup detail repository/service implementation and persisted PickupLink/Pickup pair' },
  () => {},
);

test(
  'CT-PICKUP-010 token lookup requires active organizationId and remains tenant-scoped',
  { todo: 'BLOCKED: requires token lookup implementation plus two-tenant Pickup fixtures' },
  () => {},
);

test(
  'CT-PICKUP-011 Staff from another Organization cannot get or confirm Pickup',
  { todo: 'BLOCKED: requires two-tenant STAFF memberships and a Pickup owned by the other Organization' },
  () => {},
);

test(
  'CT-PICKUP-012 confirm requires Order READY_FOR_PICKUP',
  { todo: 'BLOCKED: requires persisted Pickup plus Order fixtures in eligible and ineligible states' },
  () => {},
);

test(
  'CT-PICKUP-013 confirm atomically updates Pickup, PickupLink, and Order to RECEIVED',
  { todo: 'BLOCKED: requires implemented Pickup confirmation transaction and persisted READY fixture' },
  () => {},
);

test(
  'CT-PICKUP-014 confirm records receivedBy and canonical receivedAt',
  { todo: 'BLOCKED: requires authenticated Staff/Admin confirm flow and persisted Pickup fixture' },
  () => {},
);

test(
  'CT-PICKUP-015 confirm creates Pickup confirmation Audit entry',
  { todo: 'BLOCKED: requires implemented confirmation transaction plus Audit persistence' },
  () => {},
);

test(
  'CT-PICKUP-016 duplicate confirmation returns PICKUP_ALREADY_RECEIVED and does not mutate receipt metadata',
  { todo: 'BLOCKED: requires persisted RECEIVED Pickup/PickupLink/Order fixture and duplicate-confirm handling' },
  () => {},
);
