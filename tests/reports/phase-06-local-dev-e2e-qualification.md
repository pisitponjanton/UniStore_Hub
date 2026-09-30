# Phase 6 — Local Dev and E2E Qualification

## Goal

Execute the current canonical LocalStack/Dev Mode and local E2E flows without weakening auth, tenant, file, payment, notification, or environment requirements.

## Environment observed

Verification used Node:

```text
v24.2.0
```

which is inside the declared `>=22` baseline.

The repository now exposes the canonical root Dev command surface:

```text
dev:setup
dev
dev:seed
dev:reset
dev:down
```

LocalStack resources were present and verified:

```text
DynamoDB: unistore-hub-dev-local
S3:       unistore-hub-files-local
SQS:      unistore-hub-notifications-local
Region:   us-east-1
Endpoint: http://localhost:4566
```

The Files bucket had the expected Frontend CORS contract for GET/PUT/HEAD.

## Canonical port condition

During qualification, `localhost:4000` was occupied by a non-UniStore Docker-exposed HTTP service.

Observed:

```text
GET http://localhost:4000/health
HTTP 404
non-canonical response
```

Therefore DEV-002 and real canonical-port auth qualification cannot be treated as PASS.

For API E2E only, Testing started the current Backend on an isolated temporary port:

```text
http://127.0.0.1:4100
```

using the same LocalStack resources and current Backend code. Health passed:

```json
{"success":true,"data":{"status":"ok"}}
```

A local Notification Worker was run against the canonical LocalStack SQS queue for E2E qualification.

Testing-owned temporary runtime logs/PIDs were kept under:

```text
tests/.tmp/phase6/
```

Processes were stopped after qualification and LocalStack was returned to its previously paused state.

## Testing harness updates made during qualification

### E2E base URL compatibility

The canonical Dev outputs currently expose:

```text
E2E_API_BASE_URL=http://localhost:4000/api/v1
```

The existing E2E helpers appended routes that already begin with `/api/v1`. Without normalization this can produce a double API prefix.

The Testing helper now accepts either:

```text
http://host:port
```

or:

```text
http://host:port/api/v1
```

without changing the actual API route contract.

The final live E2E rerun intentionally used:

```text
E2E_API_BASE_URL=http://127.0.0.1:4100/api/v1
```

to prove the canonical output shape is consumed correctly.

### Historical E2E readiness guards removed

The five old implementation-file presence guards were removed from:

- core flow
- payment rejection flow
- tenant denial flow
- notification business flow
- duplicate notification delivery

Order, Payment, Pickup, Notification and Worker implementations exist now. Environment/runtime requirements remain explicit and are still TODO/BLOCKED when the required E2E variables are absent.

### Better Payment Slip failure diagnostics

Payment Slip direct-PUT failures now include the actual S3 response body instead of only HTTP status.

This exposed the current local integration defect precisely.

### DEV-008 safety verification corrected

The old test incorrectly required `AWS_ENDPOINT_URL` guard text to live directly inside `scripts/dev-reset.sh`.

Current Integration implementation correctly centralizes the guard in:

```text
scripts/lib/dev-common.sh
```

Testing now verifies that `dev-reset.sh` calls the shared guard and also executes a real non-local endpoint refusal check.

No destructive operation is performed by that check.

## Dev Mode smoke result

Executed with canonical LocalStack available:

```text
npm run test:smoke

24 tests
9 pass
0 fail
15 todo
```

The 15 TODO results include all 9 AWS deployment smoke checks, which belong to Phase 7.

Therefore local Dev smoke specifically is:

```text
15 local DEV checks
9 pass
0 fail
6 todo/blocked
```

Demonstrated local evidence includes:

- root Dev command surface exists
- canonical LocalStack table/bucket/queue exist
- local Files bucket CORS is present
- Frontend dev server can load on localhost:3000
- shared Backend data primitives remain canonical
- LocalStack AWS client configuration is accepted
- Worker entrypoint exists
- dev:reset is wired to the strict local-only guard
- dev:reset rejects a non-local AWS endpoint before destructive work
- protected Organization routes still require authentication

Remaining local smoke blockers are not hidden:

- canonical `localhost:4000` occupied by a non-UniStore service
- canonical-port real Register/Login/GET /me cannot be completed while that collision exists
- full LocalStack business/file parity is blocked by the Payment Slip direct-PUT failure described below
- full business-event notification path is transitively blocked by that same payment/file failure

## Live E2E result

All five E2E scenarios were supplied with live runtime prerequisites:

