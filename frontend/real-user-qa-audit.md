# UniStore Hub — Full Frontend Real-User QA Audit

> Task: Full Frontend Real-User UX/UI & E2E Audit  
> Scope: `frontend/**` changes only  
> Testing target: local disposable Dev Mode unless a later phase explicitly qualifies another environment

## Phase 1 — Baseline and environment readiness

### Contract baseline

Required project contracts were reviewed before QA work:

- `../SPEC.md`
- `../AGENTS.md`
- `../docs/specs/00-shared-contracts.md`
- `../docs/api/API_CONTRACT.md`
- `../docs/specs/frontend/SPEC.md`
- `../docs/specs/dev/SPEC.md`
- `../docs/specs/testing/SPEC.md`
- `AGENT.md`
- existing `frontend-report.md`, `ux-ui-audit.md`, `a11y-audit.md`, and `.interface-design/system.md`

Authoritative QA guardrails confirmed:

- frontend is Next.js + TypeScript with static export and `trailingSlash: true`
- local frontend API base is `http://localhost:4000/api/v1`
- authentication is real Express/JWT auth; there is no dev auth bypass
- frontend role visibility is UX only; backend remains authorization authority
- tenant access must remain backend-validated
- product images and payment slips use backend-issued pre-signed URLs with direct S3 transfer semantics
- required remote states include loading, success, empty, error, unauthorized, and forbidden
- high-impact actions require confirmation UX
- business lifecycle rules, prices, payment approval, and pickup validation are backend-authoritative

### Current route surface

The frontend currently exposes 28 user-facing routes, plus the root layout and generated not-found page.

Primary route groups:

- public/customer: landing, login, register, store, product, campaign, create order, customer orders/detail/payment/pickup, notifications
- organization/staff: organization select, dashboard, settings, staff, stores, products, campaigns, orders/detail, payments, production, pickups, audit
- platform admin: summary, organizations, users

### Existing automated baseline

Before adding any browser E2E harness:

- `npm test`: **77 test files / 273 tests passed**
- `npm run lint`: **passed**
- `npm run build`: **passed**
- Next.js production build generated **30/30 static pages**
- repository working tree was clean before this audit artifact was created
- runtime Node.js: **v24.20.0**, compatible with the project Node >=22 contract

Existing tests are strong component/service/helper/static-export coverage, but the frontend package does **not** currently include Playwright or another real-browser E2E framework.

### Local Dev Mode readiness

Canonical Compose stack is already running and healthy:

- Frontend: `http://localhost:3000` — HTTP 200 / healthy
- Backend: `http://localhost:4000` — healthy
- Backend health response: `{"success":true,"data":{"status":"ok"}}`
- LocalStack: `http://localhost:4566`
  - DynamoDB: running
  - S3: running
  - SQS: running
- Notification worker: running
- bootstrap service: exited 0
- deterministic seed service: exited 0

The seed created 15 deterministic items and includes dedicated local accounts for:

- Platform Admin: `platform-admin@local.unistore.test`
- Customer: `customer@local.unistore.test`
- Organization Admin: `org-admin@local.unistore.test`
- Staff: `staff@local.unistore.test`

The shared seed credential is intentionally kept in backend dev seed source and is not duplicated into this frontend QA artifact.

Seeded domain data includes:

- active demo Organization
- active Store
- active Product + Variant
- OPEN Campaign suitable for local E2E

The live public storefront API successfully returned the deterministic demo Organization.

### Test-data observation

The persistent LocalStack data currently also contains disposable organizations from earlier E2E runs. This does not block QA, but Phase 2/3 must avoid assuming the datastore contains only canonical seed data.

Real-browser tests should therefore:

- use deterministic seeded accounts for role-entry smoke checks where appropriate
- create uniquely prefixed disposable records for destructive/cross-role scenarios
- avoid matching list items by position
- identify records by stable IDs or unique test-run labels
- never depend on old E2E leftovers
- keep destructive/reset behavior local-only

### Existing cross-system test capability

The repository already contains cross-system Node test suites under `../tests/**`, including:

- API contract tests
- tenant/security tests
- frontend interaction/static-export checks
- Dev Mode smoke tests
- core E2E flow
- payment reject/resubmit flow
- notification/tenant flow

Those suites are useful contract evidence, but they are not a substitute for this task because they do not perform full browser-driven click/keyboard/responsive interaction coverage across all 28 frontend routes.

### Phase 1 outcome

**READY for Phase 2.**

No product behavior or UI was changed in Phase 1.

Next phase should add the minimum frontend-local real-browser QA harness with:

- Playwright
- Chromium baseline
- trace on failure
- screenshot on failure
- console/page-error capture
- unexpected failed-request / 4xx / 5xx capture
- reusable role/session helpers
- artifact directories excluded from source control
- configuration that targets the already-running local Compose stack without introducing a dev-only auth bypass

## Phase 2 — Real-browser QA harness

Added a frontend-local Playwright harness without changing application business behavior.

### Harness implementation

- added `@playwright/test` as a frontend dev dependency
- installed the Chromium browser runtime for the local QA machine
- added `playwright.config.ts` with a Chromium 1440×900 baseline project
- trace, screenshot, and video are retained on failure
- HTML and list reporters are enabled
- default target remains the existing local Compose frontend at `http://localhost:3000`
- browser artifacts are written to ignored `test-results/` and `playwright-report/` directories

### Browser diagnostics

`e2e/support/qa-fixture.ts` captures:

- browser console errors
- uncaught page errors
- failed requests
- HTTP responses with status >= 400
- intentional browser request cancellation (`net::ERR_ABORTED`) as a distinct diagnostic event

Request cancellation remains attached as evidence but is excluded from the default unexpected-error assertion because React/route cleanup can intentionally abort an in-flight fetch.

### Role/session helpers

`e2e/support/seed-auth.ts` can establish Customer, Staff, Organization Admin, and Platform Admin browser sessions against the deterministic local seed.

The helper:

- logs in through the real `/auth/login` API
- stores the returned JWT in the same `sessionStorage` key used by the application
- sets the seeded Organization context only for Staff/Organization Admin
- permits implicit seed credentials only on localhost
- requires explicit E2E credential/configuration overrides for non-local targets
- does not bypass Backend authentication or authorization

### Runner isolation

Vitest is now explicitly limited to `src/**/*.test.{ts,tsx}` so Playwright specs are not incorrectly collected by the unit-test runner.

Added commands:

- `npm run test:e2e`
- `npm run test:e2e:headed`
- `npm run test:e2e:ui`

### Phase 2 verification

- Playwright harness smoke: **2/2 passed**
- existing Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**

The first harness run correctly exposed intentional `net::ERR_ABORTED` fetch cancellation as a false-positive network failure. The diagnostic model was refined to preserve those events as evidence while separating them from real request failures.

**READY for Phase 3 — Route and interaction inventory.**

## Phase 3 — Route and interaction inventory

Phase 3 froze the route/control inventory before any product remediation.

### Source inventory

