# UniStore Hub — Auth And Customer

> Historical implementation, testing and decision evidence consolidated by subject. This is a review archive, **not** the product/API specification. Current security and NOT_TESTED limitations remain binding.

---

## UniStore Hub — Campus Commerce A — Login & Register Review


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub`, BDXA local only
**Plan task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 9 — Login/Register redesign with intentional form UX
**Scope result:** PASS for frontend-only auth presentation and guarded UI states. No Commit, Push, Deploy, backend change, API/session/return-route change, AWS/Production access, tenant modification, account creation or credential transmission.

### Source review / baseline

- Original `frontend/src/modules/auth/auth-form.module.css` had **915 lines** containing multiple stacked generations of auth layout CSS overrides, starting with `width: min(100%,2048px)`, tall full-viewport marketing intro and right-side form with a much smaller card.
- Baseline screenshots saved to `frontend/quality-audit/.evidence/campus-commerce-authentication/before-login-390.png`, `before-login-1440.png`, `before-register-3840.png`. In the observed 3840 CSS-pixel viewport the page was at most 2048 CSS pixels wide, with a much narrower form. The mobile entry also retained a visually weighty header before the form.
- Existing auth behavior was already implemented in `login-form.tsx`, `register-form.tsx`, `auth-entry-state.tsx`, `auth-validation.ts` and `return-route.ts`. Phase 9 deliberately **preserves all existing authentication/session flows and returnTo semantics**; Phase 10 separately owns the reported interrupted protected-order workflow and any redirect/guard fixes.

### Implemented

1. Replaced the old fragmented 915-line CSS with one concise, coherent **Campus Commerce A** `frontend/src/modules/auth/auth-form.module.css`, retaining all class names used by Login, Register, already-authenticated Auth Entry, and shared Frame.
2. **Desktop/4K:** centered split-screen editorial/commerce layout with balanced sections and a capped overall `1880px` canvas. Text-based `UniStore Hub` brand sits in the dark introductory panel, while the form lives in a semantic `--surface` card capped at `542px` normally / `560px` on extra-wide displays. This prevents 4K-size input fields, horizontally stretched copy, and unintentionally tiny cramped panels.
3. **Mobile/tablet:** below `850px`, the intro becomes a compact readable full-width top panel, the long 3-step marketing list hides visually, and the form becomes a comfortable near-full-width card. No horizontal overflow at `320,390,768,1024,1440,1920,2560,3840` CSS widths. At 200% root text size, the tested `390,768,960,1920` widths remained free of horizontal document overflow.
4. **Accessibility and state presentation:** consistent Light/Dark text/background hover contrast, 44px+ actionable password-visibility toggle and secondary links, 50px primary CTA, visible focus rings and reduced-motion overrides. Existing required fields, browser autocomplete, password show/hide `aria-pressed`, field-linked error summary/focus, server Error Notice, inline errors, and pending disabled labels were kept; form elements now explicitly set `aria-busy={pending}`.
5. **Direct/return-context:** preserves Login ↔ Register links carrying the sanitized same-origin `returnTo` path and existing contextual description, plus a return-to-store link. Actual successful sign-in/create-account and post-login protected-order continuation **are not claimed as verified** here and are Phase 10 or end-to-end auth responsibilities.
6. **Already logged in:** existing `AuthEntryState` loading and account/role-specific next-task cards retain their controls, labels, and permissions, and inherit the same cohesive form CSS. User-initial avatar is an account identity indicator, not a brand logo.
7. No fabricated brand illustration/logo, no modified backend contracts, API writes, or seeded record changes.

### Verification matrix

| Check | Result |
|---|---|
| Full frontend Vitest | **376/376 PASS** in 93 test files |
| TypeScript `tsc --noEmit`, ESLint | PASS |
| Next.js production/static Build | **30/30 pages PASS** |
| Phase 9 guarded Chromium UI/E2E | **4/4 PASS** (Login and Register, Light/Dark) |
| Responsive Phase 9 | **320,390,768,1024,1440,1920,2560,3840px** per form/per theme; no reported overflow, bounded form width |
| 200% font-size Phase 9 | **390,768,960,1920px** per form/per theme; no reported overflow |
| ReturnTo/context and interaction | Browser-verified cross-form `returnTo` query preservation; show/hide password; invalid submit linked Error Summary; mocked server error; busy/disabled submit; zero real auth writes |
| 28 canonical routes × 5 viewports read-only Responsive/A11y | **140/140 captures, PASS**; 28 routes, zero recorded browser API writes, broken images, unexpected page errors, automated axe findings and horizontal overflow |
| Full Phase 2–9 guarded Chromium suite | **31/31 PASS** on final isolated rerun. Evidence: `regression-foundation-to-authentication-final.log` and `regression-foundation-to-authentication-final.exit.txt` = 0 |
| `git diff --check` | PASS |

First concurrent full-suite run showed 30/31 with a Playwright trace-file `ENOENT` caused by concurrent matrix activity sharing `test-results`. The single failed Phase-5 icon test independently passed 4/4. The full 31-test suite was then rerun by itself and passed **31/31**; no UI failure was identified. Prior overlapping runner output was not used as a PASS claim.

Phase 9 screenshot/evidence folder: `frontend/quality-audit/.evidence/campus-commerce-authentication/`. Targeted Browser Test: `frontend/e2e/quality-audit/authentication-and-return.spec.ts`. Full suite and route matrix logs stored in the same evidence folder.

### Limitations / NOT TESTED

- Browser auth POST actions are **intercepted and simulated only**, with 401 responses. They never reach live Backend and do not create accounts; this ensures no destructive/test data, credentials, or session mutation. Test results cannot guarantee authentic live signup/login to DB.
- This phase does **not** repair the previously observed protected `/orders/new?...` return path after successful login, stale session hydration, forbidden role, or blocked-route recovery: that is Phase 10, which has a dedicated E2E/guard investigation plan.
- Responsive/A11y matrix is automated smoke coverage only; not comprehensive human screen-reader certification, cross-browser Firefox/Safari tests, native browser zoom on physical 4K monitor, or real flow from authenticated role permissions.
- Previously documented local dev security-risk acceptance remains in place and UI test pass is **not** security clearance for deployment.
- All changes are inside UniStore_Hub workspace; no Commit, Push or Deploy.

**Next:** Phase 10 — interrupted protected-route returnTo recovery.

---

## UniStore Hub — Campus Commerce A — Auth ReturnTo & Protected Order Recovery


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub` (local BDXA only)
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 10 — Fix auth returnTo and protected-route continuation
**Outcome:** PASS for Phase 10 frontend session/navigation scope; final regression, responsive matrix and build passed. No Commit, Push, Deploy, real account, order, database or backend changes.

