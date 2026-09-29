# Phase 04 — Public Storefront Contract Verification

## Contract basis

Public read-only storefront routes are:

- `GET /api/v1/storefront/organizations`
- `GET /api/v1/storefront/organizations/:organizationId/stores`
- `GET /api/v1/storefront/organizations/:organizationId/stores/:storeId`
- `GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/products`
- `GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/products/:productId`
- `GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/campaigns`
- `GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/campaigns/:campaignId`

These routes must not require JWT. Storefront responses must not expose private organization/member/payment/audit fields, storage keys, or Product `imageKey`.

Creating an Order remains protected:

- `POST /api/v1/organizations/:organizationId/orders`
- missing Bearer JWT must return `401 AUTH_REQUIRED`.

## Test IDs

- CT-STOREFRONT-001 through CT-STOREFRONT-008

Nested storefront tests accept a resource-specific 404 for deterministic non-existent fixture IDs, but reject the generic route-not-found `VALIDATION_ERROR`. This allows route/auth verification without inventing seed data.

## Latest execution

Command:

```bash
node --test contract/storefront.contract.test.mjs
```

Result:

- CT-STOREFRONT-001 — FAIL: public organization listing returned generic 404 `VALIDATION_ERROR`
- CT-STOREFRONT-002 — FAIL: store listing route returned generic route-not-found instead of a public route/resource-specific response
- CT-STOREFRONT-003 — FAIL: store detail route returned generic route-not-found
- CT-STOREFRONT-004 — FAIL: product listing route returned generic route-not-found
- CT-STOREFRONT-005 — FAIL: product detail route returned generic route-not-found
- CT-STOREFRONT-006 — FAIL: campaign listing route returned generic route-not-found
- CT-STOREFRONT-007 — FAIL: campaign detail route returned generic route-not-found
- CT-STOREFRONT-008 — FAIL: unauthenticated Order creation returned 404 instead of `401 AUTH_REQUIRED`

Observed implementation state: `backend/src/modules/stores/`, `products/`, `campaigns/`, and `orders/` are currently empty and `backend/src/app.js` still mounts only `/health`. These are Backend-owned implementation gaps; Testing does not patch them.

The shared pagination assertion was also corrected to match the canonical API pagination shape `data.items + data.nextCursor`.
