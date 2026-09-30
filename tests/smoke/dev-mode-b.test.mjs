import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertIsoUtcTimestamp,
  assertUuidV4,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const execFileAsync = promisify(execFile);
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
    todo: 'BLOCKED: requires the canonical LocalStack runtime/table to be running plus disposable Order/Payment/Pickup fixtures for a real persistence parity round-trip',
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
    todo: 'BLOCKED by current local qualification failure: Backend-issued LocalStack Payment Slip pre-signed PUT returns HTTP 400 due invalid x-amz-checksum-crc32',
  },
  () => {},
);

test('DEV-007 required Local Worker entrypoint exists for LocalStack SQS consumption', async () => {
  await access(path.join(repoRoot, 'backend', 'src', 'worker.js'));
});

test(
  'DEV-007 Backend -> LocalStack SQS -> Local Worker -> DynamoDB Notification preserves canonical event/data semantics',
  {
    todo: 'BLOCKED: Worker/Notification implementation exists; execute this full business-event path only against the canonical running Backend + Local Worker + LocalStack environment',
  },
  () => {},
);

test('DEV-008 root dev:reset command is wired to the shared strict LocalStack safety guard', async (t) => {
  const packagePath = path.join(repoRoot, 'package.json');
  try {
    await access(packagePath);
  } catch {
    t.todo('BLOCKED: Integration-owned root package.json is not present in this checkout');
    return;
  }

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
  const resetSource = await readFile(scriptPath, 'utf8');
  assert.match(resetSource, /dev_validate_local_contract/);
  assert.match(resetSource, /lib\/dev-common\.sh/);

  const sharedGuardSource = await readFile(
    path.join(repoRoot, 'scripts', 'lib', 'dev-common.sh'),
    'utf8',
  );
  assert.match(sharedGuardSource, /AWS_ENDPOINT_URL/);
  assert.match(sharedGuardSource, /localhost:4566|127\.0\.0\.1:4566/);
  assert.match(sharedGuardSource, /Refusing local Dev operation/i);
});

test('DEV-008 dev:reset refuses a non-local AWS endpoint before any destructive operation', async () => {
  const scriptPath = path.join(repoRoot, 'scripts', 'dev-reset.sh');

  await assert.rejects(
    execFileAsync('bash', [scriptPath, '--yes'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        AWS_ENDPOINT_URL: 'https://example.invalid',
      },
      maxBuffer: 1024 * 1024,
    }),
    (error) => {
      const output = `${error.stdout || ''}\n${error.stderr || ''}`;
      assert.match(output, /Refusing local Dev operation/i);
      assert.match(output, /example\.invalid/);
      return true;
    },
  );
});

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
    todo: 'BLOCKED: current business-flow E2E reaches Payment Slip upload but cannot continue past the LocalStack pre-signed PUT checksum failure',
  },
  () => {},
);