### Source-derived root causes

1. `LoginForm` and `RegisterForm` linked “กลับไปหน้าที่กำลังใช้งาน” directly to their `returnPath`. When that destination was a protected `/orders/new` and the user was still anonymous, clicking Back immediately re-entered `AuthenticatedBoundary` and showed another unauthorized state. The previous `UnauthorizedState` took very little vertical space above a huge empty canvas, without a visible public product recovery.
2. `AuthSessionStore.restore()` memoized one in-flight `/me` promise. `establish(newToken)` wrote the new token then called `restore()`; if old-token `restorePromise` was still pending, it reused that result. A late stale success or stale `TOKEN_EXPIRED` could replace the newly authenticated state or clear the new token. Logout could also race an older in-flight `/me` success.
3. `AuthenticatedBoundary` checked API failure flags before testing `auth.status === "loading"`, potentially displaying the wrong recovery UI during hydration. The Order page had no contextual recovery variant. `OrderCreateView` treated forbidden product fetches as generic errors and did not explicitly recover after definitive session invalidation.

### Work completed

1. **Safe anonymous back navigation** — `frontend/src/modules/auth/return-route.ts` now exports `getUnauthenticatedExit`. The helper keeps the actual successful sign-in `returnTo` untouched, but sends an anonymous user leaving a protected checkout to the public product when both authoritative organization and product UUIDs are well formed. Campaign ID is carried only when valid; incomplete checkout and all other protected routes safely fall back to `/`. Both Login and Register use this helper in their secondary Back link, so there is no anonymous checkout/login loop.
2. **Hydration-safe contextual order gate** — `frontend/src/modules/auth/auth-recovery.tsx`, `auth-recovery.module.css`, `access-boundary.tsx`, `use-auth-navigation-context.ts` and `frontend/src/app/orders/new/page.tsx` provide an order-specific recovery kind. During hydration a proper Loading heading is shown; for anonymous checkout, a compact, keyboard-accessible, Mobile–4K state offers sign-in preserving all query values plus public product fallback; forbidden conditions show explicit recovery without bypassing access rules. The text-only `UniStore Hub` brand stays consistent.
3. **Race-free session bootstrap** — `frontend/src/modules/auth/session.ts` versions restore generations. A new login invalidates any outstanding previous `/me` operation; a stale response (including `TOKEN_EXPIRED`) cannot overwrite or clear the newer valid session. Logout also invalidates old in-flight session requests. Repeated calls inside the same generation are still deduplicated; authoritative `/me` is still required before opening protected content.
4. **Protected order data validation** — `frontend/src/modules/orders/order-create.tsx` logs out on definite `TOKEN_INVALID` / `TOKEN_EXPIRED` errors and re-enters the guarded sign-in step; a genuine 403 has distinct forbidden UI with public store and personal-order-list exits. The order service and business validation remain unchanged.
5. **Tests** — Added focused unit tests for stale expired-token login race, logout restoration race, exact `returnTo` including variant/campaign/product IDs, public Back links and external returnTo rejection. Added read-only Chromium E2E for anonymous checkout → login → exact order continuation, slow authenticated session, expired-token fallback, already-authenticated Login page continuation and forbidden product response under Light/Dark. Auth Login POST in the E2E is intercepted and supplied a **synthetic token**; `GET /me` and public store/product/campaign API also receive synthetic responses. Order/create POST is blocked. The test does **not** establish that the local Production/Backend login succeeds with real credentials.

