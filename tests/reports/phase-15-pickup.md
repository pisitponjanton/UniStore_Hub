# Phase 15 — Pickup Flow Verification

## Contract basis

Pickup statuses:

```text
READY
RECEIVED
```

Organization routes:

- `GET /api/v1/organizations/:organizationId/pickups`
- `GET /api/v1/organizations/:organizationId/pickups/:pickupId`
- `POST /api/v1/organizations/:organizationId/pickups/:pickupId/confirm`

Organization Pickup access is Staff / Organization Admin and remains tenant-scoped.

Customer route:

- `GET /api/v1/me/orders/:orderId/pickup`
- Customer ownership is required.
- Customer does not require Organization membership for the own Order/Payment/Pickup flow.

Data-access requirements:

- Organization list uses `PickupLink` under `PK=ORG#{organizationId}`.
- detail resolves tenant-scoped `PickupLink` by `organizationId + pickupId`, then loads canonical Order-scoped Pickup.
- token lookup uses tenant-qualified GSI1 with active `organizationId`.
- normal Pickup request paths must not full-table Scan.

Ready-for-pickup creation must produce both canonical Pickup and PickupLink.

Confirmation must:

- require Order `READY_FOR_PICKUP`
- update Pickup → `RECEIVED`
- update PickupLink → `RECEIVED`
- update Order → `RECEIVED`
- set `receivedBy`
- set `receivedAt`
- create Audit
- reject a duplicate with `PICKUP_ALREADY_RECEIVED`

Pickup token format is exactly 128 bits of cryptographically secure randomness encoded as unpadded base64url, yielding 22 characters.

## Test IDs

Executable auth/surface checks:

- CT-PICKUP-001 through CT-PICKUP-004

State/data/security checks requiring authenticated disposable fixtures:

- CT-PICKUP-005 through CT-PICKUP-016

## Current implementation observation

At phase start, `backend/src/modules/pickups/` and `backend/src/modules/orders/` remain empty. The Backend app mounts Auth/Organization/User routers, so some authentication boundaries may already be observable even though the Pickup business flow is not implemented.

## Latest execution

Command:

```bash
node --test contract/pickup.contract.test.mjs
```

Result:

- CT-PICKUP-001 — PASS: organization Pickup list rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-PICKUP-002 — PASS: organization Pickup detail rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-PICKUP-003 — PASS: Pickup confirm rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-PICKUP-004 — FAIL: customer own Pickup route returned generic `404 VALIDATION_ERROR` instead of the protected-route `401 AUTH_REQUIRED` boundary.
- CT-PICKUP-005..016 — TODO/BLOCKED pending real Pickup/Order persistence, token generation, tenant fixtures, and confirm transaction implementation.

Focused summary: 16 tests total — 3 pass, 1 fail, 12 todo.

The Organization router currently exposes an authentication boundary for nested Pickup paths even before the Pickup module exists. The own-customer route `GET /api/v1/me/orders/:orderId/pickup` is still not mounted, so its contract boundary remains a genuine Backend-owned failure rather than a blocked/pass result.