Created `interaction-coverage-matrix.md` covering all **28 canonical user-facing routes**.

The source pass enumerated:

- **207 route-specific interaction definitions/families**
- shared public StorefrontHeader interactions separately
- shared authenticated ApplicationShell interactions separately
- role-specific differences for Customer, Staff, Organization Admin, and Platform Admin
- conditional actions that cannot all appear in one seed state, including Campaign lifecycle transitions, Payment review decisions, Pickup confirm, Organization approval, pagination, retries, and destructive confirmations

The 207 value is the stable source-level denominator. Dynamic per-row actions are counted once per route family rather than once per current database record.

### Real-browser inventory

Added `e2e/interaction-inventory.spec.ts`.

The inventory test:

- uses Chromium against the real local Compose frontend/backend
- authenticates through the real JWT login flow
- creates one disposable Customer Order for entity-dependent routes
- cleans the disposable Order after the scan
- visits every canonical route
- adds role-specific duplicate snapshots for routes whose visible behavior differs by role
- captures visible links, buttons, inputs, selects, textareas, and semantic interactive roles
- excludes the Next.js development-toolbar control from product coverage
- records browser diagnostics
- writes the runtime evidence to ignored `test-results/interaction-inventory.json`

Latest inventory result:

- canonical routes: **28**
- route/role snapshots: **33**
- visible rendered control instances: **529**
- inventory browser test: **passed**

Rendered-control totals are expected to vary with dynamic list data. They are evidence, not the stable unique-action denominator.

### Expected Payment diagnostic

The disposable Customer Order is initially `PENDING_PAYMENT` with no Payment record.

Opening `/my/payment/` therefore calls the documented own-Order Payment endpoint and receives `404 PAYMENT_NOT_FOUND`. Chromium also reports the failed-resource console entry.

This is a documented initial Payment state and is **not a product defect**. Later journey assertions must allow this specific expected case while continuing to flag unrelated 404/console failures.

### Inventory tooling adjustment

Playwright HTML/report artifacts are now ignored by both Git and ESLint. This prevents generated report JavaScript from being mistaken for application source during lint verification.

### Phase 3 verification

- Playwright full frontend-local suite: **3/3 passed**
- interaction inventory: **28 routes / 33 role snapshots / 529 rendered controls**
- source interaction inventory: **207 route-specific families**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- application/business behavior changed: **none**

**READY for Phase 4 — Anonymous and authentication journeys.**


## Phase 4 — Anonymous and authentication journeys

Phase 4 exercised the public/authentication layer as a real browser user. No product fixes were made.

### Coverage executed

Added `e2e/auth-journeys.spec.ts` with **8 real-browser journey tests** covering:

- Storefront discovery as Anonymous through seeded Store → Campaign → Product
- direct access to a protected Customer route
- Unauthorized → Login → Register return-context preservation
- Login client-side validation and Error Summary focus
- Register client-side validation and Error Summary focus
- password show/hide behavior
- real seeded Customer Login through the visible form
- post-login return to the protected destination
- session restoration after full page reload
- authenticated Login-page alternate state
- Logout and re-protection of Customer routes
- real local Customer Registration through the visible form
- post-registration protected return and reload/session restore
- unsafe external `returnTo` sanitization
- public authentication navigation at **375px** with horizontal-overflow check

The support helper now exposes the existing local seed credentials to browser tests without weakening application authentication. The credentials remain local-first and continue to require explicit configuration for non-local targets.

### Real registration side effect

The Register journey intentionally creates a unique disposable Customer account in the local backend because no frontend-owned delete-user contract exists. It does not touch production data and uses the `@local.unistore.test` namespace.

### Initial test-run triage

The first Phase 4 run reported three failures. Investigation showed **none were product defects**:

1. Login validation used a strict text locator even though the same message is intentionally present in both Error Summary and inline field error.
2. Register validation had the same locator ambiguity.
3. The mobile test expected a dedicated “ร้านค้า” topbar link at 375px, while the current responsive CSS intentionally hides that item at ≤620px and keeps the UniStore Hub brand as the Storefront/home affordance.

Only the E2E assertions were corrected. Application UI, routing, auth rules, and business behavior were not changed.

### Phase 4 result

The corrected Phase 4 suite completed:

- Anonymous/public Storefront navigation: **PASS**
- protected-route authentication boundary: **PASS**
- Login/Register return routing: **PASS**
- Login validation/focus behavior: **PASS**
- Register validation/focus behavior: **PASS**
- real UI Login: **PASS**
- session restore: **PASS**
- authenticated auth-entry state: **PASS**
- Logout: **PASS**
- real UI Registration: **PASS**
- unsafe external return-path sanitization: **PASS**
- 375px public auth navigation: **PASS**
- verified frontend product defects in this phase: **0**

### Phase 4 verification

- dedicated authentication/browser suite: **8/8 passed**
- full Playwright frontend suite: **11/11 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- application/business behavior changed in Phase 4: **none**

**READY for Phase 5 — Customer commerce journey.**


## Phase 5 — Customer commerce journey

Phase 5 exercised the Customer commerce experience with a real Chromium browser and the real local Express/LocalStack stack. Product behavior was not changed.

### Browser coverage added

Added `e2e/customer-commerce.spec.ts` and `e2e/support/customer-commerce-fixtures.ts`.

The Phase 5 suite covers:

- authenticated Product selection with real Variant/Campaign/quantity controls
- invalid Order quantity validation without sending a create request
- real Order creation through the visible UI
- real My Orders history/detail round-trip
- Payment file-required validation
- unsupported Payment slip type validation
- valid PNG slip selection
- real pre-signed S3/LocalStack direct upload from the browser
- real Payment submission and refresh into `PAYMENT_REVIEW`
- cancellation dialog Back path
- real Customer cancellation of a disposable `PENDING_PAYMENT` Order
- absence of Customer cancellation after `PAYMENT_REVIEW`
- fresh-Customer empty Orders state
- controlled Orders 500 error + visible retry + recovery to real backend data
- invalid missing-orderId recovery without an entity request
- disposable real lifecycle setup through `READY_FOR_PICKUP`
- Customer Pickup QR generation and Pickup Token display
- real `READY_FOR_PICKUP` notification
- Unread → mark read → Read notification workflow with Backend verification of the exact notification ID

### Finding F-005-01 — Order validation summary focus

**Severity: P2 — frontend-owned, remediation deferred**

- Route: `/orders/new/`
- Role: Customer
- Preconditions: valid Product, Variant, and OPEN Campaign
- Reproduction: enter quantity `0`, then press “ยืนยันสร้างคำสั่งซื้อ”
- Expected: validation renders and `#order-create-error-summary` receives focus
- Actual: validation renders correctly, but real Chromium focus remains elsewhere
- Impact: keyboard and screen-reader users can miss the newly rendered validation summary
- Evidence: reproduced repeatedly in Playwright; the Customer test attaches `finding-phase5-order-error-summary-focus`

