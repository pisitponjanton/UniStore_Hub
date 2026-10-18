# Test Harness Validation

Consolidated reference for feature-focused QA. Records are retained as separate dated observations; earlier metrics may be superseded by later results. Refer to `../../frontend/quality-audit/frontend-qa-signoff.md` for final scoped QA scope, and the root `../../WEB_QUALITY_AUDIT.md` for remaining gaps.

## Contents

- [Harness Race Reproduction](#record-01-harness-race-reproduction)
- [Harness Frontend Isolation](#record-02-harness-frontend-isolation)
- [Harness Traceability Determinism](#record-03-harness-traceability-determinism)
- [Harness Deterministic Full Regression](#record-04-harness-deterministic-full-regression)
- [Harness Live E2E After S3 Fix](#record-05-harness-live-e2e-after-s3-fix)
- [Harness Current Traceability](#record-06-harness-current-traceability)
- [Harness Review Diff](#record-07-harness-review-diff)


---

<a id="record-01-harness-race-reproduction"></a>

## Harness Race Reproduction

### Harness Phase 1 — Full-Suite Race Reproduction

#### Goal

Reproduce the reported top-level `npm test` instability, compare it with the public category aliases, and identify Testing-owned shared-resource/concurrency hazards before changing the harness.

#### Baseline

Repository HEAD during this phase:

```text
34d9979 chore: add root integration commands
ee5f85c test: modernize cross-system qualification suite
```

Testing working tree was clean before this phase.

Runtime:

```text
Node v24.2.0
```

This satisfies the declared `Node >=22` Testing baseline.

#### Top-level regression reproduction

Executed three consecutive times:

```text
npm --prefix tests test
```

All three runs returned the same result:

```text
323 tests
301 pass
0 fail
22 todo
0 skipped
exit 0
```

No `ERR_REQUIRE_ESM`, `ENOENT`, or `Cannot find module` failure was reproduced in these three current runs.

Therefore the reported failure is intermittent rather than a deterministic current failure.

The default TODO count is now 22 rather than the previous 23 because the Integration-owned root command surface has since been committed and one prior Dev blocker now executes/passes.

#### Public alias comparison

All public aliases completed independently under the same Node runtime.

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

test:frontend
33 tests
33 pass
0 fail
0 todo

test:smoke
24 tests
9 pass
0 fail
15 todo

test:e2e
5 tests
0 pass
0 fail
5 todo

test:infrastructure
12 tests
12 pass
0 fail
0 todo
```

The independently executed aliases show no category-local deterministic failure.

#### Race candidate 1 — TRACE-001 scans generated temporary build output

Current traceability discovery recursively walks the entire `testsRoot`.

It excludes only directory names:

```text
reports
node_modules
```

It does **not** exclude:

```text
.tmp
generated static build output
Next.js .next/output chunks
```

Current `tests/.tmp/frontend-static-build` contains:

```text
194 *.js / *.mjs files
```

including generated files under:

```text
.tmp/frontend-static-build/.next/**
.tmp/frontend-static-build/out/_next/**
```

At the same time, the Frontend static-build helper begins with:

```text
rm(tests/.tmp/frontend-static-build, recursive=true)
→ copy Frontend
→ build
```

In the top-level Node test runner, `frontend/static-export.test.mjs` and `integration/traceability.test.mjs` are separate test files and can execute in parallel.

That creates a direct TOCTOU race:

```text
TRACE readdir generated directory
→ Frontend build helper removes/replaces tempRoot
→ TRACE readFile/readdir on a now-disappeared path
→ possible ENOENT / file-disappearance failure
```

This is a concrete Testing-owned race even though it did not trigger in the three current full-suite runs.

Phase 3 should restrict traceability discovery to canonical Testing source directories/files and explicitly exclude `.tmp/**`.

#### Race candidate 2 — Frontend evidence processes share Frontend runtime/cache state

`helpers/frontend-suite-evidence.mjs` launches a separate Vitest child for each requested Frontend suite:

```text
node <frontend>/node_modules/vitest/vitest.mjs run <suite> --reporter=verbose
```

For multi-suite evidence calls the helper uses:

```text
Promise.all(files.map(runFrontendSuite))
```

All children use the same:

```text
cwd = frontend/
frontend/node_modules
frontend/node_modules/.vite
vitest.config.ts
```

The Frontend installation currently has:

```text
frontend/node_modules/.vite
```

as shared cache state.

Additionally, `frontend/frontend-interaction.test.mjs` and `frontend/static-export.test.mjs` are separate Node test files, so independent helper module instances can spawn Frontend/Vitest work concurrently during the top-level suite.

This shared cache/runtime state is the strongest current candidate for the reported intermittent Frontend loader/`ERR_REQUIRE_ESM` pattern.

Phase 2 should isolate or serialize Frontend executable evidence so parallel top-level test discovery cannot make separate Vitest processes mutate/read the same transient Vite state concurrently.

#### Race candidate 3 — static build temp path is globally fixed

The Frontend static build always uses:

```text
tests/.tmp/frontend-static-build
```

and unconditionally removes it before each build.

The `buildPromise` cache is process-local only. It does not protect:

- another Node test worker with its own helper module instance
- another concurrent `npm test` invocation
- TRACE-001 reading that tree

Therefore the temp build is not parallel-safe.

Phase 2 should use a unique Testing-owned build root per runner/process and clean only that owned root.

#### Current conclusion

The previously reported race was **not reproduced as a failure** in three consecutive current top-level runs, but the current harness contains two concrete shared-state defects and one non-isolated temp-path defect that can explain intermittent behavior:

1. TRACE-001 recursively scans `.tmp/frontend-static-build` while that tree is deleted/rebuilt.
2. Multiple Frontend evidence children share the same Frontend/Vite cache/runtime state.
3. Static build output uses one global Testing temp path.

The category aliases passing independently is consistent with a concurrency/isolation issue rather than an individual contract/Frontend test defect.

#### Phase handoff

Phase 2 should address Frontend harness isolation only.

Phase 3 should separately make traceability discovery deterministic and canonical-source-only.

No coverage should be removed, no executable Frontend check should be replaced by static-only assertions, and no genuine environment TODO/BLOCKED state should be promoted.

---

<a id="record-02-harness-frontend-isolation"></a>

## Harness Frontend Isolation

### Harness Phase 2 — Frontend Harness Isolation

#### Goal

Make Testing-owned Frontend executable evidence and static-build qualification safe under parallel top-level test discovery without reducing Frontend coverage or modifying `frontend/**`.

#### Changes

Updated:

- `helpers/frontend-suite-evidence.mjs`

##### Vitest evidence isolation

Frontend evidence now:

- batches newly requested Frontend suite files into one Vitest child instead of spawning one child per suite
- runs Vitest with `--no-cache` so Testing does not rely on or mutate the shared `frontend/node_modules/.vite` result cache
- serializes Testing-owned Vitest evidence processes across Node test workers with an atomic lock under `tests/.tmp/frontend-harness.lock`
- records the lock owner PID and automatically clears a stale lock when that recorded process no longer exists
- removes inherited `NODE_TEST_CONTEXT` from child processes as before

The lock is used only around Vitest evidence processes. It is not used around the isolated Next.js static build.

##### Static-build isolation

The old global temp path:

```text
tests/.tmp/frontend-static-build
```

was replaced with a unique per-build directory created by `mkdtemp()` under:

```text
tests/.tmp/frontend-static-builds/<pid>-<unique>/
```

Each build:

- copies Frontend source into its own Testing-owned temp directory
- excludes Frontend `node_modules`, `.next`, `out`, and `.git`
- symlinks the installed Frontend dependency tree read-only for dependency resolution
- writes Next.js `.next` and `out` only inside the unique Testing-owned temp directory
- continues to use a real Next.js production `--webpack` static build

This removes the previous cross-process `rm(tests/.tmp/frontend-static-build)` collision.

#### Concurrency verification

Two independent Node processes were started concurrently and both requested the same executable Frontend session evidence through the helper.

Result:

```text
process 1: exit 0 / evidence-ok
process 2: exit 0 / evidence-ok
```

No `ERR_REQUIRE_ESM`, `ENOENT`, lock timeout, or shared-cache failure occurred.

#### Cross-system Frontend verification

After isolation changes:

```text
npm run test:frontend

33 tests
33 pass
0 fail
0 todo
```

The complete interaction/static-export suite remained executable.

The isolated static build completed successfully and canonical exported route checks continued to pass.

#### Standalone Frontend verification

The owning Frontend subsystem suite was rerun on Node v24.2.0.

Result:

```text
60 test files passed
190 tests passed
```

Testing did not replace executable Frontend evidence with static source-only assertions.

#### Scope integrity

Current repository status after this phase shows only:

```text
M  tests/helpers/frontend-suite-evidence.mjs
?? tests/reports/test-harness-validation.md#record-01-harness-race-reproduction
?? tests/reports/test-harness-validation.md#record-02-harness-frontend-isolation
```

inside Testing ownership.

The pre-existing generated change:

```text
M frontend/next-env.d.ts
```

remains outside Testing ownership and was not modified by this phase.

#### Remaining work

Phase 2 intentionally does not change TRACE-001 source discovery.

The traceability scanner still recursively enters `tests/.tmp/**`, including generated static-build output. Phase 3 must restrict executable-ID discovery to canonical Testing source paths and exclude temp/generated trees.

#### Phase outcome

Frontend harness isolation is complete:

- executable Frontend evidence remains real
- Testing Vitest cache mutation is disabled
- Testing Vitest processes are cross-worker serialized
- stale lock recovery is present
- static builds no longer share one removable temp root
- Frontend subsystem remains 190/190 passing
- cross-system Frontend remains 33/33 passing

---

<a id="record-03-harness-traceability-determinism"></a>

## Harness Traceability Determinism

### Harness Phase 3 — Deterministic Traceability Discovery

#### Goal

Remove the TRACE-001 race where executable-ID discovery could recurse into generated `tests/.tmp/**` content while the Frontend static-build harness was deleting/replacing files.

#### Implementation

Updated:

- `integration/traceability.test.mjs`

Executable-ID discovery no longer starts at the whole `testsRoot`.

It now scans only canonical Testing source roots:

```text
baseline.test.mjs
contract/**
integration/**
security/**
frontend/**
smoke/**
e2e/**
infrastructure/**
helpers/**
```

Within those roots, only files named:

```text
*.test.mjs
```

are treated as executable traceability sources.

Therefore these areas are no longer part of TRACE-001 discovery:

```text
tests/.tmp/**
reports/**
generated Next.js .next/**
generated static out/**
runtime logs/PID files
other non-test helper modules
```

This closes the previous TOCTOU condition where TRACE could `readdir()` a generated build directory while another test worker removed/rebuilt it.

#### Regression guard

Added:

```text
TRACE-005 executable-ID discovery ignores generated tests/.tmp content
```

The test creates a real generated-looking decoy:

```text
tests/.tmp/traceability-decoy/generated.test.mjs
```

containing:

```text
TRACE-DECOY-999
```

and proves that canonical executable discovery does not see that ID.

The existing FR-08 coverage check remains `TRACE-004`; its historical test ID was preserved.

#### Direct verification

Executed on Node `v24.2.0`:

```text
node --test integration/traceability.test.mjs

5 tests
5 pass
0 fail
0 todo
```

Verified checks:

- TRACE-001 FR mapping → executable canonical test IDs + artifacts
- TRACE-002 JSON/Markdown parity and exact FR order
- TRACE-003 handoff/report existence
- TRACE-004 FR-08 Customer own-Payment coverage
- TRACE-005 generated `.tmp` exclusion

#### Race stress verification

While another thread repeatedly:

```text
creates generated JS files under tests/.tmp
deletes the directory
recreates the directory
```

the traceability test was executed 10 consecutive times.

Result:

```text
10 / 10 runs exit 0
ERR_REQUIRE_ESM: none
ENOENT: none
churn errors: none
```

This directly exercises the prior file-disappearance race shape without changing production or canonical test sources.

#### Integration alias

Executed:

```text
npm run test:integration

36 tests
36 pass
0 fail
0 todo
```

The count increased from 35 to 36 because TRACE-005 is a new executable regression guard.

#### Coverage integrity

No mapped FR test ID was removed.

The dynamic parameterized-test extraction used for CT-GOV-style definitions remains intact.

The scanner still covers all canonical test categories plus root baseline and Testing helper test files; it only removes ephemeral/generated/non-test paths from the evidence corpus.

#### Phase outcome

Phase 3 is complete.

TRACE-001 no longer scans `tests/.tmp/**`, generated build output cannot satisfy a mapped executable ID, and the file-disappearance race has a dedicated regression check.

Phase 4 should now rerun every public alias plus repeated top-level `npm test` to confirm the combined Frontend-harness and traceability fixes are deterministic.

---

<a id="record-04-harness-deterministic-full-regression"></a>

## Harness Deterministic Full Regression

### Harness Phase 4 — Deterministic Full Regression

#### Goal

Verify that the Frontend harness isolation from Phase 2 and deterministic traceability discovery from Phase 3 remove Testing-owned top-level race failures while preserving genuine environment TODO/BLOCKED states.

#### Runtime

Executed with:

```text
Node v24.2.0
```

which is inside the declared `Node >=22` Testing baseline.

#### Public aliases

All public aliases completed successfully.

##### Contract

```text
npm run test:contract

198 tests
196 pass
0 fail
2 todo
```

The two TODOs remain the intentional live/deployed file-boundary checks.

##### Integration

```text
npm run test:integration

36 tests
36 pass
0 fail
0 todo
```

The count is 36 because Phase 3 added `TRACE-005`, which proves generated `tests/.tmp/**` content cannot satisfy traceability executable-ID discovery.

##### Security

```text
npm run test:security

11 tests
11 pass
0 fail
0 todo
```

##### Frontend cross-system

```text
npm run test:frontend

33 tests
33 pass
0 fail
0 todo
```

No `ERR_REQUIRE_ESM`, `ENOENT`, lock timeout, or module-resolution error was observed.

The owning Frontend subsystem evidence from Phase 2 remains:

```text
60 test files
190 tests
190 pass
```

##### Smoke

```text
npm run test:smoke

24 tests
9 pass
0 fail
15 todo
```

The TODOs remain genuine environment/deployment blockers, including:

- canonical Backend port 4000 collision
- live LocalStack/business-flow prerequisites
- current Payment Slip direct-PUT incompatibility evidence
- AWS CLI/Learner Lab absence

##### E2E — safe default

```text
npm run test:e2e

5 tests
0 pass
0 fail
5 todo
```

This is the intended result without live E2E runtime variables.

It does not supersede the earlier live qualification evidence.

##### Infrastructure

```text
npm run test:infrastructure

12 tests
12 pass
0 fail
0 todo
```

Static Infrastructure remains separate from live AWS smoke.

#### Repeated authoritative top-level regression

Executed the authoritative top-level suite three consecutive times:

```text
npm test
```

All three runs produced exactly the same result:

```text
Run 1
324 tests
302 pass
0 fail
22 todo
0 skipped

Run 2
324 tests
302 pass
0 fail
22 todo
0 skipped

Run 3
324 tests
302 pass
0 fail
22 todo
0 skipped
```

Automated log comparison confirmed:

```text
all_same = true
ERR_REQUIRE_ESM = none
ENOENT = none
Cannot find module = none
```

The full-suite test count increased from the previous 323 to 324 because `TRACE-005` is a new executable regression guard.

#### Race result

The previously identified Testing-owned race surfaces are now closed:

1. Frontend Vitest evidence no longer relies on the shared Vite result cache and is cross-process serialized.
2. Static builds use unique Testing-owned temp directories instead of one globally removed path.
3. TRACE-001 no longer recurses into `tests/.tmp/**` or generated build output.
4. TRACE-005 verifies generated temp tests cannot enter the canonical executable-ID corpus.

Three consecutive top-level runs plus all public aliases completed without harness failure.

#### Environment blockers preserved

The deterministic default regression remains green because unavailable live dependencies are represented as TODO/BLOCKED by contract.

That does **not** mean the current live integration findings have been resolved.

Current known live findings still include:

- Payment Slip direct pre-signed PUT incompatibility with LocalStack from the previous live E2E qualification
- canonical `localhost:4000` collision with a non-UniStore service
- AWS CLI / active Learner Lab deployment unavailable

No FAIL was converted into TODO merely to make this regression pass.

#### Phase outcome

Phase 4 is complete.

Deterministic baseline:

```text
Node: v24.2.0

Top-level npm test, 3/3 identical:
324 total
302 pass
0 fail
22 todo
0 skipped

Aliases:
Contract       196 pass / 2 todo
Integration     36 pass
Security        11 pass
Frontend        33 pass
Smoke            9 pass / 15 todo
E2E              5 todo
Infrastructure  12 pass
```

Phase 5 can now rerun the live local E2E flow against the current Backend handoff and update live product evidence according to the observed result.

---

<a id="record-05-harness-live-e2e-after-s3-fix"></a>

## Harness Live E2E After S3 Fix

### Harness Phase 5 — Live Local E2E After Backend S3 Handoff

#### Goal

Rerun the full live local E2E flow against the current Backend handoff after the S3 presign compatibility fix, without mocking direct S3 upload and without disturbing the unrelated service occupying canonical port 4000.

#### Backend handoff observed

Current history includes:

```text
dfe48d9 fix(backend): make S3 presigned uploads LocalStack-compatible
```

The current S3 client config includes:

```text
requestChecksumCalculation: 'WHEN_REQUIRED'
```

No Backend file was modified by Testing.

#### Canonical port condition preserved

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

#### LocalStack state

LocalStack was already running and healthy before this phase:

```text
running
paused=false
health=healthy
endpoint=http://localhost:4566
region=us-east-1
```

Testing preserved that state after the E2E run.

#### Direct S3 compatibility recheck

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

#### First live rerun and Testing defect found

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

#### Testing-owned E2E helper correction

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

#### Authoritative live E2E rerun

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

#### Notification Worker evidence

During the authoritative rerun the Local Worker consumed multiple SQS messages with:

```text
received=1
failed=0
deleted=1
```

for each processed batch.

This provides live evidence for business-event Notification delivery in addition to duplicate-event idempotency.

#### Safe default preserved

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

#### Cleanup

Testing-owned isolated processes were stopped:

```text
Backend port 4100: stopped
Local Worker: stopped
```

The unrelated service on port 4000 was untouched.

LocalStack remained in its pre-phase running/healthy state.

#### Traceability implication for Phase 6

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

#### Phase outcome

Phase 5 is complete.

Authoritative current live local E2E result:

```text
5 / 5 PASS
0 FAIL
0 TODO
```

The previous S3 checksum incompatibility is no longer reproducible with the current Backend handoff, and the tenant-denial test was corrected so its green result now exercises the intended API paths.

---

<a id="record-06-harness-current-traceability"></a>

## Harness Current Traceability

### Harness Phase 6 — Current Traceability Refresh

#### Goal

Refresh the canonical FR-01..FR-15 current-state traceability and Testing handoff from the deterministic harness evidence and the post-Backend-S3-fix live local E2E qualification, without rewriting historical reports.

#### Current evidence incorporated

##### Deterministic harness regression

Phase 4 produced three identical supported-Node top-level runs:

```text
324 tests
302 pass
0 fail
22 todo
0 skipped
```

No `ERR_REQUIRE_ESM`, `ENOENT`, or module-resolution race was observed.

Current aliases:

```text
Contract:       198 / 196 pass / 0 fail / 2 todo
Integration:     36 / 36 pass
Security:        11 / 11 pass
Frontend cross:  33 / 33 pass
Smoke:           24 / 9 pass / 0 fail / 15 todo
E2E default:      5 / 0 pass / 0 fail / 5 todo
Infrastructure:  12 / 12 pass
```

##### Current live local E2E

After Backend commit:

```text
dfe48d9 fix(backend): make S3 presigned uploads LocalStack-compatible
```

Testing directly rechecked the production S3 adapter:

```text
pre-signed image/png PUT -> HTTP 200
HeadObject -> success
```

The authoritative corrected live E2E rerun then produced:

```text
5 tests
5 pass
0 fail
0 todo
```

including:

- canonical register-to-received flow
- payment reject -> notify -> resubmit -> approve -> PAID + audit
- two-Organization cross-tenant denial matrix
- approved/rejected/ready business-event Notification delivery and mark-read
- duplicate Notification delivery idempotency

The tenant-denial run was accepted only after fixing the Testing-owned `apiError(...)` URL normalization so it exercised intended routes rather than `/api/v1/api/v1/**`.

#### FR status changes

Previous current snapshot:

```text
PASS    12
FAIL     1
BLOCKED  2
```

Refreshed current snapshot:

```text
PASS    14
FAIL     0
BLOCKED  1
```

##### FR-08 — Payment Slip / Verification

Changed:

```text
FAIL -> PASS
```

Evidence now demonstrates:

- private Payment Slip authorization
- pre-sign/direct S3 upload
- Customer submit/read
- Staff approve/reject
- rejectReason
- replacement-slip resubmission
- PAID transition
- audit trail

The previous LocalStack `x-amz-checksum-crc32` incompatibility is no longer reproducible on the current Backend handoff.

##### FR-13 — In-app Notification

Changed:

```text
BLOCKED -> PASS
```

Current live evidence completes:

```text
PAYMENT_APPROVED / PAYMENT_REJECTED / READY_FOR_PICKUP
-> SQS
-> Local Worker
-> DynamoDB Notification
-> current-user Notification API
-> mark-read
```

Duplicate delivery also remains idempotent with exactly one persisted Notification for the event ID.

##### FR-15 — Health Check

Remains:

```text
BLOCKED
```

Current blockers remain real:

- canonical `localhost:4000` is occupied by a non-UniStore service and returns 404 for `/health`
- AWS CLI/Learner Lab credentials/deployment are unavailable, so AWS-004 cannot execute

The current Backend health endpoint itself passes on isolated qualification port 4100.

#### Canonical files refreshed

Updated:

- `reports/fr-traceability.json`
- `reports/fr-traceability.md`
- `reports/testing-handoff.md`

Historical qualification reports were not rewritten.

#### Current status

```text
PASS    14
FAIL     0
BLOCKED  1
TOTAL   15
```

Only FR-15 remains incomplete under the Testing-spec minimum verification.

#### Phase outcome

Phase 6 current-state traceability refresh is complete.

The final review should verify:

- JSON/Markdown parity
- exact FR-01..FR-15 ordering/uniqueness
- canonical executable-ID resolution
- no stale Payment Slip/Notification blocker in current canonical reports
- FR-15 and AWS blockers remain visible
- all task diff remains under `tests/**`

---

<a id="record-07-harness-review-diff"></a>

## Harness Review Diff

### Harness Phase 7 — Final Diff Review

#### Review scope

Reviewed the complete Testing task change set against:

- task goal
- `tests/**` ownership boundary
- Testing Spec layering
- Node `>=22` compatibility
- harness race/isolation requirements
- live E2E integrity
- FR traceability requirements
- AWS/environment blocker integrity
- test weakening / skipped-coverage risk

The review baseline is the prior Testing modernization commit:

```text
ee5f85c test: modernize cross-system qualification suite
```

Phase 1–2 harness work was already committed separately as:

```text
3ac6308 test: isolate frontend harness execution
```

The remaining Phase 3–6 changes are still uncommitted at review time.

#### Scope review

All task-owned implementation/report changes are under:

```text
tests/**
```

The repository still has one unrelated dirty file outside Testing ownership:

```text
M frontend/next-env.d.ts
```

Testing did not stage, edit, restore, or include that file in this task.

No Backend, Frontend application, Integration scripts, or Infrastructure production file was modified by the Testing Agent during this task.

#### Code changes reviewed

##### Frontend harness isolation

Reviewed `helpers/frontend-suite-evidence.mjs`.

The change:

- disables Vitest result cache with `--no-cache`
- serializes Testing-owned Frontend Vitest evidence across Node test workers
- records lock ownership and clears stale PID-owned locks
- batches requested Frontend suites instead of spawning a child for every file
- moves static builds from one shared removable directory to unique `mkdtemp()` directories
- keeps the real Next.js production static build

No Frontend executable evidence was replaced by a static-only assertion.

##### Deterministic traceability

Reviewed `integration/traceability.test.mjs`.

TRACE executable-ID discovery now reads only canonical Testing `*.test.mjs` sources from:

```text
baseline.test.mjs
contract/**
integration/**
security/**
frontend/**
smoke/**
e2e/**
infrastructure/**
helpers/**
```

Generated/temp content is not a canonical traceability source.

`TRACE-005` actively creates a decoy generated test under `tests/.tmp/**` and proves that the decoy ID is ignored.

No pre-existing test ID was removed.

##### Live E2E URL normalization

Reviewed `e2e/live-e2e-helpers.mjs`.

`apiError(...)` now uses the same `buildApiUrl(...)` normalization as successful API requests.

This corrects the prior false-green risk where:

```text
E2E_API_BASE_URL ending in /api/v1
+
route beginning /api/v1/...
=
/api/v1/api/v1/...
```

could return a route-level 404 instead of exercising the intended tenant authorization boundary.

Expected authorization statuses were not weakened.

#### Test weakening review

A diff scan found no newly added:

- `.skip(...)`
- `skip:`
- `todo:`
- `t.todo(...)`
- unconditional true assertions used to replace executable behavior

No existing canonical test ID was removed.

The new executable regression ID is:

```text
TRACE-005
```

The string `TRACE-DECOY-999` exists only as generated-decoy content inside TRACE-005 and is explicitly verified to be excluded from canonical discovery.

#### Deterministic regression evidence

Phase 4 ran all public aliases successfully on Node v24.2.0.

The authoritative top-level suite was run three consecutive times with identical results:

```text
324 tests
302 pass
0 fail
22 todo
0 skipped
```

Across those runs:

```text
ERR_REQUIRE_ESM: none
ENOENT: none
Cannot find module: none
```

Current Integration after the traceability refresh remains:

```text
36 tests
36 pass
0 fail
0 todo
```

Current traceability guard remains:

```text
5 tests
5 pass
0 fail
0 todo
```

#### Frontend evidence review

Current cross-system Frontend suite:

```text
33 / 33 pass
```

Current owning Frontend subsystem evidence:

```text
60 test files
190 / 190 tests pass
```

Concurrent helper verification also completed successfully from two independent Node processes.

Therefore the race fix did not reduce Frontend executable coverage.

#### Live E2E review

After the current Backend S3 handoff, Testing directly verified:

```text
pre-signed Payment Slip PUT -> HTTP 200
HeadObject -> success
```

The authoritative corrected live E2E rerun is:

```text
5 tests
5 pass
0 fail
0 todo
```

The tenant-denial scenario was rerun only after fixing the double-prefix Testing helper defect, so the accepted green result exercises intended API routes.

Safe-default behavior remains:

```text
5 tests
0 pass
0 fail
5 todo
```

when no disposable live E2E environment is supplied.

No direct S3 behavior was mocked or proxied through Backend.

#### FR traceability review

Current JSON/Markdown parity passes.

FR IDs are:

```text
FR-01 .. FR-15
```

exactly once and in order.

Current status:

```text
PASS    14
FAIL     0
BLOCKED  1
TOTAL   15
```

Evidence-supported changes:

```text
FR-08 FAIL -> PASS
FR-13 BLOCKED -> PASS
```

These promotions are backed by the current 5/5 live E2E rerun, not by default environment-gated tests.

FR-15 remains BLOCKED because its Testing-spec minimum requires local + AWS smoke and both current blockers remain visible:

- canonical `localhost:4000` is occupied by a non-UniStore service
- AWS CLI / active Learner Lab deployment credentials are unavailable

#### AWS review

The AWS live smoke gate was rechecked during final review.

Result:

```text
AWS-001..AWS-009
9 tests
0 pass
0 fail
9 todo/blocked
```

AWS CLI remains unavailable.

The review does not substitute static Infrastructure evidence for live AWS qualification.

#### Hygiene and security checks

Final review checks:

```text
git diff --check: PASS
JSON parse: PASS
all Testing *.mjs node --check: PASS
sensitive credential/private-key scan: no finding
```

No real AWS credential value or private key was added to the task diff.

Local fixture-only values remain test/dev-only.

#### Current external findings

The task is complete within Testing ownership, but these environment facts remain external:

1. `frontend/next-env.d.ts` is dirty outside Testing ownership.
2. canonical port 4000 is occupied by another service.
3. live AWS qualification requires AWS CLI plus active Learner Lab deployment access.

None were hidden or modified by Testing.

#### Review result

**PASS**

The task diff:

- remains within Testing ownership
- closes the identified Frontend/TRACE race surfaces
- preserves executable Frontend coverage
- corrects the tenant-denial false-green risk
- keeps environment gating honest
- updates FR-08/FR-13 only after live passing evidence
- keeps FR-15/AWS blockers visible
- introduces no test weakening found in review

The task is ready to complete and can be committed as Testing-owned changes when requested.
