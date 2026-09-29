import test from 'node:test';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const fixture = createFixtureFactory({ seed: 'CT-ORDER' });
const organizationId = fixture.id('organization', 1);
const campaignId = fixture.id('campaign', 1);
const productId = fixture.id('product', 1);
const variantId = fixture.id('variant', 1);
const orderId = fixture.id('order', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

const createOrderBody = {
  campaignId,
  items: [
    {
      productId,
      variantId,
      quantity: 2,
    },
  ],
};

test('CT-ORDER-001 GET organization order list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders?campaignId=${campaignId}&status=PENDING_PAYMENT`,
    });
    assertAuthRequired(result);
  });
});

test('CT-ORDER-002 POST create order requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders`,
      method: 'POST',
      body: createOrderBody,
    });
    assertAuthRequired(result);
  });
});

test('CT-ORDER-003 GET organization order detail requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders/${orderId}`,
    });
    assertAuthRequired(result);
  });
});

test('CT-ORDER-004 GET /api/v1/me/orders requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/me/orders',
    });
    assertAuthRequired(result);
  });
});

test('CT-ORDER-005 GET /api/v1/me/orders/:orderId requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/me/orders/${orderId}`,
    });
    assertAuthRequired(result);
  });
});

test('CT-ORDER-006 customer cancel endpoint requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/me/orders/${orderId}/cancel`,
      method: 'POST',
    });
    assertAuthRequired(result);
  });
});

test('CT-ORDER-007 organization cancel endpoint requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders/${orderId}/cancel`,
      method: 'POST',
    });
    assertAuthRequired(result);
  });
});

test(
  'CT-ORDER-008 order creation succeeds only when Campaign is OPEN and starts PENDING_PAYMENT',
  { todo: 'Requires authenticated Customer plus persisted OPEN/non-OPEN Campaign fixtures' },
  () => {},
);

test(
  'CT-ORDER-009 order creation rejects Product from another Organization',
  { todo: 'Requires two-tenant Product/Campaign fixtures and implemented tenant validation' },
  () => {},
);

test(
  'CT-ORDER-010 Product.storeId must equal Campaign.storeId',
  { todo: 'Requires same-tenant cross-Store Product/Campaign fixtures' },
  () => {},
);

test(
  'CT-ORDER-011 Variant must belong to the selected Product',
  { todo: 'Requires Product/Variant fixtures with deliberate mismatch' },
  () => {},
);

test(
  'CT-ORDER-012 quantity validation rejects invalid quantities',
  { todo: 'Requires implemented Order validator and authenticated Customer fixture' },
  () => {},
);

test(
  'CT-ORDER-013 Backend ignores client price/total and uses authoritative Variant.price',
  { todo: 'Requires persisted Variant price plus request containing forged price/total fields' },
  () => {},
);

test(
  'CT-ORDER-014 subtotal and total are computed as integer satang',
  { todo: 'Requires persisted multi-item Product/Variant fixtures and Order creation implementation' },
  () => {},
);

test(
  'CT-ORDER-015 OrderItem snapshot captures productName, variantName, unitPrice, quantity, totalPrice',
  { todo: 'Requires successful Order creation with persisted Product/Variant fixtures' },
  () => {},
);

test(
  'CT-ORDER-016 Product or Variant edits after Order creation do not mutate OrderItem snapshot',
  { todo: 'Requires persisted Order plus subsequent Product/Variant edits' },
  () => {},
);

test(
  'CT-ORDER-017 Customer can list/get own Orders without Organization membership',
  { todo: 'Requires Customer Order fixture and authenticated own-order flow' },
  () => {},
);

test(
  'CT-ORDER-018 another Customer cannot access the owner\'s Order',
  { todo: 'Requires two authenticated Customer fixtures and one owned Order' },
  () => {},
);

test(
  'CT-ORDER-019 Staff/Admin can access Orders only within their active Organization membership',
  { todo: 'Requires two-tenant STAFF/ORGANIZATION_ADMIN fixtures and persisted Orders' },
  () => {},
);

test(
  'CT-ORDER-020 Customer can cancel own PENDING_PAYMENT or PAYMENT_REJECTED Order and creates ORDER_CANCELLED Audit',
  { todo: 'Requires own Order fixtures in both cancellable states plus Audit persistence' },
  () => {},
);

test(
  'CT-ORDER-021 Organization Admin can cancel tenant PENDING_PAYMENT or PAYMENT_REJECTED Order',
  { todo: 'Requires authenticated Organization Admin and tenant Order fixtures' },
  () => {},
);

test(
  'CT-ORDER-022 Staff cannot use organization general cancellation',
  { todo: 'Requires authenticated STAFF fixture and tenant Order' },
  () => {},
);

test(
  'CT-ORDER-023 PAYMENT_REVIEW and paid-or-later Orders cannot be cancelled',
  { todo: 'Requires persisted Orders across PAYMENT_REVIEW/PAID/CONFIRMED/IN_PRODUCTION/READY_FOR_PICKUP/RECEIVED states' },
  () => {},
);
