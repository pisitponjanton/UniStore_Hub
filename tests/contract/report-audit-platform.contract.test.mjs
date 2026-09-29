import test from 'node:test';

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
  { todo: 'BLOCKED: requires implemented reports module, authenticated Organization Admin, and disposable organization data' },
  () => {},
);

test(
  'CT-GOV-009 Staff is forbidden from Organization dashboard/report',
  { todo: 'BLOCKED: requires implemented reports route and authenticated STAFF membership' },
  () => {},
);

test(
  'CT-GOV-010 dashboard response includes the minimum metric schema and paidRevenueSatang is integer satang',
  { todo: 'BLOCKED: requires implemented report aggregation with disposable Store/Product/Campaign/Order/Payment data' },
  () => {},
);

test(
  'CT-GOV-011 report campaignId/storeId filters scope metrics to the requested Organization resources',
  { todo: 'BLOCKED: requires report implementation and multiple Store/Campaign fixtures in one Organization' },
  () => {},
);

test(
  'CT-GOV-012 paidRevenueSatang includes PAID-or-later paid Orders and excludes cancelled/unpaid Orders',
  { todo: 'BLOCKED: requires mixed paid/unpaid/cancelled Order fixtures and report aggregation' },
  () => {},
);

test(
  'CT-GOV-013 Organization Admin can list Audit Logs only for own Organization',
  { todo: 'BLOCKED: requires implemented audit list route plus two-tenant admin and Audit fixtures' },
  () => {},
);

test(
  'CT-GOV-014 Staff is forbidden from Organization Audit Logs',
  { todo: 'BLOCKED: requires implemented audit route and authenticated STAFF fixture' },
  () => {},
);

test(
  'CT-GOV-015 Audit list supports actorId/action/resourceType/resourceId/cursor filters without tenant leakage',
  { todo: 'BLOCKED: requires Audit repository/query implementation and filtered disposable Audit fixtures' },
  () => {},
);

test(
  'CT-GOV-016 Payment approve/reject and Pickup confirm create required Audit events',
  { todo: 'BLOCKED: requires implemented Payment/Pickup business transactions and Audit persistence' },
  () => {},
);

test(
  'CT-GOV-017 Organization approve/suspend create ORGANIZATION_APPROVED and ORGANIZATION_SUSPENDED Audit events',
  { todo: 'BLOCKED: requires implemented Platform Admin actions and Audit persistence' },
  () => {},
);

test(
  'CT-GOV-018 Audit metadata excludes credentials, JWTs, and Payment Slip binary data',
  { todo: 'BLOCKED: requires Audit write helpers and representative business events with observable persisted metadata' },
  () => {},
);

test(
  'CT-GOV-019 Platform Admin authority comes only from persisted user.platformRole=PLATFORM_ADMIN reloaded from User state',
  { todo: 'BLOCKED: requires implemented platform-admin authorization plus mutable persisted User fixtures' },
  () => {},
);

test(
  'CT-GOV-020 Organization membership alone never grants Platform Admin endpoints',
  { todo: 'BLOCKED: requires Organization Admin fixture with platformRole=null and implemented platform routes' },
  () => {},
);

test(
  'CT-GOV-021 Platform Admin can list Organizations and Users independently of Organization membership',
  { todo: 'BLOCKED: requires persisted PLATFORM_ADMIN user plus implemented platform list routes' },
  () => {},
);

test(
  'CT-GOV-022 approve Organization performs PENDING -> ACTIVE',
  { todo: 'BLOCKED: requires PENDING Organization fixture and implemented Platform Admin approve action' },
  () => {},
);

test(
  'CT-GOV-023 suspend Organization sets status SUSPENDED',
  { todo: 'BLOCKED: requires active Organization fixture and implemented Platform Admin suspend action' },
  () => {},
);

test(
  'CT-GOV-024 Platform summary returns organizationsByStatus and usersByStatus',
  { todo: 'BLOCKED: requires implemented platform summary aggregation and disposable Organization/User status fixtures' },
  () => {},
);