- current Backend
- LocalStack DynamoDB
- LocalStack Files bucket
- LocalStack SQS
- Local Notification Worker
- deterministic run ID
- Platform Admin token derived from the deterministic local seed
- duplicate-recipient token/user fixture

Final result:

```text
npm run test:e2e

5 tests
1 pass
4 fail
0 todo
```

### PASS

`E2E-NOTIFY-001 duplicate delivery maps eventId to notificationId and creates only one Notification`

This demonstrates the live path:

```text
SQS
→ Local Worker
→ DynamoDB Notification
→ GET current-user Notifications
```

and confirms duplicate delivery remains idempotent with one persisted Notification for the event ID.

### FAIL — E2E-CORE-001

The flow successfully reached:

```text
Register/Login
→ Organization create/Platform approval
→ Staff membership
→ Store
→ Product
→ Variant
→ Campaign create/open
→ Customer Order
→ Backend-issued Payment Slip pre-sign
```

It then failed at the browser-equivalent S3 PUT.

### FAIL — E2E-PAYMENT-REJECT-001

The flow reached Order + Backend-issued Payment Slip pre-sign, then failed at the same direct S3 PUT before reject/resubmit/approve could execute.

### FAIL — E2E-TENANT-001

The tenant flow created both tenant/user/catalog fixtures and reached the paid-order setup path, but failed at Payment Slip direct PUT before the full denial matrix could complete.

The mandatory deterministic SEC-TENANT-001..009 cross-system evidence remains separately executable from Phase 4; this live E2E scenario is still considered failed, not passed.

### FAIL — E2E-NOTIFY-001 business event flow

The business-event notification flow reached Payment Slip upload and failed before PAYMENT_APPROVED / PAYMENT_REJECTED / READY_FOR_PICKUP business events could all be produced.

The direct duplicate-delivery notification scenario passed independently.

## Current local integration defect

All four live business-flow failures share the same root observable failure:

```text
Pre-signed Payment Slip PUT
→ HTTP 400
→ InvalidRequest
→ Value for x-amz-checksum-crc32 header is invalid.
```

A separate direct diagnostic reproduced the failure without the E2E business flow:

```text
backend createS3Adapter().createPutUrl(...)
→ Browser-equivalent fetch PUT
→ LocalStack HTTP 400
```

The generated pre-signed URL contains checksum-related query fields including:

```text
x-amz-checksum-crc32
x-amz-sdk-checksum-algorithm
```

and LocalStack returns:

```xml
<Code>InvalidRequest</Code>
<Message>Value for x-amz-checksum-crc32 header is invalid.</Message>
```

This is a real Backend/AWS-adapter ↔ LocalStack compatibility failure. Testing did not remove the checksum fields, rewrite the upload, proxy the binary through Backend, or mark the affected flows TODO/PASS.

Likely owning investigation area:

```text
backend/src/aws/s3.js
AWS SDK v3 request-checksum behavior
LocalStack S3 compatibility
```

Testing ownership does not permit changing that production code.

## Safe default behavior retained

With live E2E variables intentionally absent:

```text
npm run test:e2e

5 tests
0 pass
0 fail
5 todo
```

Therefore the suite still preserves explicit environment blocking when no disposable runtime is supplied.

## Current explicit TODO source markers

After removing historical implementation-readiness guards:

```text
21 explicit todo:/t.todo() source markers
```

These are now concentrated in environment/runtime gating:

```text
5 smoke/dev-mode-a.test.mjs
5 e2e/tenant-notification-flow.test.mjs
4 smoke/dev-mode-b.test.mjs
2 e2e/payment-rejection-flow.test.mjs
2 e2e/core-flow.test.mjs
2 contract/file-security.contract.test.mjs
1 smoke/aws-deployment.test.mjs
```

The marker count is not directly equal to runtime TODO count because one source `t.todo()` branch can cover conditional environment states and the AWS smoke shared gate expands into multiple runtime tests.

## Phase outcome

Phase 6 qualification is complete.

Result is **not all PASS**:

- Local Dev smoke: 9 PASS / 6 BLOCKED, excluding AWS
- Live E2E: 1 PASS / 4 FAIL / 0 TODO
- Health on isolated current Backend: PASS
- Duplicate Notification delivery: PASS
- Core/Payment/Tenant/business Notification E2E: FAIL on the same live LocalStack S3 checksum incompatibility
- Canonical port 4000 remains an environment collision

The failures are preserved as owning-subsystem findings and must not be hidden by Testing.
