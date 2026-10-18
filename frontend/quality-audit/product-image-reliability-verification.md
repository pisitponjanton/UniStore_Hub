# Product Image Reliability Verification

Consolidated reference for feature-focused QA. Records are retained as separate dated observations; earlier metrics may be superseded by later results. Refer to `frontend-qa-signoff.md` for final scoped QA scope, and the root `WEB_QUALITY_AUDIT.md` for remaining gaps.

## Contents

- [Cross Account Storage Reload](#record-01-cross-account-storage-reload-report)
- [Inflight Stale Closed Tab](#record-02-inflight-stale-closed-tab-report)
- [Product Image Readback Recovery](#record-03-product-image-readback-recovery-report)
- [Product Image Session Reload](#record-04-product-image-session-reload-report)
- [Product Image Storage Denied](#record-05-product-image-storage-denied-report)
- [Product Upload Negative Matrix](#record-06-product-upload-negative-matrix-report)
- [Upload Race Ambiguous Patch](#record-07-upload-race-ambiguous-patch-report)


---

<a id="record-01-cross-account-storage-reload-report"></a>

## Cross Account Storage Reload

### Phase 6 — Cross-Account Image Verification & Storage-Denied Reload

**Workspace:** UniStore_Hub (BDXA local)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan:** Phase 6 — Design Polish & Full Regression **IN PROGRESS**; Final Diff Review **PENDING**.

#### Scope

Continue the prior product-image committed-readback recovery by validating two previously unproven scenarios:
1. **Same-tab cross-account transition:** Organization Admin → Logout → Staff → Logout → original Organization Admin while one imageKey PATCH was acknowledged but latest product GET remained unverified.
2. **Session Storage denied after page reload:** the in-memory pending marker cannot survive reload; ensure the user gets an accurate warning and a safe read-only Product GET check before deciding whether to upload another image.

#### Application changes

- `frontend/src/modules/products/product-image-upload-view.tsx`: pin each in-flight signing/upload/PATCH/readback lifecycle to the **initiating authenticated user ID**; after asynchronous responses, do not update an editor that belongs to a different account. If a previously started PATCH finishes after unmount/account change, save only the original owner's scoped marker without modifying the new UI. Removed a duplicate `clearPendingProductImage` call. The existing per-user/org/product storage key remains intact.
- `frontend/src/modules/products/product-image-pending-verification.ts`: `canRememberPendingProductImage` makes a short-lived marker-namespace write/remove probe, not touching access tokens, original file bytes or signed URLs.
- `frontend/src/modules/products/product-image-upload-view.tsx`: after mounting, a denied marker store is disclosed **even if an earlier acknowledged marker was lost by reload**. The warning advises checking latest product data before another upload. Add **“โหลดข้อมูลสินค้าล่าสุด”** action that performs a single GET and refreshes the displayed Product; it never requests a signed URL or writes an imageKey. This is an advisory risk mitigation, **not guaranteed recovery of unrecorded prior writes**.
- `frontend/src/modules/products/product-image-pending-verification.test.ts`: two additional cases verify the probe succeeds without residue when storage is available and reports a denial when the marker namespace is blocked.

#### Browser evidence: actual local seed-role transitions

`frontend/e2e/quality-audit/product-image-cross-account-isolation.spec.ts`:

- Login UI for real local Organization Admin seed token, create **synthetic** acknowledged imageKey PATCH with failed readback; verify only one signed POST, one PUT and one PATCH (all intercepted).
- Logout through actual mobile shell, log into **real local Staff seed token** using login UI and GET /me; direct Organization Products route yields **“ไม่มีสิทธิ์เข้าถึง”**, no upload or verification UI.
- Logout Staff and login original Organization Admin. Reopening the same product restores admin-scoped **GET-only** recovery. Matching synthetic GET returns success; no new upload request.
- Login form POST replies carry existing local seed tokens through a Browser mock; separate seed auth setup uses the local API. The test creates or changes **no user, product, order, payment or DB record**. Staff's forbidden screenshot is retained in the per-run JSON and screenshots but **not falsely recorded as a Staff PASS for admin-only `FE-UX-18-15`**.

Three new `FE-UX-18-15` Org Admin state-level PASS tuples: `admin-saved-unverified`, `admin-resumes-after-staff`, `admin-verifies-after-switch`.

#### Browser evidence: storage-denied reload

`frontend/e2e/quality-audit/product-image-storage-denied-reload.spec.ts`:

- Playwright makes only the product image verification marker namespace throw `SecurityError`; auth-token storage still works.
- A synthetic image upload receives an acknowledged PATCH followed by GET 503. User sees the existing warning about storage unavailability.
- **Full browser reload** then opens the Product editor using a synthetic stale Product GET. The old committed marker cannot be reconstructed. The UI warns about this limitation and offers **“โหลดข้อมูลสินค้าล่าสุด”**.
- When the synthetic server begins returning the current imageKey, clicking that button updates the displayed image/status using GET **only**. The Browser proves **no repeated signing POST, signed PUT, or imageKey PATCH** was generated by that action.
- **Critical limitation:** With storage blocked and the server still stale after reload, the frontend cannot know that the previous imageKey PATCH succeeded. It cannot guarantee prevention of a user-initiated duplicate upload without backend idempotency or durable transaction status. No backend contract changes were made.

Two new scoped PASS tuples: `storage-denied-reload-caution`, `storage-denied-reload-GET-only-check`.

#### Final verification

| Gate | Result |
|---|---|
| Account transition scenario: Chromium/Firefox/WebKit | **3/3 PASS** |
| Storage-denied reload scenario: Chromium/Firefox/WebKit | **3/3 PASS** |
| Focused Chromium regression: account switch, denied reload, prior storage-denied, prior readback-only and session reload | **5/5 PASS** |
| Vitest frontend unit tests | **330/330 PASS**, 84 files |
| TypeScript / ESLint / `git diff --check` | **PASS** |
| Next.js production build | **30/30 generated pages PASS** |
| Actual business writes/object-store uploads | **0**, all Product signing/PUT/PATCH Browser requests intercepted |

An intermediate attempt to combine Cross-browser commands failed due to a tool/runtime error; both test suites were subsequently rerun **separately and PASS on the final code**. Earlier test fixture errors are not counted as PASS.

#### Retained evidence

`frontend/quality-audit/.evidence/regression-20261017/cross-account-storage-reload/`

- 6 Engine×Scenario directories; 6 machine-readable `action-outcomes.json` ledgers.
- **18 screenshots** (12 account transitions, 6 denied-reload), including forbidden Staff proof retained separately from canonical Org Admin action tuples.
- 6 scenario metadata files and `coverage-reconciliation.json`.

Ledger-deduplicated cumulative progress:

| Measure | Previous | Current |
|---|---:|---:|
| Source Action IDs with >=1 narrow direct PASS | 257/257 | **257/257** |
| Unique `(actionId,state,role)` PASS tuples | 459 | **464** |
| IDs with zero direct scoped PASS | 0 | **0** |
| Certified exhaustive all-declared-state matrices | 0/257 | **0/257** |

#### Remaining acceptance and scope cautions

The scenario uses **two valid seed accounts with different roles**, not two different Organization Admin accounts. It does not certify backend isolation between two equally privileged admins. The identity-pinned in-flight guards were included in the source fix but a **cross-account identity change exactly while a delayed GET is outstanding** still merits a dedicated synthetic timing test.

Other Phase 6 gaps: durable server-side idempotency/reconciliation after ambiguous PATCH/network timeout, disabled Session Storage combined with indefinitely stale backend data, production RBAC, screen reader, native browser 200% zoom, every applicable state/role/viewport combination and human visual sign-off.

**Phase 6 remains IN PROGRESS; Final Diff Review remains PENDING.** No Commit, Push, Deploy or mutation of real business records.

---

<a id="record-02-inflight-stale-closed-tab-report"></a>

## Inflight Stale Closed Tab

### Phase 6 — In-flight PATCH Navigation, Prolonged Readback & Closed-Tab Recovery

**Workspace:** UniStore_Hub via BDXA (local development)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan status:** Phase 6 **IN PROGRESS**, Final Diff Review **PENDING**

#### Objective

Continue the active Phase 6 State Matrix with three follow-ups to the prior ambiguous image PATCH/late-401 work:

1. **Navigate away while imageKey PATCH is still in-flight** after the signing POST and signed PUT. Distinguish a held/aborted acknowledgement from a proven failed write and prevent duplicate upload on returning to the same tab.
2. **Repeated stale, unavailable or conflicting Product GET responses** after ambiguous PATCH. Never falsely claim persistence or perform automatic retries/mutations; give the user a useful next step after several failed manual checks.
3. **Close the original tab and open a new one.** Session Storage does not provide guaranteed cross-tab recovery. Add a safe manually initiated **read-only Product GET** even when the original marker was lost, instead of promising automatic transaction recovery.

#### Frontend remediation

Changed `frontend/src/modules/products/product-image-upload-view.tsx` only:

- Added `verificationRetries` state, counting user-initiated GET-only verification attempts. On **three or more unsuccessful checks**, display a `role=status` warning telling the user to contact an administrator with the Product ID and **not upload the image again** without checking first. Reset this advisory after exact imageKey confirmation or a fresh upload; the GET-only button remains available.
- Made the existing **“โหลดข้อมูลสินค้าล่าสุด”** read-only action available in any Product Image editor without a pending marker, including a newly opened browser tab. Its existing safety and identity checks remain unchanged: it performs Product **GET only**, never signed upload POST/PUT nor imageKey PATCH, and does not infer whether a previous lost transaction committed.
- Clarified the image chooser hint: when reopening the app after a recent upload, use the read-only latest-product check before sending the same file again. This is an actionable safety hint, **not a guarantee** of backend persistence or duplicate prevention after total loss of a marker.

No changes to backend APIs, database, tenant/auth/RBAC contracts, storage semantics, dependency/lockfiles or production settings.

#### Three Browser suites added

All tests use local seed Organization Admin authentication, synthetic Store/Product GET responses, fully intercepted signing POST, signed PUT and Product imageKey PATCH, and a strict guard against unexpected business writes.

##### `product-image-inflight-navigation.spec.ts`

- PATCH is dispatched once; local mock records a commit but **withholds the response**.
- The original tab navigates away while the response remains held, then the mock aborts that response. Verify a **conservative scoped marker existed before dispatching PATCH** and survives same-tab navigation.
- On returning to the Product editor, the status is **unconfirmed**, file chooser/full upload remains disabled, and the only recovery is a manual Product GET.
- Stale GET does not clear the marker or claim success; a later matching GET confirms the expected imageKey. Exactly **1 signing POST, 1 signed PUT, 1 imageKey PATCH** across the full scenario, and **0 actual business writes**.
- The WebKit dev runner sometimes emits `POST /__nextjs_original-stack-frames` when the deliberately failed request triggers Next.js's development error overlay. That is an **internal stack-frame formatting request**, not a Product/business mutation. The harness explicitly intercepts and fulfills only this exact local development tooling endpoint; every other unexpected non-GET method remains blocked and logged. A preliminary combined run revealed this and was **not counted as passing** until diagnosed and corrected.

##### `product-image-stale-readback.spec.ts`

- PATCH response is synthetic HTTP 503 after a mocked commit.
- Retry GET returns **old imageKey three times**; the UI remains in readback-only mode and shows the new support/no-reupload advisory.
- Another GET returns a **different imageKey**, which is not falsely accepted; later GET 503 likewise does not unlock full upload.
- A full page reload restores the conservative pending marker with accurate **unconfirmed** wording. Matching GET eventually confirms the image and clears the advice and pending marker.
- The test asserts no second signing POST, signed PUT or Product PATCH; **no automatic polling**, and no promise that actual backend eventual consistency will resolve.

##### `product-image-closed-tab-recovery.spec.ts`

- The original tab dispatches one held imageKey PATCH and **is actually closed**.
- A new tab in the test browser context does **not inherit the first tab's per-tab Session Storage marker**. The same local seed account is established by the existing read-only test setup, not by moving the old tab's marker.
- The editor prominently offers **“โหลดข้อมูลสินค้าล่าสุด”** with the new chooser hint. Clicking this button performs Product GET **only** and shows the imageKey the mocked server returns. Exactly one signing POST, signed PUT and Product PATCH total (all intercepted).
- **Critical limitation:** if the server is also stale after tab closure, no frontend-only signal can establish whether the old PATCH committed. The user could still manually re-upload later. Server-side idempotency/transaction lookup would be needed to guarantee cross-tab duplicate prevention; that is outside authorized Phase 6 frontend scope.

#### Verification

| Gate | Final result |
|---|---|
| Three new scenarios × Chromium, Firefox and WebKit | **9/9 PASS** (final combined run) |
| Focused Chromium regression, previous Product upload/readback scenarios + three new suites | **13/13 PASS** (two separately run batches: 6/6 + 7/7) |
| Frontend Vitest | **334/334 PASS**, 84 files |
| TypeScript `tsc --noEmit` | **PASS** |
| ESLint | **PASS** |
| `git diff --check` | **PASS** |
| Next.js Production Build | **30/30 generated pages PASS** |
| Actual Product/Storage writes | **0**, all business mutations intercepted |

The initial single-command all-13 regression invocation encountered an execution-tool error; it was rerun successfully in **two explicit batches**. The final combined 9-case Browser run is the only fully successful all-engine run used to archive new evidence. Intermediate failed attempts (including an internal Next.js development tooling POST in WebKit) are **not** claimed as passing.

#### Evidence and cumulative traceability

`frontend/quality-audit/.evidence/regression-20261017/inflight-stale-newtab/`

- **9 browser×scenario run folders**, each with `action-outcomes.json`, scenario metadata and screenshots.
- **42 screenshot files** (in-flight PATCH **5**, prolonged-stale **6**, closed-tab **3** per browser engine).
- `coverage-reconciliation.json` recalculated from **all retained Phase 6 ledgers** with `(actionId,state,role)` deduplication.

| Coverage dimension | Before this batch | After this batch |
|---|---:|---:|
| Canonical Action IDs with ≥1 scoped direct PASS | 257/257 | **257/257** |
| Unique Action / State / Role scoped PASS tuples | 469 | **483** (+14) |
| IDs with no direct scoped PASS | 0 | **0** |
| Certified exhaustive declared-state matrices | 0/257 | **0/257** |

Do not interpret 257/257 narrow ID presence as exhaustive acceptance.

#### Remaining Phase 6 gaps

Real owned-disposable backend PATCH transaction reconciliation/idempotency and multi-tab consistency, readback under genuine prolonged production outages, true screen-reader passes, native 200% browser zoom, manual UX/visual sign-off and all applicable Role/State/Viewport combinations remain **not certified**. Never claim business records, production object storage, or real database writes were exercised.

**Phase 6 stays IN PROGRESS. Final Diff Review stays PENDING.**

No Commit, Push, Deploy, backend mutation, database reset, production access, real object upload or deletion.

---

<a id="record-03-product-image-readback-recovery-report"></a>

## Product Image Readback Recovery

### Phase 6 — Product Image Post-Commit Readback Recovery

**Workspace:** UniStore_Hub via BDXA (local development only)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan status:** Phase 6 **IN PROGRESS**; Final Diff Review **PENDING**

#### Objective

Continue the active Phase 6 State Matrix after the product-image 503/500/409 upload-error work. This batch tests the materially different state in which a **signed object PUT and product imageKey PATCH succeeded**, but subsequent **GET Product readback fails or is stale**. A network readback failure is not proof that the earlier image commit failed; allowing another full upload can needlessly request a new object and mutate the product twice.

#### Defect reproduced and fix

An initial Chromium E2E against the pre-fix component failed: after a successful intercepted imageKey PATCH and synthetic GET 503, the UI presented a generic upload-error message and left the file/re-upload path enabled. It did not offer a readback-only retry, making duplicate signing/PUT/PATCH possible.

**Frontend changes**: `frontend/src/modules/products/product-image-upload-view.tsx`.

1. Track the **committed imageKey awaiting verification** only after the documented product imageKey PATCH returns successfully.
2. Immediately clear the selected file and disable the file chooser/full-upload button while readback verification remains unresolved.
3. Make post-commit readback failure explicitly informational: **“บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ ... ไม่ต้องอัปโหลดไฟล์ซ้ำ”**. Give users **“ตรวจสอบข้อมูลล่าสุดอีกครั้ง”** instead of restarting signing/PUT/PATCH.
4. Retry verification via **GET Product only**; permit repeated 503 and stale successful GET responses while retaining the one acknowledged imageKey.
5. Check `refreshed.imageKey === committedImageKey` before clearing the verification state and announcing normal success. A successful HTTP GET with a stale imageKey is **not** accepted as complete.
6. Maintain accessible terminal feedback with the previously implemented one-shot focus/scroll handling. Preserve definitive session failure handling and existing upload validation/requests. Do not introduce backend, API, RBAC, tenant or business-semantic changes.

The follow-up GET is a **verification read**, not an additional write. The frontend never claims successful readback unless the matching key is observed.

#### Verified Browser state transitions

New E2E: `frontend/e2e/quality-audit/product-image-readback-recovery.spec.ts`.

| Baseline Action | New scoped state | Observed behavior |
|---|---|---|
| `FE-UX-18-15` — Product image upload | `committed-readback-503` | Signing POST, signed PUT and imageKey PATCH acknowledged; first post-commit GET 503. Message says saved but not yet verified, file input disabled, original Upload absent, retry-only GET visible and focused |
| `FE-UX-18-15` | `verify-retry-503` | Second GET 503 retains retry-only state and focused warning; POST/PUT/PATCH remain at one request each |
| `FE-UX-18-15` | `verify-stale-get` | GET 200 returns **old imageKey**; still not marked verified, safe retry available |
| `FE-UX-18-15` | `get-only-recovery-success` | Fourth post-commit GET returns the matching key; success focused, badge refreshed, normal upload control restored to disabled/no-file state |

Each state was directly exercised with 390×844 viewport and synthetic Organization Admin session in **Chromium, Firefox and WebKit**. Reconciliation deduplicates the browser-engine repeats: **4 new unique Action/State/Role PASS tuples**.

**Backend/network isolation:** Synthetic Store/Product GET responses, signing POST, signed PUT and imageKey PATCH were all intercepted by Playwright. Each browser engine observed **1 intercepted signing POST**, **1 intercepted signed PUT**, **1 intercepted imageKey PATCH**, **4 post-commit verification GETs**, and **0 unexpected non-GET browser requests**. No object was stored in S3; no real Product persisted.

#### Unit and Regression verification

Added one unit regression case in `frontend/src/modules/products/product-image-upload-view.test.tsx` verifying a successful imageKey PATCH followed by failed GET and successful GET-only retry. It also checks that signing, PUT, and PATCH are **each invoked only once** and that the product refresh callback happens only after successful readback.

| Gate | Result |
|---|---|
| New E2E Chromium / Firefox / WebKit | **3/3 PASS** |
| Focused Chromium regression: previous Product upload success/403, negative-state matrix and new readback-only recovery | **3/3 PASS** |
| Frontend Unit Tests | **324/324 PASS**, 83 test files |
| TypeScript / ESLint / `git diff --check` | **PASS** |
| `npm run build` | **30/30 generated pages PASS** |
| Actual object-storage or business writes | **0** |

#### Archived evidence and cumulative reconciliation

Retained files: `frontend/quality-audit/.evidence/regression-20261017/product-image-readback-recovery/`

- Three engine-specific evidence sets, each with the source Action ledger and scenario metadata.
- **12 screenshots** (4 states × 3 engines).
- `coverage-reconciliation.json` with counts recomputed from **all retained Phase 6 action ledgers**, not added arithmetically without deduplication.

| Cumulative measure | Previous | Current |
|---|---:|---:|
| Action IDs with >=1 direct scoped state PASS | 257/257 | **257/257** |
| Unique scoped `(actionId,state,role)` PASS tuples | 441 | **445** |
| Action IDs without any direct PASS | 0 | **0** |
| Certified complete `all-declared-states` matrices | 0/257 | **0/257** |

**Remaining acceptance work:** Real disposable-owned local storage/consistency behavior, expired/aborted signing and upload requests, pending timeouts, reload/navigation during unverified commit, native 200% browser zoom, screen readers and exhaustive role/state/viewport combinations. The UI differentiates acknowledgement from verified readback, but synthetic responses **do not prove eventual consistency or actual durable persistence**.

**Phase 6 remains IN PROGRESS. Final Diff Review remains PENDING.** No Commit, Push, Deploy, production access, real backend/object write or deletion.

---

<a id="record-04-product-image-session-reload-report"></a>

## Product Image Session Reload

### Phase 6 — Product Image Committed-Readback: Switch, Navigate, Reload and Late GET

**Workspace:** UniStore_Hub (local BDXA)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan:** Phase 6 — Design Polish & Full Regression **IN PROGRESS**; Final Diff Review **PENDING**

#### Goal and observed regression risk

Continue the previous post-PATCH readback-only recovery. That version held the acknowledged imageKey in React state only. Switching Products (the same uploader subtree), leaving the page, or doing a full reload could destroy that state. If Product GET was still stale/unavailable, the user could be offered another full image upload even though PATCH had succeeded. A GET begun for Product A could also return after the user selected B and attempt to update the shared editor.

This batch adds scoped, same-tab recovery **only after acknowledged imageKey PATCH**, plus stale-response protection. It does not change the API/tenant/RBAC/data contracts.

#### Application changes

- **New** `frontend/src/modules/products/product-image-pending-verification.ts`: save/read/clear a single pending *imageKey*, namespaced by **authenticated user ID, organization ID, and product ID** in `sessionStorage` (not `localStorage`). Never store the original file, signed URL or access token. Storage operations fail safely if browser privacy settings disable storage.
- **Updated** `frontend/src/modules/products/product-image-upload-view.tsx`: persist the marker only after PATCH acknowledgement; restore it after client render on re-entry/reload; block file selection and full upload until restored state is resolved; retry Product **GET only** and require exact `imageKey` match before clearing the marker. Never announce verification success after an old-key GET. A mounted-component guard prevents a delayed GET from calling the parent product-refresh callback after switching/unmounting.
- **Updated** `frontend/src/modules/products/product-view.tsx`: key the uploader subtree by `organizationId:productId`, resetting local file/progress state when the selected product changes.
- **Updated** `frontend/src/modules/products/product-image-upload-view.test.tsx`: align legacy unit interaction timing with the new hydration-ready state, rather than clicking Upload before its form is enabled. Old validation/upload unit cases remain in place.
- **New** `frontend/src/modules/products/product-image-pending-verification.test.ts`: two tests for user/org/product isolation and clearing only the verified marker.

#### Browser evidence

New E2E specs:
- `frontend/e2e/quality-audit/product-image-session-reload.spec.ts`
- `frontend/e2e/quality-audit/product-image-inflight-product-switch.spec.ts`

| Action ID | Narrow state | Checked behavior |
|---|---|---|
| `FE-UX-18-15` | `committed-session-marker` | Successful synthetic PATCH + failed GET produces scoped tab marker and readback-only warning |
| `FE-UX-18-15` | `other-product-independent` | Selecting Product B shows B's own clean upload form; A's pending marker never leaks |
| `FE-UX-18-15` | `return-to-product-pending` | Returning to Product A restores GET-only Retry and prevents another upload |
| `FE-UX-18-15` | `route-exit-return` | Navigate away then back and open A; committed marker survives same-tab routing |
| `FE-UX-18-15` | `full-reload-restored` | Full page reload restores safe A verification-only state after editor reopen |
| `FE-UX-18-15` | `reload-stale-get-only` | Stale GET 200 does not clear the marker, enable new upload or claim success |
| `FE-UX-18-15` | `verified-clears-scoped-marker` | Matching GET 200 clears marker; editing returns to normal with updated image badge |
| `FE-UX-18-15` | `inflight-readback-pending` | Product A has a pending delayed GET after one acknowledged PATCH |
| `FE-UX-18-15` | `switch-while-A-inflight` | B opens while A GET is pending, with no inherited loading/error controls |
| `FE-UX-18-15` | `late-A-result-ignored-for-B` | Resolving old A GET cannot overwrite selected Product B after unmount |
| `FE-UX-18-15` | `return-A-verified` | A can reopen with verified key, no second POST/PUT/PATCH |

**11 new unique Action/State/Role PASS tuples**, repeated on Chromium, Firefox and WebKit but counted only once after deduplication. Each run uses isolated synthetic Product/Store GET and fully intercepted signing POST, signed PUT and imageKey PATCH. Each scenario issues **one** signing POST, one signed PUT and one PATCH per browser, with **zero real business writes**.

##### Acceptance checks

| Gate | Result |
|---|---|
| Product switch/reload E2E: Chromium/Firefox/WebKit | **3/3 PASS** |
| Delayed GET versus Product switch E2E: Chromium/Firefox/WebKit | **3/3 PASS** |
| Focused Chromium regression: previous upload/403, 503/500/409, readback-only, switch/reload, delayed-switch | **5/5 PASS** |
| Frontend Unit Tests | **326/326 PASS** across 84 files |
| TypeScript / ESLint / git diff --check | **PASS** |
| Next.js Production Build | **30/30 pages PASS** |
| Actual backend business/object-storage mutations | **0** |

Unit output contained React Testing Library asynchronous `act(...)` diagnostic warnings during the upload-view tests, but no failing assertions. These warnings are not a claim of fully clean async unit diagnostics.

#### Retained traceability

Evidence: `frontend/quality-audit/.evidence/regression-20261017/product-image-session-and-inflight/`

Contains 6 browser×scenario directories, 6 `action-outcomes.json` ledgers, scenario JSON, **33 screenshots**, and `coverage-reconciliation.json`. Counts recomputed from all retained Phase 6 ledgers:

| Scope | Prior | Now |
|---|---:|---:|
| Source Action IDs with at least one narrow direct PASS | 257/257 | **257/257** |
| Distinct `(actionId,state,role)` PASS tuples | 445 | **456** |
| IDs still entirely without scoped proof | 0 | **0** |
| Fully certified exhaustive baseline matrices | 0/257 | **0/257** |

#### Explicit limitations and handoff

The marker is **per browser tab/session** and best-effort when storage is available. Closing the tab, denying session storage, signing in as a different user, or a network transition *before* PATCH acknowledgement is **not** proven recoverable by this change. Actual back-end object consistency/durable writes, access control against malicious requests, production conditions, browser-native 200% zoom, screen-reader review, all applicable roles/viewports/declared states and user visual acceptance remain outside this narrow synthetic coverage.

**Phase 6 remains IN PROGRESS; Final Diff Review remains PENDING.** No Commit, Push, Deploy, database changes, destructive activity or real business uploads.

---

<a id="record-05-product-image-storage-denied-report"></a>

## Product Image Storage Denied

### Phase 6 — Product Image Recovery with Denied Session Storage

**Workspace:** UniStore_Hub (local BDXA)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan:** Phase 6 **IN PROGRESS**, Final Diff Review **PENDING**.

#### Objective

Continue the committed-imageKey readback recovery from the prior Phase 6 batch. Explicitly verify the privacy-restricted Browser case in which storage for product-image pending verification markers is denied or full. Preserve the core distinction: PATCH may already have saved an image even when a later GET has not verified it. Avoid presenting persistence across reload as guaranteed when Session Storage cannot be used.

#### Changes

1. `frontend/src/modules/products/product-image-pending-verification.ts`: `savePendingProductImage` now returns **true** if marker storage succeeds, or **false** if Session Storage rejects the write (including a privacy policy or quota exhaustion). It still catches failed read/delete. Marker keys remain scoped to **user, organization and product**, without persisting file bytes, token or signed URL.
2. `frontend/src/modules/products/product-image-upload-view.tsx`: On a successfully acknowledged product imageKey PATCH, retain the expected key in the mounted component and explicitly track when it **could not** be persisted for a later revisit. While verification is pending and marker storage failed, show a visible warning that the user should finish verifying before leaving the page and that state may not survive navigation/reload. Full upload/file selection remains disabled during this in-memory readback-only recovery; retry performs **GET Product only** until the expected imageKey matches. Remove the storage warning on successful verification. The focus/scroll effect now guards the optional `scrollIntoView` primitive; without it keyboard focus still works.
3. `frontend/src/modules/products/product-image-upload-view.test.tsx`: wrap async upload actions in React Testing Library `act` so mock Promise completions are owned by the test before assertions. **No longer emits the previous async act warnings** in the isolated upload test.
4. `frontend/src/modules/products/product-image-pending-verification.test.ts`: two additional direct unit assertions covering **SecurityError** (GET/SET/REMOVE) and **QuotaExceededError**. Both return a safe failure without claiming durable marker storage.

#### Browser scenario — scoped live UI, synthetic backend

New E2E: `frontend/e2e/quality-audit/product-image-storage-denied.spec.ts`.

The browser permits the existing local test-role login session but overrides only marker-key `sessionStorage.getItem/setItem/removeItem` to throw `SecurityError`. All Product/Store reads are synthetic; signed URL, POST, PUT, PATCH are intercepted and answered locally.

| Action | State | Verified behavior |
|---|---|---|
| `FE-UX-18-15` | `storage-denied-committed-503` | One acknowledged synthetic PATCH followed by GET 503; saved-but-unverified message; truthful storage warning; error focus; input disabled, original Upload absent; GET-only Retry present |
| `FE-UX-18-15` | `storage-denied-stale-get` | Retry GET 200 with old imageKey retains warning and blocks a duplicate upload; no additional POST/PUT/PATCH |
| `FE-UX-18-15` | `storage-denied-get-recovered` | Matching GET 200 confirms saved key; focused success, warning removed, editor restored; writes remain at one signing POST, one signed PUT and one imageKey PATCH |

Performed independently on **Chromium, Firefox and WebKit (3/3 PASS)** at a 390×844 viewport. The stored evidence contains **9 screenshots**, **3 action-outcome ledgers** and browser scenario metadata. Every unexpected non-GET browser request is denied: **0 real business writes**.

Storage namespacing by distinct user ID, organization ID and product ID was covered in existing direct unit tests (reconfirmed by the full run). **An actual sign-out/sign-in using a different user account was not performed** in this batch; do not call that scenario tested.

#### Verification after final fixes

| Gate | Result |
|---|---|
| New Browser E2E Chromium / Firefox / WebKit | **3/3 PASS** |
| Focused Chromium regression: Storage-denied + earlier reload, readback and negative upload matrix | **4/4 PASS** |
| Frontend Unit Tests | **328/328 PASS**, 84 files, no unhandled errors |
| TypeScript, ESLint, `git diff --check` | **PASS** |
| Production Build | **30/30 static pages PASS** |
| Real writes | **0** |

A prior full-suite run uncovered a JSDOM asynchronous `TypeError: scrollIntoView is not a function` even though assertions passed; this was **fixed** by feature-testing the scroll primitive and the full test suite was rerun cleanly afterward. The initial full test run **was not** counted as PASS.

#### Reconciliation / evidence

`frontend/quality-audit/.evidence/regression-20261017/image-storage-denial/`

| Measurement | Previous | Now |
|---|---:|---:|
| Source Action IDs with at least one narrow scoped PASS | 257/257 | **257/257** |
| Unique `(actionId,state,role)` PASS tuples | 456 | **459** |
| Source IDs with no direct PASS | 0 | **0** |
| Exhaustive full-state baseline matrices certified | 0/257 | **0/257** |

The three new state/role tuples are deduplicated across browser engines and come from retained ledgers.

#### Limitations / next Phase 6 work

**The warning is intentional, not a recovery guarantee:** without available Session Storage, the in-memory pending key **cannot be promised to survive component unmount, tab closure or reload**. The backend may reflect the saved image, but this batch has not certified server-side durable consistency or the behavior of a stale server read after re-entry. Concurrent sign-in changes, an interrupted/potentially acknowledged PATCH response and server-side permission verification also remain under-tested. Native browser zoom 200%, real screen-reader audits, network interruption, high-risk role×state×viewport combinations and human visual sign-off are still required to certify all 257 matrices.

**Phase 6 stays IN PROGRESS. Final Diff Review stays PENDING.** No Commit, Push, Deploy, backend modification, production connection, object-store write or deletion.

---

<a id="record-06-product-upload-negative-matrix-report"></a>

## Product Upload Negative Matrix

### Phase 6 — Product Image Upload Negative-State & Keyboard Focus Matrix

**Workspace:** UniStore_Hub via BDXA (local only)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Plan:** Phase 6 — Design Polish & Full Regression **IN PROGRESS**; Final Diff Review **PENDING**

#### Goal

Expand direct high-risk State Matrix evidence beyond the prior **257/257 Action IDs with >=1 narrow PASS** and **434 unique `(Action ID, state, role)` PASS tuples**, without claiming that all declared state combinations are complete. This batch targets the Organization Admin's product-image input and upload action, including 320 CSS-pixel layout constraints.

#### Confirmed defect and focused remediation

**Defect reproduced by failing Chromium Browser test:** After a failed signing POST, an error alert appeared visually but the keyboard focus remained elsewhere (typically at the upload trigger). At the bottom of the Product editor, the user could miss the terminal error, particularly on narrow viewports.

**Fix:** `frontend/src/modules/products/product-image-upload-view.tsx`

- Terminal upload **Error/Success** Notice gets a focusable `tabIndex=-1` wrapper with `data-product-upload-feedback`.
- A one-shot, cancelled-on-cleanup `requestAnimationFrame` focuses and scrolls that result **only after an explicitly initiated upload request finishes**, including failed signing, failed signed PUT, failed imageKey PATCH, or success.
- Selecting/changing a file clears stale feedback and the pending focus request. Initial render does not steal focus. Existing client validation, API paths, POST/PUT/PATCH semantics, file constraints, signed upload flow and RBAC remain unchanged.

#### Direct Browser State Matrix

New test: `frontend/e2e/quality-audit/product-image-upload-negative-cases.spec.ts`

| Source action | Newly exercised narrow state |
|---|---|
| `FE-UX-18-14` file input | **5 MiB + 1 byte** PNG rejected without network activity; subsequent valid PNG selection restores enabled upload |
| `FE-UX-18-15` image upload | Intercepted signing **503**; feedback focused/visible and file preserved |
| `FE-UX-18-15` image upload | Intercepted signed-object PUT **500**; feedback focused/visible, no product PATCH |
| `FE-UX-18-15` image upload | Intercepted product imageKey PATCH **409**; feedback focused/visible, can retry |
| `FE-UX-18-15` image upload | Retry eventually produces synthetic signing POST/PUT/PATCH/GET **success**, focused completion and updated image status |
| `FE-UX-18-15` image upload | On **320×700 CSS-pixel viewport**, feedback is within the viewport when focused and the page has no horizontal overflow |

**7 newly evidenced unique Action/State/Role PASS tuples**, observed independently on Chromium, Firefox and WebKit; no double counting per engine.

**Important:** 320 CSS pixels is a constrained effective-width responsiveness test. **It is not a native browser 200% zoom test** and does not certify screen-reader behavior.

#### Safety

- Organization Admin authenticated with an existing **local test session** only. All product/store GETs are synthetic.
- Browser intercepted every image-signing POST (4), signed-image PUT (3) and product PATCH (2) **per engine**. Their HTTP 503/500/409/200 replies were mock responses; no actual object-storage upload or DB write took place.
- Every unexpected non-GET browser request was denied. Real business writes: **0**.
- No production, remote API, data deletion, database reset, Commit, Push or Deploy.

#### Verification

| Gate | Result |
|---|---|
| New upload matrix on Chromium / Firefox / WebKit | **3/3 PASS** |
| Chromium regression: earlier image upload + new matrix + Staff/OrgAdmin/PlatformAdmin shell | **5/5 PASS** |
| Frontend Unit suite | **323/323 PASS**, 83 files |
| TypeScript, ESLint, `git diff --check` | **PASS** |
| Production Build | **30/30 static pages PASS** |

Evidence at `frontend/quality-audit/.evidence/regression-20261017/product-upload-negative-matrix/`: three Browser ledgers, **21 screenshots** (7 per browser), scenario JSON and `coverage-reconciliation.json`.

Cumulative **retained-ledger** reconciliation:

- **257/257 Action IDs** with at least one narrow direct state PASS (unchanged).
- **441** distinct `(actionId,state,role)` PASS tuples, up from 434 (**+7**).
- **0** IDs without any narrow direct PASS.
- **0/257** comprehensive `all-declared-states` matrices certified. Baseline matrix entries remain `NOT_TESTED`.

#### Further high-risk gaps in Phase 6

Native browser 200% zoom, assistive-technology manual review, stalled/aborted requests and long-lived network loss, image upload success followed by readback failure (without redundant persistence), every applicable role×state×viewport, and safe, owned-disposable local backend storage/security semantics are still **NOT TESTED** or only partially evidenced. Do not close Phase 6 based on this incremental matrix.

**Phase 6 stays IN PROGRESS; Review Diff remains PENDING.**

---

<a id="record-07-upload-race-ambiguous-patch-report"></a>

## Upload Race Ambiguous Patch

### Phase 6 — Late 401 Race & Ambiguous Product Image PATCH

**Workspace:** UniStore_Hub (BDXA, local test environment)\
**Date:** 2026-10-18 (Asia/Bangkok)\
**Task:** UX/UI Remediation — WEB_QUALITY_AUDIT\
**Plan:** Phase 6 **IN PROGRESS**, Final Diff Review **PENDING**.

#### Goals

1. Reproduce and prevent old GET responses, including `401 TOKEN_EXPIRED`, from logging out a different signed-in account or updating a different Product editor after its initiating component has become obsolete.
2. Prevent unintentional duplicate Product Image signing/upload/PATCH when the server **might have committed an imageKey PATCH** but the HTTP response is lost or returns 5xx.
3. Address the prior intermittent Vitest `ERR_REQUIRE_ESM` blocker without unnecessary dependency or lockfile changes.

#### Findings and remediation

##### Late GET / account identity

The readback request is pinned to the authenticated **initiating user ID**. Its success/error handler checks both owner identity and active mounted component before invoking `onProductRefreshed`, deleting verification markers, showing stale results or logging out on a definitive session failure. The existing upload lifecycle similarly checks ownership at intermediate boundaries.

- A new **deterministic unit test** holds a readback GET, switches the mocked authenticated user from Org Admin A to Staff B, then returns a synthetic `401 TOKEN_EXPIRED`. The new user is **not** logged out, no Product callback executes, and A's pending marker survives.
- A second deterministic unit test returns a **successful stale GET** after the same identity change and likewise prevents the old response from altering B's UI or clearing A's marker.
- A new Browser test holds an Organization Admin Product A GET after an acknowledged synthetic PATCH, switches editor selection to Product B, then releases a synthetic `401 TOKEN_EXPIRED`. The **active session and Product B remain accessible**, while A's marker can be recovered for GET-only verification. This Browser scenario is **product switching**, not a second simultaneous login; cross-identity protection itself is verified by the unit test.

##### PATCH acknowledgement lost

After successful signed PUT, the frontend now saves a **conservative, scoped pending imageKey marker immediately before dispatching PATCH**. If PATCH returns successfully, it proceeds with the previously established GET verification. If the PATCH response is a network error or 5xx, the UI does **not** claim successful persistence or invite another full upload; it shows **“ยังยืนยันผลการบันทึกไม่ได้”**, blocks another file upload and offers **GET-only Product verification**.

- A matching GET confirms the imageKey and clears the marker.
- A stale/nonmatching GET retains the uncertain state instead of claiming the image is saved.
- On reload, recovered markers use **neutral wording** because they may represent either an acknowledged PATCH or a response lost during PATCH.
- Definitive rejected PATCH errors such as HTTP `409` clear the provisional marker, including if their originating editor has unmounted, and retain the pre-existing retry UX.
- An additional unit test proves that a lost PATCH response leads to **only one signing POST, one signed PUT and one imageKey PATCH**, followed by GET-only recovery; another unit test verifies that definitive `409` removes the provisional marker and preserves the selected file for correction.

These are frontend guardrails, not a server-side idempotency guarantee. They do not prove actual database persistence, durable object-storage consistency or the outcome of a request that never reaches the server.

#### Source changes

- `frontend/src/modules/products/product-image-upload-view.tsx` — conservative pre-PATCH marker, uncertain-vs-acknowledged result wording, GET-only verification on ambiguous response, identity-safe asynchronous completion and marker cleanup on definite rejection.
- `frontend/src/modules/products/product-image-upload-view.test.tsx` — **4 new focused unit tests**: old-account 401; old-account success; ambiguous PATCH; definitive PATCH 409.
- `frontend/e2e/quality-audit/product-image-stale-session-response.spec.ts` — new Browser race regression.
- `frontend/e2e/quality-audit/product-image-ambiguous-patch.spec.ts` — new Browser synthetic 503-after-commit regression.
- `frontend/e2e/quality-audit/product-image-session-reload.spec.ts` — adjusts expected readback wording after reload to reflect the more accurate uncertain-commit state.

No backend contracts, API endpoints, tenancy rules, auth token semantics, production settings or dependencies were changed.

#### Execution evidence

| Verification | Final result |
|---|---|
| New late-401 Browser E2E, Chromium/Firefox/WebKit | **3/3 PASS** |
| New ambiguous PATCH Browser E2E, Chromium/Firefox/WebKit | **3/3 PASS** |
| Focused Chromium Browser regression (new and existing upload/readback, reload, 409, storage denial, cross-account) | **7/7 PASS** |
| Full frontend Vitest Unit Tests | **334/334 PASS** across 84 files |
| TypeScript `tsc --noEmit` | **PASS** |
| ESLint | **PASS** |
| `git diff --check` | **PASS** |
| Next.js production build | **30/30 static pages PASS** |
| Real Product/Storage mutations | **0** — all Browser signing POST, PUT and PATCH requests were intercepted |

**Vitest note:** The earlier `ERR_REQUIRE_ESM` error did not recur when Vitest was run independently. The full suite and target tests passed repeatedly in this run; no unverified change to Vite/Node dependencies was attempted. The prior error's intermittent root cause is **not established**.

#### Retained evidence

`frontend/quality-audit/.evidence/regression-20261017/late-401-ambiguous-patch/`

- **6 scenario-by-Browser directories** with machine-readable `action-outcomes.json` and scenario metadata.
- **24 screenshots**, 12 each for late-401 and ambiguous-PATCH (4 states × 3 Browser engines per scenario).
- `coverage-reconciliation.json` derived by deduplicating all retained Phase 6 evidence, not from counting Browser engines multiple times.

| Cumulative metric | Previous | Current |
|---|---:|---:|
| Canonical Action IDs with ≥1 narrow direct PASS | 257/257 | **257/257** |
| Unique `(actionId,state,role)` PASS tuples | 464 | **469** |
| Action IDs with zero narrow PASS | 0 | **0** |
| Certified exhaustive all-declared-state matrices | 0/257 | **0/257** |

The +5 reflects newly evidenced **scoped** states. Common pending and existing stale-read states are deduplicated, even though each Browser reran them.

#### Unverified or out-of-scope conditions

- True cross-account Browser navigation with a live old GET completing precisely after the second login. The deterministic unit test checks the identity boundary; the Browser test checks delayed 401 after Product switching, separately.
- Actual PATCH timeout against an owned disposable backend fixture and transaction reconciliation/idempotency, especially if both the response and `sessionStorage` are unavailable.
- Closing the tab before the pre-PATCH marker is stored, if the request was never dispatched, and any multi-tab consistency beyond the existing tab-scoped behavior.
- Browser-native 200% zoom, real screen-reader acceptance, visual human sign-off and all applicable state×role×viewport matrices.

**Phase 6 remains IN PROGRESS. Review Diff remains PENDING.** No Commit, Push, Deploy, production access, database reset, real object-storage upload, or mutation of existing business records.
