# Phase 11 — Core Tenant Isolation Set A

## Mandatory source cases

This phase maps exactly to the mandatory tenant-isolation cases defined by the Testing spec:

- `SEC-TENANT-001` — Staff from Organization A cannot read Organization B Order by guessing `orderId`.
- `SEC-TENANT-002` — Organization Admin from A cannot update Store/Product/Campaign in B.
- `SEC-TENANT-003` — Customer cannot access another Customer's own-order endpoint.
- `SEC-TENANT-004` — Customer cannot request a private Payment Slip download URL for another Customer's Order.

All cross-tenant attempts must fail without leaking unnecessary resource-existence information.

The API HTTP baseline states that an authenticated request denied by permission, tenant, or ownership is `403 Forbidden`. Canonical authorization/file errors include `FORBIDDEN`, `ROLE_FORBIDDEN`, `TENANT_MISMATCH`, `RESOURCE_OWNERSHIP_REQUIRED`, and `FILE_ACCESS_FORBIDDEN`; the contracts do not assign one unique code to every case above, so these tests must not invent a narrower code requirement.

## Current execution status

The security cases are intentionally represented as explicit TODO/BLOCKED tests rather than false passes.

Current Backend state blocks meaningful execution:

- `backend/src/modules/orders/` is empty.
- `backend/src/modules/payments/` is empty.
- `backend/src/modules/files/` is empty.
- `backend/src/app.js` mounts Health/Auth/User only; Order/File tenant-owned routes are not mounted.
- Store/Product/Campaign resources required by `SEC-TENANT-002` are not yet available through the required authenticated disposable two-tenant fixture flow.

Because cross-tenant and cross-customer failures are blocking security findings, Testing does not replace these checks with mocks that could pass without exercising real authorization.

## Latest execution

Command:

```bash
node --test security/tenant-isolation-a.test.mjs
```

Result:

- SEC-TENANT-001 — TODO/BLOCKED
- SEC-TENANT-002 — TODO/BLOCKED
- SEC-TENANT-003 — TODO/BLOCKED
- SEC-TENANT-004 — TODO/BLOCKED

Focused summary: 4 tests total — 0 pass, 0 fail, 4 todo.

These are not treated as passing security checks. They remain blocked until the real authenticated tenant-owned routes and disposable two-tenant fixtures exist.
