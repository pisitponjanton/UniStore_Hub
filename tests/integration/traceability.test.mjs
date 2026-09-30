import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const testsRoot = path.resolve(here, '..');
const traceabilityPath = path.join(testsRoot, 'reports', 'fr-traceability.json');
const traceabilityMarkdownPath = path.join(
  testsRoot,
  'reports',
  'fr-traceability.md',
);

const canonicalTestSourceRoots = [
  path.join(testsRoot, 'baseline.test.mjs'),
  ...[
    'contract',
    'integration',
    'security',
    'frontend',
    'smoke',
    'e2e',
    'infrastructure',
    'helpers',
  ].map((directory) => path.join(testsRoot, directory)),
];

function collectExecutableIdsFromSource(source) {
  const ids = new Set();

  const directPattern =
    /\btest(?:\.\w+)?\s*\(\s*['"`]([A-Z][A-Z0-9-]+)\b/g;
  for (const match of source.matchAll(directPattern)) ids.add(match[1]);

  const dynamicPattern =
    /\btest(?:\.\w+)?\s*\(\s*`\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  for (const dynamicMatch of source.matchAll(dynamicPattern)) {
    const variableName = dynamicMatch[1];
    const loopPattern = new RegExp(
      `for\\s*\\(\\s*const\\s*\\[\\s*${variableName}\\b[^\\]]*\\]\\s*of\\s*\\[([\\s\\S]*?)\\]\\s*\\)\\s*\\{`,
      'g',
    );

    for (const loopMatch of source.matchAll(loopPattern)) {
      const fixtureRows = loopMatch[1];
      const fixtureIdPattern = /\[\s*['"`]([A-Z][A-Z0-9-]+)\b/g;
      for (const fixtureMatch of fixtureRows.matchAll(fixtureIdPattern)) {
        ids.add(fixtureMatch[1]);
      }
    }
  }

  return ids;
}

async function collectExecutableTestIdsFromPath(sourcePath) {
  if (sourcePath.endsWith('.test.mjs')) {
    return collectExecutableIdsFromSource(await readFile(sourcePath, 'utf8'));
  }

  const entries = await readdir(sourcePath, { withFileTypes: true });
  const ids = new Set();

  for (const entry of entries) {
    const full = path.join(sourcePath, entry.name);

    if (entry.isDirectory()) {
      for (const id of await collectExecutableTestIdsFromPath(full)) {
        ids.add(id);
      }
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.test.mjs')) continue;

    for (const id of collectExecutableIdsFromSource(
      await readFile(full, 'utf8'),
    )) {
      ids.add(id);
    }
  }

  return ids;
}

async function collectCanonicalExecutableTestIds() {
  const ids = new Set();

  for (const sourceRoot of canonicalTestSourceRoots) {
    for (const id of await collectExecutableTestIdsFromPath(sourceRoot)) {
      ids.add(id);
    }
  }

  return ids;
}

function parseMarkdownTraceabilityRows(markdown) {
  return markdown
    .split('\n')
    .filter((line) => /^\|\s*FR-\d{2}\s*\|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());

      assert.equal(cells.length, 6, `Traceability row must contain 6 columns: ${line}`);

      return {
        fr: cells[0],
        requirement: cells[1],
        minimumVerification: cells[2],
        status: cells[3].replace(/\*\*/g, ''),
        mappedTests: [...cells[4].matchAll(/`([^`]+)`/g)].map((match) => match[1]),
        artifacts: [...cells[5].matchAll(/`([^`]+)`/g)].map((match) => match[1]),
      };
    });
}

