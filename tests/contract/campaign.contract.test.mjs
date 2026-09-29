import test from 'node:test';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const fixture = createFixtureFactory({ seed: 'CT-CAMPAIGN' });
const organizationId = fixture.id('organization', 1);
const storeId = fixture.id('store', 1);
const campaignId = fixture.id('campaign', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-CAMPAIGN-001 GET campaign list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/campaigns?storeId=${storeId}&status=DRAFT`,
    });
    assertAuthRequired(result);
  });
});

test('CT-CAMPAIGN-002 POST campaign requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/campaigns`,
      method: 'POST',
      body: {
        storeId,
        name: 'Faculty Shirt Pre-order',
        openAt: '2026-10-01T00:00:00.000Z',
        closeAt: '2026-10-10T23:59:59.000Z',
        paymentDeadline: '2026-10-11T23:59:59.000Z',
        pickupAt: '2026-10-25T09:00:00.000Z',
      },
    });
    assertAuthRequired(result);
  });
});

test('CT-CAMPAIGN-003 GET campaign detail requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/campaigns/${campaignId}`,
    });
    assertAuthRequired(result);
  });
});

test('CT-CAMPAIGN-004 PATCH draft campaign requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/campaigns/${campaignId}`,
      method: 'PATCH',
      body: {
        name: 'Updated Campaign',
      },
    });
    assertAuthRequired(result);
  });
});

for (const [id, action] of [
  ['CT-CAMPAIGN-005', 'open'],
  ['CT-CAMPAIGN-006', 'close'],
  ['CT-CAMPAIGN-007', 'start-production'],
  ['CT-CAMPAIGN-008', 'ready-for-pickup'],
  ['CT-CAMPAIGN-009', 'complete'],
  ['CT-CAMPAIGN-010', 'cancel'],
]) {
  test(`${id} POST campaign action ${action} requires bearer authentication`, async () => {
    await againstBackend(async (baseUrl) => {
      const result = await requestJson({
        baseUrl,
        path: `/api/v1/organizations/${organizationId}/campaigns/${campaignId}/${action}`,
        method: 'POST',
      });
      assertAuthRequired(result);
    });
  });
}

test(
  'CT-CAMPAIGN-011 create Campaign starts in DRAFT and timestamps do not auto-advance status',
  { todo: 'Requires authenticated Organization Admin plus persisted Store/Campaign fixture and controllable time' },
  () => {},
);

test(
  'CT-CAMPAIGN-012 canonical happy path is DRAFT -> OPEN -> CLOSED -> PRODUCING -> READY_FOR_PICKUP -> COMPLETED',
  { todo: 'Requires persisted Campaign fixture and implemented lifecycle actions' },
  () => {},
);

test(
  'CT-CAMPAIGN-013 OPEN -> PRODUCING is rejected with INVALID_STATUS_TRANSITION',
  { todo: 'Requires persisted OPEN Campaign fixture and implemented lifecycle validation' },
  () => {},
);

test(
  'CT-CAMPAIGN-014 start-production while any Order is PAYMENT_REVIEW returns PAYMENT_NOT_REVIEWABLE',
  { todo: 'Requires Campaign plus Order/Payment review fixtures' },
  () => {},
);

test(
  'CT-CAMPAIGN-015 DRAFT -> CANCELLED succeeds',
  { todo: 'Requires persisted DRAFT Campaign fixture' },
  () => {},
);

test(
  'CT-CAMPAIGN-016 OPEN/CLOSED cancellation succeeds only with no PAYMENT_REVIEW or paid-or-later Orders',
  { todo: 'Requires Campaign and mixed Order lifecycle fixtures' },
  () => {},
);

test(
  'CT-CAMPAIGN-017 PRODUCING and later Campaigns cannot cancel',
  { todo: 'Requires persisted PRODUCING/READY_FOR_PICKUP/COMPLETED fixtures' },
  () => {},
);

test(
  'CT-CAMPAIGN-018 successful cancellation converts PENDING_PAYMENT and PAYMENT_REJECTED Orders to CANCELLED',
  { todo: 'Requires Campaign plus unpaid/rejected Order fixtures and transactional cancellation implementation' },
  () => {},
);

test(
  'CT-CAMPAIGN-019 CLOSED can finish payment review, but PRODUCING and later reject payment submission/resubmission/approval',
  { todo: 'Requires Campaign/Order/Payment fixtures across CLOSED and PRODUCING states' },
  () => {},
);
