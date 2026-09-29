import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../../frontend');

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

async function collectPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectPageFiles(fullPath)));
    } else if (entry.isFile() && /^page\.(?:js|jsx|ts|tsx)$/.test(entry.name)) {
      result.push(fullPath);
    }
  }

  return result;
}

test('STATIC-001 frontend package.json exists', async () => {
  await access(path.join(frontendRoot, 'package.json'));
});

test('STATIC-002 frontend package-lock.json exists for deterministic npm ci', async () => {
  await access(path.join(frontendRoot, 'package-lock.json'));
});

test('STATIC-003 Next.js config exists and declares output=export plus trailingSlash=true', async () => {
  const configPath = await firstExisting([
    path.join(frontendRoot, 'next.config.js'),
    path.join(frontendRoot, 'next.config.mjs'),
    path.join(frontendRoot, 'next.config.ts'),
  ]);

  assert.ok(configPath, 'Expected next.config.js, next.config.mjs, or next.config.ts');
  const source = await readFile(configPath, 'utf8');

  assert.match(source, /output\s*:\s*['"]export['"]/);
  assert.match(source, /trailingSlash\s*:\s*true/);
});

test('STATIC-004 runtime entity routes are implemented as static pages, not dynamic [id] pages', async () => {
  const appRoot = path.join(frontendRoot, 'src', 'app');
  const pages = await collectPageFiles(appRoot);
  assert.ok(pages.length > 0, 'Expected implemented App Router page files');

  const relativePages = pages.map((file) => path.relative(appRoot, file));
  const dynamicRuntimePages = relativePages.filter((file) => /(^|[\\/])\[[^\\/]+\]([\\/]|$)/.test(file));

  assert.deepEqual(
    dynamicRuntimePages,
    [],
    `Runtime entity pages must use static routes + query parameters; found: ${dynamicRuntimePages.join(', ')}`,
  );
});

test('STATIC-005 canonical query-parameter entity route page files exist', async () => {
  const required = [
    'src/app/stores/view/page.tsx',
    'src/app/products/view/page.tsx',
    'src/app/campaigns/view/page.tsx',
    'src/app/my/order/page.tsx',
    'src/app/org/orders/view/page.tsx',
  ];

  for (const relativePath of required) {
    await access(path.join(frontendRoot, relativePath));
  }
});

test('STATIC-006 frontend/out exists as a directory after production build', async () => {
  const outputPath = path.join(frontendRoot, 'out');
  const outputStat = await stat(outputPath);
  assert.equal(outputStat.isDirectory(), true);
});

test(
  'STATIC-007 npm ci -> npm test -> npm run build succeeds and produces frontend/out',
  { todo: 'BLOCKED: frontend package manifest/lockfile and application implementation are currently absent' },
  () => {},
);

test(
  'STATIC-008 exported canonical route directories contain index.html files under frontend/out',
  { todo: 'BLOCKED: requires successful Next.js static-export build output' },
  () => {},
);

test(
  'STATIC-009 direct refresh of canonical trailing-slash URLs resolves with S3 Website path semantics',
  { todo: 'BLOCKED: requires built frontend/out and an S3 Website-compatible static HTTP serving check' },
  () => {},
);

test(
  'STATIC-010 query-parameter entity routes load/refresh arbitrary runtime IDs without generateStaticParams or build-time API data',
  { todo: 'BLOCKED: requires implemented static pages and successful build to exercise arbitrary runtime query IDs' },
  () => {},
);
