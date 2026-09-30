# UniStore Hub — FR-01..FR-15 Traceability

Snapshot: 2026-09-30

This matrix follows the minimum-verification mapping in `docs/specs/testing/SPEC.md`. An FR is marked **PASS** only when its Testing-spec minimum verification is demonstrated by executable current evidence. **FAIL** means a required path was executed and showed a current incompatibility. **BLOCKED** means a required verification layer could not complete because of an unresolved prerequisite/environment dependency.

> Current-state snapshot: Testing harness races were isolated and closed, top-level regression is deterministic across three identical Node v24.2.0 runs, and the post-Backend-S3-fix live local E2E rerun passes all 5 scenarios. Historical reports remain unchanged. Live AWS qualification is still blocked by missing AWS CLI/Learner Lab access.

## Current readiness summary

```text
PASS    14
FAIL    0
BLOCKED 1
TOTAL   15
```

Current cross-cutting findings:

- Deterministic top-level regression: 3/3 identical runs at **324 total / 302 pass / 0 fail / 22 todo / 0 skipped** on Node v24.2.0.
- Current live local E2E after Backend S3 fix: **5/5 PASS / 0 FAIL / 0 TODO**.
- Direct Browser-equivalent Payment Slip upload now succeeds against canonical LocalStack; the earlier `x-amz-checksum-crc32` failure is no longer reproducible.
- Live business-event Notification flow now passes through SQS → Local Worker → DynamoDB Notification → current-user API → mark-read, including duplicate-delivery idempotency.
- Canonical `localhost:4000` remains occupied by a non-UniStore service, so the canonical local Health smoke requirement is still incomplete.
- AWS-001..AWS-009 remain live-environment blocked because AWS CLI/Learner Lab credentials are unavailable; static Infrastructure remains supporting evidence only.

| FR | Requirement | Testing-spec minimum verification | Current readiness | Mapped test IDs | Evidence reports |
|---|---|---|---|---|---|
| FR-01 | Authentication + JWT | UT/CT/SEC + E2E login | **PASS** | `CT-AUTH-001`, `CT-AUTH-003`, `CT-AUTH-005`, `DEV-004`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-02 | Organization | API contract + organization integration/E2E | **PASS** | `CT-ORG-001`, `CT-ORG-005`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-03 | Staff / Member | RBAC + membership + tenant tests | **PASS** | `CT-MEMBER-001`, `CT-MEMBER-005`, `SEC-TENANT-008`, `E2E-TENANT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-04 | Store | CRUD contract + tenant tests | **PASS** | `CT-STORE-001`, `CT-STORE-005`, `SEC-TENANT-002`, `E2E-TENANT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-05 | Product / Variant | CRUD + price + snapshot + file tests | **PASS** | `CT-PRODUCT-001`, `CT-VARIANT-001`, `CT-ORDER-013`, `CT-ORDER-015`, `CT-FILE-007`, `DATA-011` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-06 | Pre-order Campaign | lifecycle tests + invalid transition | **PASS** | `CT-CAMPAIGN-012`, `CT-CAMPAIGN-013`, `CT-CAMPAIGN-014`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-07 | Order | create/list/detail + snapshot + ownership | **PASS** | `CT-ORDER-001`, `CT-ORDER-008`, `CT-ORDER-015`, `CT-ORDER-018`, `SEC-TENANT-001`, `SEC-TENANT-003`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-08 | Payment Slip / Verification | private file + submit/approve/reject/resubmit | **PASS** | `CT-PAYMENT-SUBMIT-007`, `CT-PAYMENT-SUBMIT-008`, `CT-PAYMENT-REVIEW-005`, `CT-PAYMENT-REVIEW-006`, `CT-CUSTOMER-PAYMENT-READ-002`, `CT-CUSTOMER-PAYMENT-READ-004`, `CT-FILE-014`, `SEC-CUSTOMER-PAYMENT-001`, `SEC-TENANT-004`, `SEC-TENANT-005`, `E2E-PAYMENT-REJECT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-09 | Production Summary | paid-only grouping | **PASS** | `CT-PRODUCTION-007`, `CT-PRODUCTION-008`, `CT-PRODUCTION-010`, `CT-PRODUCTION-011`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-10 | Pickup QR / Token | own-token + staff confirm + duplicate prevention | **PASS** | `CT-PICKUP-005`, `CT-PICKUP-006`, `CT-PICKUP-013`, `CT-PICKUP-016`, `SEC-TENANT-006`, `E2E-CORE-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-11 | Dashboard / Report | metric-schema contract + Organization Admin authorization + UI test | **PASS** | `CT-GOV-001`, `CT-GOV-008`, `CT-GOV-010`, `CT-GOV-012`, `FE-010`, `FE-020` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-12 | Audit Log | required side effects + list authorization | **PASS** | `CT-GOV-002`, `CT-GOV-013`, `CT-GOV-016`, `CT-GOV-017`, `E2E-PAYMENT-REJECT-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-13 | In-app Notification | SQS/Worker/API/read flow | **PASS** | `CT-NOTIFY-003`, `CT-NOTIFY-004`, `CT-NOTIFY-014`, `SEC-TENANT-007`, `DEV-007`, `E2E-NOTIFY-001` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |
| FR-14 | Platform Admin | approve/suspend/list users/summary + role isolation | **PASS** | `CT-GOV-003`, `CT-GOV-004`, `CT-GOV-005`, `CT-GOV-006`, `CT-GOV-007`, `CT-GOV-019`, `CT-GOV-020` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-05-frontend-modernization.md` |
| FR-15 | Health Check | local + AWS smoke | **BLOCKED** | `CT-HEALTH-001`, `DEV-002`, `AWS-004` | `reports/phase-04-backend-security-modernization.md`<br>`reports/phase-06-local-dev-e2e-qualification.md`<br>`reports/phase-07-aws-smoke-qualification.md`<br>`reports/harness-phase-05-live-e2e-after-s3-fix.md` |

