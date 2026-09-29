# Phase 14 — Production Summary Verification

## Contract basis

Production Summary endpoint:

- `GET /api/v1/organizations/:organizationId/production`
- required query: `campaignId`
- role: `ORGANIZATION_ADMIN`

Required aggregation:

```text
APPROVED Payment + paid-lifecycle Order
→ group Order Items by Product
→ group by Variant
→ sum quantity
```

Included Order statuses when Payment is `APPROVED`:

- `PAID`
- `CONFIRMED`
- `IN_PRODUCTION`
- `READY_FOR_PICKUP`
- `RECEIVED`

Excluded:

- unpaid Orders
- rejected Payment Orders
- cancelled Orders

Additional required checks:

- tenant isolation
- campaign isolation
- Organization Admin access
- Staff denial
- no normal full-table Scan
- response baseline includes `campaignId`, Product groups, Variant groups, and summed `quantity`

## Test IDs

Executable auth/surface check:

- CT-PRODUCTION-001

Behavior/aggregation/security checks requiring authenticated disposable data:

- CT-PRODUCTION-002 through CT-PRODUCTION-013

## Current implementation observation

At phase start:

- `backend/src/modules/production/` is empty.
- `backend/src/modules/orders/` is empty.
- `backend/src/modules/payments/` is empty.
- `backend/src/app.js` mounts Health/Auth/Organization/User routers, but no Production route is mounted.

Testing keeps aggregation and authorization behavior as TODO/BLOCKED until the real Production request path and disposable paid-order fixtures exist.

## Latest execution

Command:

```bash
node --test contract/production.contract.test.mjs
```

Result:

- CT-PRODUCTION-001 — PASS: unauthenticated Production Summary request returns `401 AUTH_REQUIRED`.
- CT-PRODUCTION-002..013 — TODO/BLOCKED pending Production aggregation implementation and authenticated disposable Campaign/Order/Payment fixtures.

Focused summary: 13 tests total — 1 pass, 0 fail, 12 todo.

The current Organization router now enforces authentication before this nested path, so the auth boundary is observable even though `backend/src/modules/production/` remains empty. Aggregation, role distinction, tenant/campaign isolation, paid-lifecycle filtering, grouping, and no-Scan request-path behavior remain unverified and are not counted as passing.
