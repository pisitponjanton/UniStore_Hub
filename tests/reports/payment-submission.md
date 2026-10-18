# Phase 09 — Payment Submission Flow Verification

## Contract basis

Payment slip upload URL:

- `POST /api/v1/organizations/:organizationId/orders/:orderId/payment-slip-upload-url`
- authenticated Customer must own the Order
- request requires `contentType`
- allowed MIME: `image/jpeg`, `image/png`, `image/webp`
- response signs a direct `PUT`
- object key format: `payments/{organizationId}/{orderId}/{uuid}`
- pre-signed expiry: 900 seconds
- Payment Slip maximum size: 10 MiB
- Backend validates requested MIME before signing and validates uploaded object metadata before accepting the slip

Payment submission:

- `POST /api/v1/organizations/:organizationId/orders/:orderId/payment`
- Customer must own the Order and route Organization must match
- `slipKey` must be within the authorized Order payment path
- Campaign must be `OPEN` or `CLOSED`
- first submission creates the Order's logical Payment record
- Payment becomes `PENDING_REVIEW`
- Order becomes `PAYMENT_REVIEW`

Resubmission:

- a `PAYMENT_REJECTED` Order reuses the same `paymentId`
- replacement slip replaces `slipKey`
- previous rejection/reviewer fields are cleared
- Payment returns to `PENDING_REVIEW`
- Order returns to `PAYMENT_REVIEW`

Boundary rules:

- approved/paid-or-later Orders cannot submit another slip
- submission/resubmission when Campaign is `PRODUCING` or later returns `PAYMENT_NOT_REVIEWABLE`
- `CLOSED` Campaign may finish payment submission/resubmission

## Test IDs

Executable auth/surface checks:

- CT-PAYMENT-SUBMIT-001 through CT-PAYMENT-SUBMIT-002

Behavior/file/state checks requiring authenticated disposable fixtures:

- CT-PAYMENT-SUBMIT-003 through CT-PAYMENT-SUBMIT-014

## Latest execution

Command:

```bash
node --test contract/payment-submission.contract.test.mjs
```

Result:

- CT-PAYMENT-SUBMIT-001..002 — FAIL: payment-slip upload and payment submission routes returned generic `404 VALIDATION_ERROR` instead of protected-route behavior.
- CT-PAYMENT-SUBMIT-003..014 — TODO/BLOCKED pending authenticated disposable Order/Payment/S3 fixtures and implementation.

Observed implementation state: `backend/src/modules/payments/` and `backend/src/modules/files/` are empty. `backend/src/app.js` now mounts Health, Auth, and User routers, but no Order/Payment/File routes are mounted yet. These are Backend-owned implementation gaps; Testing does not patch them.

Current focused result: 14 tests total — 0 pass, 2 fail, 12 todo.
