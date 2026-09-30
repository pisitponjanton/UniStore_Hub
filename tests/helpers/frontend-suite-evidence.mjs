import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  symlink,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
export const frontendRoot = path.resolve(here, '../../frontend');
const testsRoot = path.resolve(here, '..');
const vitestBin = path.join(frontendRoot, 'node_modules', 'vitest', 'vitest.mjs');
const nextBin = path.join(
  frontendRoot,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

const suiteCache = new Map();
let buildPromise;

function childEnv() {
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
  };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

async function runFrontendSuite(suiteFile) {
  if (!suiteCache.has(suiteFile)) {
    suiteCache.set(
      suiteFile,
      execFileAsync(
        process.execPath,
        [vitestBin, 'run', suiteFile, '--reporter=verbose'],
        {
          cwd: frontendRoot,
          env: childEnv(),
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
      `Owning Frontend evidence suite ${suiteFile} failed under ${process.version}.\n${output}`,
    );
  }
}

export async function assertFrontendSuiteEvidence(
  suiteFiles,
  expectedPatterns = [],
) {
  const files = Array.isArray(suiteFiles) ? suiteFiles : [suiteFiles];
  assert.ok(files.length > 0, 'At least one Frontend evidence suite is required');

  const outputs = await Promise.all(files.map((file) => runFrontendSuite(file)));
  const combined = outputs.join('\n');

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
      const tempRoot = path.join(testsRoot, '.tmp', 'frontend-static-build');
      await rm(tempRoot, { recursive: true, force: true });
      await mkdir(path.dirname(tempRoot), { recursive: true });

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
          `Frontend production static build failed in Testing-owned temp copy under ${process.version}.\n${output}`,
        );
      }
    })();
  }

  return buildPromise;
}