The source already attempts to focus the summary with `requestAnimationFrame`, and the existing unit test expects focus. The real-browser result indicates a likely render/focus timing issue. Per audit constraints this defect is recorded now and **not fixed during discovery**.

### Fixture safety

The READY_FOR_PICKUP Customer state cannot be produced by advancing the deterministic seed Campaign because doing so would close the shared seed and break later phases.

The test therefore creates uniquely named disposable local Organization/Store/Product/Variant/Campaign records, approves the Organization with the local Platform Admin seed, uses real Staff approval, advances the disposable Campaign, and then inspects the Customer UI.

This setup:

- runs only against the local integration target
- does not alter production data
- does not add frontend auth/business-rule bypasses
- leaves business lifecycle authority in Backend APIs
- intentionally leaves disposable local records because no frontend-owned delete contract exists

### Browser-runner isolation

As the suite grew, running separate browser files concurrently caused state/timing interference because they share deterministic accounts and the same stateful LocalStack services. These failures did not reproduce when each journey ran alone.

Playwright is now configured with one worker so integrated journeys execute serially and produce deterministic audit evidence. This is QA tooling behavior only; no application behavior changed.

### Phase 5 verification

- Customer commerce browser suite: **5/5 passed**
- Phase 4 auth/browser regression: **8/8 passed**
- harness + 28-route interaction inventory regression: **3/3 passed**
- final serialized full Playwright invocation: **16/16 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **1 P2**
- product/business behavior changed in Phase 5: **none**
**READY for Phase 6 — Staff operational journey.**


## Phase 6 — Staff operational journey

Phase 6 exercised Staff workflows with real Chromium and the local Express/LocalStack backend. Product behavior was not changed.

### Browser coverage added

Added `e2e/staff-operational.spec.ts` and `e2e/support/staff-operational-fixtures.ts`.

Coverage includes:

- Staff Organization selection and role-appropriate landing
- Staff-only operational navigation
- direct access checks against all Organization Admin-only route families
- Organization Order filtering by Campaign, Customer, and Status
- clear-filter behavior
- real Order detail navigation
- verification that Staff does not receive the Admin-only cancel action
- real Payment queue filtering
- Payment detail selection
- temporary Payment slip-link generation
- approve confirmation flow with Backend verification of `APPROVED` / `PAID`
- reject dialog Back behavior
- reject-reason validation
- reject confirmation with Backend verification of `REJECTED` / `PAYMENT_REJECTED`
- READY Pickup filtering by Token/Status
- Pickup detail verification
- normal Pickup confirmation to `RECEIVED`
- stale duplicate-confirm scenario where another worker confirms first
- expected 409 handling, refresh to current RECEIVED state, and removal of the confirm action

### Finding F-006-01 — Reject Payment “กลับ” does not close

**Severity: P2 — frontend-owned, remediation deferred**

- Route: `/org/payments/`
- Role: Staff
- Reproduction: select a `PENDING_REVIEW` Payment → open Reject Payment → press “กลับ”
- Expected: dialog closes without changing Payment state
- Actual: dialog remains visibly open; the empty reason also validates on blur
- Impact: the secondary Back action is misleading and forces Staff to use the separate close control
- Evidence: reproduced repeatedly in Chromium and attached as `finding-phase6-payment-reject-back-does-not-close`

The test uses the dialog close control only as a recovery path so the remaining rejection journey can continue. No product fix was applied.

### Finding F-006-02 — Reject validation summary does not receive focus

**Severity: P2 — frontend-owned, remediation deferred**

- Route: `/org/payments/`
- Role: Staff
- Reproduction: open Reject Payment → leave the reason empty → press “ยืนยันปฏิเสธ”
- Expected: `#payment-reject-error-summary` becomes focused
- Actual: validation renders but the real browser focus remains elsewhere
- Impact: keyboard/screen-reader users can miss the validation summary
- Evidence: reproduced in Chromium and attached as `finding-phase6-payment-reject-summary-focus`

This mirrors the real-browser focus-management issue recorded as F-005-01 on Customer Order validation and should be triaged for a shared timing/root-cause fix rather than independently patched UI symptoms.

### Permission result

The Staff account could use Orders, Payment Review, and Pickup work as intended. Direct visits to Dashboard, Organization Settings, Staff Management, Stores, Products, Campaigns, Production Summary, and Audit were blocked with the Forbidden state before Admin-only UI became usable.

### Fixture safety

Payment-review tests create uniquely registered local Customers and real Orders/Payments against the stable seed Organization/Campaign. Pickup tests use disposable Organizations/Campaigns so lifecycle transitions to READY/RECEIVED do not mutate the shared OPEN seed Campaign.

### Phase 6 verification

- Staff operational browser suite: **5/5 passed**
- final serialized full Playwright suite: **21/21 passed**
- Payment approve/reject Backend state verification: **passed**
- normal Pickup confirmation: **passed**
- duplicate Pickup confirmation and stale-state refresh: **passed**
- Staff direct Admin-route permission checks: **passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **2 P2**
- product/business behavior changed in Phase 6: **none**
**READY for Phase 7 — Organization Admin journey.**


## Phase 7 — Organization Admin journey

Phase 7 exercised Organization Admin configuration, catalog, lifecycle, audit, and operational authority through real Chromium against the local Express/LocalStack environment. Product behavior remained unchanged.

### Browser coverage added

Added `e2e/organization-admin.spec.ts` and `e2e/support/organization-admin-fixtures.ts`.

The Phase 7 journey covers:

- complete Organization Admin navigation surface
- real Dashboard Store/Campaign report filtering and clear-to-whole-Organization behavior
- Organization Settings invalid-name validation and real name/description persistence
- direct denial of all Platform Admin route families
- Staff invalid-email validation
- adding an existing account as Staff
- Staff → Organization Admin → Staff role changes with confirmation
- member removal with Backend verification that membership becomes `INACTIVE`
- Store create/edit/deactivate/reactivate confirmations
- Product create/edit/deactivate
- Product-image invalid MIME rejection
- real Product-image pre-signed PNG upload
- Variant create/edit/deactivate
- Campaign creation/editing
- explicit Campaign lifecycle confirmations through DRAFT → OPEN → CLOSED → PRODUCING → READY_FOR_PICKUP → COMPLETED
- Production summary for the real disposable Campaign
- Audit filtering by the Campaign resource ID and metadata expansion
- Organization Admin-only Order cancellation
- Organization Admin Payment approval
- Organization Admin Pickup confirmation with Backend `RECEIVED` verification

### Finding F-007-01 — Organization Settings validation summary does not receive focus

**Severity: P2 — frontend-owned, remediation deferred**

- Route: `/org/settings/`
- Role: Organization Admin
- Reproduction: clear Organization name → press “บันทึกการเปลี่ยนแปลง”
- Expected: validation renders and `#organization-settings-error-summary` receives focus
- Actual: validation renders correctly but real Chromium focus remains elsewhere
- Impact: keyboard/screen-reader users can miss the newly rendered summary
- Evidence: `finding-phase7-settings-error-summary-focus`

