# Customer Journey Verification

Consolidated reference for feature-focused QA. Records are retained as separate dated observations; earlier metrics may be superseded by later results. Refer to `frontend-qa-signoff.md` for final scoped QA scope, and the root `WEB_QUALITY_AUDIT.md` for remaining gaps.

## Contents

- [Customer Create Order](#record-01-customer-create-order-report)
- [Customer Orders Navigation](#record-02-customer-orders-navigation-report)
- [Customer Order Cancel Followup](#record-03-customer-order-cancel-followup-report)
- [Customer Order Cancel](#record-04-customer-order-cancel-report)
- [Customer Payment Upload](#record-05-customer-payment-upload-report)
- [Customer Pickup Refresh](#record-06-customer-pickup-refresh-report)
- [Guest Customer Navigation](#record-07-guest-customer-navigation-report)
- [Notifications Actions](#record-08-notifications-actions-report)


---

<a id="record-01-customer-create-order-report"></a>

## Customer Create Order

### Phase 6 — Customer Create Order Action-State Continuation

**Workspace:** UniStore_Hub (local BDXA)\
**Date:** 2026-10-17 (Asia/Bangkok)\
**Status:** Phase 6 **IN PROGRESS**. This is scoped evidence, not full UX/UI sign-off.

#### Scope and observed UI improvements

Continued directly from the 2026-10-17 Customer Order Detail/Cancel report. The previously unevidenced eight `/orders/new/` source actions were tested at **390×844** with an authorized local Customer session, synthetic Storefront GETs, and Playwright-intercepted order-creation POSTs.

Changed `frontend/src/modules/orders/order-create.tsx` to restore keyboard focus **only on user-initiated actions** (not initial page load):

1. Explicit Retry after initial 503 focuses the loaded H1. If the retry also fails, the recovery `main` landmark receives focus instead of dropping focus when the old button unmounts.
2. Terminal create-order 409 focuses a visible, scroll-reachable server-error notice after pending state resolves, allowing correction/retry.
3. On a synthetic accepted POST, the created-order success H1 receives focus. Displayed total is the **server-returned total**, not the client estimate.
4. Existing state machine, API paths and payload, organization/customer authorization, 409 `CAMPAIGN_NOT_OPEN` terminal disabled behavior, price authority and order lifecycle were **not changed**.

#### Direct Browser action evidence

| ID | Explicitly exercised behavior |
|---|---|
| `FE-UX-07-01` | Back link retains the scoped product and campaign |
| `FE-UX-07-02` | Quantity 0 rejects before POST and focuses validation; quantity 2 updates client estimate |
| `FE-UX-07-03` | Pending disables duplicate submit; synthetic ORDER_CONFLICT 409 error; subsequent intercepted 200 presents authoritative backend total |
| `FE-UX-07-04` | GET 503 offers Retry, repeated failure focuses recovery landmark, subsequent recovery focuses loaded H1 |
| `FE-UX-07-05` | Invalid/missing order URL has the correct storefront exit |
| `FE-UX-07-06` | Success Payment link preserves created Order ID |
| `FE-UX-07-07` | Success Detail link preserves created Order ID |
| `FE-UX-07-08` | Success Product return retains selected product |

**8 distinct source Action IDs, 13 distinct state/role PASS observations** (do not count three browser repetitions as 39 distinct state types). `/orders/new/` GET requests used synthetic fixture context. The intercepted POST checked identifiers and quantity. **No order was created on the actual backend.**

#### Verification and evidence

- Chromium / Firefox / WebKit: **3/3 Playwright E2E PASS** with focus assertions.
- Related Customer Chromium E2E regression: **5/5 PASS**.
- Frontend unit: **323/323 PASS**, 83 files.
- ESLint, `tsc --noEmit`, `git diff --check`: **PASS**.
- Static production build: **30/30 pages PASS**.
- Saved cross-browser evidence: `frontend/quality-audit/.evidence/regression-20261017/customer-create-order/` with **3 ledgers and 39 screenshots** (13 per browser); full action ledger retains all 257 `all-declared-states` entries as `NOT_TESTED`.
- Deduplicated over retained `action-outcomes.json` evidence: **188/257** source IDs have at least one direct narrow PASS, **332** unique `(actionId,state,role)` PASS tuples; **69 IDs have no direct retained PASS**. Partial ID evidence is not completion or overall UX pass percentage.

#### Safety, exclusions and next gate

All order-creation POSTs are intercepted in Playwright; all unexpected browser mutations are blocked, with **0 unmocked browser writes**. Local seed login is used only to obtain a session; no real business records, payments, stock, uploads, AWS or Production environment modified. No Commit, Push or Deploy.

**NOT TESTED:** owned-fixture backend order creation, pricing/stock/authorization persistence, actual closed-campaign response from backend, high latency beyond the deferred synthetic POST, other roles and mobile devices, actual 200% browser zoom, manual screen-reader passes and remaining 69 IDs. All **257 exhaustive declared-state matrices remain NOT_TESTED**. Do not close Phase 6 or enter final review until the relevant sign-off criteria are met.

---

<a id="record-02-customer-orders-navigation-report"></a>

## Customer Orders Navigation

### Phase 6 — Customer My Orders Navigation, Filters & Retry

**Workspace:** UniStore_Hub (BDXA local)\
**Date:** 2026-10-17\
**Status:** **Phase 6 IN PROGRESS**. Narrow Browser evidence only; not full-state UX/UI acceptance.

#### UX defects reproduced and resolved

1. **Missing keyboard focus after manual initial-list Retry.** On Customer My Orders, a synthetic initial GET 503 displayed `ลองโหลดอีกครั้ง`. After the user clicked Retry, the button was unmounted by the newly loaded page and focus was not transferred to the result. Fixed in `frontend/src/modules/orders/my-orders-view.tsx`: a one-shot manual-retry flag focuses and scrolls the new page heading after the load settles. Initial navigation does not steal focus.
2. **Pagination error required keyboard navigation to discover.** The existing Load More failure message could be present without a keyboard focus destination. Added a focusable error wrapper (`[data-customer-orders-page-error]`), a side effect that focuses/scrolls it after the cursor request fails, and focus-ring/scroll-margin styles in `frontend/src/modules/orders/order-tracking.module.css`. Existing loaded entries remain preserved for a retry.

Only focus, scroll and presentation changed. Cursor semantics, sorting policy, API contracts and customer order permissions are unchanged.

**Fixture correction:** An early test fixture incorrectly used `COMPLETED`, which is not a valid Order status. Corrected it to `RECEIVED`. This was a **test-only fixture issue**, not a discovered production domain bug. The customer list intentionally starts on the `ต้องทำต่อ` filter; the test now actively selects `ทั้งหมด` before asserting non-action order rows.

#### Direct Browser action coverage

New Playwright spec: `frontend/e2e/quality-audit/customer-orders-actions.spec.ts`. Local seeded **Customer** session at **390×844** viewport. All Order list/detail GET responses are synthetic; no business POST/PATCH/DELETE were sent to the Backend.

| ID | Observed narrow states |
|---|---|
| `FE-UX-08-01` | Choose More link to storefront, including clicked navigation |
| `FE-UX-08-02` | Initial HTTP 503 with safe back-to-store; manual retry and focused recovered heading |
| `FE-UX-08-03` | Order-specific detail URL and actual navigation; READY_FOR_PICKUP contextual Pickup link |
| `FE-UX-08-04` | Loaded-only filter no-match + return-to-all, cursor 503 with preserved entries and visible focused error, same opaque-cursor retry and appended results, progress and finished filters, server-empty state with Store link |

**4 new distinct Action IDs / 11 direct Action/state/role PASS observations**, counted once across Browser engines.

#### Verification gates

| Gate | Result |
|---|---|
| New My Orders E2E — Chromium / Firefox / WebKit | **3/3 PASS** |
| Focused Chromium regression: Customer Journey, My Orders, Customer Pickup, initial Payment | **4/4 PASS** |
| All frontend Unit Tests | **323/323 PASS** across 83 files |
| Production Build / TypeScript | **30/30 static routes PASS** |
| ESLint / `git diff --check` | **PASS** |
| Real business record mutations | **0** |

#### Cumulative retained evidence (deduplicated)

Scanned `frontend/quality-audit/.evidence/regression-20261017/**/action-outcomes.json` and deduplicated by Action ID and `(Action ID, state, role)`.

- Before batch: **170/257 unique IDs**, **294 unique state/role PASS combinations**.
- New batch: **+4 distinct IDs** and **+11 previously unproven state/role combinations**.
- Current: **174/257 IDs** have at least one directly evidenced PASS (**67.7% partial ID evidence, *not* total UX acceptance**).
- Current: **305 unique Action/state/role PASS combinations**.
- **83/257 Action IDs** have no retained direct PASS.
- **All 257 exhaustive all-declared-state baseline ledger entries remain `NOT_TESTED`**. No full Action-state matrix certified.

#### Retained evidence

`frontend/quality-audit/.evidence/regression-20261017/customer-orders-navigation/`:

- `browser-1/`, `browser-2/`, `browser-3/`: 11 screenshots, `customer-orders-actions.json`, and `action-outcomes.json` each.
- **33 screenshots and 3 Action Ledgers**.
- `crossbrowser.log`, `regression.log`.
- Visually reviewed mobile screenshots showing a discoverable pagination error above the retry action, and the My Orders heading after a successful Retry.

#### Still outstanding

The other **83 unproven source Action IDs**, all untested declared-state permutations on 257 actions, actual isolated fixture write/persistence tests where explicitly safe, additional network timeout cases, multi-role/tenant permission validation, 200% zoom, screen-reader testing, real mobile hardware testing, human design acceptance.

**Phase 6 remains IN PROGRESS.** No Commit, Push, Deploy or Final Diff Review. No business records modified.

---

<a id="record-03-customer-order-cancel-followup-report"></a>

## Customer Order Cancel Followup

### Phase 6 — Customer Order Detail & Cancel Modal Follow-up

**Workspace:** `UniStore_Hub` (local BDXA)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan:** Phase 6 — Design Polish & Full Regression **IN PROGRESS**.

#### Scope

Continued the Customer Order Detail / Cancel Modal scenario `frontend/e2e/quality-audit/customer-order-cancel-actions.spec.ts` after the previous initial-GET-503 → Retry keyboard-focus failure. Verified the frontend Retry/Cancel Modal focus adjustments already present in `frontend/src/modules/orders/my-order-view.tsx` and `frontend/src/modules/orders/order-tracking.module.css`.

No Backend contract, authorization rule, cancellation policy, database data or production service was changed.

#### Browser-verified states

With a seeded local **Customer** account, `390×844` viewport, synthetic Order GET responses and **intercepted** Cancel POST responses `409` then `200`:

| Action ID | Verifications |
|---|---|
| `FE-UX-09-01` | Order 503 back link, real navigation back to My Orders, invalid order ID recovery; **new** synthetic Order GET 404 recovery link |
| `FE-UX-09-02` | Initial GET 503, manual Retry success, heading receives keyboard focus |
| `FE-UX-09-03` | Pending Payment link points to the correct Order |
| `FE-UX-09-04` | Ready for Pickup link points to the matching Order and navigates correctly |
| `FE-UX-09-05` | Eligible cancel trigger; PAID status guard; **new** Escape closes confirmation, returns focus to trigger without POST |
| `FE-UX-09-06` | Cancel restores focus without POST, pending button disabled and Escape blocked, terminal 409 closes dialog with focused visible error and allows retry, synthetic 200 updates CANCELLED and removes repeated cancellation |

**16 scoped proof states across 6 distinct Action IDs per browser**, compared with 14 in the earlier scenario. The 404 and Escape states are the **2 newly evidenced `(Action ID, state, role)` tuples**. The six Action IDs already had narrower retained PASS evidence, so they **do not count as six new globally verified IDs**.

#### Test results

| Gate | Outcome |
|---|---|
| New Order Detail/Cancel Browser E2E — Chromium / Firefox / WebKit | **3/3 PASS** |
| Focused Chromium regression — Customer Journey, My Orders, Customer Order Detail, initial Payment, Customer Pickup | **5/5 PASS** |
| Complete frontend unit tests | **334/334 PASS** across **84 files** |
| TypeScript check | **PASS** |
| ESLint | **PASS** |
| Next.js production build | **30/30 static routes PASS** |
| `git diff --check` | **PASS** |
| Actual Order-cancel business writes | **0** (two POST responses per browser served inside Playwright) |

Visual inspection of the `390×844` error/success screenshots confirmed the feedback appears **outside the dialog overlay and in the viewport**, rather than hidden behind the modal.

#### Reconciled cumulative evidence

The earlier `customer-journey-verification.md#record-04-customer-order-cancel-report` was a historical snapshot from 2026-10-17, when only 180/257 IDs had a scoped proof. Numerous other Phase 6 continuations have since added evidence, so that older number must **not** be reused as today's baseline.

Across **all retained `frontend/quality-audit/.evidence/**/action-outcomes.json`** files, de-duplicating Action IDs and `(actionId,state,role)`:

- Before this follow-up: **257/257 IDs** with at least one narrowly scoped PASS and **469** unique Action/state/role PASS tuples.
- After this follow-up: **257/257 IDs** with at least one narrow scoped PASS, **471** unique Action/state/role PASS tuples (**+2**).
- **0/257 exhaustive all-declared-state matrices certified**. Every full baseline entry remains `NOT_TESTED`; ID coverage is **not** full UX acceptance.

#### Evidence retained

`frontend/quality-audit/.evidence/regression-20261018/customer-order-cancel/`

- `browser-1/`, `browser-2/`, `browser-3/` contain **16 screenshots**, one `customer-order-cancel-actions.json`, and one `action-outcomes.json` per engine.
- **48 final screenshots and 3 Action Ledgers** overall.
- `crossbrowser.log` and `regression.log` prove the completed test runs.

#### Remaining limitations and next gates

Actual permission and write transitions against owned disposable local fixtures were **not performed**. No real Order was cancelled. Synthetic 409/200 does not certify the Backend transaction, real status propagation, cross-tenant isolation, or cancellation idempotency. Native 200% zoom, real screen readers/mobile hardware, timeouts and all other state×role×viewport variants remain unverified.

**Phase 6 remains IN PROGRESS; Final Diff Review remains PENDING. No Commit, Push, Deploy or real data modification.**

---

<a id="record-04-customer-order-cancel-report"></a>

## Customer Order Cancel

### Phase 6 — Customer Order Detail & Cancel Modal

**Historical snapshot (2026-10-17):** Counts in this file were accurate to its original cutoff, not current. Updated 2026-10-18 verification and reconciled coverage: [customer-journey-verification.md#record-03-customer-order-cancel-followup-report](customer-journey-verification.md#record-03-customer-order-cancel-followup-report).

**Workspace:** UniStore_Hub (local BDXA)\
**Date:** 2026-10-17\
**Plan status:** **Phase 6 IN PROGRESS** — scoped Browser evidence; not complete UX/UI sign-off.

#### Reproduced UX failures and remediation

**1. Initial detail GET 503 → manual Retry lost keyboard focus.** Clicking `ลองโหลดอีกครั้ง` replaced the button with the loaded Order Detail view but left focus without a clear continuation. Changed `frontend/src/modules/orders/my-order-view.tsx`: a one-shot explicit Retry flag now focuses and scrolls to the new result heading on completion. Initial page load does not steal focus.

**2. Cancel Order HTTP 409 error was behind the still-open confirmation dialog.** A simulated cancellation conflict ended the operation but left the confirmation dialog open, concealing a terminal error below the order details. Changed `my-order-view.tsx` and `order-tracking.module.css`:

- Controlled `cancelDialogOpen`; cancel/escape outside pending behaves normally.
- While a POST is Pending, confirmation is disabled and Escape/outside dismissal remains blocked.
- On the *terminal* POST result, the dialog closes. Visible focused Error/Success feedback is scrolled into view after the focus trap releases. On ordinary Back/Cancel, keyboard focus still returns to the original trigger.
- Opening a new confirmation clears stale feedback.
- Real customer cancellation eligibility, request payloads, backend authority and order lifecycle rules remain unchanged.

No real Order was canceled. Tests intercept all cancel POSTs in Playwright and return synthetic HTTP 409/200; all other browser mutations are blocked. A local Customer seed session is used only for auth.

#### Browser-executed action proof

New executable spec: `frontend/e2e/quality-audit/customer-order-cancel-actions.spec.ts`\
Browser viewport: **390×844**, role: **Customer**.

| Source Action ID | Directly observed states |
|---|---|
| `FE-UX-09-01` | 503 recovery back link; clicked Back navigates to My Orders; invalid/missing Order ID recovery |
| `FE-UX-09-02` | Persistent synthetic initial GET 503; explicit Retry succeeds and focuses resulting heading |
| `FE-UX-09-03` | Eligible pending-payment Order shows payment CTA with exact scoped Order ID |
| `FE-UX-09-04` | READY_FOR_PICKUP Order links to matching pickup and clicked route navigates successfully |
| `FE-UX-09-05` | Confirmation trigger visible only on eligible Order, opens descriptive dialog; PAID Order hides ineligible trigger |
| `FE-UX-09-06` | Back/Cancel returns focus without POST; deferred Pending disables confirm and blocks Escape; intercepted 409 closes dialog and focuses visible, retryable error; simulated 200 refreshes CANCELLED state, focuses success and removes repeat cancel |

**6 newly evidenced distinct Action IDs; 14 state-scoped PASS results**, counted once across the three Browsers. This proves UI handling of intercepted responses, **not backend transaction persistence or correctness of conflict/business rules**.

#### Verification

| Gate | Result |
|---|---|
| Customer Order Detail/Cancel on Chromium, Firefox, WebKit | **3/3 E2E PASS** |
| Focused Chromium regression (Customer Journey, My Orders, Order Detail/Cancel, initial Payment, Customer Pickup) | **5/5 E2E PASS** |
| Full frontend Unit Tests | **323/323 PASS** across 83 files |
| Production Build / TypeScript | **30/30 static routes PASS** |
| ESLint / `git diff --check` | **PASS** |
| Actual business Order cancellation writes | **0** |

#### Cumulative Phase 6 direct-evidence ledger reconciliation

Deduplicating `action-outcomes.json` from all retained evidence under `frontend/quality-audit/.evidence/regression-20261017/`:

- Before batch: **174/257** source Action IDs with ≥1 direct PASS; **305** unique `(actionId,state,role)` PASS tuples.
- Net new in this batch: **6 distinct Action IDs**, **14 new state/role tuples** (no overlap).
- Current: **180/257 Action IDs** with at least one narrow direct PASS (**70.0% ID-level *partial evidence*, not 70% UX acceptance**).
- **319** unique Action/state/role PASS tuples; **77 Action IDs** with no retained PASS evidence.
- **All 257 exhaustive all-declared-state baseline entries remain `NOT_TESTED`**, including partially evidenced IDs. No full action-state matrix is certified.

#### Evidence archive

`frontend/quality-audit/.evidence/regression-20261017/customer-order-detail-cancel/`:

- `browser-1/`, `browser-2/`, `browser-3/`: each with 14 screenshots, `customer-order-cancel-actions.json` and `action-outcomes.json`
- **42 screenshots and 3 Action Ledgers**, `crossbrowser.log` and `regression.log`
- Visually reviewed narrow viewport Error/Success frames; all business-mutating cancellation responses were synthetic.

#### Remaining Phase 6 gates

77 Action IDs still lack direct proof; exhaustive states of all 257 remain incomplete. Customer create-order interaction, Store/Campaign/Product navigation, Organization setup/image upload, timeout/permission cases, native 200% zoom, screen reader/hardware reviews, true isolated owned-fixture backend persistence, and human design approval remain outstanding.

**Phase 6 stays IN PROGRESS.** No Commit, Push, Deploy, real Order mutation or Final Diff Review.

---

<a id="record-05-customer-payment-upload-report"></a>

## Customer Payment Upload

### Phase 6 — Customer Payment Slip First Submit & Resubmission

**Workspace:** UniStore_Hub (BDXA local)\
**Date:** 2026-10-17\
**Status:** Phase 6 **IN PROGRESS**. This batch tested Browser behavior using only synthetic fixtures; it is *not* proof that Backend payment state or object storage persistence works.

#### UX defects reproduced and corrected

1. **Upload failure/result without keyboard focus.** A Customer rejected-payment resubmission with a synthetic presigned **PUT HTTP 403** displayed the expired upload link error, but did not move keyboard focus to the result. Fixed in `frontend/src/modules/payments/my-payment-view.tsx` by adding a programmatically focusable `[data-payment-operation-error]` wrapper and a `[data-payment-operation-success]` result wrapper. After terminal upload error or success, and once the submission stage is idle, focus and scroll to the relevant result. Updated `frontend/src/modules/payments/payment-view.module.css` for scroll margin and focus indicator. The selected file is retained on recoverable error so the Customer can retry.
2. **Focus lost on Customer Payment page load Retry.** After simulated Order GET 503, the **ลองโหลดอีกครั้ง** button disappeared on successful reload and the next page heading was not focused. Added a one-shot user-initiated Retry focus flag, moving keyboard focus to the resulting page heading only after explicit Retry; initial navigation is unaffected.

No Backend/payment business rules, RBAC, upload validation limits, presign contracts, or request ordering were changed.

#### Browser-executed state coverage

New tests:
- `frontend/e2e/quality-audit/customer-payment-initial-actions.spec.ts`
- `frontend/e2e/quality-audit/customer-payment-upload-actions.spec.ts`

Tests execute a locally seeded **Customer** session at **390×844** viewport. Mock GET Order/Payment responses, synthetic sign URL POST, a same-origin synthetic presigned PUT target, and synthetic Payment POST are all intercepted by Playwright. All other browser non-read requests are aborted. **No real bytes were uploaded to object storage; no payment records were created or changed.**

| Source ID | Verified narrow states |
|---|---|
| `FE-UX-10-01` | Back-to-Order link for rejected Payment, safe recovery to Order list on 503 and missing orderId |
| `FE-UX-10-02` | Persistent synthetic Order GET 503, manual retry to PENDING_PAYMENT with no existing Payment, correct keyboard focus on recovered page |
| `FE-UX-10-03` | Unsupported MIME type rejection, oversized image rejection, accepted synthetic PNG file and display of selected filename |
| `FE-UX-10-04` | First Submit with no file blocks presign and focuses input; deferred direct PUT pending disables repeat Submit, simulated first Payment 200 refreshes to PAYMENT_REVIEW and focuses success |
| `FE-UX-10-05` | Rejected state and specific rejection reason, missing file validation, new slip selection, direct PUT 403 with visible focused error, Pending lock/stage, intercepted Payment POST 409 with focused error, retry using **fresh objectKey**, simulated 200 followed by authoritative GET refresh and updated status |

**5 new distinct Action IDs** and **17 distinct state/role PASS observations** (8 from first submit + 9 from resubmission), not multiplied by Browser. Actual Backend persistence, real upload bytes, storage ACL and business transitions remain untested.

#### Test gates

| Gate | Verified result |
|---|---|
| Initial Payment + Resubmit Cross-browser E2E: Chromium, Firefox, WebKit | **6/6 PASS** |
| Chromium focused regression: Customer Journey, Initial Payment, Resubmit, Customer Pickup, Staff Payment Review | **5/5 PASS** |
| Full frontend Unit Tests | **323/323 PASS**, 83 files |
| Production Build / TypeScript | **30/30 routes PASS** |
| ESLint and `git diff --check` | **PASS** |
| Actual Backend business writes/object-store uploads | **0** |

#### Reconciled cumulative Phase 6 proof

Deduplicated from all retained `frontend/quality-audit/.evidence/regression-20261017/**/action-outcomes.json` files, counting distinct Action IDs and distinct `(actionId, state, role)` tuples:

- Before batch: **165/257** Action IDs with at least one scoped PASS, **277** unique state/role PASS tuples.
- This batch: **+5 previously unevidenced IDs**, **+17 new state/role tuples**.
- Current: **170/257 distinct Action IDs** with at least one directly observed PASS state (**66.1% partial ID coverage**, *not 66.1% complete UX acceptance*).
- **294** unique state/role PASS tuples.
- **87 Action IDs** still have no retained scoped PASS evidence.
- **All 257 exhaustive all-declared-state baseline entries remain `NOT_TESTED`**; partial proof must not imply full state coverage.

#### Archived reproducible evidence

`frontend/quality-audit/.evidence/regression-20261017/customer-payment-upload/`:

- `initial-browser-1`–`initial-browser-3`, each with 8 screenshots and its own `payment-initial-safe-states.json`, `action-outcomes.json`.
- `resubmit-browser-1`–`resubmit-browser-3`, each with 9 screenshots and its own `payment-upload-safe-states.json`, `action-outcomes.json`.
- Total: **51 screenshots, 6 Action Ledgers**.
- `crossbrowser.log`, `regression.log`; the first separately archived 3-engine resubmission run is preserved as `resubmit-crossbrowser.log`.
- Sample mobile screenshots visually reviewed for 403 feedback within viewport and recovered Payment heading.

#### Outstanding before Phase 6 closure

Remaining 87 Action IDs without retained proof, remaining declared states across all 257 IDs, real fixture-isolated upload/persistence with strict cleanup, interrupted network/timeouts and backend error permutations, actual payment slip privacy review, accessibility (screen reader, 200% zoom), native mobile hardware, and UX/UI design acceptance.

**Keep Phase 6 IN PROGRESS.** No Commit, Push, Deploy, data reset or real payment changes. Final Diff Review not started.

---

<a id="record-06-customer-pickup-refresh-report"></a>

## Customer Pickup Refresh

### Phase 6 — Customer Pickup Refresh, Retry and Recovery

**Workspace:** UniStore_Hub (BDXA local)\
**Date:** 2026-10-17\
**Status:** **Phase 6 IN PROGRESS**, narrow directly observed UI proof only.

#### UX defect reproduced and fixed

**Keyboard Focus lost after user-initiated status recheck:** On the Customer Pickup `/my/pickup/` page, clicking **ตรวจสอบสถานะล่าสุด** from an `IN_PRODUCTION` (not-ready) order replaced the refresh button with a Ready Pickup QR/Token view. Chromium Browser E2E reproduced that the new `ข้อมูลรับสินค้า` heading was visible but not focused. The user's keyboard position was stranded after the former action unmounted.

Remediation in `frontend/src/modules/pickups/my-pickup-view.tsx`:
- Added an explicit user-action flag for Refresh/Retry (not initial navigation).
- When the subsequent load finishes, the new page result heading is made programmatically focusable and focused, and scrolled into the viewport.
- The flag is reset after one completion; ordinary initial navigation does **not** automatically steal focus.
- Existing order status policy, token-only local QR generation, eligibility, GET endpoints and domain state remain unchanged.

#### Browser-executed action evidence

New test `frontend/e2e/quality-audit/customer-pickup-actions.spec.ts`; seeded local **Customer** session, **390×844 viewport**, mock GET responses for an Order and its Pickup. All non-read API requests are blocked; **no business mutations**.

| Source Action ID | Directly evidenced scoped states |
|---|---|
| `FE-UX-11-01` | Back-to-Order link remains correctly scoped when not ready and navigates to related Order when ready |
| `FE-UX-11-02` | Recheck transitions not-ready → READY QR/Token; resulting page heading receives keyboard Focus; RECEIVED credential has clear used/read-only status |
| `FE-UX-11-03` | Order GET 503 shows recoverable UI, retry succeeds; Pickup GET 503 also shows recoverable UI, retry succeeds, result heading focused |
| `FE-UX-11-04` | Error includes back-to-orders link; missing orderId shows invalid-link recovery |

**4 new Action IDs / 10 direct state-scoped PASS outcomes**, counted once across Browser engines. Mock 503 responses were deliberately held throughout automatic request retries and released only before clicking the actual UI Retry button to avoid false claims of exercising recovery.

#### Verification

| Gate | Result |
|---|---|
| Customer Pickup E2E — Chromium / Firefox / WebKit | **3/3 PASS** |
| Chromium regression: Customer Journey + new Customer Pickup + Staff Pickup Confirmation | **3/3 PASS** |
| Full frontend Unit Tests | **323/323 PASS** (83 files) |
| Production Build | **30/30 routes PASS**, TypeScript PASS |
| ESLint and `git diff --check` | **PASS** |
| Real business writes | **0** |

#### Cumulative retained-evidence traceability

Calculated directly by scanning all retained `action-outcomes.json`, de-duplicating by Action ID and by `(Action ID, state, role)`:

- **164/257 distinct Action IDs** with at least one direct PASS state (**63.8% ID-level partial proof, not whole UX acceptance**).
- **271 unique Action/state/role PASS tuples** across recent Phase 6 continuation batches, not multiplied by browser count.
- **93 distinct Action IDs** with no retained direct PASS state.
- **All 257 exhaustive all-declared-state baseline entries remain `NOT_TESTED`**, even where partial proof exists.

Previous retained-evidence count **160 IDs / 261 tuples**; this batch adds **4 IDs / 10 states**.

#### Evidence retained

`frontend/quality-audit/.evidence/regression-20261017/customer-pickup-refresh/` contains three browser-specific directories. Each contains ten screenshots, `customer-pickup-actions.json`, `action-outcomes.json`. Totals: **30 screenshots / 3 Action Ledgers**. `crossbrowser.log` and `regression.log` are preserved in this directory.

#### Outstanding

Customer payment slip/resubmission, notification actions, other 93 Action IDs lacking recent proof, all untested permutations for the entire 257-ID baseline, actual isolated disposable fixture mutations (only where safe), manual accessibility/zoom/real mobile device checks, and visual design approval remain incomplete.

**Phase 6 remains IN PROGRESS.** No Commit, Push, Deploy, production access or data reset. Final Diff Review not started.

---

<a id="record-07-guest-customer-navigation-report"></a>

## Guest Customer Navigation

### Phase 6 — Guest / Customer Shell & Authenticated Entry Navigation

**Workspace:** UniStore_Hub, local BDXA only\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan:** Phase 6 **IN PROGRESS**, Final Diff Review pending.

#### Objective and scope

Continue Phase 6 from **207/257** distinct source Action IDs with at least one retained narrow PASS and **372** distinct Action/State/Role PASS tuples. Exercise the **18 previously unproven** Guest and Customer navigation/entry IDs using real Browser interaction rather than route snapshots.

##### Directly exercised

| Source Action IDs | Role & viewport | Observed behavior |
|---|---|---|
| `FE-UX-SHELL-GUEST-01`–`04` | Guest, 1440×900 | Public brand from authentication page returns to storefront; Stores from detail route opens catalog; Login and Register navigation opens their actual forms |
| `FE-UX-SHELL-CUSTOMER-01`–`06` | Customer, 390×844 | Application-shell brand returns home; mobile menu Storefront/My Orders/Notifications links navigate correctly; keyboard Skip Link focuses `#main-content`; Logout clears browser session storage and restores guest navigation |
| `FE-UX-02-07`–`10` | Authenticated Customer, 390×844 | Login entry (without showing login form) links to My Orders, Notifications, conditionally to Organization selection for ACTIVE membership, and back home |
| `FE-UX-03-08`–`11` | Authenticated Customer, 390×844 | Register entry (without showing register form) links to My Orders, Notifications, conditionally to Organization selection for ACTIVE membership, and back home |

Each scoped PASS involves the corresponding visible Browser control, asserted route or focus and screenshot. Both **presence** with an active membership and **absence** without membership were observed for the conditional Organization link. No claim is made for other membership-status permutations.

##### Findings and deliberate restraint

- At **390px**, the public Storefront Header intentionally hides the redundant **Stores** link; the brand still links home. The Guest **Stores** control was therefore exercised at desktop width **1440px**. This was not falsely marked a mobile UI failure.
- The application-shell brand sits **outside** the mobile drawer and cannot be interacted with inside the drawer's dialog. Test explicitly closes the drawer before clicking the brand.
- A same-route link followed immediately by programmatic navigation caused cross-engine test races during test development; the final test drives meaningful distinct destinations instead of assuming navigation has settled.
- During development, the initial dynamic Action-ID mapping for Register shortcuts was incorrect. It was corrected **before** final retained Browser runs; final 18 distinct IDs and their evidence were validated against the canonical coverage baseline.
- **No application behavior code changed in this batch.** Only new safe E2E coverage was added: `frontend/e2e/quality-audit/customer-guest-shell-actions.spec.ts`.

##### Browser safety

- Local, seed-account token only for Customer sessions; Guest session uses no token.
- Browser GET `/api/v1/me`, customer Order/Notification lists, Storefront directory and Organization list were synthetic and read-only. Unexpected browser POST/PATCH/PUT/DELETE were blocked.
- Logout was tested against browser session storage and visible public navigation, not as proof of server-side token revocation.
- No actual business/backend writes, real user or tenant record changes, database resets, remote or production requests.

#### Verification

| Gate | Result |
|---|---|
| Chromium, Firefox, WebKit final targeted E2E | **3/3 PASS** |
| Related Chromium Login/Register validation, shell, My Orders mobile-filter regression | **3/3 PASS** |
| Frontend Unit Tests | **323/323 PASS**, 83 test files |
| TypeScript / ESLint / git diff --check | **PASS** |
| Production static build | **30/30 routes PASS** |
| Browser business writes | **0** |

Retained evidence: `frontend/quality-audit/.evidence/regression-20261017/guest-customer-navigation/`, containing **3 final browser evidence ledgers**, **54 scoped screenshots** (18 per engine), scenario results and authoritative `coverage-reconciliation.json`.

#### Reconciled action-level evidence

Counted de-duplicated `(actionId,state,role)` tuples from all **retained** `action-outcomes.json` files under the Phase 6 evidence root.

| Metric | Before batch | After batch |
|---|---:|---:|
| Source Action IDs with at least one narrowly evidenced state PASS | 207/257 | **225/257** |
| Unique Action/State/Role PASS tuples | 372 | **390** |
| IDs without any retained direct PASS | 50 | **32** |
| Exhaustive `all-declared-states` baseline certifications | 0/257 | **0/257** |

**Outstanding:** 32 source IDs without retained direct PASS (mainly Staff/Organization Admin/Platform Admin shell navigation, Org Settings Retry, Product Image file/upload and Organization Orders detail), full action-state combinations for 257 IDs, owned-disposable real-backend mutation fixtures, real-device keyboard/assistive-tech/200% browser zoom and human visual acceptance. Synthetic backend responses cannot certify real persistence or RBAC.

**Status: Phase 6 IN PROGRESS. Do not enter Phase 7 until acceptance is met.** No Commit, Push or Deploy.

---

<a id="record-08-notifications-actions-report"></a>

## Notifications Actions

### Phase 6 — Customer Notifications Actions & Error Focus

**Workspace:** UniStore_Hub (BDXA local)\
**Date:** 2026-10-17\
**Plan status:** **Phase 6 IN PROGRESS**. This is state-scoped Browser proof, not acceptance of every application state.

#### Reproduced UX issue and remediation

**Mark as Read failure was outside the mobile viewport.** On `/notifications/`, when a customer clicked **ทำเครื่องหมายว่าอ่านแล้ว** and the intercepted PATCH returned HTTP 409, the `Notice` appeared **below the paginated notification list**. At the 390×844 viewport it existed in the DOM but was entirely outside the viewport (`toBeInViewport` failed) and received no keyboard focus. This was reproduced by Chromium Browser E2E before fixing.

Changed:
- `frontend/src/modules/notifications/notifications-view.tsx`: moved the action failure Notice above the loading/list content and added a keyboard-focusable wrapper (`[data-notifications-action-error]`). On new operation failure, focus and scroll to the Notice so the user knows the result immediately.
- `frontend/src/modules/notifications/notifications-view.module.css`: added top scroll margin and visible keyboard focus treatment for the feedback wrapper.
- No authorization, server filtering, marking semantics, API contract, data persistence, or notification routing was changed.

The Browser test asserts the 409 error is **visible in the viewport and receives keyboard focus**, not merely that its text exists.

#### Direct Browser-executed action proof

New E2E test: `frontend/e2e/quality-audit/notification-actions.spec.ts`.

Seeded local **Customer** session, 390×844 viewport. Notification GET responses are Browser-intercepted synthetic fixtures; one notification's mark-read PATCH is intercepted to simulate conflict, deferred pending conflict, and success. All other Browser non-read operations are rejected. **No real notification read flag was changed.**

| Action ID | Directly exercised narrow states |
|---|---|
| `FE-UX-12-01` | Manual refresh HTTP 503 retains the last good list with visible feedback; retry refresh succeeds |
| `FE-UX-12-02` | All filter resets the read query and displays loaded results |
| `FE-UX-12-03` | Unread filter GET scopes results and excludes marked-read notifications |
| `FE-UX-12-04` | Read filter GET scopes results and includes the marked notification |
| `FE-UX-12-06` | Mark-read synthetic 409 focused on-screen Error, Pending disabled state, deferred 409, synthetic 200 changes read status and hides action |
| `FE-UX-12-07` | Load More with opaque cursor appends next page |

**6 IDs / 10 state-scoped PASS outcomes** in this batch (not multiplied by three Browser engines).

#### Verification

| Gate | Result |
|---|---|
| New Notifications action E2E, Chromium / Firefox / WebKit | **3/3 PASS** |
| Chromium regression: full Customer Journey + Customer Pickup + Notifications | **3/3 PASS** |
| Full frontend Unit Tests | **323/323 PASS** across 83 files |
| Production Build and TypeScript | **30/30 static routes PASS** |
| ESLint and `git diff --check` | **PASS** |
| Real business writes or notification mutations | **0** |

#### Cumulative proof — de-duplicated from retained ledgers

Previous direct evidence: **164/257 unique Action IDs**, **271 distinct (Action ID, state, role) PASS tuples**.

This batch touched six IDs, but **five already had some directly evidenced PASS state**, and four of the ten state tuples already existed. Actual net new retained proof is **one previously unproven Action ID** (`FE-UX-12-06`) plus **six additional distinct state/role tuples**.

Current totals:

- **165 of 257 Action IDs** have at least one direct PASS observation (**64.2% ID partial evidence, not UX acceptance**).
- **277 distinct Action/state/role PASS combinations** recorded.
- **92 Action IDs** remain without a retained directly evidenced PASS.
- **All 257 exhaustive all-declared-state ledger entries remain `NOT_TESTED`**.

#### Evidence archive

`frontend/quality-audit/.evidence/regression-20261017/notification-actions/`

Contains `browser-1/`, `browser-2/`, `browser-3/`: each with 10 screenshots, `notification-safe-states.json`, and `action-outcomes.json` (**30 images, 3 ledgers**). Includes `crossbrowser.log` and `regression.log`. Screenshots were visually inspected to confirm the error above the list and the updated read status.

#### Remaining

Still pending: Notification top-level initial-error/Retry states not evidenced in this batch, complete state permutations across all 257 IDs, customer payment slip upload/resubmission, safe fixture-isolated mutation persistence tests, remaining 92 unevidenced IDs, 200% browser zoom, screen-reader and real device tests, and human design approval.

**Keep Phase 6 IN PROGRESS.** No Commit, Push, Deploy or Final Diff Review; no real business record was modified.
