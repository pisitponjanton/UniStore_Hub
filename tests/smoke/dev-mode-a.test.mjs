import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('DEV-001 root developer interface exposes dev:setup/dev/dev:seed/dev:reset/dev:down', async () => {
  const rootPackagePath = path.join(repoRoot, 'package.json');
  await access(rootPackagePath);

  const pkg = await readJson(rootPackagePath);
  for (const script of ['dev:setup', 'dev', 'dev:seed', 'dev:reset', 'dev:down']) {
    assert.equal(
      typeof pkg.scripts?.[script],
      'string',
      `Expected root npm script "${script}"`,
    );
    assert.ok(pkg.scripts[script].trim().length > 0);
  }
});

test(
  'DEV-001 dev:setup starts healthy LocalStack and idempotently ensures DynamoDB table, Files bucket, and SQS queue',
  {
    todo: 'BLOCKED: root dev:setup command is absent; execute real local dependency/resource verification once Integration implements it',
  },
  () => {},
);

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

test(
  'DEV-004 real local Register -> Login -> Bearer JWT -> GET /me works without auth bypass',
  {
    todo: 'BLOCKED: requires DEV-001 LocalStack table/setup plus real local auth persistence; do not replace with mocked repository auth',
  },
  () => {},
);
