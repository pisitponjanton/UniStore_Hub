# Phase 16 — File Security Verification

## Contract basis

UniStore Hub uses direct Browser ↔ S3 transfer through Backend-authorized pre-signed URLs.

Documented endpoints:

- `POST /api/v1/organizations/:organizationId/products/:productId/image-upload-url`
- `POST /api/v1/organizations/:organizationId/orders/:orderId/payment-slip-upload-url`
- `POST /api/v1/organizations/:organizationId/files/download-url`

Object key invariants:

- Product Image: `products/{organizationId}/{productId}/{uuid}`
- Payment Slip: `payments/{organizationId}/{orderId}/{uuid}`

File constraints:

- Product Image ≤ 5 MiB
- Payment Slip ≤ 10 MiB
- allowed MIME: `image/jpeg`, `image/png`, `image/webp`
- pre-signed expiry: exactly 900 seconds
- Backend validates requested MIME before signing
- Backend performs S3 metadata/HEAD validation before persisting Product `imageKey` or accepting Payment `slipKey`

Security requirements:

- Product signing is authorized against Product + Organization.
- Customer Payment Slip access is constrained to own Order.
- Staff/Admin Payment Slip access is constrained to their authorized Organization.
- arbitrary/cross-path object keys are rejected.
- Payment Slip remains private.
- public Storefront image URL is derived only from Product's stored `imageKey`.
- API does not proxy the raw binary upload in the documented flow.

## Test IDs

Currently executable:

- CT-FILE-001 — Product Image upload route auth boundary
- CT-FILE-002 — Payment Slip upload route auth boundary
- CT-FILE-003 — private download route auth boundary
- CT-FILE-004 — S3 pre-sign default expiry is 900 seconds
- CT-FILE-005 — S3 adapter exposes PUT/GET pre-sign plus HEAD primitives
- CT-FILE-006 — Backend app has no raw/multipart file parser for the documented direct-upload flow

Fixture/deployment-dependent:

- CT-FILE-007 through CT-FILE-019

## Current implementation observation

At phase start:

- `backend/src/modules/files/`, `products/`, and `payments/` are empty.
- `backend/src/aws/s3.js` already provides pre-signed PUT/GET operations and `HeadObject`, with `DEFAULT_PRESIGN_EXPIRES_SECONDS = 900`.
- the Backend app currently uses JSON request parsing and does not configure a raw/multipart upload parser.
- file authorization, MIME/size enforcement, object-path validation, private download authorization, and persistence-time HEAD validation are not yet implemented end-to-end.

## Latest execution

Command:

```bash
node --test contract/file-security.contract.test.mjs
```

Result:

- CT-FILE-001 — PASS: Product Image upload signing route rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-FILE-002 — PASS: Payment Slip upload signing route rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-FILE-003 — PASS: private file download signing route rejects missing bearer with `401 AUTH_REQUIRED`.
- CT-FILE-004 — PASS: Backend S3 pre-sign default expiry is exactly 900 seconds.
- CT-FILE-005 — PASS: S3 adapter exposes pre-signed PUT/GET plus HEAD metadata primitives.
- CT-FILE-006 — PASS: current Backend app does not configure raw/multipart file-body parsing for the documented direct S3 flow.
- CT-FILE-007..019 — TODO/BLOCKED pending Product/Payment/File services, authenticated ownership/tenant fixtures, S3 metadata fixtures, deployed bucket checks, and end-to-end Browser ↔ S3 observation.

Focused summary: 19 tests total — 6 pass, 0 fail, 13 todo.

The six passes verify real current boundaries/capabilities only. They do not imply that file ownership, MIME/size enforcement, arbitrary-key rejection, bucket privacy, or persistence-time HEAD validation is complete; those remain explicitly blocked until the owning implementations exist.
