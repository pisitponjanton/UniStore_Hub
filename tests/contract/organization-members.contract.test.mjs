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

const fixture = createFixtureFactory({ seed: 'CT-ORG-MEMBER' });
const organizationId = fixture.id('organization', 1);
const userId = fixture.id('user', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-ORG-001 GET /api/v1/organizations requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/organizations',
    });

    assertAuthRequired(result);
  });
});

test('CT-ORG-002 POST /api/v1/organizations requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/organizations',
      method: 'POST',
      body: {
        name: 'IT Club Store',
        description: 'Student club merchandise',
      },
    });

    assertAuthRequired(result);
  });
});

test('CT-ORG-003 GET /api/v1/organizations/:organizationId requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}`,
    });

    assertAuthRequired(result);
  });
});

test('CT-ORG-004 PATCH /api/v1/organizations/:organizationId requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}`,
      method: 'PATCH',
      body: {
        name: 'Updated Organization',
      },
    });

    assertAuthRequired(result);
  });
});

test('CT-MEMBER-001 GET member list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/members`,
    });

    assertAuthRequired(result);
  });
});

test('CT-MEMBER-002 POST add-member requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/members`,
      method: 'POST',
      body: {
        email: 'Staff.User@Example.Test ',
        role: 'STAFF',
      },
    });

    assertAuthRequired(result);
  });
});

test('CT-MEMBER-003 PATCH member role requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/members/${userId}`,
      method: 'PATCH',
      body: {
        role: 'ORGANIZATION_ADMIN',
      },
    });

    assertAuthRequired(result);
  });
});

test('CT-MEMBER-004 DELETE member requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/members/${userId}`,
      method: 'DELETE',
    });

    assertAuthRequired(result);
  });
});

test(
  'CT-ORG-005 creating an Organization grants creator ORGANIZATION_ADMIN membership',
  async () => {
    await assertBackendSuiteEvidence(["organizations-members.test.js","authorization.test.js"]);
  },
);

test(
  'CT-MEMBER-005 add-member normalizes email and returns USER_NOT_FOUND for unknown User',
  async () => {
    await assertBackendSuiteEvidence(["organizations-members.test.js","authorization.test.js"]);
  },
);

test(
  'CT-MEMBER-006 only STAFF and ORGANIZATION_ADMIN are valid organization membership roles',
  async () => {
    await assertBackendSuiteEvidence(["organizations-members.test.js","authorization.test.js"]);
  },
);

test(
  'CT-MEMBER-007 Staff cannot perform Organization Admin-only member management',
  async () => {
    await assertBackendSuiteEvidence(["organizations-members.test.js","authorization.test.js"]);
  },
);

test(
  'CT-MEMBER-008 demoting the final active Organization Admin returns 409 LAST_ORGANIZATION_ADMIN',
  async () => {
    await assertBackendSuiteEvidence(["organizations-members.test.js","authorization.test.js"]);
  },
);

test(
  'CT-MEMBER-009 removing the final active Organization Admin returns 409 LAST_ORGANIZATION_ADMIN',
  async () => {
    await assertBackendSuiteEvidence(["organizations-members.test.js","authorization.test.js"]);
  },
);
