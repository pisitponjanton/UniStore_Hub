# Phase 06 — Store and Product/Variant Contract Verification

## Contract basis

Store management endpoints are Organization Admin-only:

- `GET /api/v1/organizations/:organizationId/stores`
- `POST /api/v1/organizations/:organizationId/stores`
- `GET /api/v1/organizations/:organizationId/stores/:storeId`
- `PATCH /api/v1/organizations/:organizationId/stores/:storeId`

Product/Variant management endpoints are Organization Admin-only:

- `GET /api/v1/organizations/:organizationId/products`
- `POST /api/v1/organizations/:organizationId/products`
- `GET /api/v1/organizations/:organizationId/products/:productId`
- `PATCH /api/v1/organizations/:organizationId/products/:productId`
- `DELETE /api/v1/organizations/:organizationId/products/:productId`
- `POST /api/v1/organizations/:organizationId/products/:productId/variants`
- `PATCH /api/v1/organizations/:organizationId/products/:productId/variants/:variantId`
- `DELETE /api/v1/organizations/:organizationId/products/:productId/variants/:variantId`

Canonical DTO rules include:

- StoreDTO carries `storeId`, `organizationId`, name/description/status and timestamps.
- ProductDTO carries `productId`, `organizationId`, `storeId`, image fields, status, timestamps, and variants on detail when included.
- ProductVariantDTO carries `variantId`, `organizationId`, `productId`, name, integer-satang `price`, status and timestamps.
- Management ProductDTO may contain `imageKey`; Storefront must omit `imageKey`.
- supplied Product `imageKey` must be scoped to `products/{organizationId}/{productId}/`, exist, use allowed MIME, and be at most 5 MiB.
- Product and Variant delete are soft deactivation and return HTTP 204.
- tenant/resource ownership remains authoritative; IDs alone must not grant cross-tenant access.

## Test IDs

Executable auth/surface checks:

- CT-STORE-001 through CT-STORE-004
- CT-PRODUCT-001 through CT-PRODUCT-005
- CT-VARIANT-001 through CT-VARIANT-003

Behavior/data checks requiring authenticated disposable fixtures:

- CT-STORE-005
- CT-PRODUCT-006 through CT-PRODUCT-010

## Latest execution

Command:

```bash
node --test contract/store-product.contract.test.mjs
```

Result:

- CT-STORE-001..004 — FAIL: Store management routes returned generic `404 VALIDATION_ERROR` instead of protected-route behavior.
- CT-PRODUCT-001..005 — FAIL: Product management routes returned generic `404 VALIDATION_ERROR`.
- CT-VARIANT-001..003 — FAIL: Variant management routes returned generic `404 VALIDATION_ERROR`.
- CT-STORE-005 and CT-PRODUCT-006..010 — TODO/BLOCKED pending authenticated disposable Store/Product/Variant/S3 fixtures.

Observed implementation state: `backend/src/modules/stores/` and `backend/src/modules/products/` remain empty and `backend/src/app.js` currently mounts only `/health`. These are Backend-owned implementation gaps; Testing does not patch them.

Current focused result: 18 tests total — 0 pass, 12 fail, 6 todo.
