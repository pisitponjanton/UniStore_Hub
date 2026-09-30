# Phase 4 — Backend and Security Stale TODO Conversion

## Goal

Replace stale Backend/Data/Notification/Tenant/Order/Payment/Production/Pickup/File/Audit/Platform TODOs with executable evidence against the current implementation without duplicating subsystem-owned fixture logic.

## Implementation approach

Added:

- `helpers/backend-suite-evidence.mjs`

The helper executes the owning Backend `node:test` suite under the same Node executable as the cross-system runner and caches each suite result within the current test process.

Important behavior:

- a Backend evidence suite must exit successfully
- no TODO is converted to PASS only because source files exist
- mandatory tenant/security checks additionally assert exact owning Backend evidence test names
- the nested test process removes `NODE_TEST_CONTEXT` so child reporter output is normal stdout/stderr rather than inherited parent-runner IPC
- production source is not modified

This intentionally avoids copying Backend's detailed deterministic fixtures into `tests/**` while still requiring current executable Backend evidence.

## Converted stale TODOs

Phase 3 classified 167 Category A TODO markers.

Phase 4 converted the 142 Backend/Data/Security Category A markers across:

- Campaign
- Health/Auth
- Organization/Member
- Store/Product/Variant
- Order
- Payment submission/review
- Production
- Pickup
- File authorization/metadata checks
- Report/Audit/Platform Admin
- Data-contract persistence behavior
- Notification resilience
- SEC-TENANT-001..009

The 25 Frontend/static-export Category A markers remain for Phase 5.

## Genuine blockers retained

Two file-security checks remain TODO/BLOCKED by design:

- `CT-FILE-018` — live/deployed private bucket public-read protection
- `CT-FILE-019` — integrated Browser-to-S3 transfer boundary

Dev Mode, E2E, and AWS environment blockers were not altered in this phase.

## Current explicit TODO marker count

Before Phase 4:

```text
192
```

After Phase 4:

```text
50
```

Remaining source markers by file:

```text
21 frontend/frontend-interaction.test.mjs
 8 e2e/tenant-notification-flow.test.mjs
 5 smoke/dev-mode-b.test.mjs
 4 frontend/static-export.test.mjs
 3 smoke/dev-mode-a.test.mjs
 3 e2e/payment-rejection-flow.test.mjs
 3 e2e/core-flow.test.mjs
 2 contract/file-security.contract.test.mjs
 1 smoke/aws-deployment.test.mjs
```

## Node 24 verification

Executed with:

```text
Node v24.2.0
```

Results:

```text
npm run test:contract
198 tests
196 pass
0 fail
2 todo

npm run test:integration
35 tests
35 pass
0 fail
0 todo

npm run test:security
11 tests
11 pass
0 fail
0 todo
```

The two Contract TODOs are the intentionally retained live/deployed file-security blockers above.

## Security evidence

Mandatory tenant/security IDs now execute and require owning Backend evidence rather than remaining stale TODOs:

- SEC-TENANT-001
- SEC-TENANT-002
- SEC-TENANT-003
- SEC-TENANT-004
- SEC-TENANT-005
- SEC-TENANT-006
- SEC-TENANT-007
- SEC-TENANT-008
- SEC-TENANT-009

Examples of exact evidence required include:

- tenant mismatch policy using stored `organizationId`
- Customer own-Order fail-closed access
- Payment Slip ownership
- cross-Organization Pickup denial
- Notification user isolation
- ignoring client-supplied role authority

## Integrity result

No application behavior was weakened and no production code was changed.

Category B environment blockers remain visible. Phase 5 should now convert the remaining 25 Frontend/static-export stale TODO markers.
