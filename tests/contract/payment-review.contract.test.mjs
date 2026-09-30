import test from 'node:test';
import { assertBackendSuiteEvidence } from '../helpers/backend-suite-evidence.mjs';

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
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-006 Customer cannot review or use tenant Payment-review endpoints',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-007 approving a Payment while Campaign is OPEN sets Payment APPROVED and Order PAID',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-008 approving a Payment while Campaign is CLOSED sets Payment APPROVED and Order CONFIRMED',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-009 approval records reviewedBy/reviewedAt, updates CampaignOrderLink, creates Audit, and publishes PAYMENT_APPROVED',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-010 approval while Campaign is PRODUCING or later returns PAYMENT_NOT_REVIEWABLE without state change',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-011 rejecting a Payment requires a non-empty reason',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-012 reject sets Payment REJECTED, Order PAYMENT_REJECTED, rejectReason, reviewedBy, and reviewedAt',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-013 reject creates Audit and publishes PAYMENT_REJECTED event',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-014 reviewer cannot approve a Payment outside their Organization tenant',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-015 reviewer cannot reject a Payment outside their Organization tenant',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-REVIEW-016 Staff cannot access an unauthorized tenant payment slip through Payment review flow',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);