This belongs to the same likely focus-management timing family as F-005-01 and F-006-02.

### Finding F-007-02 — Staff-add validation summary does not receive focus

**Severity: P2 — frontend-owned, remediation deferred**

- Route: `/org/staff/`
- Role: Organization Admin
- Reproduction: enter an invalid member email → press “เพิ่มสมาชิก”
- Expected: validation renders and `#staff-add-error-summary` receives focus
- Actual: inline/summary validation renders but real Chromium focus remains elsewhere
- Impact: keyboard/screen-reader users can miss the validation summary
- Evidence: `finding-phase7-staff-error-summary-focus`

This is also part of the shared Error Summary focus family rather than a separate visual-design issue.

### Finding F-007-03 — Staff-management success feedback disappears after session refresh

**Severity: P2 — frontend-owned, remediation deferred**

Two Staff-management mutations reproduce the same feedback problem:

- Role change succeeds and the refreshed member card shows the new role, but the success Notice is no longer visible after `authSession.restore()`.
- Member removal succeeds and Backend returns the membership as `INACTIVE`, but the success Notice is no longer visible after the same session refresh.

Expected behavior is that the user receives persistent confirmation that the requested mutation finished successfully. Actual authoritative state is correct; only the post-action success feedback is lost.

Evidence:

- `finding-phase7-staff-success-feedback-disappears`
- `finding-phase7-staff-remove-success-feedback-disappears`

These two symptoms are grouped as one finding because they share the same Staff-management mutation + session-refresh path.

### Test-data and state safety

Configuration/catalog/lifecycle tests use newly created local Organizations so Store/Product/Campaign mutations do not corrupt the deterministic seed Organization. Platform Admin is used only to approve disposable Organizations where required.

The Admin operational Order/Payment tests use disposable Customer Orders against the stable seed Campaign. READY/RECEIVED Pickup testing uses a disposable Organization/Campaign because advancing the seed Campaign would break later audit phases.

### Phase 7 result

- focused Organization Admin browser suite: **5/5 passed**
- Dashboard filter post-change focused rerun: **1/1 passed**
- Settings Backend persistence: **passed**
- member role/removal Backend state: **passed**
- Product image upload + Product/Variant mutation flow: **passed**
- complete Campaign lifecycle through COMPLETED: **passed**
- Production + Audit flow: **passed**
- Admin-only Order cancel + Payment/Pickup operational flow: **passed**
- Platform Admin route denial for Organization Admin: **passed**
- final serialized full Playwright suite: **26/26 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **3 P2**
- verified new P0/P1 findings: **0**
- product/business behavior changed in Phase 7: **none**

**READY for Phase 8 — Platform Admin journey.**

## Phase 8 — Platform Admin journey

Phase 8 exercised Platform Admin summary, governance actions, read-only user inspection, navigation/scope behavior, and permission boundaries in real Chromium against the local Backend. Product behavior was not changed.

### Browser coverage added

Added `e2e/platform-admin.spec.ts`.

The Platform Admin journey covers:

- authoritative Platform Summary Organization/User totals
- Platform navigation across Summary, Organizations, and Users
- transition from authenticated Platform scope to the public Storefront and browser-Back restoration
- direct Organization Dashboard denial when the Platform Admin has no Organization membership
- `/org/select/` behavior for a Platform Admin with zero memberships
- real PENDING Organization approval dialog including cancel-before-confirm
- Backend verification that approval changes PENDING to ACTIVE
- real destructive suspension confirmation from ACTIVE to SUSPENDED
- Backend verification that the suspended Organization exposes no further transition action
- read-only Platform Users list with persisted user status and platformRole
- route-specific verification that Platform Users exposes no mutation controls
- cross-role Platform denial already covered by the Organization Admin phase

### Platform scope behavior

The seeded Platform Admin has `platformRole = PLATFORM_ADMIN` and no Organization memberships. In the authenticated application shell, Platform navigation is available alongside customer-account navigation. Direct Organization management access remains forbidden without a membership.

The public Storefront (`/`) intentionally uses the public Storefront shell instead of the authenticated application shell. Platform navigation therefore disappears while browsing the public landing page. Browser Back returns to the previous Platform page and restores the Platform shell. This was verified as expected behavior rather than recorded as a defect.

### Organization governance verification

A disposable Organization was created through the real Backend in PENDING state. On `/platform/organizations/`:

- opening Approve and choosing Cancel left the authoritative Backend status at PENDING
- confirming Approve changed the Organization to ACTIVE and removed the Approve action
- confirming Suspend changed the Organization to SUSPENDED
- after suspension the row exposed no further lifecycle action

This verifies both confirmation UX and the Backend-authoritative transition result without mutating the deterministic seed Organization.

### Platform Users verification

The `/platform/users/` route displayed the seeded Platform Admin as ACTIVE with `PLATFORM_ADMIN`. The user-list section contained no buttons, inputs, selects, or textareas, matching the current read-only API contract.

### Phase 8 findings

No new P0/P1/P2/P3 frontend issue was verified during the Platform Admin phase.

### Phase 8 result

- focused Platform Admin browser suite: **3/3 passed**
- Platform Summary matched live Backend totals: **passed**
- PENDING approval cancel path: **passed**
- PENDING → ACTIVE approval: **passed**
- ACTIVE → SUSPENDED suspension: **passed**
- Platform Users read-only contract: **passed**
- Platform Admin Organization permission boundary: **passed**
- full Playwright regression after Phase 8: **29/29 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **0**
- product/business behavior changed in Phase 8: **none**

**READY for Phase 9 — Cross-role golden journeys.**

## Phase 9 — Cross-role golden journeys

Phase 9 added `e2e/cross-role-golden.spec.ts` and exercised the critical multi-user business lifecycle in one real Chromium flow against the real local Backend.

### Golden flow

1. Organization Admin creates a disposable Organization through the authoritative API in `PENDING`.
2. Platform Admin opens `/platform/organizations/` and approves it through the confirmation dialog.
3. Organization Admin opens `/org/staff/` and adds the real seeded Staff account.
4. Disposable Store/Product/Variant/Campaign fixtures are created through the Backend for test setup; Phase 7 already browser-covered their CRUD UI.
5. Organization Admin opens the Campaign through UI and changes it from `DRAFT` to `OPEN`.
6. A disposable Customer opens the Product page, selects Variant/Campaign/quantity, creates a real Order, and uploads the first PNG Payment slip.
7. Staff filters the Payment queue by that Order and rejects the real Payment with the reason “สลิปไม่ชัดเจน กรุณาส่งหลักฐานใหม่”.
8. Customer reloads the Payment page, sees that exact rejection reason, uploads a replacement PNG, and uses “ส่งหลักฐานใหม่”.
9. Staff sees the Order return to review and approves the resubmitted Payment.
10. Customer reloads Order detail and observes `PAID` / “ชำระเงินแล้ว”.
11. Organization Admin drives the Campaign through `CLOSED` → `PRODUCING` → `READY_FOR_PICKUP` from the visible lifecycle UI.
12. Customer observes `READY_FOR_PICKUP`, opens Pickup, sees the real Token + generated QR, and sees the Ready for Pickup notification.
13. Staff filters Pickup by the propagated Token and confirms the handoff.
14. Customer reloads Order detail and observes `RECEIVED`; Backend confirms both Order and Pickup are `RECEIVED`.
15. Organization Admin completes the Campaign and filters Audit Log by the real Campaign ID.
16. Platform Admin reopens Platform Organizations and still sees the Organization as `ACTIVE`, confirming platform governance status remains independent from the internal commerce lifecycle.

