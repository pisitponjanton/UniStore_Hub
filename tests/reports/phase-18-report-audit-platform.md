# Phase 18 — Report, Audit, and Platform Admin Contract Verification

## Source-backed API surface

Organization report:

- `GET /api/v1/organizations/:organizationId/reports`
- role: Organization Admin
- optional `campaignId`, `storeId`

Minimum metric schema:

```text
totalStores
totalProducts
campaignsByStatus
ordersByStatus
pendingPaymentReviews
paidOrderCount
paidRevenueSatang
```

`paidRevenueSatang` is integer satang, includes Orders that reached `PAID` or later paid lifecycle state, and excludes cancelled/unpaid Orders.

Audit list:

- `GET /api/v1/organizations/:organizationId/audit-logs`
- role: Organization Admin
- optional `actorId`, `action`, `resourceType`, `resourceId`, `cursor`

Audit fields are `auditId`, `organizationId`, `actorId`, `action`, `resourceType`, `resourceId`, `metadata`, `createdAt`. Required business Audit events include Payment approve/reject and Pickup confirm. Platform approve/suspend also write Audit entries. Audit metadata must not contain credentials, JWTs, or Payment Slip binary data.

Platform Admin routes:

- `GET /api/v1/platform/organizations`
- `POST /api/v1/platform/organizations/:organizationId/approve`
- `POST /api/v1/platform/organizations/:organizationId/suspend`
- `GET /api/v1/platform/users`
- `GET /api/v1/platform/summary`

Platform Admin authority comes only from the persisted current User having `platformRole = PLATFORM_ADMIN`; Backend reloads User state for protected platform actions. Organization membership does not grant Platform Admin authority.

Platform state behavior:

- approve: `PENDING → ACTIVE`
- suspend: `→ SUSPENDED`
- summary baseline: `organizationsByStatus`, `usersByStatus`

## Test IDs

Executable auth/surface checks:

- CT-GOV-001 through CT-GOV-007

Report/Audit/Platform behavior checks requiring implemented modules and disposable persisted fixtures:

- CT-GOV-008 through CT-GOV-024

## Current implementation observation

At phase start:

- `backend/src/modules/reports/` is empty.
- `backend/src/modules/audit/` is empty.
- `backend/src/modules/platform-admin/` is empty.
- `backend/src/app.js` mounts Health/Auth/Organization/User routers only.

Testing preserves missing-route or authorization failures as Backend-owned findings rather than weakening the contracts.

## Latest execution

Command:

```bash
node --test contract/report-audit-platform.contract.test.mjs
```

Result:

- CT-GOV-001 — PASS: Organization report path rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-GOV-002 — PASS: Audit Log path rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-GOV-003..007 — FAIL: all Platform Admin routes return generic `404 VALIDATION_ERROR` instead of a protected-route `401 AUTH_REQUIRED` boundary because the platform router is not mounted.
- CT-GOV-008..024 — TODO/BLOCKED pending reports/audit/platform-admin implementations and disposable authenticated data.

Focused summary: 24 tests total — 2 pass, 5 fail, 17 todo.

The five Platform Admin failures are genuine Backend-owned gaps and are intentionally preserved. Report/Audit auth is currently observable through the mounted Organization router, but metric aggregation, role distinction, Audit side effects/filtering, persisted Platform Admin authority, approve/suspend transitions, and platform summary remain unverified rather than being treated as passing.
