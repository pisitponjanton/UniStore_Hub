import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import {
  apiError,
  apiJson,
  markNotificationRead,
  registerAndLogin,
  uploadPaymentSlip,
  waitForNotification,
} from './live-e2e-helpers.mjs';

const requireFromHere = createRequire(import.meta.url);
const {
  createSqsAdapter,
  createSqsClient,
} = requireFromHere('../../backend/src/aws/sqs.js');

function deterministicUuid(seed) {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function ensureActiveOrganization(baseUrl, adminToken, platformAdminToken, {
  name,
  description,
}) {
  const created = await apiJson(baseUrl, '/api/v1/organizations', {
    method: 'POST',
    token: adminToken,
    body: { name, description },
    expectedStatus: 201,
  });

  if (created.data.status === 'PENDING') {
    assert.ok(
      platformAdminToken,
      'E2E_PLATFORM_ADMIN_TOKEN is required to approve newly created PENDING Organizations',
    );

    await apiJson(
      baseUrl,
      `/api/v1/platform/organizations/${created.data.organizationId}/approve`,
      {
        method: 'POST',
        token: platformAdminToken,
        expectedStatus: 200,
      },
    );
  }

  return created.data;
}

async function createStoreProductCampaign(baseUrl, adminToken, organizationId, runId) {
  const store = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/stores`,
    {
      method: 'POST',
      token: adminToken,
      body: {
        name: `E2E Store ${runId}`,
        description: 'Disposable tenant/notification E2E store',
      },
      expectedStatus: 201,
    },
  );

  const product = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/products`,
    {
      method: 'POST',
      token: adminToken,
      body: {
        storeId: store.data.storeId,
        name: `E2E Product ${runId}`,
        description: 'Disposable tenant/notification E2E product',
      },
      expectedStatus: 201,
    },
  );

  const variant = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/products/${product.data.productId}/variants`,
    {
      method: 'POST',
      token: adminToken,
      body: { name: 'Default', price: 21000 },
      expectedStatus: 201,
    },
  );

  const campaign = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns`,
    {
      method: 'POST',
      token: adminToken,
      body: {
        storeId: store.data.storeId,
        name: `E2E Campaign ${runId}`,
        openAt: '2030-03-01T00:00:00.000Z',
        closeAt: '2030-03-10T23:59:59.000Z',
        paymentDeadline: '2030-03-11T23:59:59.000Z',
        pickupAt: '2030-03-25T09:00:00.000Z',
      },
      expectedStatus: 201,
    },
  );

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns/${campaign.data.campaignId}/open`,
    { method: 'POST', token: adminToken, expectedStatus: 200 },
  );

  return {
    store: store.data,
    product: product.data,
    variant: variant.data,
    campaign: campaign.data,
  };
}

async function createPaidOrder(baseUrl, {
  organizationId,
  campaignId,
  productId,
  variantId,
  customerToken,
  staffToken,
}) {
  const order = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders`,
    {
      method: 'POST',
      token: customerToken,
      body: {
        campaignId,
        items: [{ productId, variantId, quantity: 1 }],
      },
      expectedStatus: 201,
    },
  );

  const slipKey = await uploadPaymentSlip(baseUrl, {
    organizationId,
    orderId: order.data.orderId,
    customerToken,
  });

  const payment = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders/${order.data.orderId}/payment`,
    {
      method: 'POST',
      token: customerToken,
      body: { slipKey },
    },
  );

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/payments/${payment.data.paymentId}/approve`,
    { method: 'POST', token: staffToken, expectedStatus: 200 },
  );

  return {
    order: order.data,
    payment: payment.data,
    slipKey,
  };
}

