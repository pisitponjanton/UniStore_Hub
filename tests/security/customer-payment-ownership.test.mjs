import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';

test('SEC-CUSTOMER-PAYMENT-001 Customer A cannot read Customer B Payment through own-Payment endpoint', async () => {
  const paymentLookups = [];
  const customerA = 'customer-a';
  const customerB = 'customer-b';
  const orderB = {
    orderId: 'order-b',
    organizationId: 'org-b',
    campaignId: 'campaign-b',
    customerId: customerB,
    status: 'PAYMENT_REJECTED',
    subtotal: 25000,
    total: 25000,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T11:00:00.000Z',
  };

  await withBackendServer(
    async ({ baseUrl }) => {
      const result = await requestJson({
        baseUrl,
        path: '/api/v1/me/orders/order-b/payment',
      });

      assertHttpStatus(result, 404);
      assertErrorEnvelope(
        result.body,
        'ORDER_NOT_FOUND',
      );
      assertNoStorageFields(result.body);
      assert.equal(paymentLookups.length, 0);
    },
    {
      users: {
        authMiddleware(req, res, next) {
          req.user = {
            userId: customerA,
            email: 'customer-a@example.test',
            status: 'ACTIVE',
          };
          next();
        },
        payments: {
          orderRepository: {
            async findOwnedById(customerId, orderId) {
              assert.equal(customerId, customerA);
              assert.equal(orderId, orderB.orderId);
              return null;
            },
          },
          paymentRepository: {
            async getByOrder(organizationId, orderId) {
              paymentLookups.push({
                organizationId,
                orderId,
              });
              return {
                paymentId: 'payment-b',
                organizationId: orderB.organizationId,
                orderId: orderB.orderId,
                customerId: customerB,
                slipKey: 'payments/org-b/order-b/slip-b',
                status: 'REJECTED',
                rejectReason: 'Private rejection reason',
                reviewedBy: 'staff-b',
                reviewedAt: '2026-09-29T11:00:00.000Z',
                createdAt: '2026-09-29T10:15:00.000Z',
                updatedAt: '2026-09-29T11:00:00.000Z',
              };
            },
          },
        },
      },
    },
  );
});

test('SEC-CUSTOMER-PAYMENT-002 resource mismatch cannot expose another Payment after owned Order resolution', async () => {
  const customerA = 'customer-a';
  const ownedOrder = {
    orderId: 'order-a',
    organizationId: 'org-a',
    campaignId: 'campaign-a',
    customerId: customerA,
    status: 'PAYMENT_REJECTED',
    subtotal: 25000,
    total: 25000,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T11:00:00.000Z',
  };

  await withBackendServer(
    async ({ baseUrl }) => {
      const result = await requestJson({
        baseUrl,
        path: '/api/v1/me/orders/order-a/payment',
      });

      assertHttpStatus(result, 404);
      assertErrorEnvelope(
        result.body,
        'PAYMENT_NOT_FOUND',
      );
      assertNoStorageFields(result.body);
      assert.equal(
        JSON.stringify(result.body).includes(
          'Private rejection reason',
        ),
        false,
      );
    },
    {
      users: {
        authMiddleware(req, res, next) {
          req.user = {
            userId: customerA,
            email: 'customer-a@example.test',
            status: 'ACTIVE',
          };
          next();
        },
        payments: {
          orderRepository: {
            async findOwnedById(customerId, orderId) {
              assert.equal(customerId, customerA);
              assert.equal(orderId, ownedOrder.orderId);
              return ownedOrder;
            },
          },
          paymentRepository: {
            async getByOrder(organizationId, orderId) {
              assert.equal(
                organizationId,
                ownedOrder.organizationId,
              );
              assert.equal(orderId, ownedOrder.orderId);
              return {
                paymentId: 'payment-b',
                organizationId: 'org-b',
                orderId: 'order-b',
                customerId: 'customer-b',
                slipKey: 'payments/org-b/order-b/slip-b',
                status: 'REJECTED',
                rejectReason: 'Private rejection reason',
                reviewedBy: 'staff-b',
                reviewedAt: '2026-09-29T11:00:00.000Z',
                createdAt: '2026-09-29T10:15:00.000Z',
                updatedAt: '2026-09-29T11:00:00.000Z',
              };
            },
          },
        },
      },
    },
  );
});
