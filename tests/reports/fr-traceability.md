# UniStore Hub — FR-01..FR-15 Traceability

Snapshot: 2026-09-30

This matrix follows the minimum-verification mapping in `docs/specs/testing/SPEC.md`. An FR is marked **PASS** only when its Testing-spec minimum verification is demonstrated by executable current evidence. **FAIL** means a required path was executed and showed a current incompatibility. **BLOCKED** means a required verification layer could not complete because of an external/upstream environment prerequisite.

> Current-state snapshot: Phase 4 modernized Backend/Data/Security checks, Phase 5 modernized Frontend/static-export checks, Phase 6 executed Local Dev/live E2E qualification, Phase 7 attempted live AWS smoke, and Phase 9 completed the supported-Node full regression at 323 total / 300 pass / 0 fail / 23 TODO on Node v24.2.0. Historical phase reports remain unchanged. The environment-gated full regression does not supersede stronger live Phase 6 failure evidence.

## Current readiness summary

```text
PASS    12
FAIL    1
BLOCKED 2
TOTAL   15
```

Current cross-cutting findings:

- Local live E2E: 5 scenarios → 1 PASS, 4 FAIL, 0 TODO when all local runtime prerequisites were supplied.
- The 4 live business-flow failures share one observed defect: Backend-issued Payment Slip pre-signed PUT to canonical LocalStack returns HTTP 400 `InvalidRequest` because `x-amz-checksum-crc32` is invalid.
- Duplicate Notification delivery passed the live SQS → Local Worker → DynamoDB Notification path and remained idempotent.
- Canonical `localhost:4000` was occupied by a non-UniStore service during Phase 6, so canonical-port health/auth smoke remains blocked.
- AWS-001..AWS-009 remain live-environment blocked because AWS CLI/Learner Lab credentials are unavailable; static Infrastructure is 12/12 PASS but is not used as a substitute for AWS smoke.

