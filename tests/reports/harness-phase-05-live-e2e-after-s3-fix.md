# Harness Phase 5 — Live Local E2E After Backend S3 Handoff

## Goal

Rerun the full live local E2E flow against the current Backend handoff after the S3 presign compatibility fix, without mocking direct S3 upload and without disturbing the unrelated service occupying canonical port 4000.

## Backend handoff observed

Current history includes:

```text
dfe48d9 fix(backend): make S3 presigned uploads LocalStack-compatible
```

The current S3 client config includes:

```text
requestChecksumCalculation: 'WHEN_REQUIRED'
```

No Backend file was modified by Testing.

## Canonical port condition preserved

`localhost:4000` is still occupied by a non-UniStore Docker-exposed service.

Observed:

```text
GET http://127.0.0.1:4000/health
→ HTTP 404
→ non-canonical Route not found response
```

Testing did not stop, restart, or reconfigure that service.

For disposable live qualification only, the current Backend was started at:

```text
http://127.0.0.1:4100
```

with the canonical LocalStack resources and Local Notification Worker.

## LocalStack state

LocalStack was already running and healthy before this phase:

```text
running
paused=false
health=healthy
endpoint=http://localhost:4566
region=us-east-1
```

Testing preserved that state after the E2E run.

## Direct S3 compatibility recheck

Before running the business flows, Testing exercised the current production S3 adapter directly:

```text
createS3Adapter().createPutUrl(...)
→ browser-equivalent PUT image/png
→ LocalStack S3
→ HeadObject
```

Observed pre-signed query keys:

```text
X-Amz-Algorithm
X-Amz-Content-Sha256
X-Amz-Credential
X-Amz-Date
X-Amz-Expires
X-Amz-Signature
X-Amz-SignedHeaders
x-id
```

The previous problematic checksum query fields were no longer present.

Result:

```text
PUT status = 200
HeadObject Content-Type = image/png
Content-Length = 68
```

Therefore the previously demonstrated LocalStack `x-amz-checksum-crc32` failure is resolved by the current Backend handoff.

## First live rerun and Testing defect found

The first live E2E rerun returned:

```text
5 tests
5 pass
0 fail
0 todo
```

However Backend logs revealed that the tenant-denial helper was constructing routes such as:

```text
/api/v1/api/v1/organizations/.../orders/...
```

for `apiError(...)` when `E2E_API_BASE_URL` already ended in `/api/v1`.

That meant denial checks could receive a 404 from a malformed route instead of proving the intended authorization boundary.

Testing did **not** accept that first green run as authoritative.

## Testing-owned E2E helper correction

Updated only:

- `tests/e2e/live-e2e-helpers.mjs`

`apiError(...)` now uses the same normalized `buildApiUrl(baseUrl, route)` path construction already used by successful JSON requests.

This ensures both accepted and rejected E2E requests support either:

```text
http://host:port
```

or:

```text
http://host:port/api/v1
```

without double-prefixing `/api/v1`.

No expected status was weakened.

## Authoritative live E2E rerun

After fixing the Testing helper, all five scenarios were rerun with a fresh `E2E_RUN_ID`.

Environment included:

- current Backend on isolated port 4100
- canonical LocalStack DynamoDB
- canonical LocalStack Files bucket
- canonical LocalStack SQS
- Local Notification Worker
- deterministic seeded Platform Admin token
- deterministic duplicate-recipient Customer token
- direct S3 upload path
- `E2E_API_BASE_URL=http://127.0.0.1:4100/api/v1`

Result:

```text
5 tests
5 pass
0 fail
0 todo
```

Passing scenarios:

```text
E2E-CORE-001
canonical register-to-received flow

E2E-PAYMENT-REJECT-001
reject -> notify -> resubmit -> approve -> PAID with audit trail

E2E-TENANT-001
two-organization cross-tenant denial matrix

E2E-NOTIFY-001
business event -> SQS -> Worker -> Notification -> mark-read
for approved/rejected/ready events

E2E-NOTIFY-001
duplicate delivery maps eventId to notificationId
and creates only one Notification
```

The corrected rerun produced no new `/api/v1/api/v1/` requests.

## Notification Worker evidence

During the authoritative rerun the Local Worker consumed multiple SQS messages with:

```text
received=1
failed=0
deleted=1
```

for each processed batch.

This provides live evidence for business-event Notification delivery in addition to duplicate-event idempotency.

## Safe default preserved

After live qualification, E2E was rerun with live environment variables removed.

Result:

```text
5 tests
0 pass
0 fail
5 todo
```

Therefore the suite still behaves correctly when a disposable live environment is not supplied.

No live requirement was converted into a fake default PASS.

## Cleanup

Testing-owned isolated processes were stopped:

```text
Backend port 4100: stopped
Local Worker: stopped
```

The unrelated service on port 4000 was untouched.

LocalStack remained in its pre-phase running/healthy state.

## Traceability implication for Phase 6

The new live evidence resolves the previous product/integration failure for:

```text
FR-08 Payment Slip / Verification
```

because direct pre-signed Payment Slip upload, reject/resubmit/approve, PAID transition and audit trail all completed live.

The new live business-event Notification scenario also completes the previously blocked minimum live path for:

```text
FR-13 In-app Notification
```

including approved/rejected/ready events, SQS, Worker persistence and mark-read.

Phase 6 should update canonical FR status from current evidence rather than editing historical reports.

FR-15 remains separately constrained by canonical port 4000 collision and unavailable live AWS qualification.

## Phase outcome

Phase 5 is complete.

Authoritative current live local E2E result:

```text
5 / 5 PASS
0 FAIL
0 TODO
```

The previous S3 checksum incompatibility is no longer reproducible with the current Backend handoff, and the tenant-denial test was corrected so its green result now exercises the intended API paths.
