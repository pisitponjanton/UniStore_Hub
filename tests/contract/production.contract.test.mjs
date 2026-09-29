import test from 'node:test';

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
  { todo: 'BLOCKED: requires mounted Production route plus authenticated Organization Admin fixture' },
  () => {},
);

test(
  'CT-PRODUCTION-003 Organization Admin can access Production Summary for own tenant',
  { todo: 'BLOCKED: requires authenticated Organization Admin plus Campaign/Order/Payment fixtures' },
  () => {},
);

test(
  'CT-PRODUCTION-004 Staff is forbidden from Production Summary',
  { todo: 'BLOCKED: requires authenticated STAFF fixture and mounted Production route' },
  () => {},
);

test(
  'CT-PRODUCTION-005 Production Summary is tenant-isolated',
  { todo: 'BLOCKED: requires two-tenant Organization Admin fixtures and Campaign data owned by the other tenant' },
  () => {},
);

test(
  'CT-PRODUCTION-006 Production Summary is campaign-isolated',
  { todo: 'BLOCKED: requires two Campaigns in one tenant with distinct paid OrderItem fixtures' },
  () => {},
);

test(
  'CT-PRODUCTION-007 unpaid, rejected-payment, and cancelled Orders are excluded',
  { todo: 'BLOCKED: requires mixed Order/Payment lifecycle fixtures and implemented Production aggregation' },
  () => {},
);

test(
  'CT-PRODUCTION-008 PAID Order with APPROVED Payment is included',
  { todo: 'BLOCKED: requires APPROVED Payment plus PAID Order fixture' },
  () => {},
);

test(
  'CT-PRODUCTION-009 CONFIRMED Order produced by approval after Campaign close is included',
  { todo: 'BLOCKED: requires CLOSED Campaign approval flow and CONFIRMED Order fixture' },
  () => {},
);

test(
  'CT-PRODUCTION-010 IN_PRODUCTION, READY_FOR_PICKUP, and RECEIVED paid Orders are included',
  { todo: 'BLOCKED: requires paid fixtures across all later lifecycle states' },
  () => {},
);

test(
  'CT-PRODUCTION-011 quantities group by Product then Variant and sum correctly',
  { todo: 'BLOCKED: requires multiple paid Orders sharing Product/Variant snapshots' },
  () => {},
);

test(
  'CT-PRODUCTION-012 normal Production Summary request path avoids full-table Scan',
  { todo: 'BLOCKED: Production repository/request path is not implemented yet; verify CampaignOrderLink/query strategy when available' },
  () => {},
);

test(
  'CT-PRODUCTION-013 response shape contains campaignId and products[].variants[].quantity only from authorized aggregate data',
  { todo: 'BLOCKED: requires implemented Production Summary response with disposable paid-order fixtures' },
  () => {},
);
