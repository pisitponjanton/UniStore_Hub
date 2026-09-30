# UniStore Hub — Testing Handoff

Snapshot: 2026-09-30
Scope owner: Testing Agent (`tests/**` only)

## Current architecture

Cross-system Testing is organized as:

- `contract/**` — API contract/auth/envelope/business boundaries
- `security/**` — mandatory SEC-TENANT-001..009
- `integration/**` — Data contract, Notification resilience, traceability parity
- `frontend/**` — Frontend interaction and static-export integration evidence
- `smoke/**` — Local Dev Mode + live AWS deployment smoke
- `infrastructure/**` — static CloudFormation verification
- `e2e/**` — core, rejection/resubmit, tenant, Notification and duplicate-delivery flows
- `helpers/**` — current Backend/Frontend evidence harnesses
- `reports/**` — current qualification and historical phase evidence

Canonical FR mapping:

- `reports/fr-traceability.json`
- `reports/fr-traceability.md`

Current TODO classification snapshot:

- `reports/todo-inventory.json`
- `reports/todo-inventory.md`

## Node/runtime baseline

`tests/package.json` declares:

```text
Node >=22
```

Current modernization/qualification was executed with:

```text
Node v24.2.0
```

The old directory-style aliases were corrected to explicit `*.test.mjs` globs for Node 22+ compatibility.

Phase 9 still needs the final complete regression on the supported Node 22+ baseline.

## Current deterministic cross-system evidence

Phase 4:

```text
test:contract
198 tests
196 pass
0 fail
2 todo

test:integration
35 tests
35 pass
0 fail
0 todo

test:security
11 tests
11 pass
0 fail
0 todo
```

The two Contract TODOs are live/deployed file-boundary checks:

- CT-FILE-018 — deployed/private Files bucket public-read posture
- CT-FILE-019 — integrated Browser ↔ S3 transfer-boundary observation

Phase 5:

```text
test:frontend
33 tests
33 pass
0 fail
0 todo
```

Frontend subsystem evidence used by the cross-system harness was also verified on Node 24:

```text
Frontend subsystem: 190/190 pass
Frontend production static build: PASS
```

Backend subsystem evidence was verified on Node 24:

```text
Backend subsystem: 261/261 pass
```

## Local Dev qualification

The current working tree exposes these commands through an Integration-owned root `package.json`. During Phase 10 review that root file is still **untracked outside `tests/**`**, so Integration must commit it separately before a clean checkout can reproduce the current Dev Mode smoke baseline. Testing does not own or stage that file.

The repository now exposes the canonical Integration-owned root commands:

```text
dev:setup
dev
dev:seed
dev:reset
dev:down
```

Canonical LocalStack resources were observed:

```text
DynamoDB: unistore-hub-dev-local
S3:       unistore-hub-files-local
SQS:      unistore-hub-notifications-local
Endpoint: http://localhost:4566
Region:   us-east-1
```

Local smoke result from Phase 6, excluding the 9 AWS deployment cases:

```text
15 local DEV checks
9 pass
0 fail
6 blocked
```

Important demonstrated items:

- root Dev command surface exists
- canonical LocalStack table/bucket/queue exist
- Files bucket CORS exists for Frontend GET/PUT/HEAD
- Frontend dev server responds
- shared Backend data primitives remain canonical
- LocalStack AWS client configuration works
- local Worker entrypoint exists
- `dev:reset` is wired through the shared local-only safety guard
- a non-local `AWS_ENDPOINT_URL` is rejected before destructive reset work
- protected Organization routes still require authentication

Current canonical-port blocker:

```text
localhost:4000
→ occupied by a non-UniStore HTTP service
→ /health returns 404
```

Therefore canonical-port DEV-002/DEV-004 are not claimed as PASS.

## Live local E2E qualification

Phase 6 supplied real LocalStack runtime prerequisites plus the current Backend and Local Worker.

Final result:

```text
5 tests
1 pass
4 fail
0 todo
```

### Live PASS

The duplicate Notification-delivery scenario passed:

```text
SQS
→ Local Worker
→ DynamoDB Notification
→ current-user Notification API
→ duplicate event remains one Notification
```

### Live FAIL

The following all fail:

- E2E-CORE-001
- E2E-PAYMENT-REJECT-001
- E2E-TENANT-001
- E2E-NOTIFY-001 business-event flow

All four reach the same current integration defect:

```text
Backend-issued Payment Slip pre-signed URL
→ browser-equivalent PUT to LocalStack S3
→ HTTP 400 InvalidRequest
→ Value for x-amz-checksum-crc32 header is invalid
```

This was also reproduced directly with the current Backend S3 adapter, independent of the larger E2E flow.

Likely owning investigation area:

```text
backend/src/aws/s3.js
AWS SDK v3 request-checksum behavior
LocalStack S3 compatibility
```

