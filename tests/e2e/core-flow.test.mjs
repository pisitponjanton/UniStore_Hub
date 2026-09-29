import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const REQUIRED_BACKEND_FILES = [
  'backend/src/modules/campaigns/campaign.routes.js',
  'backend/src/modules/orders/order.routes.js',
  'backend/src/modules/payments/payment.routes.js',
  'backend/src/modules/production/production.routes.js',
  'backend/src/modules/pickups/pickup.routes.js',
  'backend/src/modules/notifications/notification.routes.js',
  'backend/src/worker.js',
];

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKxkAAAAASUVORK5CYII=',
  'base64',
);

async function missingBackendFiles() {
  const missing = [];
  for (const relativePath of REQUIRED_BACKEND_FILES) {
    try {
      await access(path.join(repoRoot, relativePath));
    } catch {
      missing.push(relativePath);
    }
  }
  return missing;
}

async function apiJson(baseUrl, route, {
  method = 'GET',
  token,
  body,
  expectedStatus,
} = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  const raw = await response.text();
  let parsed = null;
  if (raw) {
    parsed = JSON.parse(raw);
  }

  if (expectedStatus !== undefined) {
    assert.equal(
      response.status,
      expectedStatus,
      `${method} ${route} expected ${expectedStatus}, got ${response.status}: ${raw}`,
    );
  } else {
    assert.ok(
      response.status >= 200 && response.status < 300,
      `${method} ${route} failed with ${response.status}: ${raw}`,
    );
  }

  if (response.status !== 204) {
    assert.equal(parsed?.success, true, `${method} ${route} must return success envelope`);
  }

  return {
    status: response.status,
    body: parsed,
    data: parsed?.data,
  };
}

async function registerAndLogin(baseUrl, { email, password, name }) {
  await apiJson(baseUrl, '/api/v1/auth/register', {
    method: 'POST',
    body: { email, password, name },
    expectedStatus: 201,
  });

  const login = await apiJson(baseUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
    expectedStatus: 200,
  });

  assert.equal(typeof login.data?.token, 'string');
  assert.ok(login.data.token.length > 0);
  return login.data;
}