test('TRACE-001 FR-01 through FR-15 each have mapped executable verification and existing evidence artifacts', async () => {
  const matrix = JSON.parse(await readFile(traceabilityPath, 'utf8'));
  const requirements = matrix.requirements;

  assert.equal(requirements.length, 15);

  const expected = Array.from({ length: 15 }, (_, index) =>
    `FR-${String(index + 1).padStart(2, '0')}`
  );
  assert.deepEqual(requirements.map((entry) => entry.fr), expected);
  assert.equal(new Set(requirements.map((entry) => entry.fr)).size, 15);

  const executableTestIds = await collectCanonicalExecutableTestIds();

  for (const entry of requirements) {
    assert.ok(entry.requirement);
    assert.ok(entry.minimumVerification);
    assert.ok(['PASS', 'FAIL', 'BLOCKED'].includes(entry.status));
    assert.ok(entry.mappedTests.length > 0, `${entry.fr} must map at least one test ID`);
    assert.ok(entry.artifacts.length > 0, `${entry.fr} must map evidence artifacts`);
    assert.ok(entry.recordedResults.length > 0, `${entry.fr} must record result state`);
    assert.ok(entry.owners.length > 0, `${entry.fr} must record owning subsystem`);

    for (const testId of entry.mappedTests) {
      assert.ok(
        executableTestIds.has(testId),
        `${entry.fr} maps ${testId}, but no executable test definition was found`,
      );
    }

    for (const artifact of entry.artifacts) {
      await access(path.join(testsRoot, artifact));
    }
  }
});

test('TRACE-002 Markdown traceability is exactly ordered and in parity with JSON', async () => {
  const matrix = JSON.parse(await readFile(traceabilityPath, 'utf8'));
  const markdown = await readFile(traceabilityMarkdownPath, 'utf8');
  const rows = parseMarkdownTraceabilityRows(markdown);
  const expected = Array.from({ length: 15 }, (_, index) =>
    `FR-${String(index + 1).padStart(2, '0')}`
  );

  assert.equal(rows.length, 15, 'Markdown must contain exactly 15 FR rows');
  assert.equal(new Set(rows.map((row) => row.fr)).size, 15);
  assert.deepEqual(rows.map((row) => row.fr), expected);

  const jsonRows = matrix.requirements.map((entry) => ({
    fr: entry.fr,
    requirement: entry.requirement,
    minimumVerification: entry.minimumVerification,
    status: entry.status,
    mappedTests: entry.mappedTests,
    artifacts: entry.artifacts,
  }));

  assert.deepEqual(rows, jsonRows);
});

test('TRACE-003 human-readable traceability and handoff reports exist', async () => {
  await access(traceabilityMarkdownPath);
  await access(path.join(testsRoot, 'reports', 'testing-handoff.md'));
});

test('TRACE-005 executable-ID discovery ignores generated tests/.tmp content', async () => {
  const decoyRoot = path.join(testsRoot, '.tmp', 'traceability-decoy');
  const decoyId = 'TRACE-DECOY-999';

  await rm(decoyRoot, { recursive: true, force: true });
  await mkdir(decoyRoot, { recursive: true });
  await writeFile(
    path.join(decoyRoot, 'generated.test.mjs'),
    `import test from 'node:test';\ntest('${decoyId} generated temp test', () => {});\n`,
    'utf8',
  );

  try {
    const ids = await collectCanonicalExecutableTestIds();
    assert.equal(
      ids.has(decoyId),
      false,
      'Generated tests/.tmp files must never be canonical executable traceability sources',
    );
  } finally {
    await rm(decoyRoot, { recursive: true, force: true });
  }
});

test('TRACE-004 FR-08 records the resolved Customer own-Payment read contract and ownership coverage', async () => {
  const matrix = JSON.parse(await readFile(traceabilityPath, 'utf8'));
  const payment = matrix.requirements.find((entry) => entry.fr === 'FR-08');

  assert.ok(payment, 'FR-08 must exist');
  assert.ok(
    payment.mappedTests.includes('CT-CUSTOMER-PAYMENT-READ-002'),
    'FR-08 must map the Customer own-Payment success contract',
  );
  assert.ok(
    payment.mappedTests.includes('CT-CUSTOMER-PAYMENT-READ-004'),
    'FR-08 must map fail-closed cross-Customer ownership',
  );
  assert.ok(
    payment.mappedTests.includes('SEC-CUSTOMER-PAYMENT-001'),
    'FR-08 must map Customer A/B Payment isolation',
  );
  assert.equal(
    payment.blockers.some((item) => /no Customer-readable Payment detail contract/i.test(item)),
    false,
    'Resolved Customer Payment read contract must not remain recorded as a blocker',
  );
});