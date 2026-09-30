# UniStore Hub — Testing Handoff

Snapshot: 2026-09-30
Scope owner: Testing Agent (`tests/**` only)

## Current Testing architecture

Cross-system Testing is organized as:

- `contract/**` — API contract/auth/envelope/business boundaries
- `security/**` — mandatory SEC-TENANT-001..009
- `integration/**` — Data contract, Notification resilience, traceability parity
- `frontend/**` — Frontend interaction and static-export evidence
- `smoke/**` — Local Dev Mode + live AWS deployment smoke
- `infrastructure/**` — static CloudFormation verification
- `e2e/**` — core, payment rejection/resubmit, tenant, Notification and duplicate-delivery flows
- `helpers/**` — Backend/Frontend evidence harnesses
- `reports/**` — current qualification and historical evidence

Canonical current FR mapping:

- `reports/fr-traceability.json`
- `reports/fr-traceability.md`

Historical phase reports are not rewritten when current evidence changes.

## Runtime baseline

Testing declares:

```text
Node >=22
```

Current harness and live qualification use:

```text
Node v24.2.0
```

No exact Node 22 binary is installed on this agent; Node 24.2.0 is within the declared supported range.

## Harness determinism

The previous top-level race surfaces were corrected inside `tests/**`:

- Frontend Vitest evidence is cross-process serialized and uses `--no-cache`
- Frontend static builds use unique Testing-owned temp directories
- TRACE executable-ID discovery scans only canonical Testing `*.test.mjs` sources
- generated `tests/.tmp/**` content is excluded and protected by `TRACE-005`

Public aliases on the current supported runtime:

```text
Contract:       198 total / 196 pass / 0 fail / 2 todo
Integration:     36 total /  36 pass / 0 fail / 0 todo
Security:        11 total /  11 pass / 0 fail / 0 todo
Frontend cross:  33 total /  33 pass / 0 fail / 0 todo
Smoke:           24 total /   9 pass / 0 fail / 15 todo
E2E default:      5 total /   0 pass / 0 fail / 5 todo
Infrastructure:  12 total /  12 pass / 0 fail / 0 todo
```

Authoritative top-level regression was executed three consecutive times:

```text
324 tests
302 pass
0 fail
22 todo
0 skipped
```

All 3 runs were identical, with no `ERR_REQUIRE_ESM`, `ENOENT`, or module-resolution failure.

The 2 Contract TODOs remain the live/deployed file-boundary checks:

- CT-FILE-018 — deployed/private Files bucket public-read posture
- CT-FILE-019 — integrated Browser ↔ S3 transfer-boundary observation

## Subsystem compatibility evidence

Current subsystem evidence on Node v24.2.0:

```text
Backend:  282 / 282 pass
Frontend: 190 / 190 pass
```

Frontend cross-system qualification also performs a real isolated Next.js production static build.

## Current Backend S3 handoff

Current repository history includes:

```text
dfe48d9 fix(backend): make S3 presigned uploads LocalStack-compatible
```

Testing directly rechecked the production S3 adapter against canonical LocalStack:

```text
createPutUrl()
→ browser-equivalent PUT image/png
→ HTTP 200
→ HeadObject succeeds
```

The previous checksum query fields are no longer present, and the earlier LocalStack `x-amz-checksum-crc32` failure is no longer reproducible.

Testing did not modify Backend production code.

## Current live local E2E qualification

Canonical `localhost:4000` is still occupied by a non-UniStore Docker-exposed service and returns 404 for `/health`.

Testing did not stop or reconfigure that service.

For disposable live qualification, the current Backend was started on:

```text
http://127.0.0.1:4100
```

with:

- canonical LocalStack DynamoDB
- canonical LocalStack Files bucket
- canonical LocalStack SQS
- Local Notification Worker
- seeded Platform Admin/Customer identities
- direct S3 upload path

During the first post-fix run, Testing discovered that `apiError(...)` could double-prefix `/api/v1` when the base URL already included the API prefix. That Testing-owned helper was corrected before accepting the result.

