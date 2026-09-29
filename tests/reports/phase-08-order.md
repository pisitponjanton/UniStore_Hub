# Phase 08 — Order Creation and Snapshot Verification

## Contract basis

Order endpoints:

- `GET /api/v1/organizations/:organizationId/orders` — Staff/Admin for their Organization
- `POST /api/v1/organizations/:organizationId/orders` — authenticated Customer/user
- `GET /api/v1/organizations/:organizationId/orders/:orderId` — tenant Staff/Admin or owning Customer
- `GET /api/v1/me/orders` — authenticated Customer own-order view
- `GET /api/v1/me/orders/:orderId` — ownership required
- `POST /api/v1/me/orders/:orderId/cancel` — owning Customer
- `POST /api/v1/organizations/:organizationId/orders/:orderId/cancel` — Organization Admin only

Creation rules:

- Campaign must be `OPEN`.
- Product must belong to the same Organization and the same `storeId` as Campaign.
- Variant must belong to Product.
- quantity must be valid.
- Backend calculates price server-side and does not trust client price/total.
- `Variant.price` is authoritative.
- subtotal/total use integer satang.
- initial Order status is `PENDING_PAYMENT`.
- OrderItem snapshot stores `productName`, `variantName`, `unitPrice`, `quantity`, `totalPrice`.
- later Product/Variant edits must not mutate the snapshot.

Ownership and cancellation:

- Customer own-order access does not require Organization membership.
- another Customer must not access the owner’s Order.
- Staff/Admin access remains tenant-membership scoped.
- Customer may cancel own `PENDING_PAYMENT` or `PAYMENT_REJECTED`.
- Organization Admin may cancel tenant Orders in those states.
- Staff cannot use general Organization cancellation.
- successful cancellation creates `ORDER_CANCELLED` Audit.
- `PAYMENT_REVIEW` and paid-or-later Orders cannot cancel.

## Test IDs

Executable auth/surface checks:

- CT-ORDER-001 through CT-ORDER-007

Business/data/ownership checks requiring authenticated disposable fixtures:

- CT-ORDER-008 through CT-ORDER-023

## Latest execution

Command:

```bash
node --test contract/order.contract.test.mjs
```

Result:

- CT-ORDER-001..007 — FAIL: Order and own-order routes returned generic `404 VALIDATION_ERROR` instead of protected-route behavior.
- CT-ORDER-008..023 — TODO/BLOCKED pending authenticated disposable Campaign/Product/Variant/Order/Audit fixtures and Order implementation.

Observed implementation state: `backend/src/modules/orders/` is currently empty and `backend/src/app.js` still mounts only `/health`. This is a Backend-owned implementation gap; Testing does not patch it.

Current focused result: 23 tests total — 0 pass, 7 fail, 16 todo.