### Verification

| Gate | Result |
|---|---|
| Focused Phase-10 Chromium | **8/8 PASS**, Light/Dark: initial 6/6 in `targeted-v2.log`, plus 2/2 existing-session Login entry; all confirmed in final 39/39 suite |
| Full frontend Vitest | **382/382 PASS**, 94 test files |
| TypeScript | PASS |
| ESLint | PASS, zero warnings after unused import was removed |
| `git diff --check` | PASS |
| Phase 2–10 guarded browser regression | **39/39 PASS** on final serial rerun; `regression-foundation-to-return-navigation-final.log`, `regression-foundation-to-return-navigation-final-exit.txt` = 0 |
| Next.js Static Build | **30/30 Pages PASS** |
| 28 canonical routes × 5 widths read-only Responsive/A11y | **140/140 PASS**, 28 routes, 0 browser writes, overflows, page errors, automated axe findings or broken images; `route28-final-exit.txt` = 0 |

Browser evidence: `frontend/quality-audit/.evidence/campus-commerce-return-navigation/`, including anonymous-order Mobile screenshot and correctly authenticated order-ready Desktop screenshot; there is no claim that a real order was submitted.

### Limits and next action

- This is a **frontend-only** fix of navigation/Session/Guard logic. It neither changes authorization policy nor creates DB entries. A true end-to-end live signup/login/checkout would require explicitly approved controlled credentials and test data. No personal credentials were supplied or transmitted during QA.
- Native physical 4K, full screen-reader/manual accessibility and production browser matrix remain beyond automated Chromium checks.
- An existing wide-screen order-ready layout overlap visible in the read-only screenshot is an acknowledged **Phase 11 customer journey visual issue**, not silently represented as repaired in Phase 10.
- `AuthSessionStore` still falls back to anonymous on a non-definitive `/me` network failure while preserving the access token; a comprehensive offline/retry product policy would be a separate reliability decision, not an auth bypass.
- Existing dev-only dependency security risk acceptance remains in place; no claim of production readiness or security clearance is made.

**Next:** Phase 11 — Customer journey, checkout/order, payment, pickup and notification UX, only after Phase 10 closes successfully.

---

