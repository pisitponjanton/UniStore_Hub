import test from 'node:test';
import { assertBackendSuiteEvidence } from '../helpers/backend-suite-evidence.mjs';
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
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-008 Product Image objectKey is products/{organizationId}/{productId}/{uuid}',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-009 Product Image accepts only jpeg/png/webp and rejects objects larger than 5 MiB',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-010 Product imageKey is persisted only after HEAD verifies existing object, allowed MIME, and size',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-011 public Storefront imageUrl derives only from stored Product imageKey and cannot sign arbitrary keys',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-012 Payment Slip objectKey is payments/{organizationId}/{orderId}/{uuid}',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-013 Payment Slip accepts only jpeg/png/webp and rejects objects larger than 10 MiB',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-014 Customer can request Payment Slip URLs only for own Order',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-015 Staff/Admin can view Payment Slip only inside authorized Organization',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-016 arbitrary or cross-path object keys are rejected before upload acceptance/download signing',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test(
  'CT-FILE-017 Payment slipKey is accepted only after HEAD verifies existing object, allowed MIME, and size',
  async () => {
    await assertBackendSuiteEvidence(["files.test.js"]);
  },
);

test('CT-FILE-018 private file bucket/object is not publicly readable', async (t) => {
  // Test only the canonical loopback LocalStack; never infer or use live AWS credentials.
  const endpoint = 'http://127.0.0.1:4566';
  const health = await fetch(endpoint + '/_localstack/health', {
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);
  if (!health?.ok) {
    t.todo('BLOCKED: canonical loopback LocalStack endpoint is unavailable');
    return;
  }

  const { randomUUID } = await import('node:crypto');
  const sdk = requireFromHere('../../backend/node_modules/@aws-sdk/client-s3');
  const client = new sdk.S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  const bucket = 'unistore-hub-files-local';
  const key = `phase1-private-qa/${randomUUID()}.png`;
  const object = { Bucket: bucket, Key: key };
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKxkAAAAASUVORK5CYII=',
    'base64',
  );

  try {
    await client.send(new sdk.PutObjectCommand({
      ...object,
      Body: tinyPng,
      ContentType: 'image/png',
    }));
    const stored = await client.send(new sdk.HeadObjectCommand(object));
    assert.equal(stored.ContentType, 'image/png');
    assert.equal(stored.ContentLength, tinyPng.length);

    const block = await client.send(new sdk.GetPublicAccessBlockCommand({ Bucket: bucket }));
    for (const name of [
      'BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets',
    ]) {
      assert.equal(block.PublicAccessBlockConfiguration?.[name], true, name);
    }

    const anonymous = await fetch(
      `${endpoint}/${bucket}/${key}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (anonymous.status === 200) {
      // LocalStack 3.8.1 accepts unsigned GET despite all four public-access
      // block flags. Do not misrepresent this as proof of private S3 access.
      t.todo(
        'BLOCKED: LocalStack accepts unsigned object GET despite full public access block; verify anonymous access on an authorized isolated AWS S3 bucket before production sign-off',
      );
      return;
    }
    assert.equal(anonymous.status, 403, 'Unsigned private object GET must be denied');
  } finally {
    try {
      await client.send(new sdk.DeleteObjectCommand(object));
    } finally {
      client.destroy();
    }
  }
});

test(
  'CT-FILE-019 binary file transfer occurs Browser-to-S3 and the API does not proxy raw file bodies',
  { todo: 'BLOCKED: requires integrated Frontend/file workflow or deployed HTTP observation to prove transfer boundary end-to-end' },
  () => {},
);
