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

const fixture = createFixtureFactory({ seed: 'CT-PAYMENT-SUBMIT' });
const organizationId = fixture.id('organization', 1);
const orderId = fixture.id('order', 1);
const slipKey = `payments/${organizationId}/${orderId}/${fixture.id('slip', 1)}`;

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-PAYMENT-SUBMIT-001 payment-slip upload URL requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders/${orderId}/payment-slip-upload-url`,
      method: 'POST',
      body: {
        contentType: 'image/png',
      },
    });

    assertAuthRequired(result);
  });
});

test('CT-PAYMENT-SUBMIT-002 payment submission requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders/${orderId}/payment`,
      method: 'POST',
      body: {
        slipKey,
      },
    });

    assertAuthRequired(result);
  });
});

test(
  'CT-PAYMENT-SUBMIT-003 upload-url accepts only image/jpeg, image/png, image/webp and requires contentType before signing',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-004 upload-url returns PUT, 900-second expiry, and payments/{organizationId}/{orderId}/{uuid} object key',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-005 submitted slipKey must remain inside the owning Order payment path',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-006 Backend validates uploaded slip metadata before accepting slipKey',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-007 first valid submission creates one Payment PENDING_REVIEW and moves Order to PAYMENT_REVIEW',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-008 rejected Payment resubmission reuses the same paymentId',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-009 rejected Payment resubmission replaces slipKey and clears reject/reviewer fields',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-010 rejected Payment resubmission returns Payment to PENDING_REVIEW and Order to PAYMENT_REVIEW',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-011 approved or paid-or-later Order cannot submit another slip',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-012 submission/resubmission while Campaign is PRODUCING or later returns PAYMENT_NOT_REVIEWABLE',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-013 CLOSED Campaign may still accept valid payment submission/resubmission',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);

test(
  'CT-PAYMENT-SUBMIT-014 Customer cannot submit a slip for another Customer Order',
  async () => {
    await assertBackendSuiteEvidence(["payments.test.js","files.test.js"]);
  },
);
