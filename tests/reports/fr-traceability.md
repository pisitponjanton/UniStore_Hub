# UniStore Hub — FR-01..FR-15 Traceability

Snapshot: 2026-09-29

This matrix follows the minimum-verification mapping in `docs/specs/testing/SPEC.md`. An FR is marked **PASS** only when every required verification layer for that FR has been demonstrated. A passing sub-check does not make the FR complete while another required path is failed or blocked.

> Important: this is a handoff snapshot from phase reports 03-27, not a fresh full regression. Several early phase reports predate later Backend source additions. Phase 29 must rerun the suite before treating old FAIL observations as current implementation truth.

| FR | Requirement | Testing-spec minimum verification | Current readiness | Mapped test IDs | Evidence reports |
|---|---|---|---|---|---|
| FR-01 | Authentication + JWT | UT/CT/SEC + E2E login | **BLOCKED** | `CT-AUTH-001`, `CT-AUTH-003`, `CT-AUTH-005`, `DEV-004`, `E2E-CORE-001` | `reports/phase-03-health-auth.md`<br>`reports/phase-21-dev-mode-a.md`<br>`reports/phase-25-core-e2e.md` |
| FR-02 | Organization | API contract + organization integration/E2E | **BLOCKED** | `CT-ORG-001`, `CT-ORG-005`, `E2E-CORE-001` | `reports/phase-05-organization-members.md`<br>`reports/phase-25-core-e2e.md` |
| FR-03 | Staff / Member | RBAC + membership + tenant tests | **BLOCKED** | `CT-MEMBER-001`, `CT-MEMBER-005`, `SEC-TENANT-008`, `E2E-TENANT-001` | `reports/phase-05-organization-members.md`<br>`reports/phase-12-tenant-isolation-b.md`<br>`reports/phase-27-tenant-notification-e2e.md` |
| FR-04 | Store | CRUD contract + tenant tests | **BLOCKED** | `CT-STORE-001`, `CT-STORE-005`, `SEC-TENANT-002`, `E2E-TENANT-001` | `reports/phase-06-store-product.md`<br>`reports/phase-11-tenant-isolation-a.md`<br>`reports/phase-27-tenant-notification-e2e.md` |
| FR-05 | Product / Variant | CRUD + price + snapshot + file tests | **BLOCKED** | `CT-PRODUCT-001`, `CT-VARIANT-001`, `CT-ORDER-013`, `CT-ORDER-015`, `CT-FILE-007`, `DATA-011` | `reports/phase-06-store-product.md`<br>`reports/phase-08-order.md`<br>`reports/phase-13-data-contract.md`<br>`reports/phase-16-file-security.md` |
| FR-06 | Pre-order Campaign | lifecycle tests + invalid transition | **BLOCKED** | `CT-CAMPAIGN-012`, `CT-CAMPAIGN-013`, `CT-CAMPAIGN-014`, `E2E-CORE-001` | `reports/phase-07-campaign.md`<br>`reports/phase-25-core-e2e.md` |
| FR-08 | Payment Slip / Verification | private file + submit/approve/reject/resubmit + Customer own-Payment read | **BLOCKED** | `CT-PAYMENT-SUBMIT-007`, `CT-PAYMENT-SUBMIT-008`, `CT-PAYMENT-REVIEW-005`, `CT-PAYMENT-REVIEW-006`, `CT-CUSTOMER-PAYMENT-READ-002`, `CT-CUSTOMER-PAYMENT-READ-004`, `CT-FILE-014`, `SEC-CUSTOMER-PAYMENT-001`, `SEC-TENANT-004`, `SEC-TENANT-005`, `E2E-PAYMENT-REJECT-001` | `reports/phase-09-payment-submission.md`<br>`reports/phase-10-payment-review.md`<br>`reports/phase-16-file-security.md`<br>`reports/phase-26-payment-rejection-e2e.md` |
| FR-08 | Payment Slip / Verification | private file + submit/approve/reject/resubmit | **BLOCKED** | `CT-PAYMENT-SUBMIT-007`, `CT-PAYMENT-SUBMIT-008`, `CT-PAYMENT-REVIEW-005`, `CT-PAYMENT-REVIEW-006`, `CT-FILE-014`, `SEC-TENANT-004`, `SEC-TENANT-005`, `E2E-PAYMENT-REJECT-001` | `reports/phase-09-payment-submission.md`<br>`reports/phase-10-payment-review.md`<br>`reports/phase-16-file-security.md`<br>`reports/phase-26-payment-rejection-e2e.md` |
| FR-09 | Production Summary | paid-only grouping | **BLOCKED** | `CT-PRODUCTION-007`, `CT-PRODUCTION-008`, `CT-PRODUCTION-010`, `CT-PRODUCTION-011`, `E2E-CORE-001` | `reports/phase-14-production.md`<br>`reports/phase-25-core-e2e.md` |
| FR-10 | Pickup QR / Token | own-token + staff confirm + duplicate prevention | **BLOCKED** | `CT-PICKUP-005`, `CT-PICKUP-006`, `CT-PICKUP-013`, `CT-PICKUP-016`, `SEC-TENANT-006`, `E2E-CORE-001` | `reports/phase-15-pickup.md`<br>`reports/phase-12-tenant-isolation-b.md`<br>`reports/phase-25-core-e2e.md` |
| FR-11 | Dashboard / Report | metric-schema contract + Organization Admin authorization + UI test | **BLOCKED** | `CT-GOV-001`, `CT-GOV-008`, `CT-GOV-010`, `CT-GOV-012`, `FE-010`, `FE-020` | `reports/phase-18-report-audit-platform.md`<br>`reports/phase-19-frontend-interaction.md` |
| FR-12 | Audit Log | required side effects + list authorization | **BLOCKED** | `CT-GOV-002`, `CT-GOV-013`, `CT-GOV-016`, `CT-GOV-017`, `E2E-PAYMENT-REJECT-001` | `reports/phase-18-report-audit-platform.md`<br>`reports/phase-26-payment-rejection-e2e.md` |
| FR-13 | In-app Notification | SQS/Worker/API/read flow | **BLOCKED** | `CT-NOTIFY-003`, `CT-NOTIFY-004`, `CT-NOTIFY-014`, `SEC-TENANT-007`, `DEV-007`, `E2E-NOTIFY-001` | `reports/phase-17-notification.md`<br>`reports/phase-12-tenant-isolation-b.md`<br>`reports/phase-22-dev-mode-b.md`<br>`reports/phase-27-tenant-notification-e2e.md` |
| FR-14 | Platform Admin | approve/suspend/list users/summary + role isolation | **BLOCKED** | `CT-GOV-003`, `CT-GOV-004`, `CT-GOV-005`, `CT-GOV-006`, `CT-GOV-007`, `CT-GOV-019`, `CT-GOV-020` | `reports/phase-18-report-audit-platform.md` |
| FR-15 | Health Check | local + AWS smoke | **BLOCKED** | `CT-HEALTH-001`, `DEV-002`, `AWS-004` | `reports/phase-03-health-auth.md`<br>`reports/phase-21-dev-mode-a.md`<br>`reports/phase-24-aws-deployment.md` |

## Current interpretation

All 15 FRs have at least one concrete mapped verification path under `tests/**`, satisfying the traceability-coverage requirement. None is marked fully complete in this snapshot because each still has at least one required failed or blocked layer.

The strongest currently recorded completed layers are the Data-contract primitives (`DATA-001..010`), file-adapter/auth boundaries, CloudFormation static verification (`INFRA-CFN-001..012`), and the public health contract (`CT-HEALTH-001`). Those passes must not be generalized to the still-blocked business flows.

## Customer Payment contract resolution

The previous FR-08 contract gap is resolved. Customer Payment state and rejection reason are now read through the canonical `GET /api/v1/me/orders/:orderId/payment -> PaymentDTO` path. Contract tests verify exact `rejectReason`, fail-closed cross-Customer ownership, and tenant derivation from the owned Order. FR-08 remains **BLOCKED** overall only because its full live E2E/file/notification environment verification is still environment-dependent; the API contract itself is no longer the blocker.

## Machine-readable source

The same mapping is stored in `reports/fr-traceability.json`. `integration/traceability.test.mjs` checks that FR-01 through FR-15 are all present, mapped IDs exist in executable test source, and referenced report artifacts exist.
