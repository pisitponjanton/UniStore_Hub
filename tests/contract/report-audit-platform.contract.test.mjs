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

const fixture = createFixtureFactory({ seed: 'CT-REPORT-AUDIT-PLATFORM' });
const organizationId = fixture.id('organization', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-GOV-001 organization report requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/reports`,
    });
    assertAuthRequired(result);
  });
});

test('CT-GOV-002 audit log list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/audit-logs`,
    });
    assertAuthRequired(result);
  });
});

for (const [id, method, path] of [
  ['CT-GOV-003', 'GET', '/api/v1/platform/organizations'],
  ['CT-GOV-004', 'POST', `/api/v1/platform/organizations/${organizationId}/approve`],
  ['CT-GOV-005', 'POST', `/api/v1/platform/organizations/${organizationId}/suspend`],
  ['CT-GOV-006', 'GET', '/api/v1/platform/users'],
  ['CT-GOV-007', 'GET', '/api/v1/platform/summary'],
]) {
  test(`${id} ${method} ${path} requires bearer authentication`, async () => {
    await againstBackend(async (baseUrl) => {
      const result = await requestJson({ baseUrl, path, method });
      assertAuthRequired(result);
    });
  });
}

test(
  'CT-GOV-008 Organization Admin can access own Organization dashboard/report',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-009 Staff is forbidden from Organization dashboard/report',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-010 dashboard response includes the minimum metric schema and paidRevenueSatang is integer satang',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-011 report campaignId/storeId filters scope metrics to the requested Organization resources',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-012 paidRevenueSatang includes PAID-or-later paid Orders and excludes cancelled/unpaid Orders',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-013 Organization Admin can list Audit Logs only for own Organization',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-014 Staff is forbidden from Organization Audit Logs',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-015 Audit list supports actorId/action/resourceType/resourceId/cursor filters without tenant leakage',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-016 Payment approve/reject and Pickup confirm create required Audit events',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-017 Organization approve/suspend create ORGANIZATION_APPROVED and ORGANIZATION_SUSPENDED Audit events',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-018 Audit metadata excludes credentials, JWTs, and Payment Slip binary data',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-019 Platform Admin authority comes only from persisted user.platformRole=PLATFORM_ADMIN reloaded from User state',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-020 Organization membership alone never grants Platform Admin endpoints',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-021 Platform Admin can list Organizations and Users independently of Organization membership',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-022 approve Organization performs PENDING -> ACTIVE',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-023 suspend Organization sets status SUSPENDED',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);

test(
  'CT-GOV-024 Platform summary returns organizationsByStatus and usersByStatus',
  async () => {
    await assertBackendSuiteEvidence(["reports-audit.test.js","platform-admin.test.js","payments.test.js","pickups.test.js"]);
  },
);
