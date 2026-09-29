import test from 'node:test';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const fixture = createFixtureFactory({ seed: 'CT-PAYMENT-REVIEW' });
const organizationId = fixture.id('organization', 1);
const paymentId = fixture.id('payment', 1);
const campaignId = fixture.id('campaign', 1);
const orderId = fixture.id('order', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-PAYMENT-REVIEW-001 GET payment list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/payments?status=PENDING_REVIEW&campaignId=${campaignId}&orderId=${orderId}`,
    });

    assertAuthRequired(result);
  });
});

test('CT-PAYMENT-REVIEW-002 GET payment detail requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/payments/${paymentId}`,
    });

    assertAuthRequired(result);
  });
});

test('CT-PAYMENT-REVIEW-003 approve action requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`,
      method: 'POST',
    });

    assertAuthRequired(result);
  });
});

test('CT-PAYMENT-REVIEW-004 reject action requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/payments/${paymentId}/reject`,
      method: 'POST',
      body: {
        reason: 'Slip amount does not match order',
      },
    });

    assertAuthRequired(result);
  });
});

test(
  'CT-PAYMENT-REVIEW-005 Staff and Organization Admin can list/get Payments only inside their active Organization',
  { todo: 'Requires authenticated STAFF/ORGANIZATION_ADMIN fixtures in two tenants plus persisted Payments' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-006 Customer cannot review or use tenant Payment-review endpoints',
  { todo: 'Requires authenticated Customer fixture and pending Payment' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-007 approving a Payment while Campaign is OPEN sets Payment APPROVED and Order PAID',
  { todo: 'Requires OPEN Campaign plus PAYMENT_REVIEW Order/PENDING_REVIEW Payment fixture' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-008 approving a Payment while Campaign is CLOSED sets Payment APPROVED and Order CONFIRMED',
  { todo: 'Requires CLOSED Campaign plus PAYMENT_REVIEW Order/PENDING_REVIEW Payment fixture' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-009 approval records reviewedBy/reviewedAt, updates CampaignOrderLink, creates Audit, and publishes PAYMENT_APPROVED',
  { todo: 'Requires Payment review transaction plus Audit/CampaignOrderLink/event fixtures' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-010 approval while Campaign is PRODUCING or later returns PAYMENT_NOT_REVIEWABLE without state change',
  { todo: 'Requires Campaign fixtures across PRODUCING/READY_FOR_PICKUP/COMPLETED plus pending Payment' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-011 rejecting a Payment requires a non-empty reason',
  { todo: 'Requires authenticated tenant reviewer and PENDING_REVIEW Payment fixture' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-012 reject sets Payment REJECTED, Order PAYMENT_REJECTED, rejectReason, reviewedBy, and reviewedAt',
  { todo: 'Requires authenticated tenant reviewer and PENDING_REVIEW Payment fixture' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-013 reject creates Audit and publishes PAYMENT_REJECTED event',
  { todo: 'Requires Payment rejection transaction plus Audit/event observation fixtures' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-014 reviewer cannot approve a Payment outside their Organization tenant',
  { todo: 'Requires two-tenant STAFF/ORGANIZATION_ADMIN fixtures and cross-tenant Payment' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-015 reviewer cannot reject a Payment outside their Organization tenant',
  { todo: 'Requires two-tenant STAFF/ORGANIZATION_ADMIN fixtures and cross-tenant Payment' },
  () => {},
);

test(
  'CT-PAYMENT-REVIEW-016 Staff cannot access an unauthorized tenant payment slip through Payment review flow',
  { todo: 'Requires two-tenant reviewer fixtures, private slipKey, and file authorization implementation' },
  () => {},
);