## Status details

### FR-01 — Authentication + JWT — PASS

- Phase 4 modernization: current Auth/JWT contract evidence executes successfully through the owning Backend suite.
- Current live rerun: E2E-CORE-001 completes the canonical Register/Login/Bearer-auth flow through RECEIVED.
- No current blocker recorded for the minimum-verification requirement.

### FR-02 — Organization — PASS

- Phase 4 modernization: Organization contract behavior executes successfully against current Backend evidence.
- Current live rerun: E2E-CORE-001 creates an Organization and completes Platform Admin approval as part of the full flow.
- No current blocker recorded for the minimum-verification requirement.

### FR-03 — Staff / Member — PASS

- Phase 4 modernization: Member/RBAC contract checks and SEC-TENANT-008 client-role distrust execute successfully.
- Current live rerun: E2E-TENANT-001 completes the two-Organization membership/authorization denial matrix.
- No current blocker recorded for the minimum-verification requirement.

### FR-04 — Store — PASS

- Phase 4 modernization: current Store CRUD contract evidence and SEC-TENANT-002 cross-Organization mutation isolation execute successfully.
- Current live rerun: E2E-TENANT-001 completes Store/Product cross-tenant denial checks on intended normalized API routes.
- No current blocker recorded for the minimum-verification requirement.

### FR-05 — Product / Variant — PASS

- Phase 4: Product/Variant CRUD, authoritative pricing, OrderItem snapshot persistence, canonical file association/metadata, and Data-contract evidence execute successfully.
- Phase 5: Frontend Product Image direct pre-sign -> S3 PUT -> imageKey persistence flow is covered by executable Frontend evidence.
- No current blocker recorded for the minimum-verification requirement.

### FR-06 — Pre-order Campaign — PASS

- Phase 4 modernization: Campaign lifecycle and invalid-transition contract evidence execute successfully against current Backend behavior.
- Current live rerun: E2E-CORE-001 creates/opens the Campaign and completes the downstream order/payment/production/pickup flow.
- No current blocker recorded for the minimum-verification requirement.

### FR-07 — Order — PASS

- Phase 4 modernization: Order create/list/detail, authoritative snapshot, ownership, SEC-TENANT-001, and SEC-TENANT-003 evidence execute successfully.
- Current live rerun: E2E-CORE-001 completes Customer Order creation through final RECEIVED state.
- No current blocker recorded for the minimum-verification requirement.

### FR-08 — Payment Slip / Verification — PASS

