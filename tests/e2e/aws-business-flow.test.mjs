import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  apiJson, listAuditItems, registerAndLogin, tinyPng,
  waitForNotification,
} from './live-e2e-helpers.mjs';

const execFileAsync = promisify(execFile);
const REGION = 'us-east-1';
const STACK_NAME = 'unistore-hub-dev';
const ENABLED = process.env.TEST_ENABLE_AWS_BUSINESS_E2E === '1';

// This is deliberately separate from the local-only Live E2E guard. Remote
// business writes require an exact caller-account match and a second explicit
// acknowledgment that records/files will persist in the isolated Learner Lab.
async function requiredIsolatedLab() {
  assert.equal(process.env.TEST_AWS_E2E_CONFIRM, 'DISPOSABLE_LAB_DATA',
    'Set TEST_AWS_E2E_CONFIRM=DISPOSABLE_LAB_DATA to acknowledge persistent synthetic records');
  const expectedAccount = process.env.TEST_AWS_EXPECTED_ACCOUNT_ID;
  assert.match(expectedAccount || '', /^\d{12}$/,
    'A 12-digit TEST_AWS_EXPECTED_ACCOUNT_ID is required');
  assert.ok(process.env.TEST_AWS_PLATFORM_ADMIN_TOKEN,
    'TEST_AWS_PLATFORM_ADMIN_TOKEN must belong to the isolated Learner Lab');
  const awsJson = async (args) => {
    const result = await execFileAsync('aws', [...args, '--region', REGION, '--output', 'json'], {
      timeout: 15000, maxBuffer: 4 * 1024 * 1024,
    });
    return JSON.parse(result.stdout);
  };
  const caller = await awsJson(['sts', 'get-caller-identity']);
  assert.equal(caller.Account, expectedAccount,
    'Refusing to create synthetic data in an unexpected AWS account');
  const response = await awsJson(['cloudformation', 'describe-stacks', '--stack-name', STACK_NAME]);
  const stack = response.Stacks?.[0];
  assert.equal(stack?.StackName, STACK_NAME);
  assert.match(stack?.StackStatus || '', /^(?:CREATE|UPDATE)_COMPLETE$/);
  const outputs = Object.fromEntries((stack.Outputs || []).map(({ OutputKey, OutputValue }) =>
    [OutputKey, OutputValue]));
  assert.ok(outputs.FilesBucketName);
  assert.ok(outputs.ApiBaseURL);
  const api = new URL(outputs.ApiBaseURL);
  assert.equal(api.protocol, 'https:');
  assert.match(api.hostname, /^[-a-z0-9]+\.execute-api\.us-east-1\.amazonaws\.com$/);
  assert.equal(api.pathname, '/dev');
  return outputs;
}

function assertPrivatePresignedS3Target(raw, bucket) {
  const url = new URL(raw);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.ok(
    url.hostname === `${bucket}.s3.us-east-1.amazonaws.com` ||
    url.hostname === `${bucket}.s3.amazonaws.com` ||
    (url.hostname === 's3.us-east-1.amazonaws.com' && url.pathname.startsWith(`/${bucket}/`)),
    'Refusing to send a test file to an unexpected upload destination',
  );
  assert.ok(url.searchParams.has('X-Amz-Signature'),
    'Expected an actual AWS S3 pre-signed URL');
}

async function putImage(base, route, token, bucket) {
  const signed = await apiJson(base, route, {
    method: 'POST', token, body: { contentType: 'image/png' }, expectedStatus: 200,
  });
  assert.equal(signed.data.method, 'PUT');
  assertPrivatePresignedS3Target(signed.data.url, bucket);
  const put = await fetch(signed.data.url, {
    method: 'PUT', headers: { 'Content-Type': 'image/png' },
    body: tinyPng, signal: AbortSignal.timeout(15000),
  });
  assert.equal(put.status, 200, 'S3 image upload must succeed');
  return signed.data.objectKey;
}