test('E2E-TENANT-001 two-organization cross-tenant denial matrix', async (t) => {
  const baseUrl = process.env.E2E_API_BASE_URL;
  const runId = process.env.E2E_RUN_ID;
  const platformAdminToken = process.env.E2E_PLATFORM_ADMIN_TOKEN;
  if (!baseUrl || !runId) {
    t.todo('BLOCKED: set E2E_API_BASE_URL and deterministic E2E_RUN_ID');
    return;
  }

  const password = process.env.E2E_TEST_PASSWORD || 'E2e-only-Strong-Password-123!';
  const prefix = `unistore-tenant-${runId}`;

  const adminA = await registerAndLogin(baseUrl, {
    email: `${prefix}-admin-a@example.test`,
    password,
    name: 'Tenant Admin A',
  });
  const staffA = await registerAndLogin(baseUrl, {
    email: `${prefix}-staff-a@example.test`,
    password,
    name: 'Tenant Staff A',
  });
  const customerA = await registerAndLogin(baseUrl, {
    email: `${prefix}-customer-a@example.test`,
    password,
    name: 'Tenant Customer A',
  });
  const adminB = await registerAndLogin(baseUrl, {
    email: `${prefix}-admin-b@example.test`,
    password,
    name: 'Tenant Admin B',
  });
  const staffB = await registerAndLogin(baseUrl, {
    email: `${prefix}-staff-b@example.test`,
    password,
    name: 'Tenant Staff B',
  });
  const customerB = await registerAndLogin(baseUrl, {
    email: `${prefix}-customer-b@example.test`,
    password,
    name: 'Tenant Customer B',
  });

  let orgA;
  let orgB;
  try {
    orgA = await ensureActiveOrganization(baseUrl, adminA.token, platformAdminToken, {
      name: `Tenant Org A ${runId}`,
      description: 'Disposable tenant A',
    });
    orgB = await ensureActiveOrganization(baseUrl, adminB.token, platformAdminToken, {
      name: `Tenant Org B ${runId}`,
      description: 'Disposable tenant B',
    });
  } catch (error) {
    if (/E2E_PLATFORM_ADMIN_TOKEN/.test(error.message)) {
      t.todo('BLOCKED: E2E_PLATFORM_ADMIN_TOKEN is required because new Organizations are PENDING');
      return;
    }
    throw error;
  }

  await apiJson(baseUrl, `/api/v1/organizations/${orgA.organizationId}/members`, {
    method: 'POST',
    token: adminA.token,
    body: { email: staffA.user.email, role: 'STAFF' },
    expectedStatus: 201,
  });
  await apiJson(baseUrl, `/api/v1/organizations/${orgB.organizationId}/members`, {
    method: 'POST',
    token: adminB.token,
    body: { email: staffB.user.email, role: 'STAFF' },
    expectedStatus: 201,
  });

  const catalogB = await createStoreProductCampaign(
    baseUrl,
    adminB.token,
    orgB.organizationId,
    `${runId}-b`,
  );

  const paidB = await createPaidOrder(baseUrl, {
    organizationId: orgB.organizationId,
    campaignId: catalogB.campaign.campaignId,
    productId: catalogB.product.productId,
    variantId: catalogB.variant.variantId,
    customerToken: customerB.token,
    staffToken: staffB.token,
  });

  // Move the paid Order to READY_FOR_PICKUP so a tenant-scoped Pickup exists.
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/campaigns/${catalogB.campaign.campaignId}/close`,
    { method: 'POST', token: adminB.token, expectedStatus: 200 },
  );
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/campaigns/${catalogB.campaign.campaignId}/start-production`,
    { method: 'POST', token: adminB.token, expectedStatus: 200 },
  );
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/campaigns/${catalogB.campaign.campaignId}/ready-for-pickup`,
    { method: 'POST', token: adminB.token, expectedStatus: 200 },
  );

  const pickupB = await apiJson(
    baseUrl,
    `/api/v1/me/orders/${paidB.order.orderId}/pickup`,
    { token: customerB.token, expectedStatus: 200 },
  );

  // Cross-tenant Order access.
  await apiError(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/orders/${paidB.order.orderId}`,
    { token: staffA.token },
  );

  // Cross-tenant Payment review.
  await apiError(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/payments/${paidB.payment.paymentId}/approve`,
    { method: 'POST', token: staffA.token },
  );

  // Cross-tenant private Payment Slip access.
  await apiError(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/files/download-url`,
    {
      method: 'POST',
      token: customerA.token,
      body: { objectKey: paidB.slipKey },
    },
  );

  // Cross-tenant Product update.
  await apiError(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/products/${catalogB.product.productId}`,
    {
      method: 'PATCH',
      token: adminA.token,
      body: { name: 'Unauthorized cross-tenant mutation' },
    },
  );

  // Cross-tenant Pickup confirm.
  await apiError(
    baseUrl,
    `/api/v1/organizations/${orgB.organizationId}/pickups/${pickupB.data.pickupId}/confirm`,
    { method: 'POST', token: staffA.token },
  );

  // Resource ID alone cannot authorize Customer A against Customer B own-order route.
  await apiError(
    baseUrl,
    `/api/v1/me/orders/${paidB.order.orderId}`,
    { token: customerA.token },
  );
});

test('E2E-NOTIFY-001 business event -> SQS -> Worker -> Notification -> mark-read for approved/rejected/ready events', async (t) => {
  const baseUrl = process.env.E2E_API_BASE_URL;
  const runId = process.env.E2E_RUN_ID;
  const platformAdminToken = process.env.E2E_PLATFORM_ADMIN_TOKEN;
  if (!baseUrl || !runId) {
    t.todo('BLOCKED: set E2E_API_BASE_URL and deterministic E2E_RUN_ID');
    return;
  }

  const password = process.env.E2E_TEST_PASSWORD || 'E2e-only-Strong-Password-123!';
  const prefix = `unistore-notify-${runId}`;

  const admin = await registerAndLogin(baseUrl, {
    email: `${prefix}-admin@example.test`,
    password,
    name: 'Notify Admin',
  });
  const staff = await registerAndLogin(baseUrl, {
    email: `${prefix}-staff@example.test`,
    password,
    name: 'Notify Staff',
  });
  const customer = await registerAndLogin(baseUrl, {
    email: `${prefix}-customer@example.test`,
    password,
    name: 'Notify Customer',
  });

  let org;
  try {
    org = await ensureActiveOrganization(baseUrl, admin.token, platformAdminToken, {
      name: `Notify Org ${runId}`,
      description: 'Disposable notification E2E organization',
    });
  } catch (error) {
    if (/E2E_PLATFORM_ADMIN_TOKEN/.test(error.message)) {
      t.todo('BLOCKED: E2E_PLATFORM_ADMIN_TOKEN is required because new Organizations are PENDING');
      return;
    }
    throw error;
  }

  await apiJson(baseUrl, `/api/v1/organizations/${org.organizationId}/members`, {
    method: 'POST',
    token: admin.token,
    body: { email: staff.user.email, role: 'STAFF' },
    expectedStatus: 201,
  });

  const catalog = await createStoreProductCampaign(
    baseUrl,
    admin.token,
    org.organizationId,
    `${runId}-notify`,
  );

  // Approved path.
  const approvedOrder = await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/orders`,
    {
      method: 'POST',
      token: customer.token,
      body: {
        campaignId: catalog.campaign.campaignId,
        items: [{
          productId: catalog.product.productId,
          variantId: catalog.variant.variantId,
          quantity: 1,
        }],
      },
      expectedStatus: 201,
    },
  );
  const approvedSlip = await uploadPaymentSlip(baseUrl, {
    organizationId: org.organizationId,
    orderId: approvedOrder.data.orderId,
    customerToken: customer.token,
  });
  const approvedPayment = await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/orders/${approvedOrder.data.orderId}/payment`,
    {
      method: 'POST',
      token: customer.token,
      body: { slipKey: approvedSlip },
    },
  );
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/payments/${approvedPayment.data.paymentId}/approve`,
    { method: 'POST', token: staff.token, expectedStatus: 200 },
  );

  const approvedNotification = await waitForNotification(
    baseUrl,
    customer.token,
    { type: 'PAYMENT_APPROVED' },
  );
  const approvedRead = await markNotificationRead(
    baseUrl,
    customer.token,
    approvedNotification.notificationId,
  );
  assert.ok(approvedRead.data.readAt);

  // Rejected path.
  const rejectedOrder = await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/orders`,
    {
      method: 'POST',
      token: customer.token,
      body: {
        campaignId: catalog.campaign.campaignId,
        items: [{
          productId: catalog.product.productId,
          variantId: catalog.variant.variantId,
          quantity: 1,
        }],
      },
      expectedStatus: 201,
    },
  );
  const rejectedSlip = await uploadPaymentSlip(baseUrl, {
    organizationId: org.organizationId,
    orderId: rejectedOrder.data.orderId,
    customerToken: customer.token,
  });
  const rejectedPayment = await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/orders/${rejectedOrder.data.orderId}/payment`,
    {
      method: 'POST',
      token: customer.token,
      body: { slipKey: rejectedSlip },
    },
  );
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/payments/${rejectedPayment.data.paymentId}/reject`,
    {
      method: 'POST',
      token: staff.token,
      body: { reason: 'Notification E2E rejection' },
      expectedStatus: 200,
    },
  );

  const rejectedNotification = await waitForNotification(
    baseUrl,
    customer.token,
    { type: 'PAYMENT_REJECTED' },
  );
  const rejectedRead = await markNotificationRead(
    baseUrl,
    customer.token,
    rejectedNotification.notificationId,
  );
  assert.ok(rejectedRead.data.readAt);

  // Ready-for-pickup path for the approved Order.
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/campaigns/${catalog.campaign.campaignId}/close`,
    { method: 'POST', token: admin.token, expectedStatus: 200 },
  );

  // Rejected order remains PAYMENT_REJECTED and is not a PAYMENT_REVIEW blocker.
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/campaigns/${catalog.campaign.campaignId}/start-production`,
    { method: 'POST', token: admin.token, expectedStatus: 200 },
  );
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${org.organizationId}/campaigns/${catalog.campaign.campaignId}/ready-for-pickup`,
    { method: 'POST', token: admin.token, expectedStatus: 200 },
  );

  const readyNotification = await waitForNotification(
    baseUrl,
    customer.token,
    { type: 'READY_FOR_PICKUP' },
  );
  const readyRead = await markNotificationRead(
    baseUrl,
    customer.token,
    readyNotification.notificationId,
  );
  assert.ok(readyRead.data.readAt);
});

