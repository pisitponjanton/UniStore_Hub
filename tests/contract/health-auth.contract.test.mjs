import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
  assertSuccessEnvelope,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';

async function againstBackend(callback) {
  return withBackendServer(
    async ({ baseUrl }) => callback(baseUrl),
    {
      users: {
        authOptions: {
          jwtOptions: {
            secret: 'ct-health-auth-only-secret',
          },
        },
      },
    },
  );
}

test('CT-HEALTH-001 GET /health is public and returns the canonical health envelope', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/health',
    });

    assertHttpStatus(result, 200);
    const data = assertSuccessEnvelope(result.body);
    assert.deepEqual(data, { status: 'ok' });
    assertNoStorageFields(result.body);
  });
});

test('CT-AUTH-001 POST /api/v1/auth/register exists and validates malformed input', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/auth/register',
      method: 'POST',
      body: {
        email: 'not-an-email',
        password: 'short',
        name: '',
      },
    });

    assertHttpStatus(result, 400);
    assertErrorEnvelope(result.body, 'VALIDATION_ERROR');
    assertNoStorageFields(result.body);
  });
});

test('CT-AUTH-002 POST /api/v1/auth/login exists and validates malformed input', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/auth/login',
      method: 'POST',
      body: {
        email: 'not-an-email',
        password: '',
      },
    });

    assertHttpStatus(result, 400);
    assertErrorEnvelope(result.body, 'VALIDATION_ERROR');
    assertNoStorageFields(result.body);
  });
});

test('CT-AUTH-003 GET /api/v1/me requires a bearer token', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/me',
    });

    assertHttpStatus(result, 401);
    assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
    assertNoStorageFields(result.body);
  });
});

test('CT-AUTH-004 GET /api/v1/me rejects a malformed bearer token', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/me',
      token: 'not-a-jwt',
    });

    assertHttpStatus(result, 401);
    assertErrorEnvelope(result.body, 'TOKEN_INVALID');
    assertNoStorageFields(result.body);
  });
});

test('CT-AUTH-005 successful register/login/current-user flow', { todo: 'Requires implemented auth routes plus disposable DynamoDB/Dev Mode fixture reset' }, () => {});

test('CT-AUTH-006 duplicate email and invalid-password behavior', { todo: 'Requires implemented auth routes plus disposable DynamoDB/Dev Mode fixture reset' }, () => {});

test('CT-AUTH-007 expired-token and disabled-user behavior', { todo: 'Requires auth implementation plus controlled user/token fixtures' }, () => {});