test('AWS-BUSINESS-001 isolated AWS register -> S3 -> payment -> SQS -> pickup -> audit', {
  timeout: 180000,
}, async (t) => {
  if (!ENABLED) {
    t.skip('Requires TEST_ENABLE_AWS_BUSINESS_E2E=1 and an authorized isolated Learner Lab');
    return;
  }
  const outputs = await requiredIsolatedLab(); // Must pass BEFORE any writes
  const base = outputs.ApiBaseURL;
  const run = randomUUID().slice(0, 12);
  const prefix = `unistore-aws-e2e-${run}`;
  const password = `Disposable-${randomBytes(24).toString('hex')}!`;
  const adminEmail = `${prefix}-admin@example.test`;
  const staffEmail = `${prefix}-staff@example.test`;
  const customerEmail = `${prefix}-customer@example.test`;

  // Only synthetic accounts/organization created by this run are modified.
  const [admin, staff, customer] = await Promise.all([
    registerAndLogin(base, { email: adminEmail, password, name: `AWS E2E Admin ${run}` }),
    registerAndLogin(base, { email: staffEmail, password, name: `AWS E2E Staff ${run}` }),
    registerAndLogin(base, { email: customerEmail, password, name: `AWS E2E Customer ${run}` }),
  ]);
  const org = await apiJson(base, '/api/v1/organizations', {
    method: 'POST', token: admin.token,
    body: { name: `AWS E2E Organization ${run}`, description: 'Disposable Learner Lab verification' },
    expectedStatus: 201,
  });
  const organizationId = org.data.organizationId;
  if (org.data.status === 'PENDING') {
    await apiJson(base, `/api/v1/platform/organizations/${organizationId}/approve`, {
      method: 'POST', token: process.env.TEST_AWS_PLATFORM_ADMIN_TOKEN,
      expectedStatus: 200,
    });
  }
  await apiJson(base, `/api/v1/organizations/${organizationId}/members`, {
    method: 'POST', token: admin.token,
    body: { email: staffEmail, role: 'STAFF' }, expectedStatus: 201,
  });

  const store = await apiJson(base, `/api/v1/organizations/${organizationId}/stores`, {
    method: 'POST', token: admin.token,
    body: { name: `AWS E2E Store ${run}`, description: 'Isolated test store' },
    expectedStatus: 201,
  });
  const storeId = store.data.storeId;
  const storeImageKey = await putImage(base,
    `/api/v1/organizations/${organizationId}/stores/${storeId}/image-upload-url`,
    admin.token, outputs.FilesBucketName);
  await apiJson(base, `/api/v1/organizations/${organizationId}/stores/${storeId}`, {
    method: 'PATCH', token: admin.token, body: { imageKey: storeImageKey }, expectedStatus: 200,
  });

  const product = await apiJson(base, `/api/v1/organizations/${organizationId}/products`, {
    method: 'POST', token: admin.token,
    body: { storeId, name: `AWS E2E Product ${run}`, description: 'Isolated test product' },
    expectedStatus: 201,
  });
  const productId = product.data.productId;
  const productImageKey = await putImage(base,
    `/api/v1/organizations/${organizationId}/products/${productId}/image-upload-url`,
    admin.token, outputs.FilesBucketName);
  await apiJson(base, `/api/v1/organizations/${organizationId}/products/${productId}`, {
    method: 'PATCH', token: admin.token, body: { imageKey: productImageKey }, expectedStatus: 200,
  });
  const variant = await apiJson(base,
    `/api/v1/organizations/${organizationId}/products/${productId}/variants`, {
      method: 'POST', token: admin.token, body: { name: 'Default', price: 15000 },
      expectedStatus: 201,
    });

  const campaign = await apiJson(base, `/api/v1/organizations/${organizationId}/campaigns`, {
    method: 'POST', token: admin.token,
    body: {
      storeId, name: `AWS E2E Campaign ${run}`,
      openAt: '2030-02-01T00:00:00.000Z',
      closeAt: '2030-02-10T23:59:59.000Z',
      paymentDeadline: '2030-02-11T23:59:59.000Z',
      pickupAt: '2030-02-25T09:00:00.000Z',
    },
    expectedStatus: 201,
  });
  const campaignId = campaign.data.campaignId;
  await apiJson(base, `/api/v1/organizations/${organizationId}/campaigns/${campaignId}/open`, {
    method: 'POST', token: admin.token, expectedStatus: 200,
  });
  const order = await apiJson(base, `/api/v1/organizations/${organizationId}/orders`, {
    method: 'POST', token: customer.token,
    body: { campaignId, items: [{
      productId, variantId: variant.data.variantId, quantity: 1,
    }] },
    expectedStatus: 201,
  });
  assert.equal(order.data.status, 'PENDING_PAYMENT');
  const orderId = order.data.orderId;

  // Payment Slip uses the same private S3 bucket but must be owned by customer.
  const slip = await apiJson(base,
    `/api/v1/organizations/${organizationId}/orders/${orderId}/payment-slip-upload-url`, {
      method: 'POST', token: customer.token,
      body: { contentType: 'image/png' }, expectedStatus: 200,
    });
  assertPrivatePresignedS3Target(slip.data.url, outputs.FilesBucketName);
  const uploaded = await fetch(slip.data.url, {
    method: 'PUT', headers: { 'Content-Type': 'image/png' },
    body: tinyPng, signal: AbortSignal.timeout(15000),
  });
  assert.equal(uploaded.status, 200);
  const payment = await apiJson(base,
    `/api/v1/organizations/${organizationId}/orders/${orderId}/payment`, {
      method: 'POST', token: customer.token,
      body: { slipKey: slip.data.objectKey }, expectedStatus: 201,
    });
  const paymentId = payment.data.paymentId;
  await apiJson(base, `/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`, {
    method: 'POST', token: staff.token, expectedStatus: 200,
  });
  const paid = await apiJson(base, `/api/v1/me/orders/${orderId}`, {
    token: customer.token, expectedStatus: 200,
  });
  assert.equal(paid.data.status, 'PAID');
  await waitForNotification(base, customer.token, {
    type: 'PAYMENT_APPROVED', resourceId: paymentId, attempts: 40,
  });
  for (const step of ['close', 'start-production', 'ready-for-pickup']) {
    await apiJson(base, `/api/v1/organizations/${organizationId}/campaigns/${campaignId}/${step}`, {
      method: 'POST', token: admin.token, expectedStatus: 200,
    });
  }
  const pickup = await apiJson(base, `/api/v1/me/orders/${orderId}/pickup`, {
    token: customer.token, expectedStatus: 200,
  });
  await waitForNotification(base, customer.token, {
    type: 'READY_FOR_PICKUP', resourceId: pickup.data.pickupId, attempts: 40,
  });
  await apiJson(base,
    `/api/v1/organizations/${organizationId}/pickups/${pickup.data.pickupId}/confirm`, {
      method: 'POST', token: staff.token, expectedStatus: 200,
    });
  const received = await apiJson(base, `/api/v1/me/orders/${orderId}`, {
    token: customer.token, expectedStatus: 200,
  });
  assert.equal(received.data.status, 'RECEIVED');
  const audit = await listAuditItems(base, admin.token, organizationId, {
    action: 'PAYMENT_APPROVED', resourceType: 'PAYMENT', resourceId: paymentId,
  });
  assert.ok(audit.some(entry => entry.action === 'PAYMENT_APPROVED' && entry.resourceId === paymentId));
});
