# Phase 12 — Core Tenant Isolation Set B

## Mandatory source cases

This phase maps exactly to the remaining mandatory tenant-isolation cases in the Testing spec:

- `SEC-TENANT-005` — Staff cannot approve/reject Payment outside their Organization.
- `SEC-TENANT-006` — Staff cannot confirm Pickup outside their Organization.
- `SEC-TENANT-007` — Notification endpoint returns only the current user's Notifications.
- `SEC-TENANT-008` — client-supplied Organization role is ignored as authoritative data.
- `SEC-TENANT-009` — resource ID alone is insufficient to authorize tenant-owned data.

Shared authorization invariants used by these tests:

- Backend must not trust client-supplied `organizationId` without database/resource verification.
- Backend must not trust client-supplied role without database verification.
- a tenant resource must not be authorized by `resourceId` alone.
- Staff/Admin access is constrained to Organizations with valid membership.
- Customer access to Order/Payment/Pickup is constrained by authenticated ownership.
- all cross-tenant attempts must fail without unnecessary resource-existence leakage.

Relevant API surfaces include Payment approve/reject, Pickup confirm, `GET /api/v1/notifications`, and notification ownership on mark-read.

## Current execution status

The five mandatory security cases are intentionally represented as TODO/BLOCKED, not as passing tests.

Current implementation constraints:

- `backend/src/modules/payments/` has no Payment-review implementation.
- `backend/src/modules/pickups/` is empty.
- `backend/src/modules/notifications/` is empty.
- `backend/src/app.js` currently mounts Health/Auth/User only; Payment/Pickup/Notification routes are not mounted.
- Organization repository work has appeared, but the protected organization-scoped flows needed to prove forged-role and resourceId-only authorization behavior are not yet available end-to-end.

Testing does not replace these checks with isolated mocks because that would not verify the mandatory cross-system authorization boundary.

## Latest execution

Command:

```bash
node --test security/tenant-isolation-b.test.mjs
```

Result:

- SEC-TENANT-005 — TODO/BLOCKED
- SEC-TENANT-006 — TODO/BLOCKED
- SEC-TENANT-007 — TODO/BLOCKED
- SEC-TENANT-008 — TODO/BLOCKED
- SEC-TENANT-009 — TODO/BLOCKED

Focused summary: 5 tests total — 0 pass, 0 fail, 5 todo.

These are not passing security checks. They remain blocked until the real authenticated tenant-owned routes and disposable multi-user/two-tenant fixtures exist.