## UniStore Hub — Campus Commerce A — Customer Workspace Review


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub`, local BDXA
**Plan task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 11 — Customer Journeys and Account Workspace
**Status:** PASS — scoped customer UI changes verified with final Browser Regression and 28-route smoke matrix. No Commit, Push, Deploy, backend changes, production access, database mutation or seeded-record deletion.

### Initial browser finding

The previous `/orders/new` screenshot (Phase 10) showed the product image fallback overlapping the product title and summary at desktop width. Root cause: `order-create.module.css` combined a width-dependent CSS Grid with an intrinsically sized 4:3 image stage and `min-height:250px`. The stage could grow beyond the expected Grid track while text remained in its neighbor. Phases 2–10 had not asserted sibling-media collision.

### Implemented in the frontend

- **Checkout** (`frontend/src/modules/orders/order-create.module.css`): limit large-screen image stage to 220px and remove conflicting minimum height; constrain both media and text columns to their actual Grid tracks; wrap long content; compact 82px image on Mobile; convert purchase progress to semantic Light/Dark backgrounds with readable text and focus. **Unchanged:** authoritative product, variant, campaign OPEN gating, quantity, derived pricing, order payload, authenticated submission.
- **My Orders / Order Detail** (`frontend/src/modules/orders/order-tracking.module.css`): predictable readable 4K max width, clearer vertical spacing, responsive actionable rows, consistent filter hover/focus, meaningful amount/ID text wrapping, accessible links and natural stacking for narrower layouts. Cancellation still requires the existing modal confirmation and still honors server conflict refresh.
- **Payment** (`frontend/src/modules/payments/payment-view.module.css`): responsive saved order amount, clear proof upload form, bounded file input/feedback, high-contrast focused actions and amount/ID wrapping. The direct upload pipeline and status guards remain unchanged.
- **Pickup** (`frontend/src/modules/pickups/pickup-view.module.css`): QR/token and information panels remain bounded even with long credential text; Token remains selectable and is displayed only from the existing authoritative eligible backend state. Not-ready state still prevents disclosure.
- **Notifications** (`frontend/src/modules/notifications/notifications-view.module.css`): action-first inbox layout, stacked actions on narrow screens, hover/focus contrast, row text wrapping; mark-read and filters remain strictly bound to existing API semantics.
- Shared Campus Commerce A design authority is updated in `frontend/.interface-design/system.md`. All changes are **frontend CSS only** plus read-only/blocked-mutation Playwright regression; no business logic or data contracts changed.

### Browser QA scope

`frontend/e2e/quality-audit/customer-order-workspace.spec.ts` injects a synthetic authenticated session and **intercepts all Backend API calls**. The only mutation is a *fully mocked browser-local PATCH mark-read response*, and every other write is blocked before reaching the server. Nothing is submitted to a real API.

Tests cover both Light/Dark with 390, 768, 1024, 1440, 3840 CSS-pixel views for each of the six customer route families (60 measured points, all no-overflow and no image/title overlap):
1. Checkout, with programmatic check that actual image and product-summary rectangles do **not** overlap at any covered size.
2. Orders, including actionable-first listings and status filters.
3. Single Order, including opening and dismissing the destructive Cancel confirmation dialog **without confirming the cancellation**.
4. Payment, including filename input visibility and required-proof validation **without uploading or submitting payment**.
5. Pickup, including valid token/QR display and no early credential when not ready.
6. Notifications, including filter and simulated mark-read; plus explicit empty state.

Additional blocked-response checks simulate Orders HTTP 503 Error → user-triggered Retry → loaded list, Pickup not ready, and empty notification inbox. Evidence screenshots and metrics are under `frontend/quality-audit/.evidence/campus-commerce-customer-journeys/`.

A browser fixture initially leaked its own in-memory mock read-at state between Light and Dark test executions. It was corrected to clone the mock record set per browser context. **No actual backend request or database write was involved.**

### Gates

| Gate | Result |
|---|---|
| Phase 11 targeted read-only Chromium E2E | **4/4 PASS** (2 account-flow + 2 empty/error/retry cases; Light/Dark) |
| Frontend full Vitest | **382/382 PASS**, 94 test files |
| TypeScript `tsc --noEmit` | PASS after fixing two TypeScript-only test fixture declarations |
| ESLint | PASS with zero warnings |
| Next.js Static Build | **30/30 pages PASS** |
| Git Diff Check | PASS |
| Phase 2–11 guarded Browser Regression | **43/43 PASS**, durable `regression-foundation-to-customer-journeys-e2e.log` and `regression-foundation-to-customer-journeys-exit.txt` = 0 |
| 28 Routes × 5 Widths Responsive/A11y | **140/140 PASS**, 28 routes, 0 unexpected outcomes, reported overflow, browser errors, broken images, axe violations or real writes; `route28-exit.txt` = 0 and `route28-matrix.json` |

### Limits

- Client-side testing cannot prove actual payment approvals, failed S3 presigned upload recovery, verified pickup handoff, real order cancellation or multi-device consistency. Those require explicitly approved isolated integration test data.
- The 28-route automated smoke matrix is not a certification of all Role/Modal/Popup states, physical 4K native zoom, assistive technology or cross-browser Safari/Firefox.
- No new text-only brand logo, visual asset or fake product photo was inserted, and no existing QA/demo data was modified.
- Existing acknowledged local development dependency security risk remains outside this frontend-only phase. No production deploy is authorized.

**Next phase after final gates:** Phase 12 — Staff Operations Workspace. Do not implement/commit without a new request.

---

---

## Design-branch visual migration — Authentication & Account Entry

**Active BDXA task:** `task_1febbe60-581b-42d0-8765-506f38b362f0`, current `main` visual migration. Design source was local `design` branch; only presentation was imported selectively, not React auth flows.

### Scope implemented

- `frontend/src/modules/auth/auth-form.module.css`: moved Login/Register/account-entry shared composition from the historical green split card to a formal two-column Orange/Neutral campus style, with surface-colored intro, accessible brand/label colors, aligned form card, native password-toggle focus/disabled behavior, and semantic light/dark tokens. Preserved all existing content, autoComplete fields, validators, pending/error summary handling, return destination and account role actions.
- `frontend/src/modules/auth/auth-recovery.module.css`: styled the already-existing protected-order recovery header, guidance badge, neutral panel and secondary actions consistently, keeping the current loading/unauthorized/forbidden flow, origin-specific checkout return and link targets.
- `frontend/e2e/quality-audit/authentication-and-return.spec.ts`: updated one obsolete pre-existing text-only-logo assertion (which failed before this pass, Light and Dark) to verify the approved decorative logo beside accessible UniStore Hub text; added no-teal computed-color checks, screenshot coverage at 320/768, and guarded recovery geometry/overflow and screenshot coverage at 320/390/768/1440/3840. Kept all interception/real-write denial logic.

### Verified tests and evidence

- Playwright Chromium `authentication-and-return.spec.ts` Auth Layout: **4/4 PASS** Light/Dark. Covers Login/Register at 8 responsive widths (320–3840), root-font-size 200% (390/768/960/1920), native password type-toggle, autocomplete, validation/Error Summary focus, submit pending and simulated rejected auth POST.
- `authentication-and-return.spec.ts` Return to Order: **8/8 PASS**, Light/Dark. Covers anonymous Checkout → Login → same Checkout with variant/query preserved, delayed session, expired-token removal and recovery, forbidden resource guarding, and already-authenticated return.
- `auth-form-states.spec.ts`: **1/1 PASS** with browser-only synthetic 503/409 auth responses, pending/disabled/error summary/retry and zero unintended backend mutations.
- `account-role-entry.spec.ts`: **7/7 PASS** across Guest Login/Register and Customer/Staff/Organization Admin/Platform Admin, plus membership-scoped organization selection; all writes blocked.
- Browser screenshots: `frontend/quality-audit/.evidence/campus-commerce-authentication/{light,dark}-{login,register}-{320,390,768,1440,3840}.png`, error screenshots; `frontend/quality-audit/.evidence/campus-commerce-return-navigation/{light,dark}-expired-recovery-{390,1440}.png`; browser-only controlled state, no real credential use.
- Final local verification: Frontend Vitest **384/384 PASS across 94 test files**; TypeScript, ESLint, Git diff check and artifact naming guard **PASS**; Next.js static build **31/31 generated routes/assets**.

**Unchanged:** auth service endpoints/payloads, session version and token storage, returnTo sanitization, protected-route recovery, API contracts, RBAC, browser password-manager integration, customer checkout logic. No real signup/login, purchase, payment, or other backend writes in tests. **NOT_TESTED:** Firefox/WebKit, hardware/browser zoom and manual screen-reader assessment, live production auth credentials, complete 28-route/action-state parity, security signoff.

**Handoff:** Auth/Account Entry presentation has been migrated in the local uncommitted `main` worktree. No Commit, Push, Deploy or backend/AWS edits.

---

## Customer Workspaces & Commerce Journey — Design-branch visual migration

**Active BDXA task:** `task_1febbe60-581b-42d0-8765-506f38b362f0`. This is a scoped visual migration on `main` from the **appearance** of local `design`, while `main` remains the authority for customer order creation, order status precedence, guarded payment slip upload, cancel confirmation, pickup token visibility, notification read/unread semantics, filtering, cursor retry and account/session/returnTo behavior. Previous uncommitted phases remain preserved. No merge or cherry-pick from `design`.

### Scoped implementation

- `frontend/src/modules/orders/order-create.module.css`: formal neutral checkout header, accessible Orange/current-step emphasis, bordered product/review/confirmation cards and clear authoritative amount. Kept real variant/quantity summary, product/image collision fixes, mobile confirmation ordering, existing form and dialogs.
- `frontend/src/modules/orders/order-tracking.module.css`: neutral Orders and Detail headers, row surfaces, clear task-needed Orange accent, restrained lifecycle journey, payment/status amount panels and accessible navigation. Kept action-first order ordering/filter logic and cancellation confirmation.
- `frontend/src/modules/payments/payment-view.module.css`: cohesive payment header, amount, file input, upload/review and status steps; preserve file selection, server state, rejected slip retry, validation and guarded upload.
- `frontend/src/modules/pickups/pickup-view.module.css`: neutral proof/QR/token panels, received state and wrapping. No changes to eligibility or token disclosure guard.
- `frontend/src/modules/notifications/notifications-view.module.css`: editorial no-gradient inbox heading, restrained row/control surfaces, Orange unread indicators and actionable CTA using `--action-primary`. No changes to event ordering, filters, paging, or mark-read API action.
- `frontend/src/modules/orders/customer-journey-nav.module.css`: shared neutral/orange secondary task tabs, preserving original role-aware destinations and mobile compact layout.
- `frontend/e2e/quality-audit/customer-order-workspace.spec.ts`: extended existing guarded browser suite to cover all viewport sizes **320/390/768/1024/1440/1920/2560/3840** on six routes in both themes (96 route/width/theme checks), no checkout media/title overlap, and computed surface-vs-gradient regression on customer headings. No new milestone-named files.

### Local verification

- **Targeted Playwright Chromium:** Customer workspace 4/4 PASS (six routes, Light/Dark and empty/error/retry/credential guard), Create Order 1/1, Payment Slip 1/1, Cancel Dialog 1/1, Pickup 1/1, Notification Actions 1/1, My Orders filters/cursors 1/1: **10/10 PASS**. Dark Mode / 200%-text representative suite **1/1 PASS**. All browser tests intercept or deny write requests; the workspace suite simulates one mark-read mutation in a local browser response only. No real API/DB mutation, order confirmation, payment, file upload or pickup handoff occurred.
- **Unit:** frontend Vitest **384/384 PASS** across 94 suites; TypeScript **PASS**, ESLint **PASS**, Next.js static Build **31/31 routes PASS**, artifact naming **PASS**, Git diff whitespace check **PASS**.
- Screenshots and measurement JSON stored in `frontend/quality-audit/.evidence/campus-commerce-customer-journeys/`; reviewed actual `light-checkout-1440.png`, `dark-orders-390.png`, `light-notifications-1440.png`. More test-run evidence is in `frontend/test-results/quality-audit/` (ignored).
- No API, auth/session, backend, DB, infrastructure/AWS or shared contract changes. No Commit, Push or Deploy.

### Explicit limitations

**NOT_TESTED:** real backend checkout/payment/pickup mutation, Safari/Firefox/WebKit and physical device zoom, every modal/state/role permutation, manual assistive-technology verification, production/staging authorization; these remain subsequent QA/release gates. Chromium desktop emulation at 3840 CSS pixels is not proof of a physical 4K display. This pass verifies presentation and safety guards, not live payment or fulfillment correctness.

**Handoff:** Customer visual styling and guarded browser tests complete for this scoped visual phase. Next work belongs to Staff Operations; no automatic continuation.