async function waitForReadyNotification(baseUrl, token, { attempts = 20 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const response = await apiJson(baseUrl, '/api/v1/notifications?read=false', {
      token,
      expectedStatus: 200,
    });

    const items = response.data?.items || [];
    const match = items.find((item) => item.type === 'READY_FOR_PICKUP');
    if (match) return match;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  assert.fail('READY_FOR_PICKUP notification did not arrive within polling window');
}

test('E2E-CORE-001 canonical register-to-received flow', async (t) => {
  const missing = await missingBackendFiles();
  if (missing.length > 0) {
    t.todo(
      `BLOCKED: core E2E owning implementations are incomplete: ${missing.join(', ')}`,
    );
    return;
  }

  const baseUrl = process.env.E2E_API_BASE_URL;
  const runId = process.env.E2E_RUN_ID;
  const platformAdminToken = process.env.E2E_PLATFORM_ADMIN_TOKEN;

  if (!baseUrl || !runId) {
    t.todo(
      'BLOCKED: set E2E_API_BASE_URL and deterministic E2E_RUN_ID for disposable core-flow data',
    );
    return;
  }

  const password = process.env.E2E_TEST_PASSWORD || 'E2e-only-Strong-Password-123!';
  const prefix = `unistore-e2e-${runId}`;
  const adminEmail = `${prefix}-admin@example.test`;
  const staffEmail = `${prefix}-staff@example.test`;
  const customerEmail = `${prefix}-customer@example.test`;

  // Register -> Login
  const admin = await registerAndLogin(baseUrl, {
    email: adminEmail,
    password,
    name: `E2E Admin ${runId}`,
  });
  const staff = await registerAndLogin(baseUrl, {
    email: staffEmail,
    password,
    name: `E2E Staff ${runId}`,
  });
  const customer = await registerAndLogin(baseUrl, {
    email: customerEmail,
    password,
    name: `E2E Customer ${runId}`,
  });

  // Create/Access Organization
  const createdOrg = await apiJson(baseUrl, '/api/v1/organizations', {
    method: 'POST',
    token: admin.token,
    body: {
      name: `E2E Organization ${runId}`,
      description: 'Disposable E2E core-flow organization',
    },
    expectedStatus: 201,
  });
  const organizationId = createdOrg.data.organizationId;
  assert.ok(organizationId);

  // Newly created Organizations are PENDING by the current data contract.
  // Activate through the documented Platform Admin action before operational
  // Store/Product/Campaign work if the environment requires it.
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

  // Staff account exists before Organization Admin adds it by email.
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

  // Create Store
  const store = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/stores`,
    {
      method: 'POST',
      token: admin.token,
      body: {
        name: `E2E Store ${runId}`,
        description: 'Disposable E2E store',
      },
      expectedStatus: 201,
    },
  );
  const storeId = store.data.storeId;

  // Create Product / Variant
  const product = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/products`,
    {
      method: 'POST',
      token: admin.token,
      body: {
        storeId,
        name: `E2E Shirt ${runId}`,
        description: 'Disposable E2E product',
      },
      expectedStatus: 201,
    },
  );
  const productId = product.data.productId;

  const variant = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/products/${productId}/variants`,
    {
      method: 'POST',
      token: admin.token,
      body: {
        name: 'Size M',
        price: 25000,
      },
      expectedStatus: 201,
    },
  );
  const variantId = variant.data.variantId;

  // Create Campaign -> Open
  const campaign = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns`,
    {
      method: 'POST',
      token: admin.token,
      body: {
        storeId,
        name: `E2E Campaign ${runId}`,
        openAt: '2030-01-01T00:00:00.000Z',
        closeAt: '2030-01-10T23:59:59.000Z',
        paymentDeadline: '2030-01-11T23:59:59.000Z',
        pickupAt: '2030-01-25T09:00:00.000Z',
      },
      expectedStatus: 201,
    },
  );
  const campaignId = campaign.data.campaignId;
  assert.equal(campaign.data.status, 'DRAFT');

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns/${campaignId}/open`,
    { method: 'POST', token: admin.token, expectedStatus: 200 },
  );

  // Customer creates Order
  const order = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders`,
    {
      method: 'POST',
      token: customer.token,
      body: {
        campaignId,
        items: [
          {
            productId,
            variantId,
            quantity: 2,
          },
        ],
      },
      expectedStatus: 201,
    },
  );
  const orderId = order.data.orderId;
  assert.equal(order.data.status, 'PENDING_PAYMENT');
  assert.equal(order.data.items[0].unitPrice, 25000);
  assert.equal(order.data.items[0].quantity, 2);
  assert.equal(order.data.items[0].totalPrice, 50000);
  assert.equal(order.data.total, 50000);

  // Customer uploads Payment Slip through Backend-authorized pre-sign.
  const upload = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders/${orderId}/payment-slip-upload-url`,
    {
      method: 'POST',
      token: customer.token,
      body: { contentType: 'image/png' },
      expectedStatus: 200,
    },
  );
  assert.equal(upload.data.method, 'PUT');
  assert.equal(upload.data.expiresInSeconds, 900);
  assert.match(
    upload.data.objectKey,
    new RegExp(`^payments/${organizationId}/${orderId}/`),
  );

  const putResponse = await fetch(upload.data.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: tinyPng,
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(putResponse.ok, `Pre-signed Payment Slip PUT failed: ${putResponse.status}`);

  const payment = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders/${orderId}/payment`,
    {
      method: 'POST',
      token: customer.token,
      body: { slipKey: upload.data.objectKey },
      expectedStatus: 201,
    },
  );
  const paymentId = payment.data.paymentId;
  assert.equal(payment.data.status, 'PENDING_REVIEW');

  // Staff approves Payment while Campaign is OPEN -> Order PAID.
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`,
    { method: 'POST', token: staff.token, expectedStatus: 200 },
  );

  let ownOrder = await apiJson(baseUrl, `/api/v1/me/orders/${orderId}`, {
    token: customer.token,
    expectedStatus: 200,
  });
  assert.equal(ownOrder.data.status, 'PAID');

  // Production Summary includes the paid Order.
  const production = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/production?campaignId=${campaignId}`,
    { token: admin.token, expectedStatus: 200 },
  );
  const productGroup = production.data.products.find(
    (item) => item.productId === productId,
  );
  assert.ok(productGroup, 'Paid Product must appear in Production Summary');
  const variantGroup = productGroup.variants.find(
    (item) => item.variantId === variantId,
  );
  assert.equal(variantGroup?.quantity, 2);

  // Explicit resolved post-PAID progression.
  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns/${campaignId}/close`,
    { method: 'POST', token: admin.token, expectedStatus: 200 },
  );
  ownOrder = await apiJson(baseUrl, `/api/v1/me/orders/${orderId}`, {
    token: customer.token,
    expectedStatus: 200,
  });
  assert.equal(ownOrder.data.status, 'CONFIRMED');

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns/${campaignId}/start-production`,
    { method: 'POST', token: admin.token, expectedStatus: 200 },
  );
  ownOrder = await apiJson(baseUrl, `/api/v1/me/orders/${orderId}`, {
    token: customer.token,
    expectedStatus: 200,
  });
  assert.equal(ownOrder.data.status, 'IN_PRODUCTION');

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/campaigns/${campaignId}/ready-for-pickup`,
    { method: 'POST', token: admin.token, expectedStatus: 200 },
  );
  ownOrder = await apiJson(baseUrl, `/api/v1/me/orders/${orderId}`, {
    token: customer.token,
    expectedStatus: 200,
  });
  assert.equal(ownOrder.data.status, 'READY_FOR_PICKUP');

  // Customer receives Ready for Pickup notification.
  const notification = await waitForReadyNotification(
    baseUrl,
    customer.token,
  );
  assert.equal(notification.type, 'READY_FOR_PICKUP');

  // Customer obtains own Pickup; Staff confirms it.
  const pickup = await apiJson(
    baseUrl,
    `/api/v1/me/orders/${orderId}/pickup`,
    { token: customer.token, expectedStatus: 200 },
  );
  assert.equal(pickup.data.status, 'READY');
  assert.ok(pickup.data.pickupId);
  assert.ok(pickup.data.token);

  await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/pickups/${pickup.data.pickupId}/confirm`,
    { method: 'POST', token: staff.token, expectedStatus: 200 },
  );

  ownOrder = await apiJson(baseUrl, `/api/v1/me/orders/${orderId}`, {
    token: customer.token,
    expectedStatus: 200,
  });
  assert.equal(ownOrder.data.status, 'RECEIVED');
});