### State-propagation verification

The flow verifies the required rejected-Payment resubmission path end to end, including exact rejection-reason propagation back to Customer and the same Order returning to Staff review before approval.

It also verifies the order-to-pickup lifecycle end to end, including Admin READY transition, Customer notification/QR/Token, Staff Pickup confirmation, Customer RECEIVED state, Campaign completion, and Audit visibility.

Backend lifecycle writes can become queryable a short moment after the UI has already rendered the successful transition. The test therefore polls authoritative Order/Campaign state after visible UI success. This was treated as expected integration timing because no stale or misleading user-visible state was reproduced.

### Phase 9 findings

No new P0/P1/P2/P3 frontend finding was verified during the cross-role golden journey.

### Phase 9 verification

- focused cross-role golden browser suite: **1/1 passed**
- rejected Payment → Customer resubmit → Staff approval: **passed**
- full Order → Payment → Production → READY → Pickup → RECEIVED path: **passed**
- Ready for Pickup notification propagation: **passed**
- Campaign completion + Audit visibility: **passed**
- Platform/Organization scope separation after commerce flow: **passed**
- full Playwright regression after Phase 9: **30/30 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **0**
- product/business behavior changed in Phase 9: **none**

**READY for Phase 10 — Responsive interaction audit.**

## Phase 10 — Responsive interaction audit

Phase 10 added `e2e/responsive-interactions.spec.ts` and repeated critical real-user interactions at **320, 375, 768, 1024, and 1440 px** widths.

### Responsive surfaces exercised

- Customer `/my/payment/`: authenticated shell, mobile navigation, upload file control, selected-file feedback, primary submit reachability, and sticky submit behavior on compact widths.
- Staff `/org/payments/`: Payment Order filter, apply action, queue item selection, detail panel, approval action, confirmation dialog sizing, and dialog actions.
- Organization Admin `/org/audit/`: page-level overflow boundary plus keyboard-focusable internal table scrolling.
- Application shell: mobile drawer at 320/375/768, body scroll lock while open, close control focus, focus return to the menu trigger, and desktop navigation at 1024/1440.

Across all five widths, tested primary actions remained reachable, confirmation dialogs remained within the viewport, and no tested page produced unintended document-level horizontal scrolling. Audit tables at 320/375/768 kept their wide content inside the table's own horizontal scroll region.

### Finding F-010-01 — Global CSS nesting disables responsive root tokens and intended global focus styling

**Severity: P2 — frontend-owned, remediation deferred**

`src/app/globals.css` has an unclosed heading rule immediately after:

`h1, h2, h3, h4 { color: var(--ink);`

The next top-level selectors are consequently parsed as nested CSS under the heading selector. This affects the later responsive `:root` token overrides and the global `:focus-visible` rule.

Runtime evidence:

- At 320px and 375px, `matchMedia('(max-width: 620px)')` is true, but the real root still reports `--control-height: 40px` and `--target-min: 40px` instead of the source-intended 44px mobile values.
- The Payment approval dialog's Cancel and Confirm actions therefore render at **40px high** on both 320px and 375px.
- Compact root spacing tokens also remain at their desktop values rather than the intended mobile overrides.
- A keyboard-focused Button matches `:focus-visible`, but the intended project 3px outline does not apply. Chromium falls back to its native **1px auto** outline at both 320px and 1440px.

The issue is currently non-blocking for the audited flows because the controls remain reachable and the browser still provides a default focus indicator, but it weakens intended mobile target sizing and focus consistency across the application.

Evidence captured by the responsive suite:

- `finding-phase10-dialog-touch-target-320`
- `finding-phase10-dialog-touch-target-375`
- `finding-phase10-global-focus-ring-320`
- `finding-phase10-global-focus-ring-1440`

No product fix was applied during discovery.

### Phase 10 verification

- responsive focused suite: **5/5 passed**
- critical viewport widths: **320 / 375 / 768 / 1024 / 1440**
- route-role viewport checks: **15 representative critical passes**
- mobile navigation drawer: **passed at 320 / 375 / 768**
- desktop navigation: **passed at 1024 / 1440**
- Customer file upload and compact sticky submit: **passed**
- Staff filter/detail/dialog interaction: **passed**
- Admin table horizontal scrolling: **passed where needed**
- unintended page-level horizontal overflow: **0 in tested surfaces**
- full Playwright regression after Phase 10: **35/35 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **1 P2**
- product/business behavior changed in Phase 10: **none**

**READY for Phase 11 — Negative, resilience, and accessibility audit.**

## Phase 11 — Negative, resilience, and accessibility audit

Phase 11 added `e2e/resilience-accessibility.spec.ts` and completed the remaining discovery checks around session failure, recoverability, upload rejection, duplicate activation, keyboard focus behavior, and reflow.

### Negative and resilience coverage

The focused browser suite verifies:

- a simulated real `401 TOKEN_EXPIRED` response clears the stored access token and exposes the protected-page login recovery state
- a network-aborted Customer Order request produces the recoverable Error State and succeeds after “ลองโหลดอีกครั้ง”
- a valid-but-missing Order UUID produces the real Backend `404` path and renders “ไม่พบคำสั่งซื้อ” instead of a broken/stuck page
- an unsupported Payment proof (`text/plain`) is rejected before signing/upload/submission
- rapid double activation of Payment submission creates exactly **one** pre-sign request and **one** Payment submission
- mobile ApplicationShell keyboard focus remains inside the open drawer and Escape closes the drawer with focus returned to its trigger
- the destructive Customer cancel-order ConfirmDialog keeps repeated Tab navigation inside the dialog and Escape returns focus to the original trigger
- a 640 CSS-pixel viewport, used as the reflow-equivalent layout width of a 1280px desktop at 200% zoom, keeps `/my/order/` free of document-level horizontal overflow with the destructive action reachable

Existing real-browser discovery already supplies the other negative cases required by the plan: Staff/Organization permission `403` boundaries, duplicate Pickup `409` recovery, and a forced `500` Customer retry path.

### Finding F-011-01 — Invalid Payment file remains displayed in the native input after rejection

**Severity: P2 — frontend-owned, remediation deferred**