| FR | Requirement | Testing-spec minimum verification | Current readiness | Mapped test IDs | Evidence reports |
|---|---|---|---|---|---|
| FR-01 | Authentication + JWT | UT/CT/SEC + E2E login | **PASS** | `CT-AUTH-001`, `CT-AUTH-003`, `CT-AUTH-005`, `DEV-004`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-02 | Organization | API contract + organization integration/E2E | **PASS** | `CT-ORG-001`, `CT-ORG-005`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-03 | Staff / Member | RBAC + membership + tenant tests | **PASS** | `CT-MEMBER-001`, `CT-MEMBER-005`, `SEC-TENANT-008`, `E2E-TENANT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-04 | Store | CRUD contract + tenant tests | **PASS** | `CT-STORE-001`, `CT-STORE-005`, `SEC-TENANT-002`, `E2E-TENANT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-05 | Product / Variant | CRUD + price + snapshot + file tests | **PASS** | `CT-PRODUCT-001`, `CT-VARIANT-001`, `CT-ORDER-013`, `CT-ORDER-015`, `CT-FILE-007`, `DATA-011` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-06 | Pre-order Campaign | lifecycle tests + invalid transition | **PASS** | `CT-CAMPAIGN-012`, `CT-CAMPAIGN-013`, `CT-CAMPAIGN-014`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-07 | Order | create/list/detail + snapshot + ownership | **PASS** | `CT-ORDER-001`, `CT-ORDER-008`, `CT-ORDER-015`, `CT-ORDER-018`, `SEC-TENANT-001`, `SEC-TENANT-003`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-08 | Payment Slip / Verification | private file + submit/approve/reject/resubmit | **FAIL** | `CT-PAYMENT-SUBMIT-007`, `CT-PAYMENT-SUBMIT-008`, `CT-PAYMENT-REVIEW-005`, `CT-PAYMENT-REVIEW-006`, `CT-CUSTOMER-PAYMENT-READ-002`, `CT-CUSTOMER-PAYMENT-READ-004`, `CT-FILE-014`, `SEC-CUSTOMER-PAYMENT-001`, `SEC-TENANT-004`, `SEC-TENANT-005`, `E2E-PAYMENT-REJECT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-09 | Production Summary | paid-only grouping | **PASS** | `CT-PRODUCTION-007`, `CT-PRODUCTION-008`, `CT-PRODUCTION-010`, `CT-PRODUCTION-011`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-10 | Pickup QR / Token | own-token + staff confirm + duplicate prevention | **PASS** | `CT-PICKUP-005`, `CT-PICKUP-006`, `CT-PICKUP-013`, `CT-PICKUP-016`, `SEC-TENANT-006`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-11 | Dashboard / Report | metric-schema contract + Organization Admin authorization + UI test | **PASS** | `CT-GOV-001`, `CT-GOV-008`, `CT-GOV-010`, `CT-GOV-012`, `FE-010`, `FE-020` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-12 | Audit Log | required side effects + list authorization | **PASS** | `CT-GOV-002`, `CT-GOV-013`, `CT-GOV-016`, `CT-GOV-017`, `E2E-PAYMENT-REJECT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-13 | In-app Notification | SQS/Worker/API/read flow | **BLOCKED** | `CT-NOTIFY-003`, `CT-NOTIFY-004`, `CT-NOTIFY-014`, `SEC-TENANT-007`, `DEV-007`, `E2E-NOTIFY-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md` |
| FR-14 | Platform Admin | approve/suspend/list users/summary + role isolation | **PASS** | `CT-GOV-003`, `CT-GOV-004`, `CT-GOV-005`, `CT-GOV-006`, `CT-GOV-007`, `CT-GOV-019`, `CT-GOV-020` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-15 | Health Check | local + AWS smoke | **BLOCKED** | `CT-HEALTH-001`, `DEV-002`, `AWS-004` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/phase-07-aws-smoke-qualification.md` |

## Status details

### FR-01 — Authentication + JWT — PASS

- Phase 4: current Auth/JWT cross-system contract evidence executes successfully through the owning Backend suite.
- Phase 6: live E2E successfully completed Register/Login and used the resulting Bearer identities through Organization/catalog/order setup before the later Payment Slip S3 failure.
- No current blocker recorded for the minimum-verification requirement.

### FR-02 — Organization — PASS

- Phase 4: Organization contract behavior executes successfully against current Backend evidence.
- Phase 6: live E2E created Organizations and successfully performed Platform Admin approval before the later Payment Slip upload failure.
- No current blocker recorded for the minimum-verification requirement.

### FR-03 — Staff / Member — PASS

- Phase 4: Member/RBAC contract checks and SEC-TENANT-008 client-role distrust execute successfully.
- Phase 6: live tenant setup successfully created separate users/Organizations/membership context before the downstream Payment Slip failure.
- No current blocker recorded for the minimum-verification requirement.

### FR-04 — Store — PASS

- Phase 4: current Store CRUD contract evidence and SEC-TENANT-002 cross-Organization mutation isolation execute successfully.
- Phase 6: live E2E created Stores for disposable Organizations before the downstream Payment Slip failure.
- No current blocker recorded for the minimum-verification requirement.

### FR-05 — Product / Variant — PASS

- Phase 4: Product/Variant CRUD, authoritative pricing, OrderItem snapshot persistence, canonical file association/metadata, and Data-contract evidence execute successfully.
- Phase 5: Frontend Product Image direct pre-sign -> S3 PUT -> imageKey persistence flow is covered by executable Frontend evidence.
- No current blocker recorded for the minimum-verification requirement.

### FR-06 — Pre-order Campaign — PASS

- Phase 4: Campaign lifecycle and invalid-transition contract evidence execute successfully against current Backend behavior.
- Phase 6: live core/tenant setup successfully created and opened Campaigns before the later Payment Slip S3 failure.
- No current blocker recorded for the minimum-verification requirement.

### FR-07 — Order — PASS

- Phase 4: Order create/list/detail, authoritative snapshot, ownership, SEC-TENANT-001, and SEC-TENANT-003 evidence execute successfully.
- Phase 6: live E2E successfully created Customer Orders before failing at the subsequent Payment Slip direct upload.
- No current blocker recorded for the minimum-verification requirement.

### FR-08 — Payment Slip / Verification — FAIL

- Phase 4: Payment submit/review, Customer own-Payment read, ownership, rejectReason, resubmission, and file authorization contract/security evidence execute successfully.
- Phase 5: Frontend pre-sign/direct-PUT/resubmit/rejection-reason behavior is executable and passes at the Frontend boundary.
- Phase 6: live Payment flows fail at the browser-equivalent pre-signed S3 PUT with LocalStack HTTP 400 InvalidRequest: x-amz-checksum-crc32 is invalid.
- **Blocker:** Current Backend AWS SDK S3 pre-sign output is incompatible with the canonical LocalStack direct PUT path because checksum query/header semantics produce HTTP 400.

### FR-09 — Production Summary — PASS

- Phase 4: paid-only Production Summary grouping and authorization evidence execute successfully against the current Backend suite.
- Phase 5: Production UI evidence verifies Organization Admin-only access and renders Backend-owned summary totals rather than rebuilding totals client-side.
- No current blocker recorded for the minimum-verification requirement.

### FR-10 — Pickup QR / Token — PASS

- Phase 4: Pickup ownership/token, Staff confirmation, duplicate prevention, and SEC-TENANT-006 cross-Organization denial execute successfully.
- Phase 5: Pickup UI confirmation refresh and PICKUP_ALREADY_RECEIVED conflict handling execute successfully.
- No current blocker recorded for the minimum-verification requirement.

### FR-11 — Dashboard / Report — PASS

- Phase 4: Dashboard/Report metric-schema and Organization Admin authorization evidence execute successfully against current Backend tests.
- Phase 5: current Frontend remote-state and role-aware navigation evidence executes successfully; Frontend application/static export is present.
- No current blocker recorded for the minimum-verification requirement.

### FR-12 — Audit Log — PASS

- Phase 4: Audit list authorization/filtering and required business-side Audit persistence evidence execute successfully in current Backend suites.
- Phase 6 payment-rejection live E2E did not reach Audit because the upstream Payment Slip S3 PUT failed; this does not invalidate the deterministic minimum-verification evidence.
- No current blocker recorded for the minimum-verification requirement.

### FR-13 — In-app Notification — BLOCKED

- Phase 4: Notification API, SQS publication, Worker behavior/idempotency, mark-read, and SEC-TENANT-007 user isolation execute successfully through current Backend evidence.
- Phase 5: Notification UI list/read/unread/mark-read evidence executes successfully.
- Phase 6: live duplicate delivery passes SQS -> Local Worker -> DynamoDB Notification -> current-user API with exactly one Notification; the business-event notification E2E is blocked upstream by the Payment Slip S3 checksum failure.
- **Blocker:** The required live PAYMENT_APPROVED/PAYMENT_REJECTED/READY_FOR_PICKUP business-event notification path cannot complete until the upstream LocalStack Payment Slip direct-PUT failure is fixed.

### FR-14 — Platform Admin — PASS

- Phase 4: Platform Admin approve/suspend/list-users/summary and persisted platform-role isolation evidence execute successfully.
- Phase 5: Frontend role-aware navigation derives Platform Admin authority from user.platformRole rather than Organization membership.
- No current blocker recorded for the minimum-verification requirement.

### FR-15 — Health Check — BLOCKED

- Phase 4: CT-HEALTH-001 current health contract evidence passes.
- Phase 6: current Backend health passes on isolated port 4100, while canonical localhost:4000 is occupied by a non-UniStore service and therefore DEV-002 cannot pass on the canonical port.
- Phase 7: AWS-004 remains BLOCKED because AWS CLI/Learner Lab credentials/deployment are unavailable.
- **Blocker:** Canonical localhost:4000 is occupied by a non-UniStore service during qualification.
- **Blocker:** AWS CLI and active Learner Lab deployment credentials are unavailable, so deployed AWS health cannot be verified.

## Executable traceability guard

`integration/traceability.test.mjs` verifies:

- FR-01 through FR-15 exist exactly once and in order.
- the Markdown table is in parity with canonical `fr-traceability.json`.
- mapped test IDs resolve to executable test definitions, including parameterized definitions.
- referenced evidence artifacts exist.
- FR-08 retains Customer own-Payment read/ownership coverage.

The JSON file is the canonical machine-readable traceability source; this Markdown is refreshed from the same mapping during the current-state update.
