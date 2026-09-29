import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertListEnvelope,
  assertNoStorageFields,
  assertSuccessEnvelope,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const fixture = createFixtureFactory({ seed: 'CT-STOREFRONT' });
const organizationId = fixture.id('organization', 1);
const storeId = fixture.id('store', 1);
const productId = fixture.id('product', 1);
const variantId = fixture.id('variant', 1);
const campaignId = fixture.id('campaign', 1);

const PRIVATE_FIELDS = new Set([
  'passwordHash',
  'imageKey',
  'slipKey',
  'payment',
  'payments',
  'members',
  'memberships',
  'audit',
  'auditLogs',
]);

const emptyOrganizationRepository = {
  async listPlatform() {
    return { items: [], lastEvaluatedKey: null };
  },
  async getById() {
    return null;
  },
};

async function againstBackend(callback) {
  return withBackendServer(
    async ({ baseUrl }) => callback(baseUrl),
    {
      storefront: {
        organizationRepository: emptyOrganizationRepository,
      },
    },
  );
}

function assertNoPrivateStorefrontFields(value, path = 'body') {
  if (value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPrivateStorefrontFields(item, `${path}[${index}]`));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      PRIVATE_FIELDS.has(key),
      false,
      `Private storefront field ${key} leaked at ${path}`,
    );
    assertNoPrivateStorefrontFields(child, `${path}.${key}`);
  }
}

function assertPublicRouteResult(result, allowedNotFoundCodes = []) {
  assert.notEqual(result.status, 401, 'Public storefront route must not require authentication');
  assert.notEqual(result.status, 403, 'Public storefront route must not require authorization');

  if (result.status === 404) {
    const error = assertErrorEnvelope(result.body);
    assert.ok(
      allowedNotFoundCodes.includes(error.code),
      `Expected a resource-specific 404 code, got ${error.code}`,
    );
    return null;
  }

  assertHttpStatus(result, 200);
  assertNoStorageFields(result.body);
  assertNoPrivateStorefrontFields(result.body);
  return assertSuccessEnvelope(result.body);
}

test('CT-STOREFRONT-001 GET /api/v1/storefront/organizations is public', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/storefront/organizations',
    });

    assertHttpStatus(result, 200);
    assertListEnvelope(result.body);
    assertNoStorageFields(result.body);
    assertNoPrivateStorefrontFields(result.body);
  });
});

test('CT-STOREFRONT-002 organization store listing is public', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/storefront/organizations/${organizationId}/stores`,
    });

    const data = assertPublicRouteResult(result, ['ORGANIZATION_NOT_FOUND']);
    if (data) {
      assert.ok(Array.isArray(data.items), 'Store list must expose data.items');
      assert.ok(Object.hasOwn(data, 'nextCursor'), 'Store list must expose nextCursor');
    }
  });
});

test('CT-STOREFRONT-003 store detail is public', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/storefront/organizations/${organizationId}/stores/${storeId}`,
    });

    assertPublicRouteResult(result, ['ORGANIZATION_NOT_FOUND', 'STORE_NOT_FOUND']);
  });
});

test('CT-STOREFRONT-004 product listing is public', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/storefront/organizations/${organizationId}/stores/${storeId}/products`,
    });

    const data = assertPublicRouteResult(result, ['ORGANIZATION_NOT_FOUND', 'STORE_NOT_FOUND']);
    if (data) {
      assert.ok(Array.isArray(data.items), 'Product list must expose data.items');
      assert.ok(Object.hasOwn(data, 'nextCursor'), 'Product list must expose nextCursor');
    }
  });
});

test('CT-STOREFRONT-005 product detail is public and never exposes imageKey', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/storefront/organizations/${organizationId}/stores/${storeId}/products/${productId}`,
    });

    assertPublicRouteResult(result, [
      'ORGANIZATION_NOT_FOUND',
      'STORE_NOT_FOUND',
      'PRODUCT_NOT_FOUND',
    ]);
  });
});

test('CT-STOREFRONT-006 campaign listing is public', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/storefront/organizations/${organizationId}/stores/${storeId}/campaigns`,
    });

    const data = assertPublicRouteResult(result, ['ORGANIZATION_NOT_FOUND', 'STORE_NOT_FOUND']);
    if (data) {
      assert.ok(Array.isArray(data.items), 'Campaign list must expose data.items');
      assert.ok(Object.hasOwn(data, 'nextCursor'), 'Campaign list must expose nextCursor');
    }
  });
});

test('CT-STOREFRONT-007 campaign detail is public', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/storefront/organizations/${organizationId}/stores/${storeId}/campaigns/${campaignId}`,
    });

    assertPublicRouteResult(result, [
      'ORGANIZATION_NOT_FOUND',
      'STORE_NOT_FOUND',
      'CAMPAIGN_NOT_FOUND',
    ]);
  });
});

test('CT-STOREFRONT-008 order creation still requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders`,
      method: 'POST',
      body: {
        campaignId,
        items: [
          {
            productId,
            variantId,
            quantity: 1,
          },
        ],
      },
    });

    assertHttpStatus(result, 401);
    assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
    assertNoStorageFields(result.body);
  });
});