- Route: `/my/payment/`
- Role: Customer
- Reproduction: choose a `text/plain` file in the Payment proof control.
- Expected: once the application rejects the file, both application state and the native file input are cleared.
- Actual: the file is rejected correctly, the validation message says “รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP”, and the custom selected-file state says “ยังไม่ได้เลือกไฟล์หลักฐาน”; however the native file input still has `C:\\fakepath\\not-an-image.txt`.
- Operational safety: the submit action does not accept the invalid file because React `selectedFile` state is null, so no upload/payment request is sent.
- UX impact: the native control and custom UI communicate contradictory selection state, which can cause a user to think the rejected file is still active.
- Evidence: `finding-phase11-invalid-payment-file-input-retains-name`.

`ProductImageUploadView` already clears `event.target.value` when file validation fails, while `MyPaymentView` currently clears only React state. This provides a small, frontend-local remediation path without changing API/business behavior.

### Accessibility result

Keyboard mechanics themselves were healthy in the audited paths: mobile navigation focus trapping, dialog focus containment, Escape closing, and focus return all passed in real Chromium. The project-wide custom focus-ring defect found in **F-010-01** remains a separate known shared root cause: browser-native focus remains visible, but the intended project 3px focus styling is not applied because of the malformed global CSS nesting.

### Full-suite environment observation

After adding Phase 11 coverage, a 41-test full serialized run reached the late Staff/inventory section while the host was heavily resource-constrained. Three cases failed for infrastructure/timing reasons rather than frontend assertions:

- Staff permission-boundary test exceeded its 30s total timeout while its failure snapshot already showed the expected “ไม่มีสิทธิ์เข้าถึง” state.
- READY Pickup fixture failed during Backend `/auth/login` with `socket hang up`.
- interaction inventory exceeded its 55s timeout while creating a fixture token.

Each affected case was immediately rerun on its own and passed: Staff boundary **1/1**, duplicate Pickup **1/1**, inventory **1/1**. No product-source change was made to mask or loosen these checks. The definitive clean single-run regression is still Phase 15.

### Phase 11 verification

- focused resilience/accessibility browser suite: **6/6 passed**
- 401 expired-token cleanup and login recovery: **passed**
- request-abort/network recovery and retry: **passed**
- real missing-resource 404: **passed**
- invalid Payment MIME rejection: **passed with F-011-01**
- double-submit prevention: **passed**
- mobile drawer keyboard focus trap / Escape / focus return: **passed**
- destructive ConfirmDialog keyboard containment / Escape / focus return: **passed**
- 200% reflow-equivalent Customer Order layout: **passed**
- failed cases from the environment-contended full run rerun independently: **3/3 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **1 P2**
- product/business behavior changed in Phase 11: **none**

**READY for Phase 12 — Audit consolidation and severity triage.**

## Phase 12 — Audit consolidation and severity triage

The discovery audit is now **frozen before fixes**. Every verified issue from Phases 4–11 was re-read from its recorded reproduction/evidence and deduplicated by likely root cause rather than by page.

### Frozen finding register

| ID | Severity | Owner | Root-cause family | User impact | Blocking? |
|---|---|---|---|---|---|
| F-005-01 | P2 | Frontend | Error Summary post-render focus | Customer validation can render without moving keyboard/screen-reader focus to the summary | No |
| F-006-01 | P2 | Frontend | Reject-dialog Back behavior | “กลับ” is misleading because the Reject Payment dialog remains open | No |
| F-006-02 | P2 | Frontend | Error Summary post-render focus | Staff rejection validation can be missed by keyboard/screen-reader users | No |
| F-007-01 | P2 | Frontend | Error Summary post-render focus | Organization Settings validation summary is not focused | No |
| F-007-02 | P2 | Frontend | Error Summary post-render focus | Staff-add validation summary is not focused | No |
| F-007-03 | P2 | Frontend | Success feedback lost across session refresh | Role/remove operations succeed but their success Notice disappears | No |
| F-010-01 | P2 | Frontend | Malformed global CSS nesting | Intended mobile target tokens/responsive gutters and project 3px focus ring are not globally applied | No |
| F-011-01 | P2 | Frontend | Native file input not reset on invalid Payment file | Native file control shows a rejected filename while application state says no file is selected | No |

**Severity totals: P0 = 0, P1 = 0, P2 = 8, P3 = 0.** All eight verified findings are frontend-owned. No Backend-owned product defect was verified by this audit.

### Root-cause consolidation

The four focus-placement findings **F-005-01, F-006-02, F-007-01, and F-007-02** are one remediation family. Their source paths all follow the same model: set validation state and immediately schedule `ErrorSummary.focus()` via `requestAnimationFrame`. The shared `ErrorSummary` itself is focusable with `tabIndex={-1}`; the failure is that the real browser does not reliably focus the newly rendered summary from the submit-handler timing. The remediation should therefore be render-aware/shared rather than four page-specific delays.

**F-010-01 is intentionally separate from that family.** Its malformed global CSS nesting explains why the intended custom focus ring is not styled and why responsive root tokens do not apply, but it does not explain why `document.activeElement` fails to become the Error Summary. Fixing CSS visual focus and fixing actual focus placement require separate regression assertions.

For **F-007-03**, source review confirms the affected paths set the local success Notice and then await `authSession.restore()`. The session store enters/loading-emits updated auth state during restore, which can replace/remount the authenticated shell path and discard the page-local Notice. Remediation must preserve Backend/session refresh authority while making feedback survive that transition.

For **F-011-01**, the fix can stay narrowly frontend-local: Product image validation already clears the native input value on rejection, while Customer Payment validation currently clears only `selectedFile` React state.

### Remediation batches

**B1 — Global CSS structure (F-010-01).** Add the missing structural close in `globals.css`, then verify computed responsive tokens, 44px compact target sizing, page gutters, and the intended 3px project focus ring. Because the change restores global rules across the application, run targeted responsive + accessibility browser smoke immediately.

**B2 — Shared Error Summary focus (F-005-01, F-006-02, F-007-01, F-007-02).** Replace handler-timed focus attempts on the verified routes with one render-aware focus strategy tied to validation-summary visibility/state. Add a shared regression pattern that asserts the actual active element in Chromium.

**B3 — Reject Payment Back (F-006-01).** Make the secondary Back action close the controlled Reject Dialog without validation side effects, preserving Payment state and existing close/Escape behavior.

**B4 — Staff mutation success feedback (F-007-03).** Reorder/persist success feedback so role-change/removal confirmation appears after the required auth/session refresh, without weakening membership refresh or authorization checks.

**B5 — Payment invalid-file reset (F-011-01).** Reset the native file input when validation rejects a Payment proof and verify that native value, custom selected-file state, and submit availability all agree.

The safest execution order for Phase 14 is **B1 → B2 → B3 → B4 → B5**. B1 runs first because it restores intended global CSS and may change visual focus/responsive rendering; B2 then fixes actual focus movement independently. The remaining three are isolated feature fixes.

### P0/P1 phase disposition

There is **nothing to fix in Phase 13** under the current frozen evidence: no P0/P1 defect was verified. Phase 13 should therefore confirm the frozen register still contains zero blockers/high-impact defects and advance without changing product code unless new evidence materially changes severity.

