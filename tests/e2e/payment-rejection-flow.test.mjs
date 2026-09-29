import test from 'node:test';
import assert from 'node:assert/strict';

import {
  apiJson,
  listAuditItems,
  missingRepoFiles,
  registerAndLogin,
  uploadPaymentSlip,
  waitForNotification,
} from './live-e2e-helpers.mjs';

const REQUIRED_BACKEND_FILES = [
  'backend/src/modules/orders/order.routes.js',
  'backend/src/modules/payments/payment.routes.js',
  'backend/src/modules/notifications/notification.routes.js',
  'backend/src/modules/audit/audit.routes.js',
  'backend/src/worker.js',
];

test('E2E-PAYMENT-REJECT-001 reject -> notify -> resubmit -> approve -> PAID with audit trail', async (t) => {
  const missing = await missingRepoFiles(REQUIRED_BACKEND_FILES);
  if (missing.length > 0) {
    t.todo(
      `BLOCKED: payment-rejection E2E owning implementations are incomplete: ${missing.join(', ')}`,
    );
    return;
  }

  const baseUrl = process.env.E2E_API_BASE_URL;
  const runId = process.env.E2E_RUN_ID;
  const platformAdminToken = process.env.E2E_PLATFORM_ADMIN_TOKEN;

  if (!baseUrl || !runId) {
    t.todo(
      'BLOCKED: set E2E_API_BASE_URL and deterministic E2E_RUN_ID for disposable payment-rejection data',
    );
    return;
  }

  const password = process.env.E2E_TEST_PASSWORD || 'E2e-only-Strong-Password-123!';
  const prefix = `unistore-reject-${runId}`;
  const adminEmail = `${prefix}-admin@example.test`;
  const staffEmail = `${prefix}-staff@example.test`;
  const customerEmail = `${prefix}-customer@example.test`;
  const rejectionReason = 'Slip amount does not match order';

  const admin = await registerAndLogin(baseUrl, {
    email: adminEmail,
    password,
    name: `Reject E2E Admin ${runId}`,
  });
  const staff = await registerAndLogin(baseUrl, {
    email: staffEmail,
    password,
    name: `Reject E2E Staff ${runId}`,
  });
  const customer = await registerAndLogin(baseUrl, {
    email: customerEmail,
    password,
    name: `Reject E2E Customer ${runId}`,
  });

  const createdOrg = await apiJson(baseUrl, '/api/v1/organizations', {
    method: 'POST',
    token: admin.token,
    body: {
      name: `Reject E2E Organization ${runId}`,
      description: 'Disposable payment rejection E2E organization',
    },
    expectedStatus: 201,
  });
  const organizationId = createdOrg.data.organizationId;

  if (createdOrg.data.status === 'PENDING') {
    if (!platformAdminToken) {
      t.todo(
        'BLOCKED: newly created Organization is PENDING; set E2E_PLATFORM_ADMIN_TOKEN to execute documented approval',
      );
      return;
    }

    await apiJson(
      baseUrl,
      `/api/v1/platform/organizations/${organizationId}/approve`,
      {
        method: 'POST',
        token: platformAdminToken,
        expectedStatus: 200,
      },
    );
  }

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/members`,
    {
      method: 'POST',
      token: admin.token,
      body: { email: staffEmail, role: 'STAFF' },
      expectedStatus: 201,
    },
  );

  const store = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/stores`,
    {
      method: 'POST',
      token: admin.token,
      body: {
        name: `Reject E2E Store ${runId}`,
        description: 'Disposable rejection E2E store',
      },
      expectedStatus: 201,
    },
  );

  const product = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/products`,
    {
      method: 'POST',
      token: admin.token,
      body: {
        storeId: store.data.storeId,
        name: `Reject E2E Product ${runId}`,
        description: 'Disposable rejection E2E product',
      },
      expectedStatus: 201,
    },
  );

  const variant = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/products/${product.data.productId}/variants`,
    {
      method: 'POST',
      token: admin.token,
      body: { name: 'Default', price: 19000 },
      expectedStatus: 201,
    },
  );

  const campaign = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns`,
    {
      method: 'POST',
      token: admin.token,
      body: {
        storeId: store.data.storeId,
        name: `Reject E2E Campaign ${runId}`,
        openAt: '2030-02-01T00:00:00.000Z',
        closeAt: '2030-02-10T23:59:59.000Z',
        paymentDeadline: '2030-02-11T23:59:59.000Z',
        pickupAt: '2030-02-25T09:00:00.000Z',
      },
      expectedStatus: 201,
    },
  );

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns/${campaign.data.campaignId}/open`,
    {
      method: 'POST',
      token: admin.token,
      expectedStatus: 200,
    },
  );

  const order = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders`,
    {
      method: 'POST',
      token: customer.token,
      body: {
        campaignId: campaign.data.campaignId,
        items: [
          {
            productId: product.data.productId,
            variantId: variant.data.variantId,
            quantity: 1,
          },
        ],
      },
      expectedStatus: 201,
    },
  );
  assert.equal(order.data.status, 'PENDING_PAYMENT');

  const firstSlipKey = await uploadPaymentSlip(baseUrl, {
    organizationId,
    orderId: order.data.orderId,
    customerToken: customer.token,
  });

  const submitted = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders/${order.data.orderId}/payment`,
    {
      method: 'POST',
      token: customer.token,
      body: { slipKey: firstSlipKey },
    },
  );
  const paymentId = submitted.data.paymentId;
  assert.equal(submitted.data.status, 'PENDING_REVIEW');

  const rejected = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/payments/${paymentId}/reject`,
    {
      method: 'POST',
      token: staff.token,
      body: { reason: rejectionReason },
      expectedStatus: 200,
    },
  );
  assert.equal(rejected.data.status, 'REJECTED');
  assert.equal(rejected.data.rejectReason, rejectionReason);

  const rejectedOrder = await apiJson(
    baseUrl,
    `/api/v1/me/orders/${order.data.orderId}`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  assert.equal(rejectedOrder.data.status, 'PAYMENT_REJECTED');

  const customerRejectedPayment = await apiJson(
    baseUrl,
    `/api/v1/me/orders/${order.data.orderId}/payment`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  assert.equal(customerRejectedPayment.data.paymentId, paymentId);
  assert.equal(customerRejectedPayment.data.status, 'REJECTED');
  assert.equal(
    customerRejectedPayment.data.rejectReason,
    rejectionReason,
  );

  const rejectedNotification = await waitForNotification(
    baseUrl,
    customer.token,
    {
      type: 'PAYMENT_REJECTED',
      resourceId: paymentId,
    },
  );
  assert.equal(rejectedNotification.type, 'PAYMENT_REJECTED');

  const secondSlipKey = await uploadPaymentSlip(baseUrl, {
    organizationId,
    orderId: order.data.orderId,
    customerToken: customer.token,
  });
  assert.notEqual(secondSlipKey, firstSlipKey);

  const resubmitted = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders/${order.data.orderId}/payment`,
    {
      method: 'POST',
      token: customer.token,
      body: { slipKey: secondSlipKey },
    },
  );
  assert.equal(resubmitted.data.paymentId, paymentId);
  assert.equal(resubmitted.data.status, 'PENDING_REVIEW');
  assert.equal(resubmitted.data.slipKey, secondSlipKey);
  assert.equal(resubmitted.data.rejectReason, null);
  assert.equal(resubmitted.data.reviewedBy, null);
  assert.equal(resubmitted.data.reviewedAt, null);

  const customerResubmittedPayment = await apiJson(
    baseUrl,
    `/api/v1/me/orders/${order.data.orderId}/payment`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  assert.equal(customerResubmittedPayment.data.paymentId, paymentId);
  assert.equal(customerResubmittedPayment.data.status, 'PENDING_REVIEW');
  assert.equal(customerResubmittedPayment.data.slipKey, secondSlipKey);
  assert.equal(customerResubmittedPayment.data.rejectReason, null);
  assert.equal(customerResubmittedPayment.data.reviewedBy, null);
  assert.equal(customerResubmittedPayment.data.reviewedAt, null);

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`,
    {
      method: 'POST',
      token: staff.token,
      expectedStatus: 200,
    },
  );

  const paidOrder = await apiJson(
    baseUrl,
    `/api/v1/me/orders/${order.data.orderId}`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  assert.equal(paidOrder.data.status, 'PAID');

  const customerApprovedPayment = await apiJson(
    baseUrl,
    `/api/v1/me/orders/${order.data.orderId}/payment`,
    {
      token: customer.token,
      expectedStatus: 200,
    },
  );
  assert.equal(customerApprovedPayment.data.paymentId, paymentId);
  assert.equal(customerApprovedPayment.data.status, 'APPROVED');
  assert.equal(customerApprovedPayment.data.rejectReason, null);

  const rejectAudits = await listAuditItems(
    baseUrl,
    admin.token,
    organizationId,
    {
      action: 'PAYMENT_REJECTED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
    },
  );
  assert.ok(
    rejectAudits.some(
      (item) =>
        item.action === 'PAYMENT_REJECTED' &&
        item.resourceId === paymentId,
    ),
    'Expected PAYMENT_REJECTED Audit entry',
  );

  const approveAudits = await listAuditItems(
    baseUrl,
    admin.token,
    organizationId,
    {
      action: 'PAYMENT_APPROVED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
    },
  );
  assert.ok(
    approveAudits.some(
      (item) =>
        item.action === 'PAYMENT_APPROVED' &&
        item.resourceId === paymentId,
    ),
    'Expected PAYMENT_APPROVED Audit entry',
  );
});
