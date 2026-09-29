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

const ORDER_ID = 'order-1';
const OWNER_ID = 'customer-a';
const OTHER_ID = 'customer-b';
const ORGANIZATION_ID = 'org-1';

function makeOrder(overrides = {}) {
  return {
    orderId: ORDER_ID,
    organizationId: ORGANIZATION_ID,
    campaignId: 'campaign-1',
    customerId: OWNER_ID,
    status: 'PAYMENT_REJECTED',
    subtotal: 19000,
    total: 19000,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T11:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    paymentId: 'payment-1',
    organizationId: ORGANIZATION_ID,
    orderId: ORDER_ID,
    customerId: OWNER_ID,
    slipKey: 'payments/org-1/order-1/slip-1',
    status: 'REJECTED',
    rejectReason: 'Slip amount does not match order',
    reviewedBy: 'staff-1',
    reviewedAt: '2026-09-29T11:00:00.000Z',
    createdAt: '2026-09-29T10:15:00.000Z',
    updatedAt: '2026-09-29T11:00:00.000Z',
    ...overrides,
  };
}

function createOptions({
  userId = OWNER_ID,
  order = makeOrder(),
  payment = makePayment(),
  maliciousOwnedLookup = false,
  calls = {
    ownedOrder: [],
    paymentByOrder: [],
    reviewerPaymentById: 0,
  },
} = {}) {
  return {
    calls,
    options: {
      users: {
        authMiddleware(req, res, next) {
          req.user = {
            userId,
            email: userId + '@example.test',
            status: 'ACTIVE',
          };
          next();
        },
        payments: {
          orderRepository: {
            async findOwnedById(customerId, orderId) {
              calls.ownedOrder.push({ customerId, orderId });

              if (orderId !== order.orderId) {
                return null;
              }

              if (maliciousOwnedLookup) {
                return order;
              }

              return customerId === order.customerId
                ? order
                : null;
            },
          },
          paymentRepository: {
            async getByOrder(organizationId, orderId) {
              calls.paymentByOrder.push({
                organizationId,
                orderId,
              });
              return payment;
            },
            async findById() {
              calls.reviewerPaymentById += 1;
              throw new Error(
                'Customer own-Payment read must not use reviewer paymentId lookup',
              );
            },
          },
        },
      },
    },
  };
}

test('CT-CUSTOMER-PAYMENT-READ-001 endpoint requires bearer authentication', async () => {
  await withBackendServer(async ({ baseUrl }) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/me/orders/order-1/payment',
    });

    assertHttpStatus(result, 401);
    assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
    assertNoStorageFields(result.body);
  });
});

test('CT-CUSTOMER-PAYMENT-READ-002 owner reads PaymentDTO and exact rejectReason without Organization membership', async () => {
  const harness = createOptions();

  await withBackendServer(
    async ({ baseUrl }) => {
      const result = await requestJson({
        baseUrl,
        path: '/api/v1/me/orders/order-1/payment',
      });

      assertHttpStatus(result, 200);
      const data = assertSuccessEnvelope(result.body);
      assert.equal(data.paymentId, 'payment-1');
      assert.equal(data.organizationId, ORGANIZATION_ID);
      assert.equal(data.orderId, ORDER_ID);
      assert.equal(data.customerId, OWNER_ID);
      assert.equal(data.status, 'REJECTED');
      assert.equal(
        data.rejectReason,
        'Slip amount does not match order',
      );
      assertNoStorageFields(result.body);

      assert.deepEqual(harness.calls.ownedOrder, [
        {
          customerId: OWNER_ID,
          orderId: ORDER_ID,
        },
      ]);
      assert.deepEqual(harness.calls.paymentByOrder, [
        {
          organizationId: ORGANIZATION_ID,
          orderId: ORDER_ID,
        },
      ]);
      assert.equal(
        harness.calls.reviewerPaymentById,
        0,
      );
    },
    harness.options,
  );
});

test('CT-CUSTOMER-PAYMENT-READ-003 owned Order without Payment returns PAYMENT_NOT_FOUND', async () => {
  const harness = createOptions({
    payment: null,
  });

  await withBackendServer(
    async ({ baseUrl }) => {
      const result = await requestJson({
        baseUrl,
        path: '/api/v1/me/orders/order-1/payment',
      });

      assertHttpStatus(result, 404);
      assertErrorEnvelope(
        result.body,
        'PAYMENT_NOT_FOUND',
      );
      assertNoStorageFields(result.body);
    },
    harness.options,
  );
});

test('CT-CUSTOMER-PAYMENT-READ-004 another Customer fails closed as ORDER_NOT_FOUND before Payment lookup', async () => {
  const harness = createOptions({
    userId: OTHER_ID,
  });

  await withBackendServer(
    async ({ baseUrl }) => {
      const result = await requestJson({
        baseUrl,
        path: '/api/v1/me/orders/order-1/payment',
      });

      assertHttpStatus(result, 404);
      assertErrorEnvelope(
        result.body,
        'ORDER_NOT_FOUND',
      );
      assertNoStorageFields(result.body);
      assert.equal(
        harness.calls.paymentByOrder.length,
        0,
      );
    },
    harness.options,
  );
});

test('CT-CUSTOMER-PAYMENT-READ-005 service fails closed even if owned-Order repository returns another Customer Order', async () => {
  const harness = createOptions({
    userId: OTHER_ID,
    maliciousOwnedLookup: true,
  });

  await withBackendServer(
    async ({ baseUrl }) => {
      const result = await requestJson({
        baseUrl,
        path: '/api/v1/me/orders/order-1/payment',
      });

      assertHttpStatus(result, 404);
      assertErrorEnvelope(
        result.body,
        'ORDER_NOT_FOUND',
      );
      assertNoStorageFields(result.body);
      assert.equal(
        harness.calls.paymentByOrder.length,
        0,
      );
    },
    harness.options,
  );
});

test('CT-CUSTOMER-PAYMENT-READ-006 mismatched Payment customer fails closed as PAYMENT_NOT_FOUND', async () => {
  const harness = createOptions({
    payment: makePayment({
      customerId: OTHER_ID,
    }),
  });

  await withBackendServer(
    async ({ baseUrl }) => {
      const result = await requestJson({
        baseUrl,
        path: '/api/v1/me/orders/order-1/payment',
      });

      assertHttpStatus(result, 404);
      assertErrorEnvelope(
        result.body,
        'PAYMENT_NOT_FOUND',
      );
      assertNoStorageFields(result.body);
    },
    harness.options,
  );
});