### Environment/integration observations kept out of the finding register

The Phase 11 full-run Staff timeout, Backend `socket hang up`, and inventory timeout are classified as local environment/integration contention, not frontend defects. The affected tests passed independently with no product change. They remain a reason to require a clean serialized run in Phase 15, but they do not enter P0–P3 totals.

### Phase 12 result

- discovery finding IDs reviewed: **8/8**
- deduplicated remediation families: **5**
- P0/P1 findings: **0**
- P2 findings: **8**
- P3 findings: **0**
- Backend-owned product findings: **0**
- environment observations separated from product findings: **yes**
- smallest safe remediation batches defined: **B1–B5**
- product/business behavior changed in Phase 12: **none**
- discovery state: **frozen for remediation**

**READY for Phase 13 — P0 and P1 remediation.**

## Phase 13 — P0 and P1 remediation

Phase 13 was intentionally executed as a **verification-only remediation gate** because the frozen Phase 12 register contains no verified P0 or P1 defect.

### Frozen severity recheck

- P0: **0**
- P1: **0**
- P2: **8**
- P3: **0**
- total verified findings: **8**

No source evidence supports promoting any of the eight P2 findings to P0/P1: critical user journeys remain completable, role boundaries remain enforced, Backend authority is intact, and none of the recorded defects causes data corruption or an unrecoverable destructive action.

### Critical high-severity smoke

To make the no-op decision evidence-based rather than administrative, the core blocker/high-impact paths were rerun sequentially to avoid the integration contention observed in Phase 11:

- seeded Customer login → authenticated session restore → logout: **1/1 passed**
- Staff Organization selection, operational navigation, and direct admin-route blocking: **1/1 passed**
- Organization Admin Dashboard/Settings access plus Platform Admin route blocking: **1/1 passed**
- Platform Admin Platform-scope navigation/summary with Organization-scope isolation: **1/1 passed**
- complete cross-role golden flow with Platform approval, Customer Payment reject/resubmit, Staff approval, Admin lifecycle transition, Pickup, and Audit propagation: **1/1 passed**

No smoke produced a new blocking or high-impact product failure.

### Change decision

Applying product changes in this phase would violate the frozen severity triage because there is no P0/P1 defect to target. Therefore Phase 13 makes **no product-code change** and adds no speculative fix.

- `git status --short src`: **clean**
- `git diff --check`: **passed**
- new P0 findings: **0**
- new P1 findings: **0**
- severity escalations: **0**
- product/business behavior changed in Phase 13: **none**

The remaining verified frontend work is exactly the P2/shared UX remediation batches defined in Phase 12.

**READY for Phase 14 — P2 and shared UX remediation.**

## Phase 14 — P2 and shared UX remediation

Phase 14 implemented the five remediation batches frozen in Phase 12. All eight verified P2 findings now pass their targeted real-browser regression. No backend contract, authorization rule, lifecycle rule, price authority, payment authority, or pickup authority was changed.

### B1 — F-010-01: global CSS structure

The missing closing brace after the global `h1, h2, h3, h4` color rule was restored. This returns the following selectors and media queries to top-level CSS instead of accidental nesting.

Real Chromium responsive regression now verifies:

- compact 320px/375px root control and minimum-target tokens resolve to the intended **44px**
- Payment approval dialog action heights meet the 44px compact target
- the project `:focus-visible` rule applies a focus outline of at least **3px**
- the responsive critical-interaction suite remains green at **320 / 375 / 768 / 1024 / 1440**
- no tested page-level horizontal-overflow regression was introduced

Focused result: **5/5 passed**.

### B2 — F-005-01, F-006-02, F-007-01, F-007-02: Error Summary focus

The previous pattern scheduled `ref.current?.focus()` from the submit handler before the validation-summary render was reliably committed. It was replaced with a shared `useErrorSummaryFocus()` helper that requests focus through React state and performs the focus from a layout effect after render.

The four recorded findings now pass actual `document.activeElement`/Playwright focus assertions:

- Customer Order quantity validation: **passed**
- Staff Reject Payment validation: **passed**
- Organization Settings validation: **passed**
- Organization Staff-add validation: **passed**

Because source review showed the same fragile pattern in other forms, the shared remediation was also applied to Login, Register, Organization creation, Store create/edit, Product create/edit, Variant create/edit, and Campaign create/edit. Login/Register focused-summary regressions were rerun and passed **2/2**.

The Customer Order form also retains explicit native-validation bypass on its submitter. Real Chromium showed that the invalid numeric path otherwise stays on the submit button instead of reaching the React validation/focus handler even though the form itself is marked `noValidate`.

### B3 — F-006-01: Reject Payment “กลับ”

The secondary “กลับ” action now closes the controlled Reject Payment dialog immediately and clears rejection-validation state while leaving the selected Payment and authoritative Payment state untouched.

The real Staff reject regression verifies Back closes, reopen works, empty rejection focuses the Error Summary, and a valid rejection still persists the reason.

Focused result: **1/1 passed**.

### B4 — F-007-03: Staff success feedback across session refresh

Role-change and member-removal success feedback is now preserved across the required `authSession.restore()` refresh. The success message is temporarily kept in session storage so a shell/page remount can restore it, then the temporary value is cleared. Backend/session refresh remains authoritative.

The Organization Admin Staff journey now sees the success Notice after role change and removal while authoritative member state still refreshes correctly.

Focused result: **1/1 passed** inside the Organization Admin member-management regression.

### B5 — F-011-01: invalid Payment native file value

When Payment proof validation rejects an unsupported MIME/size, the native file input is now cleared along with React `selectedFile` state. This matches the existing Product image-upload behavior.

The Phase 11 regression now confirms:

- unsupported `text/plain` proof shows the validation error
- native file-input value becomes empty
- no invalid upload/payment submission occurs
- a subsequent valid PNG can still submit
- rapid double activation still produces one pre-sign + one Payment submission

Focused result: **1/1 passed**.

### Phase 14 targeted regression summary

- B1 responsive/focus regression: **5/5 passed**
- B2 Customer Order focus: **1/1 passed**
- B2/B3 Staff Reject Payment: **1/1 passed**
- B2/B4 Organization Settings + Staff management: **2/2 passed**
- shared Login/Register focus regression: **2/2 passed**
- B5 invalid Payment file reset: **1/1 passed**
- Vitest: **77 files / 273 tests passed**
- ESLint: **passed**
- TypeScript `tsc --noEmit`: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**

### Phase 14 disposition

All **8/8** frozen P2 findings have a passing targeted regression and are marked **resolved pending full regression**. No speculative redesign was introduced. The next phase must rerun the complete browser matrix/golden journeys plus unit/lint/build checks before any finding is considered finally closed.

**READY for Phase 15 — Full regression and E2E rerun.**

## Phase 15 — Full regression and E2E rerun

