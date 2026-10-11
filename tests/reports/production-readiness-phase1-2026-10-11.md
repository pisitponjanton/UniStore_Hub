# UniStore Hub — Production Readiness Phase 1: QA TODO Triage & Isolated LocalStack Evidence

- Date: **2026-10-11** (Asia/Bangkok)
- Workspace: `UniStore_Hub`
- Workspace Plan: **UniStore Hub — Production Readiness & Quality Assurance**, Phase 1
- Baseline commit: `15a8db0`
Environment: **localhost only**, Docker Compose `docker-compose.dev.yml`, LocalStack **3.8.1**, no real AWS access.

## Scope and outcome

**Phase outcome: local QA tasks implemented where safe; all outstanding TODOs have explicit reproducible blockers. Production sign-off remains WITHHELD.**

This phase inspected all **5 live cross-system E2E**, **2 file-security Contract**, and **13 baseline Smoke** TODOs. One Smoke TODO became a real PASS after an isolated DynamoDB read/write/delete test. Remaining **19 TODOs** are blocked on explicit credentials/environment, LocalStack emulator fidelity, missing dedicated fixture scope, or actual AWS deployment authorization; no TODO was counted as PASS. The application business logic, API contracts, deployment infrastructure and existing seeded dataset were not reset or changed.

### Summary

| Suite | Baseline TODO | Executed PASS | Remaining TODO | Notes |
|---|---:|---:|---:|---|
| Legacy Node live E2E (`tests/e2e/*.test.mjs`) | 5 | 0 | **5** | Requires explicitly prepared disposable local run IDs and platform/queue/recipient credentials. `npm run test:e2e` actually executed: 0 PASS, 5 TODO. Equivalent focused Playwright flows were run, but **do not constitute passes of these five tests**. |
| File Security Contract CT-FILE-018/019 | 2 | 0 of those two | **2** | CT-018 runs a disposable LocalStack S3 unsigned-GET test and detects emulator mismatch; CT-019 still needs browser/HTTP transfer proof within this Contract suite. The whole `test:contract` suite has 196 PASS, 2 TODO. |
| Local `DEV-*` Smoke | 4 | **1 newly PASS** | **3** | DEV-005 DynamoDB round-trip creates three isolated synthetic keyed records (Order/Payment/Pickup), reads the expected entity/status fields, and deletes only those records in `finally`. Other DEV-006/007/009 full-flow placeholders remain, with equivalent focused Playwright evidence. |
| AWS Learner Lab `AWS-001..009` Smoke | 9 | 0 | **9** | Intentionally blocked: no AWS identity, CloudFormation stack, IAM privileges or authorized staging deployment was accessed; live AWS opt-in guard added. |
| **Total tracked TODOs** | **20** | **1** | **19** | All 19 are documented as blockers; do not report as green. |

Full `npm run test:smoke`: **12 PASS / 12 TODO / 0 FAIL** (9 AWS + 3 local TODO). Full `npm run test:contract`: **196 PASS / 2 TODO / 0 FAIL**.

## Five legacy Live E2E blockers — exact preconditions and security boundary

All five tests exist and are executable but default to `t.todo` without the required isolated environment. `assertLocalOnlyLiveE2eTarget` now validates loopback API endpoints in `tests/e2e/live-e2e-helpers.mjs`, and the SQS duplicate case additionally requires a canonical local SQS URL and explicit local AWS endpoint. It does **not** auto-fetch or print any seed/platform credentials.

| Test ID | Current status | Needed before executing this exact legacy test |
|---|---|---|
| `E2E-CORE-001` | BLOCKED / 1 TODO | Canonical `E2E_API_BASE_URL` on loopback, unique deterministic `E2E_RUN_ID`, securely supplied `E2E_PLATFORM_ADMIN_TOKEN` for approval of a newly registered, initially PENDING Organization; local Worker + S3/DynamoDB/SQS healthy |
| `E2E-PAYMENT-REJECT-001` | BLOCKED / 1 TODO | Same base URL, disposable Run ID and Platform token; end-to-end local slip upload, review, reject, resubmit and async notification processing |
| `E2E-TENANT-001` | BLOCKED / 1 TODO | Same base URL, unique Run ID and Platform token; two entirely disposable Organizations with independently registered identities |
| `E2E-NOTIFY-001` business-event pipeline | BLOCKED / 1 TODO | Same base URL, unique Run ID and Platform token; running local SQS/Worker and separate disposable Customer |
| `E2E-NOTIFY-001` duplicate event | BLOCKED / 1 TODO | `E2E_API_BASE_URL`, unique `E2E_RUN_ID`, `E2E_NOTIFICATION_QUEUE_URL`, `E2E_AWS_ENDPOINT_URL` pointing to loopback LocalStack, `E2E_DUPLICATE_RECIPIENT_TOKEN` and `E2E_DUPLICATE_RECIPIENT_USER_ID` from an isolated disposable Customer |

**Important:** Do not hardcode platform JWTs, reuse production user tokens, run with a remote endpoint, or print env contents. Do not re-use run IDs between tests without cleanup. Running the legacy suite without prerequisites continues to report **0 PASS, 5 TODO**, not success.

### Confirmed equivalent browser evidence in this phase

