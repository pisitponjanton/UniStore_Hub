import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertErrorEnvelope,
  assertIntegerSatang,
  assertIsoUtcTimestamp,
  assertListEnvelope,
  assertNoStorageFields,
  assertSuccessEnvelope,
  assertUuidV4,
} from './assertions.mjs';
import { isLoopbackUrl, loadTestEnv } from './env.mjs';
import { requestJson, resolveUrl, withQuery } from './http.mjs';
import { createFixtureFactory, createTwoTenantFixture } from '../fixtures/factories.mjs';

test('loadTestEnv uses canonical local defaults and supports explicit overrides', () => {
  const env = loadTestEnv(
    { backendBaseUrl: 'http://127.0.0.1:4400/', requestTimeoutMs: 1234 },
    {},
  );

  assert.equal(env.backendBaseUrl, 'http://127.0.0.1:4400');
  assert.equal(env.apiBaseUrl, 'http://127.0.0.1:4400/api/v1');
  assert.equal(env.healthUrl, 'http://127.0.0.1:4400/health');
  assert.equal(env.frontendBaseUrl, 'http://localhost:3000');
  assert.equal(env.awsEndpointUrl, 'http://localhost:4566');
  assert.equal(env.awsRegion, 'us-east-1');
  assert.equal(env.appTableName, 'unistore-hub-dev-local');
  assert.equal(env.filesBucketName, 'unistore-hub-files-local');
  assert.equal(env.requestTimeoutMs, 1234);
  assert.equal(isLoopbackUrl(env.backendBaseUrl), true);
});

test('fixture factories are deterministic and produce contract-shaped primitive values', () => {
  const first = createFixtureFactory({ seed: 'CT-AUTH-001' });
  const second = createFixtureFactory({ seed: 'CT-AUTH-001' });

  assert.equal(first.id('user', 1), second.id('user', 1));
  assertUuidV4(first.id('user', 1));
  assertIsoUtcTimestamp(first.timestamp(5));

  const tenants = createTwoTenantFixture({ seed: 'SEC-TENANT' });
  assert.notEqual(tenants.organizationA.organizationId, tenants.organizationB.organizationId);
  assert.notEqual(tenants.customerA.email, tenants.customerB.email);
  assert.equal(tenants.storeA.organizationId, tenants.organizationA.organizationId);
  assert.equal(tenants.storeB.organizationId, tenants.organizationB.organizationId);
});

test('HTTP helpers build query strings and send JSON with bearer auth', async () => {
  assert.equal(
    withQuery('/orders', { status: 'PAID', cursor: null, tag: ['a', 'b'] }),
    '/orders?status=PAID&tag=a&tag=b',
  );
  assert.equal(resolveUrl('http://localhost:4000/api/v1/', '/me'), 'http://localhost:4000/api/v1/me');

  let captured;
  const response = await requestJson({
    baseUrl: 'http://localhost:4000/api/v1',
    path: '/orders',
    method: 'POST',
    token: 'test-token',
    body: { quantity: 2 },
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ success: true, data: { orderId: 'x' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(captured.url, 'http://localhost:4000/api/v1/orders');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.get('authorization'), 'Bearer test-token');
  assert.equal(captured.init.headers.get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(captured.init.body), { quantity: 2 });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { success: true, data: { orderId: 'x' } });
});

test('reusable assertions validate API envelopes and storage-field privacy', () => {
  assert.deepEqual(assertSuccessEnvelope({ success: true, data: { id: 1 } }), { id: 1 });
  assert.deepEqual(
    assertListEnvelope({ success: true, data: { items: [], nextCursor: null } }),
    { items: [], nextCursor: null },
  );
  assert.equal(
    assertErrorEnvelope(
      { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      'AUTH_REQUIRED',
    ).code,
    'AUTH_REQUIRED',
  );

  assertIntegerSatang(250050);
  assertNoStorageFields({ success: true, data: [{ orderId: 'opaque' }] });

  assert.throws(
    () => assertNoStorageFields({ success: true, data: { PK: 'ORG#x' } }),
    /storage field PK leaked/i,
  );
});