Phase 15 completed the definitive post-remediation acceptance run. The full Playwright suite was executed serially (`--workers=1`) against the real local Compose frontend/backend environment so the result is not mixed with the resource-contention behavior observed during Phase 11.

### Complete browser result

**41/41 Playwright tests passed in 2.9 minutes.**

The passing run includes:

- all Anonymous/authentication journeys
- the full Customer commerce suite
- the complete cross-role golden lifecycle, including Payment reject → Customer resubmit → Staff approval → production → ready notification/QR → Pickup → RECEIVED → Audit propagation
- Organization Admin management/lifecycle/operational authority
- Platform Admin governance and permission boundaries
- Staff operational/payment/pickup/duplicate-confirm behavior
- negative session/network/404/upload/double-submit paths
- keyboard drawer/dialog focus containment and Escape/focus return
- 200% reflow-equivalent layout coverage
- responsive critical interactions at **320 / 375 / 768 / 1024 / 1440**
- the final route/role interaction inventory over all **28 canonical user-facing routes**

The frozen coverage denominator remains **207 source-defined route-specific interaction families**, with **33 role/data snapshots** and **529 rendered control instances** recorded by the inventory baseline. Conditional source-defined actions remain documented in the matrix and their lifecycle/role variants are represented by the corresponding journey tests.

### Finding closure

Every frozen P2 finding stayed fixed in the complete suite:

| Finding | Final status | Regression evidence |
|---|---|---|
| F-005-01 | RESOLVED | Customer Order validation focus passed in the full Customer journey |
| F-006-01 | RESOLVED | Staff Reject Payment Back closes correctly in the full Staff journey |
| F-006-02 | RESOLVED | Staff Reject Payment Error Summary focus passed |
| F-007-01 | RESOLVED | Organization Settings validation focus passed |
| F-007-02 | RESOLVED | Staff-add validation focus passed |
| F-007-03 | RESOLVED | Staff role/remove success feedback remained visible after session refresh |
| F-010-01 | RESOLVED | All five responsive widths passed with restored mobile tokens/focus styling |
| F-011-01 | RESOLVED | Invalid Payment file reset + valid follow-up submission passed |

Final unresolved verified findings after regression: **P0 = 0, P1 = 0, P2 = 0, P3 = 0**.

### Non-browser acceptance checks

- Vitest: **77 files / 273 tests passed**
- ESLint: **passed**
- TypeScript `tsc --noEmit`: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**

### Artifact cleanup

After the passing browser run, generated `playwright-report/`, `test-results/`, and `blob-report/` directories were removed. They are already ignored by the frontend `.gitignore`, so no transient browser artifact remains in the task diff.

### Phase 15 result

- complete serialized E2E regression: **41/41 passed**
- interaction inventory rerun: **passed**
- 28-route matrix coverage retained: **yes**
- all eight remediated findings stayed resolved: **8/8**
- unresolved audited findings: **0**
- unit/lint/type/build acceptance: **all passed**
- transient browser artifacts cleaned: **yes**
- backend/API/business-rule changes: **none**
- final blocking regression: **none**

**READY for Phase 16 — Review diff.**

## Phase 16 — Review diff

The final diff was reviewed only against this task's goal, frontend-only scope, constraints, and acceptance criteria. Product-source changes were checked for regressions, compatibility problems, permission weakening, business-rule drift, broad redesign, leftover debug code, and missing regression evidence. Test/config additions were also reviewed for safety because the E2E suite performs real mutations.

### Scope review

Repository-root status confirms every changed or untracked path is under `frontend/**`. No `backend/**`, `infrastructure/**`, root API contract, seed script, or business-rule source was modified.

The diff consists of:

- frontend-local Playwright harness/config/support/specs
- ignored test-artifact configuration and Vitest collection scoping
- the five verified P2 remediation batches
- the shared Error Summary focus helper
- audit/coverage documentation

Playwright is added only as a development dependency; no production runtime dependency was introduced.

### Review finding R-016-01 — non-local mutation safety in the E2E harness

**Review severity: blocking test-safety issue, resolved before completion.**

The first review pass found that the new Playwright harness allowed `E2E_FRONTEND_BASE_URL` and `E2E_API_BASE_URL` to point to non-local hosts without requiring an explicit destructive-test opt-in. Because the suite registers users, creates/approves/suspends Organizations, creates Orders and Payments, transitions Campaigns, confirms Pickups, and updates notifications, this could violate the explicit constraint against destructive testing on production data.

The harness was hardened in `playwright.config.ts`:

- local loopback URLs remain the normal zero-configuration target
- any non-loopback frontend or API target now fails during config loading unless `E2E_TARGET_ENV=integration` and `E2E_ALLOW_NON_LOCAL_MUTATIONS=true` are both present
- the error states that production targets are unsupported
- `e2e/README.md` documents the mutating nature of the suite and the required integration-only opt-in

Verification:

- local `playwright test --list`: **41 tests listed**
- non-local URLs without opt-in: **refused before test execution**
- non-local URLs with both integration safety flags: **configuration loads and lists 41 tests**

This is a harness-safety correction, not a product finding, and is now resolved.

### Acceptance-matrix review

The canonical matrix already listed all **28 routes**, roles, and **207 source-defined route-specific interaction families**, but the final review made the requested expected/actual/status representation explicit. A final route acceptance projection now classifies **28/28 routes** as PASS with conditional interactions explicitly marked **NOT-TESTABLE** when the final data state could not safely produce them. No conditional control is silently presented as executed.

### Product-diff review

No remaining review issue was found in the remediations:

- global CSS fix restores intended top-level responsive/focus rules without changing content or business behavior
- shared Error Summary focus helper is client-only, render-aware, and covered by real Chromium assertions
- Payment Reject Back behavior changes only dialog close/validation UI state
- Staff success-message persistence retains authoritative `authSession.restore()` behavior
- Payment invalid-file reset only synchronizes the native input with already-cleared React state
- Customer Order native-validation bypass still routes invalid quantity through the application's explicit validation and does not bypass Backend validation/authority

No old debug attributes/logging from remediation investigation remain.

### Final post-review regression

After the review safety fix, the complete serialized browser suite was rerun once more:

- Playwright E2E: **41/41 passed**
- cross-role golden lifecycle: **passed**
- interaction inventory: **passed**
- responsive widths 320/375/768/1024/1440: **passed**
- negative/resilience/accessibility suite: **passed**
- all remediated findings: **remain resolved**

Supporting checks after the final diff:

- Vitest: **77 files / 273 tests passed**
- ESLint: **passed**
- TypeScript `tsc --noEmit`: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- changes outside `frontend/**`: **0**
- transient `playwright-report/`, `test-results/`, `blob-report/`: **removed**

### Final review disposition

**PASS.** No unresolved regression, security/test-safety issue, compatibility problem, scope drift, unnecessary backend/business-rule change, or missing blocker-level regression coverage remains in the reviewed diff.

Final product finding status remains **P0 = 0 / P1 = 0 / P2 = 0 / P3 = 0 unresolved**.