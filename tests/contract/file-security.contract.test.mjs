import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const requireFromHere = createRequire(import.meta.url);
const {
  DEFAULT_PRESIGN_EXPIRES_SECONDS,
  createS3Adapter,
} = requireFromHere('../../backend/src/aws/s3.js');

const fixture = createFixtureFactory({ seed: 'CT-FILE-SECURITY' });
const organizationId = fixture.id('organization', 1);
const productId = fixture.id('product', 1);
const orderId = fixture.id('order', 1);

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-FILE-001 product image upload URL requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/products/${productId}/image-upload-url`,
      method: 'POST',
      body: { contentType: 'image/png' },
    });

    assertAuthRequired(result);
  });
});

test('CT-FILE-002 payment slip upload URL requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/orders/${orderId}/payment-slip-upload-url`,
      method: 'POST',
      body: { contentType: 'image/png' },
    });

    assertAuthRequired(result);
  });
});

test('CT-FILE-003 private file download URL requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/files/download-url`,
      method: 'POST',
      body: {
        objectKey: `payments/${organizationId}/${orderId}/${fixture.id('slip', 1)}`,
      },
    });

    assertAuthRequired(result);
  });
});

test('CT-FILE-004 S3 pre-signed URL default expiry is exactly 900 seconds', () => {
  assert.equal(DEFAULT_PRESIGN_EXPIRES_SECONDS, 900);
});

test('CT-FILE-005 S3 adapter exposes direct PUT, GET, and HEAD primitives rather than file proxying', () => {
  const adapter = createS3Adapter({
    bucketName: 'test-only-private-files',
    client: { send: async () => ({}) },
  });

  assert.equal(typeof adapter.createPutUrl, 'function');
  assert.equal(typeof adapter.createGetUrl, 'function');
  assert.equal(typeof adapter.headObject, 'function');
});

test('CT-FILE-006 backend app does not configure a raw/multipart upload parser for documented file flow', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const appPath = path.resolve(here, '../../backend/src/app.js');
  const source = await readFile(appPath, 'utf8');

  assert.doesNotMatch(source, /express\.raw\s*\(/);
  assert.doesNotMatch(source, /\bmulter\b/);
  assert.doesNotMatch(source, /\bbusboy\b/);
  assert.doesNotMatch(source, /\bformidable\b/);
});

test(
  'CT-FILE-007 Product Image upload is authorized only for the correct Product and Organization',
  { todo: 'BLOCKED: requires mounted Product image signing route plus authenticated tenant Product fixture' },
  () => {},
);

test(
  'CT-FILE-008 Product Image objectKey is products/{organizationId}/{productId}/{uuid}',
  { todo: 'BLOCKED: requires implemented Product image signing service and generated pre-signed response' },
  () => {},
);

test(
  'CT-FILE-009 Product Image accepts only jpeg/png/webp and rejects objects larger than 5 MiB',
  { todo: 'BLOCKED: requires Product file validation plus S3/LocalStack HEAD metadata fixtures' },
  () => {},
);

test(
  'CT-FILE-010 Product imageKey is persisted only after HEAD verifies existing object, allowed MIME, and size',
  { todo: 'BLOCKED: requires Product persistence plus forged missing/wrong-type/wrong-size S3 objects' },
  () => {},
);

test(
  'CT-FILE-011 public Storefront imageUrl derives only from stored Product imageKey and cannot sign arbitrary keys',
  { todo: 'BLOCKED: requires Product/storefront implementation and Product image fixture' },
  () => {},
);

test(
  'CT-FILE-012 Payment Slip objectKey is payments/{organizationId}/{orderId}/{uuid}',
  { todo: 'BLOCKED: requires implemented Payment Slip signing service and owned Order fixture' },
  () => {},
);

test(
  'CT-FILE-013 Payment Slip accepts only jpeg/png/webp and rejects objects larger than 10 MiB',
  { todo: 'BLOCKED: requires Payment file validation plus S3/LocalStack HEAD metadata fixtures' },
  () => {},
);

test(
  'CT-FILE-014 Customer can request Payment Slip URLs only for own Order',
  { todo: 'BLOCKED: requires two Customer fixtures, one owned Order, and mounted file routes' },
  () => {},
);

test(
  'CT-FILE-015 Staff/Admin can view Payment Slip only inside authorized Organization',
  { todo: 'BLOCKED: requires two-tenant Staff/Admin fixtures, Payment Slip object, and private download implementation' },
  () => {},
);

test(
  'CT-FILE-016 arbitrary or cross-path object keys are rejected before upload acceptance/download signing',
  { todo: 'BLOCKED: requires implemented object ownership/path authorization for Product and Payment files' },
  () => {},
);

test(
  'CT-FILE-017 Payment slipKey is accepted only after HEAD verifies existing object, allowed MIME, and size',
  { todo: 'BLOCKED: requires Payment submission implementation and forged missing/wrong-type/wrong-size S3 objects' },
  () => {},
);

test(
  'CT-FILE-018 private file bucket/object is not publicly readable',
  { todo: 'BLOCKED: requires LocalStack/AWS deployed bucket policy/public-access-block verification' },
  () => {},
);

test(
  'CT-FILE-019 binary file transfer occurs Browser-to-S3 and the API does not proxy raw file bodies',
  { todo: 'BLOCKED: requires integrated Frontend/file workflow or deployed HTTP observation to prove transfer boundary end-to-end' },
  () => {},
);
