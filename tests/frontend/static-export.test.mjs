import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  access,
  readFile,
  readdir,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertFrontendBuildEvidence,
  assertFrontendSuiteEvidence,
} from '../helpers/frontend-suite-evidence.mjs';

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

async function withStaticExportServer(outputRoot, run) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const decodedPath = decodeURIComponent(url.pathname);
      const relative = decodedPath.replace(/^\/+/, '');
      const target = path.resolve(
        outputRoot,
        relative === ''
          ? 'index.html'
          : decodedPath.endsWith('/')
            ? path.join(relative, 'index.html')
            : relative,
      );

      const outputPrefix = `${path.resolve(outputRoot)}${path.sep}`;
      if (
        target !== path.resolve(outputRoot, 'index.html') &&
        !target.startsWith(outputPrefix)
      ) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const body = await readFile(target);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not Found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
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

test('STATIC-007 Frontend tests and production static build succeed without modifying production source', async () => {
  await assertFrontendSuiteEvidence(
    'src/app/static-export.test.ts',
    [
      'keeps Next.js configured for trailing-slash static export',
      'uses query-based entity routes instead of runtime dynamic route directories',
    ],
  );

  const build = await assertFrontendBuildEvidence();
  await access(path.join(build.outputRoot, 'index.html'));
});

test('STATIC-008 exported canonical route directories contain index.html files under build output', async () => {
  const { outputRoot } = await assertFrontendBuildEvidence();
  const required = [
    'stores/view/index.html',
    'products/view/index.html',
    'campaigns/view/index.html',
    'my/order/index.html',
    'my/payment/index.html',
    'my/pickup/index.html',
    'org/orders/view/index.html',
    'org/production/index.html',
    'notifications/index.html',
    'login/index.html',
    'register/index.html',
  ];

  for (const relativePath of required) {
    await access(path.join(outputRoot, relativePath));
  }
});

test('STATIC-009 direct refresh of canonical trailing-slash URLs resolves with S3 Website path semantics', async () => {
  const { outputRoot } = await assertFrontendBuildEvidence();

  await withStaticExportServer(outputRoot, async (baseUrl) => {
    for (const route of [
      '/',
      '/stores/view/',
      '/products/view/',
      '/campaigns/view/',
      '/my/order/',
      '/org/orders/view/',
      '/notifications/',
    ]) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, `Expected direct refresh of ${route} to resolve`);
      assert.match(
        response.headers.get('content-type') || '',
        /text\/html/,
      );
    }
  });
});

test('STATIC-010 query-parameter entity routes load/refresh arbitrary runtime IDs without generateStaticParams or build-time API data', async () => {
  const { outputRoot } = await assertFrontendBuildEvidence();

  await assertFrontendSuiteEvidence(
    'src/app/static-export.test.ts',
    ['uses query-based entity routes instead of runtime dynamic route directories'],
  );

  const appRoot = path.join(frontendRoot, 'src', 'app');
  const pages = await collectPageFiles(appRoot);
  for (const pageFile of pages) {
    const source = await readFile(pageFile, 'utf8');
    assert.doesNotMatch(
      source,
      /generateStaticParams/,
      `Runtime entity page must not depend on generateStaticParams: ${path.relative(appRoot, pageFile)}`,
    );
  }

  await withStaticExportServer(outputRoot, async (baseUrl) => {
    const routes = [
      '/stores/view/?storeId=runtime-store-arbitrary',
      '/products/view/?productId=runtime-product-arbitrary',
      '/campaigns/view/?campaignId=runtime-campaign-arbitrary',
      '/my/order/?orderId=runtime-order-arbitrary',
      '/org/orders/view/?organizationId=runtime-org&orderId=runtime-order',
    ];

    for (const route of routes) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, `Expected runtime query route to refresh: ${route}`);
    }
  });
});