- Deterministic contract/security evidence covers private Payment Slip authorization, submit/read/review/rejectReason/resubmission and tenant ownership.
- Frontend evidence covers pre-sign -> direct S3 PUT -> submit/resubmit and rejection-reason presentation.
- Current Backend S3 handoff was rechecked directly: browser-equivalent pre-signed image/png PUT to canonical LocalStack returns HTTP 200 and HeadObject succeeds.
- Current authoritative E2E-PAYMENT-REJECT-001 completes reject -> notify -> resubmit -> approve -> PAID with audit trail; the previous x-amz-checksum-crc32 failure is no longer reproducible.
- No current blocker recorded for the minimum-verification requirement.

### FR-09 — Production Summary — PASS

- Phase 4 modernization: paid-only Production Summary grouping and authorization evidence execute successfully against current Backend tests.
- Frontend evidence verifies Organization Admin-only Production UI and Backend-owned summary totals.
- Current live E2E-CORE-001 completes the paid-to-production path through READY_FOR_PICKUP and RECEIVED.
- No current blocker recorded for the minimum-verification requirement.

### FR-10 — Pickup QR / Token — PASS

- Phase 4 modernization: Pickup ownership/token, Staff confirmation, duplicate prevention, and SEC-TENANT-006 cross-Organization denial execute successfully.
- Frontend evidence verifies Pickup confirmation refresh and PICKUP_ALREADY_RECEIVED handling.
- Current live E2E-CORE-001 completes the canonical pickup flow to RECEIVED.
- No current blocker recorded for the minimum-verification requirement.

### FR-11 — Dashboard / Report — PASS

- Phase 4: Dashboard/Report metric-schema and Organization Admin authorization evidence execute successfully against current Backend tests.
- Phase 5: current Frontend remote-state and role-aware navigation evidence executes successfully; Frontend application/static export is present.
- No current blocker recorded for the minimum-verification requirement.

### FR-12 — Audit Log — PASS

- Phase 4 modernization: Audit list authorization/filtering and required business-side Audit persistence evidence execute successfully.
- Current authoritative E2E-PAYMENT-REJECT-001 completes reject -> resubmit -> approve and verifies the required audit trail.
- No current blocker recorded for the minimum-verification requirement.

### FR-13 — In-app Notification — PASS

- Deterministic Backend/security evidence covers Notification API, SQS publication, Worker behavior/idempotency, mark-read and user isolation.
- Frontend evidence covers Notification list/read-unread/mark-read behavior.
- Current live E2E-NOTIFY-001 completes approved/rejected/ready business events through SQS -> Local Worker -> DynamoDB Notification -> current-user API -> mark-read.
- Current duplicate-delivery E2E also passes and persists exactly one Notification for the event ID.
- No current blocker recorded for the minimum-verification requirement.

### FR-14 — Platform Admin — PASS

- Phase 4: Platform Admin approve/suspend/list-users/summary and persisted platform-role isolation evidence execute successfully.
- Phase 5: Frontend role-aware navigation derives Platform Admin authority from user.platformRole rather than Organization membership.
- No current blocker recorded for the minimum-verification requirement.

### FR-15 — Health Check — BLOCKED

- CT-HEALTH-001 current health contract evidence passes.
- Current Backend health passes on isolated qualification port 4100.
- Canonical localhost:4000 remains occupied by a non-UniStore service and returns 404 for /health, so canonical local smoke is not complete.
- AWS-004 remains BLOCKED because AWS CLI/Learner Lab credentials/deployment are unavailable.
- **Blocker:** Canonical localhost:4000 is occupied by a non-UniStore service during qualification.
- **Blocker:** AWS CLI and active Learner Lab deployment credentials are unavailable, so deployed AWS health cannot be verified.

## Executable traceability guard

`integration/traceability.test.mjs` verifies:

- FR-01 through FR-15 exist exactly once and in order.
- the Markdown table is in parity with canonical `fr-traceability.json`.
- mapped test IDs resolve only from canonical Testing `*.test.mjs` sources.
- generated/temp content under `tests/.tmp/**` cannot satisfy executable-ID mapping.
- referenced evidence artifacts exist.
- FR-08 retains Customer own-Payment read/ownership coverage.

The JSON file is the canonical machine-readable traceability source; this Markdown is refreshed from the same current mapping.
