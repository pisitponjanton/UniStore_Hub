import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../../backend');
const suiteCache = new Map();

async function runBackendSuite(suiteFile) {
  if (!suiteCache.has(suiteFile)) {
    const childEnv = {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'test',
      JWT_SECRET:
        process.env.JWT_SECRET || 'cross-system-evidence-only-secret',
    };

    // A nested node --test process must not inherit the parent test runner's
    // internal child context; otherwise its reporter output may be transported
    // over the parent's IPC channel instead of normal stdout/stderr.
    delete childEnv.NODE_TEST_CONTEXT;

    suiteCache.set(
      suiteFile,
      execFileAsync(
        process.execPath,
        ['--test', `tests/${suiteFile}`],
        {
          cwd: backendRoot,
          env: childEnv,
          maxBuffer: 16 * 1024 * 1024,
        },
      ).then(({ stdout = '', stderr = '' }) => `${stdout}\n${stderr}`),
    );
  }

  try {
    return await suiteCache.get(suiteFile);
  } catch (error) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;
    assert.fail(
      `Owning Backend evidence suite ${suiteFile} failed under ${process.version}.\n${output}`,
    );
  }
}

export async function assertBackendSuiteEvidence(suiteFiles, expectedPatterns = []) {
  const files = Array.isArray(suiteFiles) ? suiteFiles : [suiteFiles];
  assert.ok(files.length > 0, 'At least one Backend evidence suite is required');

  const outputs = await Promise.all(files.map((file) => runBackendSuite(file)));
  const combined = outputs.join('\n');

  for (const pattern of expectedPatterns) {
    if (pattern instanceof RegExp) {
      assert.match(
        combined,
        pattern,
        `Expected Backend evidence output to match ${pattern}`,
      );
    } else {
      assert.ok(
        combined.includes(pattern),
        `Expected Backend evidence output to include: ${pattern}`,
      );
    }
  }

  return combined;
}
