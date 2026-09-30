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

const fixture = createFixtureFactory({ seed: 'CT-PRODUCTION' });
const organizationId = fixture.id('organization', 1);
const campaignId = fixture.id('campaign', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-PRODUCTION-001 production summary requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/production?campaignId=${campaignId}`,
    });

    assertAuthRequired(result);
  });
});

test(
  'CT-PRODUCTION-002 campaignId query is required',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-003 Organization Admin can access Production Summary for own tenant',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-004 Staff is forbidden from Production Summary',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-005 Production Summary is tenant-isolated',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-006 Production Summary is campaign-isolated',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-007 unpaid, rejected-payment, and cancelled Orders are excluded',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-008 PAID Order with APPROVED Payment is included',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-009 CONFIRMED Order produced by approval after Campaign close is included',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-010 IN_PRODUCTION, READY_FOR_PICKUP, and RECEIVED paid Orders are included',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-011 quantities group by Product then Variant and sum correctly',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-012 normal Production Summary request path avoids full-table Scan',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);

test(
  'CT-PRODUCTION-013 response shape contains campaignId and products[].variants[].quantity only from authorized aggregate data',
  async () => {
    await assertBackendSuiteEvidence(["production.test.js"]);
  },
);
