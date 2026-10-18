# Payment And Pickup Verification

Consolidated reference for feature-focused QA. Records are retained as separate dated observations; earlier metrics may be superseded by later results. Refer to `frontend-qa-signoff.md` for final scoped QA scope, and the root `WEB_QUALITY_AUDIT.md` for remaining gaps.

## Contents

- [Payment Decision State Matrix](#record-01-payment-decision-state-matrix-report)
- [Payment Review Modal](#record-02-payment-review-modal-report)
- [Pickup Confirm Modal](#record-03-pickup-confirm-modal-report)


---

<a id="record-01-payment-decision-state-matrix-report"></a>

## Payment Decision State Matrix

### Phase 6 — Payment Review Decision State-Matrix Regression

**Workspace:** UniStore_Hub (BDXA local)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan status:** Phase 6 **IN PROGRESS**; Final Diff Review **PENDING**

#### Goal

Extend Phase 6 from **257/257 canonical Action IDs having at least one narrow direct PASS** and **428 distinct Action/State/Role PASS tuples** to high-risk terminal Modal states that prior Payment Review tests never exercised: **approve/reject POST pending, HTTP 409, successful decision, dialog close and terminal feedback focus**.

#### Confirmed defect and remediation

On an intercepted **Approval POST returning 409**, the application's `ConfirmDialog` remained open after the request completed. The error `role=alert` appeared in the main page **behind the active Radix modal focus trap**. Browser accessibility queries therefore could not locate the alert in the active accessibility tree. Keyboard and screen-reader users could be left inside a dialog whose action had already failed. This was reproduced by an initial failing Chromium E2E and explicitly verified by DOM inspection: the alert existed, but the confirmation dialog was still active.

**Frontend-only fix:** `frontend/src/modules/payments/organization-payments-view.tsx`.

- Approval modal is explicitly controlled via `approveOpen`; during pending it cannot close by user Escape/outside click, while on terminal success or failure it closes predictably.
- The rejected-payment modal also closes after a terminal intercepted 409, rather than leaving the error outside its focus trap.
- Add a focusable success/error result wrapper and a one-shot delayed focus/scroll after the modal unmounts and Radix releases focus. The callback checks that a review outcome exists and a modal is no longer open; it never runs for ordinary initial page loading.
- Preserve Cancel/Back/Escape focus restoration when **no** terminal request occurred, including the previously fixed custom Rejection modal trigger behavior.
- Do **not** alter backend review eligibility, tenant scope, API request payload, validation, order/payment business semantics or authorization rules.

#### New direct Browser scenarios

Test: `frontend/e2e/quality-audit/payment-review-decision-matrix.spec.ts`

| Action ID | New directly checked states |
|---|---|
| `FE-UX-22-10` — Approve confirmation | Deferred intercepted POST → pending button disabled and Escape blocked; synthetic **409** → dialog closes, error visible and focused; synthetic **200** → approved state and both review actions removed, success feedback focused |
| `FE-UX-22-12` — Rejection reason | Trimmed rejection reason sent as exact documented JSON payload (e.g. `{reason:"ยอดเงินไม่ตรง"}`) |
| `FE-UX-22-14` — Rejection confirmation | Synthetic **409** → dialog closes, recoverable feedback focused; retry synthetic **200** → modal closes, rejection reason shown and completed status blocks repeat review |

For each engine: **6 state-level screenshots and 6 scoped PASS ledger entries**. Two approval and two rejection writes were **fully intercepted in Browser**; HTTP 409/200 are mock responses, not persisted transactions. All unrelated browser write methods were denied; **0 real business writes**.

These cover only the **Staff 390×844** scenario, not every role, session state, viewport, network condition or actual backend mutation.

#### Verification

| Gate | Result |
|---|---|
| New scenario Chromium, Firefox and WebKit | **3/3 PASS** |
| Chromium regression: existing safe Payment Review, new terminal-state matrix, modal a11y/viewport test | **3/3 PASS** |
| Frontend unit | **323/323 PASS** across 83 test files |
| TypeScript / ESLint / git diff --check | **PASS** |
| Production Build | **30/30 static pages PASS** |
| Actual review/payment writes | **0** |

#### Retained evidence

`frontend/quality-audit/.evidence/regression-20261017/payment-review-decision-matrix/` contains **3 ledgers, 18 screenshots**, browser-by-browser metadata and `coverage-reconciliation.json`.

Retained-ledger reconciliation across all archived Phase 6 action outcomes:

- **257/257 Action IDs with at least one narrow scoped PASS** (unchanged).
- **434 distinct Action/State/Role scoped PASS tuples**, up from 428 (**+6**).
- **0 Action IDs without any direct narrow evidence**.
- **0/257 exhaustive all-declared-state matrices certified**; original baseline entries stay `NOT_TESTED`.

#### Follow-up and limitations

Still required within active Phase 6: review the other high-risk modal submit states (especially denied rights, timeout, repeated and interrupted uploads), all relevant role×state×viewport combinations, offline/slow network, browser-native 200% zoom, screen-reader passes and human visual review. There is **no claim** of complete 257-action acceptance or production-ready payment processing.

No Commit, Push, Deploy, backend change, schema change, data deletion, production access or real order/payment mutation.

---

<a id="record-02-payment-review-modal-report"></a>

## Payment Review Modal

### Phase 6 — Payment Review Dialogs and Private Slip Link

**Workspace:** UniStore_Hub (local BDXA)\
**Date:** 2026-10-17\
**Status:** Phase 6 **IN PROGRESS**. All checks in this batch used isolated Browser mocks; no real payment was approved or rejected.

#### Verified UX defects and changes

**1. Rejection dialog loses focus on Back/Escape.** The custom controlled `Dialog` was not opened through a Radix Dialog trigger. Clicking **กลับ** closed the modal but keyboard focus was not returned to the **ปฏิเสธการชำระเงิน** button. The initial Chromium E2E reproduced this failure.

Remediation:
- `frontend/src/components/ui/dialog.tsx`: added optional `onCloseAutoFocus` passthrough for explicitly controlled dialogs (existing ConfirmDialog behavior unaffected).
- `frontend/src/modules/payments/organization-payments-view.tsx`: identify the rejection trigger and return keyboard focus there on Back/Escape; if a successful review removed that trigger, return to the existing focusable detail panel instead.

**2. Reject reason validation focus race in Firefox.** Clicking confirm with an empty reason produced an Error Summary but the keyboard focus could remain on the button due to a deferred `onBlur` state mutation. The initial cross-browser run failed **Firefox** on first-invalid-confirm. Removed that blur-time mutation and retained full Submit-time `validateRejectReason`. After the fix, all three Browsers passed.

These changes are limited to frontend UX/focus. No validation/business/RBAC/tenant/payment API contract was altered.

#### Direct UI action proof

New browser test: `frontend/e2e/quality-audit/payment-review-safe-actions.spec.ts`

Using seeded local `staff` login, 390×844 viewport, synthetic GET Payment/Order fixtures, one intercepted POST to `files/download-url` returning a clearly invalid nonpublic URL; **the URL was never opened**. POSTs to approve/reject are intercepted and blocked if attempted.

| Action ID | Narrow verified states |
|---|---|
| `FE-UX-22-06` | Payment selection, new GET for Payment + related Order and detail view |
| `FE-UX-22-08` | Request for temporary private slip URL, intercepted POST response |
| `FE-UX-22-09` | New-tab link `href`, `target=_blank`, `rel=noopener noreferrer`; no external URL visit |
| `FE-UX-22-10` | Approval confirmation open and Cancel, focus restored, zero approval writes |
| `FE-UX-22-11` | Rejection modal open and reopen without previous draft |
| `FE-UX-22-12` | Rejection reason draft and stale error clearance |
| `FE-UX-22-13` | Back restores focus to trigger, Escape dismisses |
| `FE-UX-22-14` | First invalid confirmation blocks submission and focuses Error Summary |

**8 distinct Action IDs, 11 narrow PASS outcomes**, counted once across Browsers. The test **does not** test confirmed rejection, approval, save, slip download, download object security, or real backend review transitions.

#### Verification

| Gate | Outcome |
|---|---|
| New Payment Review E2E, Chromium / Firefox / WebKit | **3/3 PASS** (after fixes) |
| Staff read-only, Organization Modals, Staff queue filters, Payment review Chromium Regression | **4/4 PASS** |
| Full frontend Unit Tests | **323/323 PASS** across 83 files |
| Production Build | **30/30 routes PASS** |
| TypeScript / ESLint / `git diff --check` | **PASS** |
| Real business review writes | **0** |

#### Traceability reconciliation — important correction

The earlier narrative report indicated **159/257 IDs with some proof and 241 state outcomes** before this batch. Recomputing **directly from all retained `action-outcomes.json` files** in `frontend/quality-audit/.evidence/regression-20261017/` reveals **150 distinct IDs before** and **158 after** this batch. Some prior cumulative reports added per-batch totals without removing overlapping IDs; the old **159** should not be used as independently verified evidence.

**Current retained-evidence-based totals:**
- **158/257 distinct Action IDs** with at least one directly evidenced PASS state (**61.5% of IDs with partial evidence, not completed UX acceptance**).
- **254 distinct combinations of (Action ID, state, role)** with direct PASS proof; deduplicated across Browser engines, and not equivalent to the earlier narrative 241.
- **99/257 IDs** have no retained directly evidenced PASS state.
- **All 257 exhaustive action-state baseline entries remain NOT_TESTED**, including partially evidenced IDs; no full-state certification has occurred.

These values come from the retained evidence, not from assuming prior report arithmetic, and must be recalculated after future batches.

#### Archived proof and tests

`frontend/quality-audit/.evidence/regression-20261017/payment-review-modal/`

Contains `browser-1/`, `browser-2/`, `browser-3/`, each with 11 screenshots, `payment-review-safe-states.json`, and `action-outcomes.json` (**33 images, 3 ledgers**), plus `crossbrowser.log` and `regression.log`. The `test-results/` directory is transient and can be cleared by subsequent test runs.

#### Outstanding

Pending: actual payment approval/rejection **only on isolated owned disposable local fixtures** with permission and rollback safeguards, all Modal pending/server-error/success permutations, cross-role review actions, private slip expiry/security behavior, all 257 full-state matrices, screen readers, native browser zoom, mobile device testing and user design approval.

**Phase 6 remains IN PROGRESS**. No commit/push/deploy or business-record modification.

---

<a id="record-03-pickup-confirm-modal-report"></a>

## Pickup Confirm Modal

### Phase 6 — Pickup Confirmation Modal and Terminal Feedback

**Workspace:** UniStore_Hub (BDXA local)\
**Date:** 2026-10-17\
**Status:** Phase 6 **IN PROGRESS**. This continuation tests scoped frontend behavior, not persisted backend acceptance.

#### UX defect reproduced and fixed

In `frontend/src/modules/pickups/organization-pickups-view.tsx`, the READY Pickup confirmation was an uncontrolled Radix `ConfirmDialog`. On a simulated POST returning HTTP 409 `ORDER_NOT_READY_FOR_PICKUP`, an error notice was rendered in the page behind the **still-open Modal**, so the operator could not see why confirmation failed or how to retry.

Changed only frontend behavior:
- Introduced a controlled `confirmOpen` state and kept it locked throughout the pending request; the dialog closes in `finally` when the request finishes.
- Restored standard Cancel/Escape focus to the confirmation trigger when no mutation was submitted.
- After terminal error or success, moved keyboard focus and the viewport to a feedback wrapper `[data-pickup-action-feedback]` *after* the Radix focus trap is released; manual Cancel still returns to its original button.
- Cleared stale errors/success on the next dialog open; prevented duplicate confirmation during Pending.
- Preserved existing `PICKUP_ALREADY_RECEIVED`, other conflict readback, status guard, token, RBAC and request contracts without change.

#### Direct Browser evidence

New test: `frontend/e2e/quality-audit/pickup-confirm-safe-actions.spec.ts`. Seeded **Staff** local session, **390×844** viewport, test-only GET fixtures for one READY Pickup and its Order. Two POSTs to the Pickup confirm endpoint are explicitly intercepted by Playwright and answered with a deferred 409 and a 200; every other mutation is aborted. No real Pickup or Order record was updated.

| Source Action ID | Verified scoped state |
|---|---|
| `FE-UX-24-07` | Select Pickup: separate latest Pickup + Order GET, display token and related order; after a simulated RECEIVED result, reselect shows no confirm action |
| `FE-UX-24-09` | Open confirmation with warning; Cancel returns focus without POST; while POST pending Confirm disabled and Escape blocked; synthetic HTTP 409 closes Modal, displays a visible focused error and permits retry; synthetic 200 closes Modal, focuses visible success, updates UI state and prevents a repeat confirm |

**2 distinct Action IDs, 7 state-scoped PASS outcomes**, counted once across engines. This is not an actual receipt confirmation or certification of the Backend 409/200 semantics.

#### Test gates

| Gate | Result |
|---|---|
| Pickup Confirmation E2E — Chromium / Firefox / WebKit | **3/3 PASS** |
| Focused Chromium regression (Staff queues, Organization modals, queue filters, new Pickup) | **4/4 PASS** |
| Frontend Unit Tests | **323/323 PASS**, 83 files |
| Production Build / TypeScript | **30/30 static routes PASS** |
| ESLint / `git diff --check` | **PASS** |
| Real Backend business writes | **0** |

#### Reconciled cumulative Phase 6 coverage

Computed by scanning **all retained `action-outcomes.json` files**, de-duplicating Action IDs and `(actionId,state,role)` tuples across Browsers and batches:

- **160/257 distinct source Action IDs** with at least one scoped PASS (**62.3% partial ID coverage, not UX acceptance**).
- **261 distinct action/state/role PASS combinations**.
- **97 Action IDs** still have no retained PASS proof.
- **All 257 exhaustive all-declared-state baseline entries remain NOT_TESTED**. No action has been certified across its full state matrix.

Previous retained-evidence total: 158 IDs / 254 tuples; this continuation adds 2 IDs / 7 scoped outcomes.

#### Evidence retained

`frontend/quality-audit/.evidence/regression-20261017/pickup-confirm-modal/`

- `browser-1/`, `browser-2/`, `browser-3/`: each has seven screenshots, a `pickup-confirm-safe-states.json` and a full `action-outcomes.json` baseline plus scoped PASS entries
- **21 screenshots, 3 Action Ledgers**, `crossbrowser.log`, `regression.log`
- Images reviewed for focused on-screen 409 and success feedback on narrow mobile viewport

#### Outstanding before Phase 6 closure

Real fixture-isolated receipt confirmation and backend persistence; already-received conflict, network timeout and post-mutation readback failure permutations; all remaining 97 IDs and other unverified states; role matrices, native zoom, screen-reader and hardware testing, detailed visual approval.

**Keep Phase 6 IN PROGRESS.** No Commit, Push, Deploy, data reset or real Pickup mutation. Final Diff Review not initiated.