test('E2E-NOTIFY-001 duplicate delivery maps eventId to notificationId and creates only one Notification', async (t) => {
  const baseUrl = process.env.E2E_API_BASE_URL;
  const queueUrl = process.env.E2E_NOTIFICATION_QUEUE_URL;
  const runId = process.env.E2E_RUN_ID;
  const recipientToken = process.env.E2E_DUPLICATE_RECIPIENT_TOKEN;
  const recipientUserId = process.env.E2E_DUPLICATE_RECIPIENT_USER_ID;

  if (!baseUrl || !queueUrl || !runId || !recipientToken || !recipientUserId) {
    t.todo(
      'BLOCKED: set E2E_API_BASE_URL, E2E_NOTIFICATION_QUEUE_URL, E2E_RUN_ID, E2E_DUPLICATE_RECIPIENT_TOKEN, and E2E_DUPLICATE_RECIPIENT_USER_ID',
    );
    return;
  }

  const eventId = process.env.E2E_DUPLICATE_EVENT_ID || deterministicUuid(`duplicate:${runId}`);
  const occurredAt = new Date().toISOString();
  const endpoint = process.env.E2E_AWS_ENDPOINT_URL;

  const client = createSqsClient({
    ...(endpoint ? { endpoint } : {}),
    region: process.env.E2E_AWS_REGION || 'us-east-1',
  });
  const sqs = createSqsAdapter({ client, queueUrl });

  const event = {
    version: 1,
    eventId,
    type: 'PAYMENT_APPROVED',
    occurredAt,
    organizationId: process.env.E2E_DUPLICATE_ORGANIZATION_ID || deterministicUuid(`org:${runId}`),
    recipientUserId,
    resourceType: 'PAYMENT',
    resourceId: process.env.E2E_DUPLICATE_RESOURCE_ID || deterministicUuid(`payment:${runId}`),
    data: {},
  };

  await sqs.sendJson(event);
  await sqs.sendJson(event);

  let matches = [];
  for (let i = 0; i < 20; i += 1) {
    const notifications = await apiJson(
      baseUrl,
      '/api/v1/notifications',
      { token: recipientToken, expectedStatus: 200 },
    );
    matches = (notifications.data?.items || []).filter(
      (item) => item.notificationId === eventId,
    );
    if (matches.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  assert.equal(matches.length, 1, 'Duplicate event delivery must create exactly one Notification');
  assert.equal(matches[0].notificationId, eventId);
  assert.equal(matches[0].createdAt, occurredAt);
});
