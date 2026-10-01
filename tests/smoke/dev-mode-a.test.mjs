import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const backendRoot = path.join(repoRoot, 'backend');
const frontendRoot = path.join(repoRoot, 'frontend');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function waitForJson(url, { timeoutMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const body = await response.json();
      return { response, body };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
}

test('DEV-001 canonical root docker-compose.dev.yml exposes the complete one-command Dev stack', async () => {
  const composeFile = path.join(repoRoot, 'docker-compose.dev.yml');
  await access(composeFile);

  const result = await execFileAsync(
    'docker',
    ['compose', '-f', composeFile, 'config', '--services'],
    { cwd: repoRoot, maxBuffer: 1024 * 1024 },
  );

  const services = new Set(
    result.stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  );

  for (const service of [
    'localstack',
    'bootstrap',
    'seed',
    'backend',
    'worker',
    'frontend',
  ]) {
    assert.ok(services.has(service), `Expected Compose service "${service}"`);
  }
});

test('DEV-001 canonical LocalStack contains the required DynamoDB table, Files bucket, and SQS queue after one-command Compose startup', async (t) => {
  const composeFile = path.join(repoRoot, 'docker-compose.dev.yml');
  try {
    const ps = await execFileAsync(
      'docker',
      ['compose', '-f', composeFile, 'ps', '--status', 'running', '-q', 'localstack'],
      { cwd: repoRoot, maxBuffer: 1024 * 1024 },
    );
    if (!ps.stdout.trim()) {
      t.todo('BLOCKED: canonical LocalStack container is not running');
      return;
    }
  } catch (error) {
    t.todo(`BLOCKED: Docker/LocalStack is unavailable: ${error.message}`);
    return;
  }

  const awslocal = async (args) => execFileAsync(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'localstack',
      'awslocal',
      ...args,
      '--region',
      'us-east-1',
    ],
    { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 },
  );

  const table = JSON.parse(
    (await awslocal(['dynamodb', 'describe-table', '--table-name', 'unistore-hub-dev-local'])).stdout,
  );
  assert.equal(table.Table?.TableName, 'unistore-hub-dev-local');
  assert.equal(table.Table?.BillingModeSummary?.BillingMode, 'PAY_PER_REQUEST');

  const bucket = JSON.parse(
    (await awslocal(['s3api', 'get-bucket-cors', '--bucket', 'unistore-hub-files-local'])).stdout,
  );
  assert.ok(
    bucket.CORSRules?.some(
      (rule) =>
        rule.AllowedOrigins?.includes('http://localhost:3000') &&
        ['GET', 'PUT', 'HEAD'].every((method) => rule.AllowedMethods?.includes(method)),
    ),
    'Expected canonical Frontend GET/PUT/HEAD CORS on local Files bucket',
  );

  const queue = JSON.parse(
    (await awslocal(['sqs', 'get-queue-url', '--queue-name', 'unistore-hub-notifications-local'])).stdout,
  );
  assert.match(queue.QueueUrl || '', /unistore-hub-notifications-local$/);
});

test('DEV-002 backend local entrypoint serves GET http://localhost:4000/health', async (t) => {
  const localEntrypoint = path.join(backendRoot, 'src', 'local.js');
  await access(localEntrypoint);

  let child;
  try {
    // If port 4000 is already occupied, accept it only when it is clearly the
    // canonical UniStore Hub health endpoint. A different service on the
    // required port is an environment blocker, not a Backend contract failure.
    try {
      const response = await fetch('http://127.0.0.1:4000/health');
      const body = await response.json().catch(() => null);

      if (
        response.status === 200 &&
        body?.success === true &&
        body?.data?.status === 'ok'
      ) {
        return;
      }

      t.todo(
        `BLOCKED: localhost:4000 is occupied by a non-canonical HTTP service (status ${response.status})`,
      );
      return;
    } catch {}

    child = spawn(process.execPath, ['src/local.js'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '4000',
        AWS_REGION: 'us-east-1',
        JWT_SECRET: process.env.JWT_SECRET || 'dev-smoke-only-secret',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const result = await waitForJson('http://127.0.0.1:4000/health');
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, {
      success: true,
      data: { status: 'ok' },
    });
  } finally {
    await stopChild(child);
  }
});

test('DEV-003 Frontend dev server loads at http://localhost:3000', async () => {
  const packagePath = path.join(frontendRoot, 'package.json');
  await access(packagePath);

  const pkg = await readJson(packagePath);
  assert.equal(typeof pkg.scripts?.dev, 'string', 'Expected frontend npm run dev');

  let child;
  try {
    try {
      const existing = await fetch('http://127.0.0.1:3000/');
      assert.ok(existing.status >= 200 && existing.status < 500);
      return;
    } catch {}

    child = spawn('npm', ['run', 'dev'], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        PORT: '3000',
        NEXT_PUBLIC_API_BASE_URL:
          process.env.NEXT_PUBLIC_API_BASE_URL ||
          'http://localhost:4000/api/v1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const deadline = Date.now() + 20000;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const response = await fetch('http://127.0.0.1:3000/');
        assert.ok(response.status >= 200 && response.status < 500);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    throw lastError || new Error('Timed out waiting for Frontend localhost:3000');
  } finally {
    await stopChild(child);
  }
});

test('DEV-004 real local Register -> Login -> Bearer JWT -> GET /me works without auth bypass', async (t) => {
  const backendBaseUrl =
    process.env.TEST_BACKEND_BASE_URL || 'http://127.0.0.1:4000';

  let health;
  try {
    health = await fetch(`${backendBaseUrl.replace(/\/$/, '')}/health`);
  } catch {
    t.todo(`BLOCKED: canonical Backend is not reachable at ${backendBaseUrl}`);
    return;
  }

  const healthBody = await health.json().catch(() => null);
  if (
    health.status !== 200 ||
    healthBody?.success !== true ||
    healthBody?.data?.status !== 'ok'
  ) {
    t.todo(
      `BLOCKED: ${backendBaseUrl} is not the canonical UniStore Hub Backend health endpoint`,
    );
    return;
  }

  const email = `dev-smoke-${Date.now()}-${process.pid}@example.test`;
  const password = 'Dev-smoke-only-Password-123!';

  const register = await fetch(
    `${backendBaseUrl.replace(/\/$/, '')}/api/v1/auth/register`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: 'Dev Smoke User',
      }),
    },
  );
  assert.equal(register.status, 201);
  assert.equal((await register.json()).success, true);

  const login = await fetch(
    `${backendBaseUrl.replace(/\/$/, '')}/api/v1/auth/login`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
  );
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(loginBody.success, true);
  assert.equal(typeof loginBody.data?.token, 'string');

  const me = await fetch(
    `${backendBaseUrl.replace(/\/$/, '')}/api/v1/me`,
    {
      headers: {
        Authorization: `Bearer ${loginBody.data.token}`,
      },
    },
  );
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.success, true);
  assert.equal(meBody.data?.user?.email, email);
});
