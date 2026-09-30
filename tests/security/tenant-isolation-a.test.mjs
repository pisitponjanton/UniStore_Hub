import test from 'node:test';
import { assertBackendSuiteEvidence } from '../helpers/backend-suite-evidence.mjs';

/*
 * Mandatory tenant-isolation checks from docs/specs/testing/SPEC.md.
 *
 * Detailed deterministic fixtures remain owned by Backend; these cross-system
 * checks require the exact owning security evidence to execute successfully.
 */

const tenantAEvidence = [
  'authorization.test.js',
  'orders.test.js',
  'stores-products.test.js',
  'files.test.js',
];

test(
  'SEC-TENANT-001 Staff from Organization A cannot read Organization B Order by guessed orderId',
  async () => {
    await assertBackendSuiteEvidence(tenantAEvidence, [
      'tenant policy accepts only resources whose stored organizationId matches route context',
    ]);
  },
);

test(
  'SEC-TENANT-002 Organization Admin from A cannot update Store/Product/Campaign in B',
  async () => {
    await assertBackendSuiteEvidence(tenantAEvidence, [
      'store list rejects repository data from another tenant',
      'product creation requires the Store to belong to the same Organization',
    ]);
  },
);

test(
  "SEC-TENANT-003 Customer cannot access another Customer's own-order endpoint",
  async () => {
    await assertBackendSuiteEvidence(tenantAEvidence, [
      'Customer own-order access fails closed if repository returns another Customer Order',
    ]);
  },
);

test(
  "SEC-TENANT-004 Customer cannot request private Payment Slip download URL for another Customer's Order",
  async () => {
    await assertBackendSuiteEvidence(tenantAEvidence, [
      'Customer can download only a Payment Slip for an Order they own',
    ]);
  },
);