- `frontend: npx playwright test e2e/customer-commerce.spec.ts --project=chromium`: **5/5 PASS** (new Customer identity, checkout, slip, payment, pickup, notifications).
- `frontend: npx playwright test e2e/role-security-boundaries.spec.ts --project=chromium`: **2/2 PASS** (real API cross-tenant / cross-user denial).
- `frontend: npx playwright test e2e/cross-role-golden.spec.ts --project=chromium`: **1/1 PASS** (multi-role approval/payment/production/pickup workflow).
- `frontend: npx playwright test e2e/staff-operational.spec.ts --project=chromium`: **5/5 PASS** (Staff operational boundaries).
- These 13 passing Playwright tests do **not** verify duplicate SQS delivery to the level of the dedicated legacy idempotency test and must not be used to conceal its TODO.

## File Security Contract findings

- `CT-FILE-018`: A real anonymous GET experiment was executed **only against `http://127.0.0.1:4566` and the canonical local test bucket**. The test creates a uniquely named PNG object, validates storage with authenticated HEAD, and deletes the same object in `finally`. The bucket's `BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy` and `RestrictPublicBuckets` were all **true**. Nonetheless **LocalStack 3.8.1 returned HTTP 200 for an unsigned GET** of the object. This is a material emulator-versus-S3 privacy discrepancy. It is **not proof** that the deployed AWS S3 bucket is public or private. CT-FILE-018 is explicitly **TODO/BLOCKED** pending authorized isolated real S3 verification. Production template defines PublicAccessBlock on the files bucket; verify its deployed enforcement and anonymous GET before go-live.
- `CT-FILE-019`: API authentication, lack of raw/multipart parsers, pre-signed PUT and browser-to-local S3 evidence exist as separate Backend and Playwright tests. The **specific contract-runner integrated HTTP/browser boundary** remains **TODO**; do not count the existing partial checks as a new executable CT-FILE-019 PASS. Needs an isolated test fixture directly linking an authorized API pre-sign response, browser PUT, subsequent HEAD, and zero binary upload to API.

## Smoke TODO disposition

- `DEV-005` DynamoDB entity/status persistence: **FIXED / PASS**, with 3 disposable records, consistent reads and targeted cleanup.
- `DEV-006` authorized payment-slip browser transfer: **TODO / full-flow fixture absent** in this smoke; focused Customer Playwright upload passed. To close, wire the disposable Customer Order fixture to an HTTP transcript in this smoke.
- `DEV-007` Backend → SQS → Worker → DynamoDB Notification: **TODO / dedicated isolated pipeline fixture absent**; related Playwright/Integration paths passed. To close, generate and correlate a unique disposable notification event through the running local Worker.
- `DEV-009` full role/tenant/campaign/payment/pickup parity: **TODO / whole multi-role fixture intentionally delegated to full E2E**. Close only after this smoke invokes a deterministic isolated multi-role parity fixture or explicitly changes the required assertion semantics through Testing/Integration coordination.
- `AWS-001..009`: **9 TODO / NOT EXECUTED on real AWS**, from deployment identity and CloudFormation outputs through live S3/Worker/CloudWatch. These are **Phase 4 staging-readiness prerequisites** and require explicit user approval for actual isolated Learner Lab inspection.
- `tests/smoke/aws-deployment.test.mjs` now does **zero AWS discovery by default**; it requires explicit `TEST_ENABLE_AWS_SMOKE=1` and authorized staging/credentials. This is not permission to deploy or change cloud resources.

## Regression gates executed

| Verification | Result |
|---|---|
| Frontend Vitest | **292/292 PASS** |
| Backend unit tests | **287/287 PASS** |
| Contract full suite | **196 PASS, 2 TODO, 0 FAIL** |
| Integration | **36/36 PASS** |
| Security (incl. 3 new local-only safety tests) | **14/14 PASS** |
| Local+AWS Smoke (AWS safely disabled) | **12 PASS, 12 TODO, 0 FAIL** |
| Legacy Live E2E without credentials | **0 PASS, 5 TODO, 0 FAIL** |
| Frontend ESLint / TypeScript | **PASS** |
| Frontend Next.js Production Build / static export | **PASS**, 30 exported routes |
| Backend Syntax Check | **PASS**, 177 JavaScript files |
| Frontend cross-system contract | **33/33 PASS** |
| `git diff --check` | **PASS** |
| Focused Chromium Playwright | **13/13 PASS** |

## Environment/data safety and next phases

- Docker `backend`, `frontend`, `localstack` and `worker` were already running and not restarted/reset.
- No real AWS STS, S3, CloudFormation or deployment API was contacted by the Phase 1 run. The S3 test used a loopback endpoint and only its own ephemeral object; DynamoDB test removed only its own synthetic keyed records. Additional disposable Playwright fixtures may remain in local persistent LocalStack by project design.
- Existing seeded users, Notifications and Orders were not bulk-cleared. No `git clean`, `reset`, `commit`, `push` or `deploy`.
- Phase 2 should execute cross-browser/real-device accessibility evidence; Phase 4 should address any **explicitly authorized** real AWS privacy verification and the remaining AWS Smoke checklist. Final review must preserve all unresolved TODOs and the LocalStack S3 emulator finding.
