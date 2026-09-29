import test from 'node:test';

/*
 * Mandatory tenant-isolation checks from docs/specs/testing/SPEC.md.
 *
 * These tests remain explicit TODO/BLOCKED until the owning Backend routes and
 * disposable authenticated two-tenant fixtures exist. Do not convert a missing
 * route or missing fixture into a passing security test.
 *
 * When executable, authenticated tenant/ownership denials must use the API's
 * 403 Forbidden baseline and must not leak unnecessary resource existence.
 */

test(
  'SEC-TENANT-001 Staff from Organization A cannot read Organization B Order by guessed orderId',
  {
    todo: 'BLOCKED: requires mounted Order routes plus disposable Organization A/B STAFF memberships and an Order owned by Organization B',
  },
  () => {},
);

test(
  'SEC-TENANT-002 Organization Admin from A cannot update Store/Product/Campaign in B',
  {
    todo: 'BLOCKED: requires mounted Store/Product/Campaign routes plus disposable Organization A/B admin and tenant-owned resource fixtures',
  },
  () => {},
);

test(
  "SEC-TENANT-003 Customer cannot access another Customer's own-order endpoint",
  {
    todo: 'BLOCKED: requires mounted own-order routes plus two authenticated Customer fixtures and an Order owned by the second Customer',
  },
  () => {},
);

test(
  "SEC-TENANT-004 Customer cannot request private Payment Slip download URL for another Customer's Order",
  {
    todo: 'BLOCKED: requires mounted Order/File routes, two authenticated Customer fixtures, and a private Payment Slip owned by the second Customer',
  },
  () => {},
);
