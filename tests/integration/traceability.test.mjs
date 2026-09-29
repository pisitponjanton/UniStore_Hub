import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const testsRoot = path.resolve(here, '..');
const traceabilityPath = path.join(testsRoot, 'reports', 'fr-traceability.json');

async function collectExecutableSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = [];

  for (const entry of entries) {
    if (entry.name === 'reports' || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      contents.push(...await collectExecutableSources(full));
    } else if (/\.(?:mjs|js)$/.test(entry.name)) {
      contents.push(await readFile(full, 'utf8'));
    }
  }

  return contents;
}

test('TRACE-001 FR-01 through FR-15 each have mapped executable verification and existing evidence artifacts', async () => {
  const matrix = JSON.parse(await readFile(traceabilityPath, 'utf8'));
  const requirements = matrix.requirements;

  assert.equal(requirements.length, 15);

  const expected = Array.from({ length: 15 }, (_, index) =>
    `FR-${String(index + 1).padStart(2, '0')}`
  );
  assert.deepEqual(requirements.map((entry) => entry.fr), expected);

  const sourceCorpus = (await collectExecutableSources(testsRoot)).join('\n');

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
        sourceCorpus.includes(testId),
        `${entry.fr} maps missing executable test ID ${testId}`,
      );
    }

    for (const artifact of entry.artifacts) {
      await access(path.join(testsRoot, artifact));
    }
  }
});

test('TRACE-002 human-readable traceability and handoff reports exist', async () => {
  await access(path.join(testsRoot, 'reports', 'fr-traceability.md'));
  await access(path.join(testsRoot, 'reports', 'testing-handoff.md'));
});

test('TRACE-003 FR-08 records the resolved Customer own-Payment read contract and ownership coverage', async () => {
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