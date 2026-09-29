import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertIsoUtcTimestamp,
  assertUuidV4,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const requireFromHere = createRequire(import.meta.url);

const { createId } = requireFromHere('../../backend/src/utils/id.js');
const { nowIsoUtc } = requireFromHere('../../backend/src/utils/time.js');
const keys = requireFromHere('../../backend/src/repositories/keys.js');
const { buildAwsClientOptions } = requireFromHere(
  '../../backend/src/aws/client-options.js',
);
const { createS3Client } = requireFromHere('../../backend/src/aws/s3.js');

const fixture = createFixtureFactory({ seed: 'DEV-MODE-B' });
const organizationId = fixture.id('organization', 1);
const campaignId = fixture.id('campaign', 1);
const orderId = fixture.id('order', 1);

test('DEV-005 shared Backend primitives preserve production Data semantics in Dev Mode', () => {
  const id = createId();
  const timestamp = nowIsoUtc();

  assertUuidV4(id, 'Dev Mode createId()');
  assertIsoUtcTimestamp(timestamp, 'Dev Mode nowIsoUtc()');

  assert.deepEqual(keys.campaignOrderLinkKey(
    organizationId,
    campaignId,
    timestamp,
    orderId,
  ), {
    PK: `ORG#${organizationId}`,
    SK: `CAMPAIGN#${campaignId}#ORDER#${timestamp}#${orderId}`,
  });
});

test(
  'DEV-005 LocalStack DynamoDB round-trip uses the same entity/key/status shapes as the Data Spec',
  {
    todo: 'BLOCKED: requires DEV-001 LocalStack setup/table plus implemented Order/Payment/Pickup persistence for a real parity round-trip',
  },
  () => {},
);

test('DEV-006 AWS client configuration accepts the canonical LocalStack endpoint', async () => {
  const endpoint = 'http://localhost:4566';
  const options = buildAwsClientOptions({
    endpoint,
    region: 'us-east-1',
  });

  assert.equal(options.endpoint, endpoint);
  assert.equal(options.region, 'us-east-1');

  const s3 = createS3Client({
    endpoint,
    region: 'us-east-1',
  });

  assert.equal(s3.config.forcePathStyle, true);
  const resolvedEndpoint = await s3.config.endpoint();
  assert.equal(resolvedEndpoint.protocol, 'http:');
  assert.equal(resolvedEndpoint.hostname, 'localhost');
  assert.equal(resolvedEndpoint.port, 4566);
});

test(
  'DEV-006 Payment Slip uses Backend-authorized pre-sign then Browser-to-LocalStack-S3 PUT with canonical key/MIME/size rules',
  {
    todo: 'BLOCKED: Payment/File services and DEV-001 Files bucket/CORS setup are not implemented end-to-end yet',
  },
  () => {},
);

test('DEV-007 required Local Worker entrypoint exists for LocalStack SQS consumption', async () => {
  await access(path.join(repoRoot, 'backend', 'src', 'worker.js'));
});

test(
  'DEV-007 Backend -> LocalStack SQS -> Local Worker -> DynamoDB Notification preserves canonical event/data semantics',
  {
    todo: 'BLOCKED: backend/src/worker.js and Notification persistence are absent; requires real LocalStack queue/table flow',
  },
  () => {},
);

test('DEV-008 root dev:reset command exists and its implementation contains a local-endpoint safety guard', async () => {
  const packagePath = path.join(repoRoot, 'package.json');
  await access(packagePath);

  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.equal(typeof pkg.scripts?.['dev:reset'], 'string');

  const resetCommand = pkg.scripts['dev:reset'];
  assert.ok(resetCommand.trim().length > 0);

  const candidateScript = resetCommand
    .split(/\s+/)
    .find((part) => /(?:scripts\/|\.\/).*?(?:reset|dev)/i.test(part));

  assert.ok(
    candidateScript,
    'dev:reset must point to an inspectable local reset implementation',
  );

  const scriptPath = path.resolve(repoRoot, candidateScript);
  const source = await readFile(scriptPath, 'utf8');

  assert.match(source, /AWS_ENDPOINT_URL/);
  assert.match(source, /localhost|127\.0\.0\.1|localstack/i);
  assert.match(source, /abort|refus|exit|throw/i);
});

test(
  'DEV-008 dev:reset refuses a non-local AWS endpoint without deleting any resource',
  {
    todo: 'BLOCKED: root dev:reset implementation is absent; execute a non-local endpoint refusal test once Integration provides it',
  },
  () => {},
);

test('DEV-009 development mode still requires authentication on protected Organization routes', async () => {
  await withBackendServer(async ({ baseUrl }) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/organizations/${organizationId}/stores`,
    });

    assertHttpStatus(result, 401);
    assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  });
});

test(
  'DEV-009 Dev Mode enforces tenant membership, RBAC, ownership, Campaign transitions, Payment review rules, and Pickup duplicate protection exactly as production contracts',
  {
    todo: 'BLOCKED: requires DEV-001 disposable LocalStack data plus the currently missing Store/Order/Payment/Pickup business flows',
  },
  () => {},
);