Testing did not alter production S3 behavior or bypass direct upload.

## E2E environment-gating behavior

With live E2E variables absent, the same suite intentionally remains blocked:

```text
5 tests
0 pass
0 fail
5 todo
```

Historical implementation-file readiness guards were removed because the owning modules now exist. Current TODO conditions are environment/runtime gates, not old "module absent" assumptions.

## AWS live qualification

Phase 7:

```text
AWS-001..AWS-009
0 pass
0 fail
9 blocked
```

Current Testing Agent environment has:

```text
AWS CLI: unavailable
AWS_ACCESS_KEY_ID: unset
AWS_SECRET_ACCESS_KEY: unset
AWS_SESSION_TOKEN: unset
AWS_PROFILE: unset
~/.aws/credentials: absent
~/.aws/config: absent
```

Therefore no live Learner Lab deployment claim is made.

Static Infrastructure remains:

```text
test:infrastructure
12 tests
12 pass
0 fail
0 todo
```

This does not substitute for AWS-001..AWS-009.

## Current FR readiness

Current canonical traceability status:

```text
PASS    12
FAIL     1
BLOCKED  2
TOTAL   15
```

PASS minimum-verification requirements:

```text
FR-01 Authentication + JWT
FR-02 Organization
FR-03 Staff / Member
FR-04 Store
FR-05 Product / Variant
FR-06 Pre-order Campaign
FR-07 Order
FR-09 Production Summary
FR-10 Pickup QR / Token
FR-11 Dashboard / Report
FR-12 Audit Log
FR-14 Platform Admin
```

Current FAIL:

```text
FR-08 Payment Slip / Verification
```

Reason: live direct Payment Slip PUT fails against canonical LocalStack because of the checksum incompatibility.

Current BLOCKED:

```text
FR-13 In-app Notification
FR-15 Health Check
```

FR-13 has deterministic Notification/Worker/API evidence and live duplicate-delivery evidence, but the required live business-event path is transitively blocked by the Payment Slip upload failure.

FR-15 is blocked because canonical localhost:4000 is occupied and live AWS health cannot run without AWS CLI/Learner Lab access.

## Security status

SEC-TENANT-001 through SEC-TENANT-009 now execute instead of carrying historical TODOs.

The deterministic security suite result is:

```text
11 tests
11 pass
0 fail
0 todo
```

This includes evidence for:

- stored `organizationId` tenant checks
- cross-Customer own-Order denial
- private Payment Slip ownership
- cross-Organization Pickup denial
- Notification user isolation
- client-supplied role distrust
- resource ID alone being insufficient authorization

The live tenant E2E still fails later during paid-order setup because Payment Slip direct PUT is broken; that live failure is preserved.

## Traceability integrity

The current traceability workflow now verifies:

- exactly FR-01..FR-15
- unique FR IDs
- correct ordering
- Markdown/JSON parity
- mapped IDs resolve to executable test definitions
- evidence report paths exist

The previous FR-07 missing / duplicate FR-08 Markdown defect is fixed.

`fr-traceability.json` is the canonical machine-readable current snapshot.

Historical phase reports remain historical and are not rewritten to pretend earlier implementation state was different.

## Phase 9 supported-Node full regression

Executed with Node `v24.2.0`, which satisfies the declared `>=22` baseline.

Final complete Testing result:

```text
323 tests
300 pass
0 fail
23 todo
0 skipped
```

Named aliases:

```text
Contract:       198 / 196 pass / 0 fail / 2 todo
Integration:     35 / 35 pass
Security:        11 / 11 pass
Frontend cross:  33 / 33 pass
Smoke:           24 / 8 pass / 0 fail / 16 todo
E2E default:      5 / 0 pass / 0 fail / 5 todo
Infrastructure:  12 / 12 pass
```

Compatibility suites on the same runtime:

```text
Backend:  282 / 282 pass
Frontend: 190 / 190 pass
```

The smoke rerun exposed and fixed one Testing-only readiness defect: a paused LocalStack container was incorrectly treated as runnable. DEV-001 now checks for `--status running` and reports paused/non-running LocalStack as BLOCKED instead of false FAIL.

The zero-failure default regression does not override the live Phase 6 E2E result. The Payment Slip pre-signed LocalStack PUT checksum failure remains current product/integration evidence, and AWS live qualification remains blocked.

Detailed evidence: `reports/phase-09-node22plus-full-regression.md`.

## Next step — Phase 10

Review only the task diff against scope, constraints and acceptance criteria.

The review must keep these current findings visible:

1. Payment Slip direct PUT / LocalStack checksum incompatibility.
2. Canonical localhost:4000 collision.
3. AWS live smoke unavailable without AWS CLI + active Learner Lab deployment.
4. Environment-gated E2E remains TODO when live runtime variables are absent.

Testing may correct Testing-owned review defects only. Product/Backend/Integration/AWS findings must not be hidden.
