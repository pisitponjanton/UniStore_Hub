# UniStore Hub — Local Audit Remediation Phase 4: Flaky Cross-Role Journey Stabilization

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 4
- **Scope:** Frontend Payment feedback and four formerly flaky Playwright scenarios on existing localhost Docker Compose/LocalStack.
- **Status:** Targeted Phase 4 **COMPLETED**. Full 67-case E2E requalification and real AWS tests remain **NOT RUN** here.
- **No commit, push, deployment, LocalStack reset, historical Order cleanup, or AWS action.**

## 1. Findings from the four historical flaky cases

Reference: `WEB_QUALITY_AUDIT.md` §21.5 (FLAKY-21-01 through FLAKY-21-04). Initial **read-only** local baseline of the Staff selection, Platform Tracking and Guest Matrix cases: **3/3 PASS, 0 retries, 14.1s**. Therefore the previous flakiness was intermittent; failures were not automatically reproduced in this fresh baseline.

| Historical case | Root cause / observed risk | Targeted correction |
|---|---|---|
| FLAKY-21-01 Organization Admin Payment Feedback | `OrganizationPaymentsView.handleApprove` awaited an additional Payment + Order GET after the successful mutation and **only then** set the success notice. A slow or failed refresh could hide a committed successful approval and show a generic error. | Publish authoritative mutation success and update list/detail immediately, before attempting readback. A readback error preserves clear success feedback and says latest details still need refresh; never treat a committed mutation as an approval failure. Apply same handling to reject for consistent safety. |
| FLAKY-21-02 Staff Organization → Orders | Cross-page Next.js client routing and auth restoration sometimes outlasted default 5s heading assertion in Dev. Backend RBAC previously verified. | Use DOM-ready initial navigation, bounded 20s wait on **actual Staff Orders heading**, preserve all staff menu visibility and admin-route denial assertions. |
| FLAKY-21-03 Platform Admin storefront tracking | The homepage intentionally hides authenticated tracking link while session state is loading. A 5s assertion may race auth hydration/back/forward on Dev. | Use DOM-ready initial navigation/history and bounded 20s assertion for **authenticated /my/orders href**. Still verify navigation URL, absence of login gate and forward/back transitions. |
| FLAKY-21-04 Guest Route/Viewport Matrix | Guest route first h1 could appear after 12s in Next.js Dev and generic h1 may be outside the intended content. | Wait for visible main and its semantic h1 (20s), and for Guest avoid a **true loading placeholder**, preserving all 11 viewport geometry/a11y/console assertions. |

A trial Guest heading matcher `/กำลัง|loading/i` was **too broad**, because the legitimate Thai Login heading contains “กำลังดำเนินการ”. The trial failed twice for a test-assertion mistake, not app behavior; fixed to a beginning-of-heading pattern for genuine loading messages `/^(กำลังโหลด|กำลังตรวจสอบบัญชี|loading)/i`, then reran successfully. The Playwright runner sometimes printed `Internal error: step id not found: fixture@79` during a failing run; the final successful Guest run did not report an assertion failure and no claim of fixing the runner itself is made.

## 2. Changed files and business-safety design

- `frontend/src/modules/payments/organization-payments-view.tsx`
  - On successful `approvePayment`, update Payment UI and show confirmation **before** `refreshSelected`; failed readback sets an honest “approved but latest details not loaded” success notice, without offering/retriggering a second approve.
  - Same post-mutation/readback distinction for `rejectPayment`; no change to server-side authorization or Payment state transition rules.
- `frontend/src/modules/payments/organization-payments-view.test.tsx`: test success notice before a pending readback, successful approval despite readback error, and preserved rejection success on failed readback. Retain existing approval/rejection and validation assertions.
- `frontend/e2e/organization-admin.spec.ts`: after UI approval feedback, query **real Backend** for `Payment.status=APPROVED` and `Order.status=PAID`. Continue existing real pickup confirmation and `RECEIVED` state proof. No weakened authorization or price/payment checks.
- `frontend/e2e/staff-operational.spec.ts`: specific Staff navigation readiness.
- `frontend/e2e/storefront-tracking-navigation.spec.ts`: specific Platform Admin session-aware tracking readiness and history.
- `frontend/e2e/route-viewport-matrix.spec.ts`: page-main heading readiness and narrow Guest placeholder check. **No UI layout changes yet**; those belong to Phase 5.

No backend source changes were made **in Phase 4**. Previously uncommitted Phase 1–3 and historical audit changes remain intact.

## 3. Verified test results, without retries

| Target | Actual observed outcome |
|---|---|
| Original 3 read-only target flows before edits | **3/3 PASS, 0 retries** |
| Staff Navigation after readiness correction (`--repeat-each=2`) | **2/2 PASS**, 0 retries |
| Platform Admin Tracking after readiness correction (`--repeat-each=2`) | **2/2 PASS**, 0 retries |
| Guest Matrix after narrow loading-heading fix (`--repeat-each=2`) | **2/2 PASS**, 0 retries. Both runs exercised 6 guest pages × 11 viewports = **66 measurements/run**; `failedMeasurements=0`, `diagnosticEvents=0`. |
| Organization Admin Order cancellation → real Payment approval → real Pickup work | **1/1 PASS**, 0 retries, **11.2s**, with added authoritative `APPROVED` and `PAID` verification and preexisting `RECEIVED` check |
| Frontend full `npm test` | **299/299 PASS**, 80 test files |
| Frontend TypeScript `npx tsc --noEmit` | **PASS** |
| `git diff --check` | **PASS** |

The initial post-edit guest combined run yielded 4 PASS / 2 FAIL because our overly broad temporary Thai-language matcher rejected an entirely valid Login title. This was corrected; **final guest run passed 2/2**. Do not hide this diagnostic history or count the failed transient edit as an application defect.

Test runner log locations are temporary on BDXA Mac, not user-download URLs:
- `/tmp/unistore-phase4-baseline.log`
- `/tmp/unistore-phase4-regression.log` (contains the trial assertion mistake)
- `/tmp/unistore-phase4-guest-fixed.log` and `/tmp/unistore-phase4-guest-fixed/`
- `/tmp/unistore-phase4-payment-flow.log` and `/tmp/unistore-phase4-payment-flow/`

## 4. Outstanding matters and safe handoff

- Guest Matrix still recorded **six nested-overflow observations** on desktop Login/Register at widths 1280, 1440 and 1920. Its measured clipping failures remain zero; **do not declare layout fixed**. Review visually/accessibility in Phase 5, together with home mobile discovery and the Audit table 1024px.
- The successful Payment/Pickup E2E creates new **synthetic, LocalStack-only** registered users and organization/order/payment/pickup records; those historical/audit fixtures are **not deleted** by this phase. One canceled Order follows the app's business soft-cancel path. Do not equate test PASS with removal of all test fixture records.
- Real AWS, HTTPS, S3 file privacy, Lambda/SQS, backups and production readiness: still **NOT RUN / NOT CERTIFIED**, see `tests/reports/aws-live-validation-checklist.md`.
- The local **67 distinct-case** E2E clean-regression goal is scheduled for Phase 7. The four formerly flaky cases have been retested in isolation only, and reproducibility under a full large suite must be validated there.

**Phase 4 targeted acceptance: PASS.** All four historical flaky topics have 0-retry successful targeted Browser evidence and corrected Payment feedback semantics. **Next phase: Phase 5 — Mobile Store Discovery & Nested Overflow.** No Commit/Push/Deploy.
