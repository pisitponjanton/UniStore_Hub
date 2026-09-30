import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
export const frontendRoot = path.resolve(here, '../../frontend');
const testsRoot = path.resolve(here, '..');
const vitestBin = path.join(
  frontendRoot,
  'node_modules',
  'vitest',
  'vitest.mjs',
);
const nextBin = path.join(
  frontendRoot,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

const suiteCache = new Map();
const frontendHarnessLockDir = path.join(
  testsRoot,
  '.tmp',
  'frontend-harness.lock',
);
let buildPromise;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    return true;
  }
}

async function lockOwnerIsAlive() {
  try {
    const owner = JSON.parse(
      await readFile(path.join(frontendHarnessLockDir, 'owner.json'), 'utf8'),
    );
    return isProcessAlive(owner.pid);
  } catch {
    // A contender can observe the directory between mkdir() and owner.json.
    // Treat an unreadable owner as live and wait rather than deleting a lock
    // that may have just been acquired by another test process.
    return true;
  }
}

async function withFrontendHarnessLock(run, { timeoutMs = 90000 } = {}) {
  await mkdir(path.dirname(frontendHarnessLockDir), { recursive: true });

  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      await mkdir(frontendHarnessLockDir);
      await writeFile(
        path.join(frontendHarnessLockDir, 'owner.json'),
        JSON.stringify({
          pid: process.pid,
          startedAt: new Date().toISOString(),
        }),
        'utf8',
      );
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;

      if (!(await lockOwnerIsAlive())) {
        await rm(frontendHarnessLockDir, { recursive: true, force: true });
        continue;
      }

      if (Date.now() >= deadline) {
        assert.fail(
          `Timed out waiting for isolated Frontend harness lock: ${frontendHarnessLockDir}`,
        );
      }
      await sleep(50);
    }
  }

  try {
    return await run();
  } finally {
    await rm(frontendHarnessLockDir, { recursive: true, force: true });
  }
}

function childEnv() {
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
  };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function startFrontendSuiteBatch(suiteFiles) {
  const files = [...new Set(suiteFiles)].sort();
  if (files.length === 0) {
    return Promise.resolve('');
  }

  const batchPromise = withFrontendHarnessLock(async () => {
    const { stdout = '', stderr = '' } = await execFileAsync(
      process.execPath,
      [
        vitestBin,
        'run',
        ...files,
        '--reporter=verbose',
        '--no-cache',
      ],
      {
        cwd: frontendRoot,
        env: childEnv(),
        maxBuffer: 32 * 1024 * 1024,
      },
    );

    return `${stdout}\n${stderr}`;
  });

  for (const file of files) {
    suiteCache.set(file, batchPromise);
  }

  return batchPromise;
}

async function runFrontendSuites(suiteFiles) {
  const files = [...new Set(suiteFiles)];
  const missing = files.filter((file) => !suiteCache.has(file));

  if (missing.length > 0) {
    startFrontendSuiteBatch(missing);
  }

  try {
    const outputs = await Promise.all(
      files.map((file) => suiteCache.get(file)),
    );
    return [...new Set(outputs)].join('\n');
  } catch (error) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;
    assert.fail(
      `Owning Frontend evidence suites ${files.join(', ')} failed under ${process.version}.\n${output}`,
    );
  }
}

export async function assertFrontendSuiteEvidence(
  suiteFiles,
  expectedPatterns = [],
) {
  const files = Array.isArray(suiteFiles) ? suiteFiles : [suiteFiles];
  assert.ok(
    files.length > 0,
    'At least one Frontend evidence suite is required',
  );

  const combined = await runFrontendSuites(files);

  for (const pattern of expectedPatterns) {
    if (pattern instanceof RegExp) {
      assert.match(
        combined,
        pattern,
        `Expected Frontend evidence output to match ${pattern}`,
      );
    } else {
      assert.ok(
        combined.includes(pattern),
        `Expected Frontend evidence output to include: ${pattern}`,
      );
    }
  }

  return combined;
}

export async function assertFrontendSourceEvidence(
  relativePath,
  expectedPatterns = [],
) {
  const source = await readFile(path.join(frontendRoot, relativePath), 'utf8');

  for (const pattern of expectedPatterns) {
    if (pattern instanceof RegExp) {
      assert.match(
        source,
        pattern,
        `Expected ${relativePath} to match ${pattern}`,
      );
    } else {
      assert.ok(
        source.includes(pattern),
        `Expected ${relativePath} to include: ${pattern}`,
      );
    }
  }

  return source;
}

export async function assertFrontendBuildEvidence() {
  if (!buildPromise) {
    buildPromise = (async () => {
      const tempParent = path.join(
        testsRoot,
        '.tmp',
        'frontend-static-builds',
      );
      await mkdir(tempParent, { recursive: true });
      const tempRoot = await mkdtemp(
        path.join(tempParent, `${process.pid}-`),
      );

      await cp(frontendRoot, tempRoot, {
        recursive: true,
        filter(source) {
          const relative = path.relative(frontendRoot, source);
          if (!relative) return true;

          const topLevel = relative.split(path.sep)[0];
          return !['node_modules', '.next', 'out', '.git'].includes(topLevel);
        },
      });

      await symlink(
        path.join(frontendRoot, 'node_modules'),
        path.join(tempRoot, 'node_modules'),
        'dir',
      );

      try {
        const { stdout = '', stderr = '' } = await execFileAsync(
          process.execPath,
          [nextBin, 'build', '--webpack'],
          {
            cwd: tempRoot,
            env: {
              ...childEnv(),
              NEXT_TELEMETRY_DISABLED: '1',
            },
            maxBuffer: 32 * 1024 * 1024,
          },
        );

        await access(path.join(tempRoot, 'out', 'index.html'));
        return {
          output: `${stdout}\n${stderr}`,
          outputRoot: path.join(tempRoot, 'out'),
        };
      } catch (error) {
        const output = `${error.stdout || ''}\n${error.stderr || ''}`;
        assert.fail(
          `Frontend production static build failed in isolated Testing-owned temp copy under ${process.version}.\n${output}`,
        );
      }
    })();
  }

  return buildPromise;
}
