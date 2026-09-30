import test from 'node:test';
import { assertBackendSuiteEvidence } from '../helpers/backend-suite-evidence.mjs';

/*
 * Mandatory tenant-isolation checks from docs/specs/testing/SPEC.md.
 *
 * Shared-contract invariants:
 * - never trust client-supplied organizationId without resource verification
 * - never trust client-supplied role without database verification
 * - resourceId alone is insufficient for tenant authorization
 * - Staff/Admin access is limited to Organizations with valid membership
 * - Customer-owned Order/Payment/Pickup access is ownership-scoped
 */

const tenantBEvidence = [
  'authorization.test.js',
  'payments.test.js',
  'pickups.test.js',
  'notifications.test.js',
];

test(
  'SEC-TENANT-005 Staff cannot approve/reject Payment outside their Organization',
  async () => {
    await assertBackendSuiteEvidence(tenantBEvidence, [
      'tenant policy accepts only resources whose stored organizationId matches route context',
      'payment list filters by tenant review index and campaign/order filters fail closed through canonical Orders',
    ]);
  },
);

test(
  'SEC-TENANT-006 Staff cannot confirm Pickup outside their Organization',
  async () => {
    await assertBackendSuiteEvidence(tenantBEvidence, [
      'Staff from another Organization cannot resolve or confirm a Pickup by pickupId',
    ]);
  },
);

test(
  "SEC-TENANT-007 Notification endpoint returns only current user's Notifications",
  async () => {
    await assertBackendSuiteEvidence(tenantBEvidence, [
      'notification service fails closed if repository returns another User notification',
    ]);
  },
);

test(
  'SEC-TENANT-008 client-supplied Organization role is ignored as authoritative data',
  async () => {
    await assertBackendSuiteEvidence(tenantBEvidence, [
      'role middleware ignores client-supplied role and trusts resolved membership only',
    ]);
  },
);

test(
  'SEC-TENANT-009 resource ID alone is insufficient to authorize tenant-owned data',
  async () => {
    await assertBackendSuiteEvidence(tenantBEvidence, [
      'tenant policy accepts only resources whose stored organizationId matches route context',
    ]);
  },
);
