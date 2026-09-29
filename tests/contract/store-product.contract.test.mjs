import test from 'node:test';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const fixture = createFixtureFactory({ seed: 'CT-STORE-PRODUCT' });
const organizationId = fixture.id('organization', 1);
const storeId = fixture.id('store', 1);
const productId = fixture.id('product', 1);
const variantId = fixture.id('variant', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-STORE-001 GET store list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/stores`,
    });
    assertAuthRequired(result);
  });
});

test('CT-STORE-002 POST store requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/stores`,
      method: 'POST',
      body: {
        name: 'Main Store',
        description: 'Faculty merchandise',
      },
    });
    assertAuthRequired(result);
  });
});

test('CT-STORE-003 GET store detail requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/stores/${storeId}`,
    });
    assertAuthRequired(result);
  });
});

test('CT-STORE-004 PATCH store requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/stores/${storeId}`,
      method: 'PATCH',
      body: {
        name: 'Updated Store',
        status: 'ACTIVE',
      },
    });
    assertAuthRequired(result);
  });
});

test('CT-PRODUCT-001 GET product list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products?storeId=${storeId}`,
    });
    assertAuthRequired(result);
  });
});

test('CT-PRODUCT-002 POST product requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products`,
      method: 'POST',
      body: {
        storeId,
        name: 'Faculty Shirt',
        description: 'Pre-order shirt',
      },
    });
    assertAuthRequired(result);
  });
});

test('CT-PRODUCT-003 GET product detail requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products/${productId}`,
    });
    assertAuthRequired(result);
  });
});

test('CT-PRODUCT-004 PATCH product requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products/${productId}`,
      method: 'PATCH',
      body: {
        name: 'Updated Shirt',
        imageKey: `products/${organizationId}/${productId}/${fixture.id('image', 1)}`,
        status: 'ACTIVE',
      },
    });
    assertAuthRequired(result);
  });
});

test('CT-PRODUCT-005 DELETE product requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products/${productId}`,
      method: 'DELETE',
    });
    assertAuthRequired(result);
  });
});

test('CT-VARIANT-001 POST variant requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products/${productId}/variants`,
      method: 'POST',
      body: {
        name: 'Size M',
        price: 25000,
      },
    });
    assertAuthRequired(result);
  });
});

test('CT-VARIANT-002 PATCH variant requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products/${productId}/variants/${variantId}`,
      method: 'PATCH',
      body: {
        name: 'Size L',
        price: 27000,
        status: 'ACTIVE',
      },
    });
    assertAuthRequired(result);
  });
});

test('CT-VARIANT-003 DELETE variant requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products/${productId}/variants/${variantId}`,
      method: 'DELETE',
    });
    assertAuthRequired(result);
  });
});

test(
  'CT-STORE-005 StoreDTO shape and tenant organizationId are authoritative',
  { todo: 'Requires authenticated Organization Admin plus disposable Store fixture' },
  () => {},
);

test(
  'CT-PRODUCT-006 ProductDTO/VariantDTO response shapes use integer satang and no storage fields',
  { todo: 'Requires authenticated Organization Admin plus disposable Product/Variant fixtures' },
  () => {},
);

test(
  'CT-PRODUCT-007 product storeId and all nested resources remain tenant-scoped',
  { todo: 'Requires two-tenant authenticated fixtures to verify TENANT_MISMATCH/FORBIDDEN behavior' },
  () => {},
);

test(
  'CT-PRODUCT-008 imageKey must match products/{organizationId}/{productId}/ and reference an allowed existing object within 5 MiB',
  { todo: 'Requires S3/LocalStack fixture and implemented Product image metadata validation' },
  () => {},
);

test(
  'CT-PRODUCT-009 management ProductDTO may return imageKey/imageUrl while Storefront omits imageKey',
  { todo: 'Requires Product image fixture and both management/storefront implementations' },
  () => {},
);

test(
  'CT-PRODUCT-010 product and variant delete are soft deactivation and return 204',
  { todo: 'Requires authenticated Organization Admin plus persisted Product/Variant fixtures' },
  () => {},
);