Authoritative rerun after the helper correction:

```text
5 tests
5 pass
0 fail
0 todo
```

Passing live scenarios:

- E2E-CORE-001 — canonical register-to-received flow
- E2E-PAYMENT-REJECT-001 — reject → notify → resubmit → approve → PAID with audit trail
- E2E-TENANT-001 — two-Organization cross-tenant denial matrix
- E2E-NOTIFY-001 — approved/rejected/ready business events → SQS → Worker → Notification → mark-read
- E2E-NOTIFY-001 — duplicate delivery remains exactly one Notification

The corrected tenant-denial rerun produced no new `/api/v1/api/v1/` requests.

The Local Worker processed the live notification batches with:

```text
received=1
failed=0
deleted=1
```

Safe-default behavior remains explicit when no live E2E runtime variables are supplied:

```text
5 tests
0 pass
0 fail
5 todo
```

The isolated Backend/Worker processes were stopped after qualification. The unrelated port-4000 service was untouched.

Detailed current live evidence:

- `reports/harness-phase-05-live-e2e-after-s3-fix.md`

## AWS qualification

Live AWS qualification remains unavailable on this Testing Agent:

```text
AWS CLI: unavailable
AWS credentials/session/profile: unavailable
Learner Lab deployment access: unavailable
```

Therefore:

```text
AWS-001..AWS-009
0 pass
0 fail
9 blocked
```

Static Infrastructure remains:

```text
12 tests
12 pass
0 fail
0 todo
```

Static Infrastructure is not a substitute for live AWS smoke.

## Current FR readiness

Canonical current readiness is now:

```text
PASS    14
FAIL     0
BLOCKED  1
TOTAL   15
```

PASS:

```text
FR-01 Authentication + JWT
FR-02 Organization
FR-03 Staff / Member
FR-04 Store
FR-05 Product / Variant
FR-06 Pre-order Campaign
FR-07 Order
FR-08 Payment Slip / Verification
FR-09 Production Summary
FR-10 Pickup QR / Token
FR-11 Dashboard / Report
FR-12 Audit Log
FR-13 In-app Notification
FR-14 Platform Admin
```

FR-08 is now PASS because the current live direct Payment Slip upload succeeds and the rejection/resubmission/approval/audit E2E completes.

FR-13 is now PASS because the current live business-event Notification flow completes approved/rejected/ready events through SQS, Worker, persisted Notification, current-user API, and mark-read; duplicate-delivery idempotency also passes.

Still BLOCKED:

```text
FR-15 Health Check
```

Reasons:

- canonical localhost:4000 is occupied by a non-UniStore service
- live AWS health cannot be verified without AWS CLI + active Learner Lab deployment credentials

## Security status

Mandatory tenant/security coverage remains executable:

```text
SEC-TENANT-001 .. SEC-TENANT-009

11 tests
11 pass
0 fail
0 todo
```

The corrected live tenant E2E also passes the intended denial routes rather than malformed double-prefixed paths.

## Traceability integrity

Current traceability requires:

- exactly FR-01..FR-15
- unique ordered IDs
- JSON/Markdown parity
- mapped IDs resolve from canonical executable `*.test.mjs` sources only
- generated `tests/.tmp/**` content cannot satisfy mappings
- referenced evidence artifacts exist
- FR-08 retains Customer own-Payment read/ownership coverage

`fr-traceability.json` remains the canonical machine-readable current state.

## Current task review

Final diff review result:

```text
PASS
```

Reviewed properties:

- task changes remain under `tests/**`
- no test weakening was found
- canonical traceability remains ordered/unique and JSON/Markdown-parity protected
- live E2E result remains 5/5 PASS after the Testing URL-normalization correction
- FR-15/AWS blockers remain visible
- `git diff --check`, JSON parsing, and Testing `.mjs` syntax checks pass

Detailed review:

- `reports/harness-phase-07-review-diff.md`

No further Testing phase is pending for this task. Commit only Testing-owned changes when requested.
