# Phase 9 — Node 22+ Full Regression

## Goal

Run the complete Testing regression and all public test aliases on a supported Node runtime, then rerun the relevant Backend and Frontend subsystem suites without hiding environment blockers or the previously demonstrated live E2E defect.

## Supported runtime used

The Testing package requires:

```text
Node >=22
```

Installed runtimes discovered on this agent:

```text
default: Node v20.13.0   (unsupported)
Node v24.2.0             (supported; used for Phase 9)
Node v25.6.0             (available but not used)
```

No exact Node 22 binary is installed on this agent. Node 24.2.0 is inside the declared `>=22` support range, so Phase 9 was executed on Node 24.2.0.

## Public alias regression

### Contract

```text
npm run test:contract

198 tests
196 pass
0 fail
2 todo
```

The two TODOs remain intentional live/deployed file-boundary checks:

- CT-FILE-018 — private bucket/object public-read posture
- CT-FILE-019 — integrated Browser ↔ S3 transfer boundary

### Integration

```text
npm run test:integration

35 tests
35 pass
0 fail
0 todo
```

### Security

```text
npm run test:security

11 tests
11 pass
0 fail
0 todo
```

### Frontend cross-system

```text
npm run test:frontend

33 tests
33 pass
0 fail
0 todo
```

This includes the Testing-owned isolated production static build.

### Smoke

The first default Phase 9 smoke run exposed a Testing harness issue:

```text
DEV-001 attempted docker exec into a paused LocalStack container
→ Docker returned "container is paused"
→ false FAIL
```

Phase 6 had intentionally returned LocalStack to its prior paused state. The readiness probe used `docker compose ps -q`, which reports a paused container ID as present.

Testing-owned fix:

```text
docker compose ps --status running -q localstack
```

The harness now reports a non-running/paused LocalStack as BLOCKED instead of trying to execute inside it.

Final smoke result:

```text
npm run test:smoke

24 tests
8 pass
0 fail
16 todo
```

The 16 runtime TODOs contain:

- 9 AWS live smoke cases — AWS CLI/Learner Lab unavailable
- LocalStack-dependent Dev checks while LocalStack is not running
- canonical Backend health/auth checks while localhost:4000 is occupied by a non-UniStore service
- business/file paths known to require the unresolved Payment Slip direct-PUT compatibility fix

### E2E — default environment-gated run

```text
npm run test:e2e

5 tests
0 pass
0 fail
5 todo
```

This is the correct safe-default result when no live E2E variables/runtime are supplied.

It does **not** supersede Phase 6 live qualification:

```text
5 live E2E tests
1 pass
4 fail
0 todo
```

where all four business-flow failures reached the same Payment Slip LocalStack S3 checksum defect.

### Infrastructure

```text
npm run test:infrastructure

12 tests
12 pass
0 fail
0 todo
```

Static Infrastructure remains separate from live AWS qualification.

## Complete Testing regression

Executed:

```text
npm test
```

Final supported-runtime result:

```text
323 tests
300 pass
0 fail
23 todo
0 skipped
```

The full default suite exits successfully because all unavailable environment checks remain explicit TODO/BLOCKED rather than becoming false failures.

The 23 runtime TODO results are:

```text
2  Contract live/deployed file-boundary checks
5  E2E environment-gated scenarios
9  AWS live deployment checks
7  Local Dev/runtime checks
```

The exact runtime TODO count is different from the source marker count because conditional `t.todo()` branches and the shared AWS deployment gate expand differently at runtime.

Current explicit source TODO markers remain:

```text
21
```

and are concentrated only in file/live environment, E2E, Dev Mode and AWS gating.

## Full-suite discovery note

`npm test` discovers 323 tests, while the named category aliases total 318 tests.

The additional full-suite coverage comes from Testing files that are intentionally outside category aliases:

- `baseline.test.mjs`
- `helpers/shared-utilities.test.mjs`

Therefore the top-level `npm test` remains the authoritative complete Testing regression.

## Backend compatibility

Executed on the same Node v24.2.0 runtime:

```text
cd backend
npm test

282 tests
282 pass
0 fail
0 todo
```

The Backend suite has grown from the earlier 261-test snapshot; current Phase 9 evidence is 282/282.

## Frontend compatibility

Executed on the same Node v24.2.0 runtime:

```text
cd frontend
npm test

60 test files passed
190 tests passed
```

Cross-system `test:frontend` additionally verifies an isolated Next.js production static build, so no production Frontend build artifacts need to be modified for this phase.

## Current known product/environment findings

The zero-failure default full regression must not be read as "all live paths pass."

Current live qualification evidence still includes:

1. **Payment Slip LocalStack S3 incompatibility**
   - live core/rejection/tenant/business-notification E2E reached direct Payment Slip upload
   - Backend-issued pre-signed PUT returns HTTP 400
   - LocalStack reports invalid `x-amz-checksum-crc32`

2. **Canonical localhost:4000 collision**
   - a non-UniStore service responds on port 4000
   - canonical Backend health/auth smoke cannot be claimed PASS there

3. **AWS live smoke blocked**
   - AWS CLI unavailable
   - no active Learner Lab credential/profile environment
   - AWS-001..AWS-009 remain BLOCKED

4. **Default E2E is intentionally gated**
   - no live E2E env → 5 TODO
   - Phase 6 live result remains the authoritative live E2E evidence

## Traceability effect

Phase 9 does not overturn the Phase 8 FR status:

```text
PASS    12
FAIL     1
BLOCKED  2
```

The current FAIL remains:

```text
FR-08 Payment Slip / Verification
```

The current BLOCKED requirements remain:

```text
FR-13 In-app Notification
FR-15 Health Check
```

The default full regression's environment TODOs do not erase the stronger live evidence from Phases 6–7.

## Phase outcome

Phase 9 supported-Node regression is complete.

Final Testing baseline for review:

```text
Node:            v24.2.0 (supported >=22)
Full Testing:    323 / 300 pass / 0 fail / 23 todo
Contract:        198 / 196 pass / 0 fail / 2 todo
Integration:      35 / 35 pass
Security:         11 / 11 pass
Frontend cross:   33 / 33 pass
Smoke:            24 / 8 pass / 0 fail / 16 todo
E2E default:       5 / 0 pass / 0 fail / 5 todo
Infrastructure:   12 / 12 pass
Backend subsystem: 282 / 282 pass
Frontend subsystem: 190 / 190 pass
```

The task is ready for Phase 10 diff review, with live product/environment findings preserved.
