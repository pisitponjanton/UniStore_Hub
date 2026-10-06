# UniStore Hub — Frontend Interaction Coverage Matrix

> Phase 3 artifact for **Full Frontend Real-User UX/UI & E2E Audit**
>
> Purpose: establish the authoritative interaction inventory before journey execution or product fixes.

## Counting model

Two different coverage numbers are intentionally tracked:

1. **Source interaction definitions / families** — one logical interaction is counted once per route even if the UI renders that action for many rows. Conditional/error-state actions are included when the current source supports them. Shared application-shell navigation is documented separately rather than multiplied across every authenticated route.
2. **Rendered control instances** — controls actually visible in the real Chromium snapshot for a concrete route/role/data state. Dynamic rows are counted individually.

Current Phase 3 baseline:

- canonical user-facing routes: **28**
- role/data browser snapshots: **33**
- source-defined route-specific interaction families: **207**
- rendered control instances observed across the 33 snapshots: **529**
- shared shell/navigation interaction families: documented separately below
- product/business fixes made during inventory: **0**

The 207 figure is an inventory-definition count, not a claim that 207 actions have already been executed. Execution status is intentionally deferred to Phases 4–11.

## Status vocabulary

- **Inventoried** — source and at least one representative browser state were inspected.
- **Conditional** — source-defined but requires a different data/error/lifecycle state than the baseline seed snapshot.
- **Journey test pending** — execution belongs to a later role/journey phase.
- **Read-only** — no route-specific mutation/action beyond navigation/shell behavior.

## Shared interaction families

### Public StorefrontHeader

Applies to public Storefront surfaces:

- UniStore Hub brand → storefront root
- ร้านค้า → storefront root
- anonymous: เข้าสู่ระบบ
- anonymous: สมัครสมาชิก
- authenticated: คำสั่งซื้อของฉัน
- authenticated: การแจ้งเตือน

### Authenticated ApplicationShell

Applies to authenticated shell routes as permitted by scope/role:

- skip link → main content
- UniStore Hub brand → storefront
- Customer navigation: storefront, My Orders, Notifications
- Staff Organization navigation: Orders, Payment Review, Pickups
- Organization Admin navigation: Dashboard, Settings, Staff, Stores, Products, Campaigns, Orders, Payment Review, Pickups, Production, Audit
- Platform Admin navigation: Platform Summary, Organizations, Users
- Organization switcher where an Organization context is active
- Logout
- mobile-only: open menu, close menu, close via scrim, close via Escape/focus return behavior

Shared shell interactions are tested as real interactions in the role/responsive/accessibility phases and are not added repeatedly to the 207 route-specific definition count.

---

## Canonical route matrix

| # | Route | Primary role(s) | Route-specific interaction families | Count | Browser baseline | Execution |
|---:|---|---|---|---:|---|---|
| 1 | `/` | Anonymous / Customer | hero jump to open stores; track orders; discovery jump to all stores; discovery store links; catalog store links; retry on load error | 6 | Anonymous success snapshot | **Phase 4 PASS (public discovery/navigation)**; error/retry remains later negative audit |
| 2 | `/login/` | Anonymous; authenticated alternate state | email; password; show/hide password; submit; register; back/return; authenticated My Orders; authenticated Notifications; conditional Organization area; authenticated back home | 10 | Anonymous form snapshot | **Phase 4 PASS** for validation, UI login, return routing, authenticated entry state, unsafe-return sanitization |
| 3 | `/register/` | Anonymous; authenticated alternate state | display name; email; password; show/hide password; submit; login; back/return; authenticated My Orders; authenticated Notifications; conditional Organization area; authenticated back home | 11 | Anonymous form snapshot | **Phase 4 PASS** for client validation, real local registration, protected-destination return, authenticated session restore |
| 4 | `/stores/view/` | Anonymous / Customer | back to all stores; campaign-card navigation; product-card navigation; invalid/not-found/error recovery link | 4 | Seed store success snapshot | **Phase 4 PASS (anonymous direct/public navigation)**; remaining commerce/error states later |
| 5 | `/products/view/` | Anonymous / Customer | back to store; variant select; campaign select; quantity; campaign detail; authenticated order CTA; anonymous login-to-order CTA | 7 | Anonymous + Customer snapshots | **Phase 5 PASS** for authenticated variant/campaign/quantity selection and order CTA; Phase 4 already covered anonymous login-to-order |
| 6 | `/campaigns/view/` | Anonymous / Customer | back to store; product-card navigation; invalid/not-found/error recovery link | 3 | Seed OPEN campaign snapshot | **Phase 4 PASS (anonymous direct/public navigation)**; remaining error states later |
| 7 | `/orders/new/` | Customer | back to product; quantity; create order; retry load; error back to storefront; success payment; success order detail; success product return | 8 | Seed order-entry snapshot | **Phase 5 PASS with P2 finding**: real Order creation and quantity validation pass, but validation Error Summary does not receive focus in Chromium |
| 8 | `/my/orders/` | Customer | choose more products; retry; per-order contextual detail/continue; load more | 4 | Customer list snapshot | **Phase 5 PASS** for empty state, real Order list/history, contextual detail navigation, forced-error retry; pagination remains data-conditional |
| 9 | `/my/order/` | Customer | back to My Orders; retry; payment link; pickup link; cancel-order dialog trigger; cancel-order confirmation | 6 | Disposable PENDING_PAYMENT order snapshot | **Phase 5 PASS** for Payment-review detail, list round-trip, cancel dialog cancel/confirm, and READY_FOR_PICKUP action |
| 10 | `/my/payment/` | Customer | back to order; retry/error recovery; payment-slip file input; submit slip; rejected-state resubmit action | 5 | No-payment PENDING_PAYMENT snapshot | **Phase 5 PASS** for no-file validation, unsupported type, real PNG pre-signed upload, submit, refresh, and PAYMENT_REVIEW state; reject/resubmit deferred to cross-role phase |
| 11 | `/my/pickup/` | Customer | back to order; check latest status; retry; error/back recovery | 4 | Not-ready snapshot | **Phase 5 PASS** for READY_FOR_PICKUP Customer QR/Token rendering; not-ready baseline already inventoried; negative retry remains later resilience audit |
| 12 | `/notifications/` | Customer | refresh; All filter; Unread filter; Read filter; retry; mark-read per item; load more | 7 | Customer notification snapshot | **Phase 5 PASS** for Unread/Read filters and real mark-read on READY_FOR_PICKUP notification; refresh/load-more remain data-conditional/later coverage |
| 13 | `/org/select/` | Staff / Organization Admin | retry; select Organization; Organization name; description; create Organization | 5 | Organization Admin snapshot | **Phase 6 PASS (Staff)** for accessible Organization selection and Staff landing; create/retry remain for Admin/resilience phases |
| 14 | `/org/dashboard/` | Organization Admin | retry; Settings shortcut; Payment queue shortcut; Orders shortcut; Stores shortcut; Products shortcut; Campaign ID filter; Store ID filter; apply filter; clear filter; Campaigns shortcut; Orders shortcut from summary | 12 | Seed Org Admin snapshot | **Phase 7 PASS** for Admin navigation plus real Campaign/Store report filters and clear-to-whole-Organization behavior; retry remains resilience-phase coverage |
| 15 | `/org/settings/` | Organization Admin | retry; back/select Organization; name; description; save; switch Organization | 6 | Seed Org Admin snapshot | **Phase 7 PASS with P2 finding**: real update persisted to Backend; invalid-name validation renders but Error Summary does not receive Chromium focus |
| 16 | `/org/staff/` | Organization Admin | member role select; role-change dialog trigger/confirm; remove-member dialog trigger/confirm; add-member email; add-member initial role; submit add | 6 | Seed members snapshot | **Phase 7 PASS with P2 findings**: add/role-change/remove all persist correctly; invalid-add Error Summary loses focus and role/remove success feedback disappears after session refresh |
| 17 | `/org/stores/` | Organization Admin | edit store; activate/deactivate dialog; create name; create description; create; close editor; edit name; edit description; save | 9 | Seed active store snapshot | **Phase 7 PASS** for validation, create, edit, deactivate confirmation, and reactivate confirmation |
| 18 | `/org/products/` | Organization Admin | store filter; clear filter; edit Product; deactivate Product dialog; load more; create Store select/name/description/submit; close editor; edit name/description/save; image file/upload; Variant edit; deactivate Variant dialog; Variant edit name/price/save/cancel; new Variant name/price/add | 24 | Seed Product snapshot | **Phase 7 PASS** for Product validation/create/edit, invalid+valid image upload, Variant create/edit/deactivate, and Product deactivate; store filter/load-more remain conditional coverage |
| 19 | `/org/campaigns/` | Organization Admin | Store filter; Status filter; clear; view detail; load more; create Store/Name/Open/Close/Payment deadline/Pickup dates/submit; close detail; draft edit Store/Name/4 dates/save; lifecycle confirm actions across supported statuses | 26 | Seed OPEN campaign snapshot | **Phase 7 PASS** for create/edit and full real lifecycle DRAFT → OPEN → CLOSED → PRODUCING → READY_FOR_PICKUP → COMPLETED; list filters/load-more remain conditional coverage |
| 20 | `/org/orders/` | Staff / Organization Admin | Campaign ID; Customer ID; Order Status; apply filters; clear filters; per-order detail; load more | 7 | Staff + Admin snapshots | **Phase 6 PASS (Staff)** for Campaign/Customer/Status filters, clear, and real detail navigation; load-more remains data-conditional |
| 21 | `/org/orders/view/` | Staff / Organization Admin | back to list; Admin-only cancel-order confirm flow | 2 | Staff + Admin disposable order snapshots | **Phase 7 PASS (Admin)** for real Admin-only cancellation confirmation; Phase 6 already verified Staff cannot access the cancel action |
| 22 | `/org/payments/` | Staff / Organization Admin | Payment Status/Campaign ID/Order ID filters; apply/clear; select payment; load more; request slip; open temporary slip link; approve confirm; reject dialog trigger; reject reason; reject back; reject confirm | 14 | Staff + Admin queue snapshots | **Phase 7 PASS (Admin approve)**; Phase 6 already covers Staff filter/slip/approve/reject with 2 P2 findings; load-more remains data-conditional |
| 23 | `/org/production/` | Organization Admin | Campaign ID; load summary | 2 | Seed Campaign ID snapshot | **Phase 7 PASS** using the real disposable completed Campaign ID and Backend production summary |
| 24 | `/org/pickups/` | Staff / Organization Admin | Pickup token/Order ID/Campaign ID/Status filters; apply/clear; select pickup; load more; READY pickup confirm dialog | 9 | Staff + Admin queue snapshots | **Phase 7 PASS (Admin confirm)**; Phase 6 already covers Staff filter/select/normal+duplicate confirmation; remaining filter variants/load-more stay data-conditional |
| 25 | `/org/audit/` | Organization Admin | Actor ID/Action/Resource Type/Resource ID filters; search; clear; metadata details expand/collapse; load more | 8 | Seed Org Admin snapshot | **Phase 7 PASS** for real Campaign Resource ID filtering and metadata expansion; alternate filters/clear/load-more remain conditional coverage |
| 26 | `/platform/summary/` | Platform Admin | read-only route-specific surface | 0 | Platform Admin success snapshot | **Phase 8 PASS**: real Platform Summary matched Backend totals; Platform navigation and scope context rendered correctly |
| 27 | `/platform/organizations/` | Platform Admin | approve Organization confirm; suspend Organization confirm | 2 | Platform Admin organization list snapshot | **Phase 8 PASS**: disposable PENDING Organization cancel-confirm, approve to ACTIVE, then suspend to SUSPENDED persisted through the real Backend |
| 28 | `/platform/users/` | Platform Admin | read-only route-specific surface | 0 | Platform Admin success snapshot | **Phase 8 PASS**: persisted User status/platformRole rendered from real Backend; route-specific surface remained read-only with no mutation controls |

Total source-defined route-specific interaction families: **207**.

---

## Campaign lifecycle conditional inventory

The Campaign management page exposes only actions valid for the current backend state. These are all included in the source inventory even though one seed Campaign cannot render them simultaneously.

| Campaign status | Available UI actions |
|---|---|
| DRAFT | เปิดรับคำสั่งซื้อ; ยกเลิกแคมเปญ |
| OPEN | ปิดรับคำสั่งซื้อ; ยกเลิกแคมเปญ |
| CLOSED | เริ่มการผลิต; ยกเลิกแคมเปญ |
| PRODUCING | แจ้งพร้อมรับสินค้า |
| READY_FOR_PICKUP | ปิดแคมเปญเป็นเสร็จสิ้น |
| COMPLETED | none |
| CANCELLED | none |

Every lifecycle mutation is represented through confirmation UI; Backend remains authoritative.

## Role-bound action differences

The same canonical route can expose materially different interactions by role:

- `/products/view/`: anonymous gets login-to-order; Customer gets order CTA.
- `/org/orders/`: Staff and Organization Admin can inspect/filter Orders.
- `/org/orders/view/`: Staff is read/operational only; Organization Admin can cancel only in supported states.
- `/org/payments/`: Staff and Organization Admin both review payments.
- `/org/pickups/`: Staff and Organization Admin both confirm eligible pickups.
- Organization configuration routes (Dashboard/Settings/Staff/Stores/Products/Campaigns/Production/Audit) remain Organization Admin-only.
- Platform routes remain Platform Admin-only.

## Browser inventory evidence

The real Chromium inventory pass uses the running local Compose stack, real JWT login, and real seeded backend data.

It visits all 28 canonical paths and adds role-specific duplicate snapshots where the same route differs by role. The current pass produced **33 snapshots** and observed **529 visible control instances**.

Dynamic data means the 529 value can legitimately change between runs because:

- list rows create repeated per-record actions,
- persistent LocalStack contains previous disposable E2E records,
- conditional buttons appear only for matching status/data,
- pagination controls depend on response size.

Therefore source-defined interaction families are the stable coverage denominator, while rendered-control totals are runtime evidence.

## Phase 3 browser observation

One expected contract-state diagnostic appeared on the Customer payment page for the disposable `PENDING_PAYMENT` order before any Payment exists:

- `GET /me/orders/:orderId/payment` returns `404 PAYMENT_NOT_FOUND`.
- Chromium also emits the corresponding failed-resource console entry.

The Frontend contract explicitly treats this owned-order `PAYMENT_NOT_FOUND` case as “no Payment has been submitted yet”, so this is **not recorded as a product defect**. Later browser journey assertions should allow this exact expected state while still failing on unrelated 404/console errors.

## Phase 3 exit condition

The route/control inventory is now frozen enough to begin execution:

- every canonical route is represented,
- every primary role surface is represented,
- conditional interaction families are documented from source,
- shared navigation behavior is documented separately,
- browser baseline exists against the real local backend,
- no discovered UI issue has been fixed during inventory.

Later phases must update this matrix from **Journey test pending** to explicit pass/fail/not-testable results as actions are executed.


## Phase 4 — Anonymous and authentication execution

Real Chromium execution against the local frontend/backend completed the following authentication-facing journeys:

| Journey | Expected | Actual | Status |
|---|---|---|---|
| Anonymous storefront discovery | Visitor can enter the seeded store, campaign, and product without authentication | Navigation completed through all three public surfaces | PASS |
| Protected Customer route | Anonymous visitor sees an authentication boundary instead of protected data | `/my/orders/` showed the Unauthorized state and login action | PASS |
| Return routing | Login/Register preserve the protected destination | `returnTo=/my/orders/` survived Login → Register and returned correctly after auth | PASS |
| Login client validation | Invalid form is blocked locally and summary receives focus | No Login request was sent; field errors and focused summary appeared | PASS |
| Register client validation | Invalid form is blocked locally and summary receives focus | No Register request was sent; field errors and focused summary appeared | PASS |
| Password visibility | User can reveal and re-hide password without submitting | Input switched password → text → password | PASS |
| Real UI login | Seed Customer can authenticate through the visible form | Backend login succeeded and returned to My Orders | PASS |
| Session restore | Authenticated browser survives reload | Reload restored the Customer session through `/me` | PASS |
| Authenticated Login page | Already-authenticated user is not asked to enter credentials again | Login page showed authenticated account state instead of form | PASS |
| Logout | User can end the session and protected route becomes protected again | Logout returned to Storefront; direct My Orders access returned Unauthorized state | PASS |
| Real UI registration | Disposable local Customer can register and continue protected journey | New local account registered, returned to My Orders, and restored across reload | PASS |
| Unsafe external `returnTo` | Auth navigation must not become an open redirect | External URL was sanitized to `/`; Register link also dropped unsafe return target | PASS |
| 375px public navigation | Brand/auth links remain reachable with no unintended horizontal overflow | Brand, Login, Register were usable; dedicated Store nav is intentionally hidden ≤620px and brand is the storefront/home control | PASS |

Phase 4 produced **no verified product defect**. The first browser run had two locator strictness failures because the same validation message is intentionally rendered both in the Error Summary and beside the field, plus one test expectation that did not account for the intentional mobile CSS rule hiding the dedicated Store link. Those were test-harness corrections only; no application code or product behavior was changed.


## Phase 5 — Customer commerce execution

Real Chromium execution against the local frontend/backend covered the Customer commerce lifecycle without changing product behavior.

| Journey | Expected | Actual | Status |
|---|---|---|---|
| Product selection | Authenticated Customer can choose Variant, OPEN Campaign, and quantity and continue | Seed Product/Variant/Campaign loaded and the order CTA became usable | PASS |
| Order quantity validation | Invalid quantity must not create an Order and should surface actionable validation | No Order POST was sent and inline/summary validation rendered | PASS with P2 focus finding |
| Real Order creation | Backend creates the authoritative Order and total | UI created a real quantity-2 Order and showed Backend-returned Order ID/state | PASS |
| Payment file validation | Missing/unsupported files are blocked before upload | Missing file focused the file input; text file rejected; PNG accepted | PASS |
| Real Payment upload | Browser obtains a pre-signed URL, uploads directly, submits the slip key, then refreshes | Real LocalStack S3 PUT + Payment POST completed and UI reached PAYMENT_REVIEW | PASS |
| Order history/detail | Created Order appears in My Orders and can be reopened | Order row appeared with PAYMENT_REVIEW guidance and detail navigation worked | PASS |
| Customer cancellation | PENDING_PAYMENT Order can back out of dialog or confirm cancel; no cancel after disallowed state | Dialog Back preserved Order; Confirm moved a disposable Order to CANCELLED; PAYMENT_REVIEW had no cancel action | PASS |
| Empty Orders | New Customer with no Orders receives an actionable empty state | “ยังไม่มีคำสั่งซื้อ” plus “เลือกสินค้า” displayed | PASS |
| Orders retry | Temporary list failure can recover through retry | Controlled 500 showed error state; removing interception + retry restored real list | PASS |
| Invalid detail link | Missing Order ID should be recoverable without entity request | Invalid-link state rendered and no entity request was issued | PASS |
| READY_FOR_PICKUP | Customer sees Pickup Token and locally generated QR | Disposable real lifecycle fixture reached READY; Token + QR rendered | PASS |
| Notification read flow | New READY notification appears unread and can be marked read/filter to Read | Customer marked the real notification read; Backend confirmed its exact notification ID has readAt | PASS |

### Phase 5 finding — F-005-01

- **Severity:** P2
- **Owner:** Frontend
- **Route:** `/orders/new/`
- **Role:** Customer
- **Precondition:** valid Product/Variant/OPEN Campaign context
- **Steps:** enter quantity `0` → press “ยืนยันสร้างคำสั่งซื้อ”
- **Expected:** validation renders and `#order-create-error-summary` receives focus, matching the component intent and existing unit-test expectation
- **Actual:** validation renders, but real Chromium focus does **not** move to the Error Summary
- **Impact:** keyboard/screen-reader users may not be moved to the newly rendered validation summary after submission
- **Evidence:** reproduced repeatedly in Playwright; the test attaches `finding-phase5-order-error-summary-focus`
- **Remediation status:** deliberately **not fixed during discovery**; carry to Phase 12 triage / Phase 13–14 remediation

The implementation schedules the focus with `requestAnimationFrame` immediately after changing submission state. The browser result suggests a render/focus timing race, but root-cause correction is intentionally deferred until remediation.

### Phase 5 test-data note

READY_FOR_PICKUP coverage uses a uniquely named disposable local Organization/Store/Product/Campaign because advancing the deterministic seed Campaign would permanently close it and break later audit phases. Platform Admin, Organization Admin, Staff, and Customer APIs are used only as fixture setup so the browser test can inspect the Customer surface at the required state. No production data is used.

### Phase 5 runner note

The growing browser suite shares deterministic seeded accounts and a stateful LocalStack backend. Cross-file parallel execution caused test interference and timing failures unrelated to user behavior. The Playwright configuration is therefore serialized to one worker. Individual phase suites remain fast enough for focused execution.


## Phase 6 — Staff operational execution

Real Chromium execution exercised Staff-only operational work against the local backend with disposable data and no product fixes.

| Journey | Expected | Actual | Status |
|---|---|---|---|
| Organization selection | Staff can choose an accessible Organization and land on operational work | Seed Organization selection routed to `/org/orders/` | PASS |
| Staff navigation | Staff sees only operational Organization links | Orders, Payment Review, Pickup visible; Admin configuration links absent | PASS |
| Admin-only direct URLs | Staff must be blocked from Admin configuration routes | Dashboard, Settings, Staff, Stores, Products, Campaigns, Production, Audit all showed Forbidden | PASS |
| Orders filtering | Staff can combine Campaign, Customer, and Status filters and clear them | Disposable Customer Order isolated correctly; “แสดงทั้งหมด” restored the queue | PASS |
| Order detail permission | Staff can inspect but cannot cancel Organization Orders | Real PENDING_PAYMENT detail opened; cancel action was absent | PASS |
| Payment slip inspection | Staff can load a PAYMENT_REVIEW item and request its temporary slip URL | Real Payment detail loaded and temporary slip link appeared | PASS |
| Payment approval | Staff confirmation updates Payment and Order | UI approved the real Payment; Backend verified Payment APPROVED and Order PAID | PASS |
| Payment rejection | Staff must supply a reason and Backend preserves it | Empty reason validation rendered; valid reason changed Payment to REJECTED and Order to PAYMENT_REJECTED | PASS with P2 findings |
| Pickup confirmation | Staff can filter READY Pickup by Token and confirm delivery | Real Pickup changed to RECEIVED and Order changed to RECEIVED | PASS |
| Duplicate pickup confirmation | A stale second confirmation must not double-process | Backend 409 was surfaced, UI refreshed to RECEIVED, and confirm action disappeared | PASS |

### Phase 6 finding — F-006-01

- **Severity:** P2
- **Owner:** Frontend
- **Route:** `/org/payments/`
- **Role:** Staff
- **Steps:** select a `PENDING_REVIEW` Payment → open “ปฏิเสธการชำระเงิน” → press “กลับ”
- **Expected:** the Reject Payment dialog closes without mutating the Payment
- **Actual:** the dialog remains visibly open; blurring the empty reason also renders required-field validation
- **Impact:** the secondary Back action does not behave as labeled and leaves Staff trapped in the same decision surface unless they use the separate close control
- **Evidence:** reproduced repeatedly in Chromium; attached as `finding-phase6-payment-reject-back-does-not-close`
- **Remediation:** deferred until the remediation phases

### Phase 6 finding — F-006-02

- **Severity:** P2
- **Owner:** Frontend
- **Route:** `/org/payments/`
- **Role:** Staff
- **Steps:** open Reject Payment → leave reason empty → press “ยืนยันปฏิเสธ”
- **Expected:** validation renders and `#payment-reject-error-summary` receives focus
- **Actual:** validation renders, but the Error Summary does not receive real-browser focus
- **Impact:** keyboard/screen-reader users can miss the newly rendered validation summary
- **Evidence:** reproduced in Chromium; attached as `finding-phase6-payment-reject-summary-focus`
- **Root-cause note:** this matches the real-browser focus-timing pattern already seen in F-005-01 and should be triaged as a possible shared focus-management root cause rather than three unrelated visual defects

### Phase 6 test-data note

Payment tests use uniquely registered local Customers against the stable seed Organization/Campaign so filtering can isolate one Order or Payment without mutating shared lifecycle state. Pickup tests use disposable Organizations/Campaigns so READY/RECEIVED transitions do not close the shared seed Campaign.

### Phase 6 permission boundary note

Staff was also sent directly to every current Organization Admin-only route. All eight representative configuration/audit surfaces were blocked by the Organization boundary before Admin UI became available.


## Phase 7 — Organization Admin execution

Real Chromium execution exercised Organization Admin configuration, catalog, lifecycle, audit, and operational authority against disposable/local backend data. No product fix was made during discovery.

| Journey | Expected | Actual | Status |
|---|---|---|---|
| Admin navigation | Organization Admin can reach all Organization management/operational areas | Dashboard, Settings, Staff, Stores, Products, Campaigns, Orders, Payments, Pickups, Production, Audit were present | PASS |
| Dashboard report scope | Campaign + Store IDs can scope the Dashboard and be cleared | Real disposable Campaign/Store filters applied; “แสดงทั้งหน่วยงาน” restored whole-Organization scope | PASS |
| Organization Settings | Editable display data persists while governance remains outside this page | Name/description update persisted through the real Backend | PASS with P2 focus finding |
| Platform boundary | Organization Admin must not inherit Platform Admin scope | Summary/Organizations/Users Platform routes all showed Forbidden | PASS |
| Staff add | Existing account can be added with chosen initial Organization role | Disposable account added as STAFF | PASS with P2 focus finding |
| Staff role change | Role mutation requires confirmation and persists | STAFF → ORGANIZATION_ADMIN → STAFF persisted | PASS with P2 feedback finding |
| Staff remove | Removal requires confirmation and membership becomes inactive | Backend confirmed removed member status INACTIVE | PASS with P2 feedback finding |
| Store management | Create/edit/deactivate/reactivate must use the real Store contract and destructive confirmations | All mutations completed successfully | PASS |
| Product management | Create/edit/deactivate, image upload, and Variant management must persist | Product and Variant create/edit/deactivate passed; PNG presigned upload persisted; invalid text upload was blocked | PASS |
| Campaign management | DRAFT data can be edited and lifecycle transitions require explicit confirmation | DRAFT → OPEN → CLOSED → PRODUCING → READY_FOR_PICKUP → COMPLETED passed | PASS |
| Production | Admin can load production summary for a real Campaign | Summary region loaded for the disposable Campaign | PASS |
| Audit | Admin can filter immutable logs and inspect metadata | Real Campaign Resource ID filter returned rows and metadata expanded | PASS |
| Admin Order cancellation | Only Admin receives the supported cancel action | Disposable PENDING_PAYMENT Order was cancelled through confirmation | PASS |
| Admin operational work | Admin can also perform Payment/Pickup operations allowed to operational roles | Real Payment approval and real Pickup confirmation passed | PASS |

### Phase 7 findings

**F-007-01 — P2 — Organization Settings Error Summary focus**

On `/org/settings/`, clearing the Organization name and submitting renders the correct validation but `#organization-settings-error-summary` does not receive focus in real Chromium. This matches the shared focus-management failure family already observed in F-005-01 and F-006-02.

**F-007-02 — P2 — Staff add Error Summary focus**

On `/org/staff/`, submitting an invalid member email renders “กรุณาระบุอีเมลที่ถูกต้อง” but `#staff-add-error-summary` does not receive focus in real Chromium. Treat this as the same likely shared focus-timing/root-cause family rather than an isolated visual defect.

**F-007-03 — P2 — Staff management success feedback is lost after session refresh**

Role-change and member-removal mutations both succeed and Backend/UI membership data refreshes correctly, but the success Notice set immediately before `authSession.restore()` is not visible after the refresh. Evidence is attached separately for role change and removal. The operational result is correct; confirmation feedback is what disappears.

No P0/P1 defect was found in the Organization Admin phase.

## Phase 8 — Platform Admin execution

Real Chromium execution exercised the Platform Admin scope against the local Backend without changing product behavior.

| Journey | Expected | Actual | Status |
|---|---|---|---|
| Platform Summary | Platform Admin sees authoritative Organization/User totals and Platform scope context | UI totals matched the real `/platform/summary` response | PASS |
| Platform navigation | Platform-only navigation exposes Summary, Organizations, and Users | All three links were visible and navigated correctly | PASS |
| Public scope transition | Public Storefront uses the public shell | Storefront opened normally; browser Back returned to Platform scope | PASS |
| Organization boundary | Platform Admin without Organization membership must not inherit Organization Admin access | Direct seed Organization Dashboard URL showed Forbidden | PASS |
| Organization selector | Platform Admin with no memberships should have no accessible Organization context | `/org/select/` showed no accessible Organizations while Platform navigation remained available | PASS |
| Approve Organization | PENDING Organization requires explicit confirmation before ACTIVE | Cancel left status PENDING; confirm changed authoritative Backend state to ACTIVE | PASS |
| Suspend Organization | Eligible Organization requires destructive confirmation before SUSPENDED | ACTIVE Organization suspended successfully and no further transition action remained | PASS |
| Platform Users | Users list is read-only and reflects persisted status/platformRole | Seed Platform Admin row showed ACTIVE + PLATFORM_ADMIN; route-specific section exposed no mutation controls | PASS |
| Cross-role Platform boundary | Non-Platform Organization Admin must not enter Platform routes | Already verified in Phase 7 across Summary/Organizations/Users | PASS |

### Phase 8 findings

No new P0/P1/P2/P3 frontend finding was verified in the Platform Admin phase.

The public Storefront intentionally uses its own public shell, so Platform Admin navigation is not rendered while the user is on `/`. Returning with browser Back restores the authenticated Platform shell; this is expected layout behavior, not a defect.

### Phase 8 result

- focused Platform Admin browser suite: **3/3 passed**
- real Platform Summary count verification: **passed**
- approval-dialog cancellation preserves PENDING state: **passed**
- PENDING to ACTIVE approval confirmation: **passed**
- ACTIVE to SUSPENDED confirmation: **passed**
- Platform Users read-only contract: **passed**
- Platform Admin Organization permission boundary: **passed**
- full Playwright regression after Phase 8: **29/29 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **0**
- product/business behavior changed in Phase 8: **none**

## Phase 9 — Cross-role golden journey

A single real-browser golden flow now verifies the main UniStore Hub lifecycle across Platform Admin, Organization Admin, Customer, and Staff against the real local Backend.

| Handoff | Producer role/action | Consumer role/observed result | Status |
|---|---|---|---|
| Organization governance | Platform Admin approves disposable PENDING Organization | Organization Admin can operate the ACTIVE Organization | PASS |
| Staff membership | Organization Admin adds seeded Staff through UI | Staff can operate Payment/Pickup queues for that Organization | PASS |
| Campaign availability | Organization Admin opens disposable Campaign | Customer can select the Campaign and create a real Order | PASS |
| Initial Payment | Customer uploads PNG slip and submits Payment | Staff sees the real PAYMENT_REVIEW item | PASS |
| Payment rejection | Staff rejects with a concrete reason | Customer sees PAYMENT_REJECTED plus the exact reason | PASS |
| Payment resubmission | Customer uploads a second slip using “ส่งหลักฐานใหม่” | Staff sees the same Order return to PAYMENT_REVIEW | PASS |
| Payment approval | Staff approves the resubmitted Payment | Customer Order becomes PAID and UI shows “ชำระเงินแล้ว” | PASS |
| Production lifecycle | Organization Admin closes Campaign, starts production, then marks READY_FOR_PICKUP | Customer Order reaches READY_FOR_PICKUP and Pickup becomes available | PASS |
| Ready notification | Admin READY transition emits notification | Customer Notifications shows Ready for Pickup | PASS |
| Pickup handoff | Staff confirms the propagated Pickup Token | Customer Order/Pickup both become RECEIVED | PASS |
| Campaign completion | Organization Admin completes the READY Campaign after handoff | Backend Campaign reaches COMPLETED | PASS |
| Audit propagation | Campaign lifecycle generates audit records | Organization Admin can filter Audit by the real Campaign ID and inspect rows | PASS |
| Platform isolation after commerce | Business flow stays inside Organization scope | Platform Admin still sees the Organization as ACTIVE at Platform level | PASS |

### Phase 9 execution notes

The golden journey intentionally uses API setup only for disposable catalog fixtures (Store/Product/Variant/Campaign creation). Those CRUD surfaces were already exercised through visible Organization Admin UI in Phase 7. Every cross-role handoff that matters to the acceptance flow is performed or observed through the browser.

Some Backend state propagation is asynchronous relative to the immediate UI success state. The E2E waits for authoritative Order/Campaign state after the visible transition instead of treating that short propagation delay as a frontend defect.

### Phase 9 result

- focused cross-role golden E2E: **1/1 passed**
- Platform approval → Customer order/payment → Staff reject → Customer resubmit → Staff approve: **passed**
- Admin production/READY → Customer QR/notification → Staff Pickup confirm → Customer RECEIVED: **passed**
- Campaign completion and Audit propagation: **passed**
- full Playwright regression after Phase 9: **30/30 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **0**
- product/business behavior changed in Phase 9: **none**

## Phase 10 — Responsive interaction audit

Responsive browser coverage now runs the same critical interaction set at **320, 375, 768, 1024, and 1440 px** widths.

| Width | Customer Payment / upload | Navigation | Staff Payment review / dialog | Admin Audit table | Page overflow | Result |
|---:|---|---|---|---|---|---|
| 320 | file selection + sticky submit reachable | mobile drawer open/close/focus return | filter, row action, detail, approval dialog reachable | internal horizontal scroll works | none | PASS with F-010-01 evidence |
| 375 | file selection + sticky submit reachable | mobile drawer open/close/focus return | filter, row action, detail, approval dialog reachable | internal horizontal scroll works | none | PASS with F-010-01 evidence |
| 768 | upload/form reachable | mobile drawer works | filter/detail/dialog reachable | internal horizontal scroll works | none | PASS |
| 1024 | upload/form reachable | desktop navigation visible | filter/detail/dialog reachable | table bounded by page | none | PASS |
| 1440 | upload/form reachable | desktop navigation visible | filter/detail/dialog reachable | table bounded by page | none | PASS with F-010-01 focus evidence |

Coverage in this phase represents **15 critical route-role viewport passes** (5 widths × Customer Payment, Staff Payment Review, and Organization Admin Audit), plus responsive shell/drawer, dialog, sticky-action, upload, filter, table-scroll, and focus-visibility checks.

### Phase 10 finding — F-010-01

- **Severity:** P2
- **Owner:** Frontend
- **Root cause:** `src/app/globals.css` starts `h1, h2, h3, h4 { color: var(--ink);` but does not close that rule before the following global selectors. Modern CSS nesting therefore treats the later global selectors/media blocks as descendants of headings instead of top-level rules.
- **Responsive impact:** the intended `@media (max-width: 620px) :root` control/target token overrides do not reach the real root. At 320px and 375px, `--control-height` and `--target-min` remain **40px** instead of the intended **44px**. Approval-dialog Cancel and Confirm buttons therefore render at 40px high.
- **Spacing impact:** the responsive root gutter/token overrides are also skipped; the runtime root keeps the desktop `--page-gutter` value instead of the intended compact mobile value.
- **Focus impact:** the intended global `button:focus-visible` / link/input/select/textarea focus rule is nested by the same root cause. Keyboard focus remains visible through Chromium's browser default, but the project-defined **3px** focus ring is not applied; measured Button focus was the browser-default **1px auto** outline at both 320px and 1440px.
- **Observed usability:** no primary action was clipped or unreachable in the tested flows, mobile drawers remained usable, dialogs stayed inside the viewport, and narrow tables scrolled inside their own region without producing page-level horizontal overflow.
- **Evidence:** Playwright attachments `finding-phase10-dialog-touch-target-320`, `finding-phase10-dialog-touch-target-375`, `finding-phase10-global-focus-ring-320`, and `finding-phase10-global-focus-ring-1440`.
- **Remediation:** intentionally deferred to the remediation phases so discovery remains evidence-first.

### Phase 10 result

- responsive focused browser suite: **5/5 passed**
- widths covered: **320 / 375 / 768 / 1024 / 1440**
- mobile drawer checks: **passed at 320 / 375 / 768**
- desktop navigation checks: **passed at 1024 / 1440**
- Customer upload + sticky mobile submit: **passed**
- Staff filters/detail/approval dialog reachability: **passed**
- Admin Audit internal horizontal scrolling: **passed at all narrow widths requiring it**
- page-level horizontal overflow in tested surfaces: **0 occurrences**
- verified new frontend findings: **1 P2 shared root cause**
- full Playwright regression after Phase 10: **35/35 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- product/business behavior changed in Phase 10: **none**

## Phase 11 — Negative, resilience, and accessibility execution

Phase 11 adds focused real-browser coverage for session failure, network recovery, real 404 handling, invalid upload behavior, duplicate activation protection, keyboard focus containment, Escape/focus return, and a 200% reflow-equivalent layout check.

| Scenario | Expected | Actual | Status |
|---|---|---|---|
| Expired session / 401 | Definitive expired token is removed and protected UI offers login recovery | `TOKEN_EXPIRED` cleared `unistoreHub.accessToken`; `/my/orders/` rendered “กรุณาเข้าสู่ระบบ” with login return context | PASS |
| Network failure | Temporary connection failure shows recoverable state and retry can restore authoritative data | Forced request abort rendered Customer error state; “ลองโหลดอีกครั้ง” restored the real Order list | PASS |
| Real 404 | Missing valid Order ID renders a safe not-found state instead of crashing/stalling | Backend 404 rendered “ไม่พบคำสั่งซื้อ” with a route back to Order history | PASS |
| 403 permission boundary | Wrong role cannot enter admin-only URLs | Already exercised in Phase 6/7; Staff and Organization Admin forbidden boundaries continue to pass | PASS |
| 409 stale/duplicate action | Duplicate Pickup confirmation refreshes authoritative state safely | Already exercised in Phase 6; stale second confirmation refresh behavior passes | PASS |
| 5xx recovery | Server failure renders an error state with an actionable retry | Phase 5 forced 500 retry path remains covered by the full regression suite | PASS |
| Invalid Payment upload | Unsupported MIME is rejected before upload | `text/plain` is rejected and no Payment upload request is sent | PASS with F-011-01 UI inconsistency |
| Double activation | Rapid duplicate activation must not create duplicate Payment submissions | One pre-sign request and one Payment submission were observed | PASS |
| Mobile keyboard navigation | Drawer traps keyboard focus; Escape closes and returns focus to the menu trigger | Real Chromium keyboard path behaved correctly | PASS |
| Destructive dialog keyboard behavior | Focus remains inside ConfirmDialog and Escape returns focus to trigger | Eight Tab cycles stayed within dialog; Escape returned focus to “ยกเลิกคำสั่งซื้อ” | PASS |
| 200% reflow-equivalent layout | 1280px desktop reflowed to ~640 CSS px remains operable with no horizontal page overflow | `/my/order/` had no document overflow and destructive primary control remained reachable | PASS |

### Phase 11 finding — F-011-01

- **Severity:** P2
- **Owner:** Frontend
- **Route / role:** `/my/payment/` / Customer
- **Action:** choose an unsupported `text/plain` Payment proof.
- **Expected:** invalid file selection is cleared from both React state and the native file input so the control and supporting UI communicate the same state.
- **Actual:** validation correctly shows “รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP” and the custom selected-file UI says “ยังไม่ได้เลือกไฟล์หลักฐาน”, but the native file input still reports `C:\\fakepath\\not-an-image.txt`. The submit control remains unavailable because React state was cleared.
- **Impact:** contradictory file-selection feedback can make a user believe the rejected file is still selected while the application considers there to be no file.
- **Evidence:** Playwright attachment `finding-phase11-invalid-payment-file-input-retains-name`.
- **Related implementation contrast:** Product image upload explicitly clears `event.target.value` on invalid selection; Customer Payment upload currently only clears React state.
- **Remediation:** deferred to the remediation phases.

### Regression/environment note

A full 41-test serialized run encountered host/integration contention late in the run: one Staff permission test exceeded its 30s test timeout, one Pickup fixture received a backend `socket hang up` during `/auth/login`, and the interaction inventory exceeded 55s. The failure artifacts showed expected UI state rather than a product assertion failure. All three affected cases were rerun independently after the contended run and passed (**1/1 Staff boundary**, **1/1 duplicate Pickup**, **1/1 route inventory**). A clean single-run full regression remains intentionally scheduled for Phase 15.

### Phase 11 result

- focused resilience/accessibility browser suite: **6/6 passed**
- explicit 401 expired-session recovery: **passed**
- network abort + retry: **passed**
- real Backend 404 recovery: **passed**
- invalid upload blocking: **passed with 1 P2 feedback finding**
- duplicate Payment activation protection: **passed (1 pre-sign + 1 submit)**
- keyboard focus containment + Escape/focus return: **passed**
- 200% reflow-equivalent check: **passed**
- previously verified 403 / 409 / 5xx cases remain represented in regression coverage
- affected full-suite environment failures rerun independently: **3/3 passed**
- Vitest regression: **77 files / 273 tests passed**
- ESLint: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- verified new frontend findings: **1 P2**
- product/business behavior changed in Phase 11: **none**

## Phase 12 — Discovery freeze and severity triage

Discovery is now frozen before remediation. The audit contains **8 verified frontend-owned findings**, all **P2**. No P0, P1, or P3 finding was verified.

| Finding | Root-cause family | Severity | Blocking | Evidence / affected surface | Remediation batch |
|---|---|---:|---|---|---|
| F-005-01 | Error Summary focus after render | P2 | No | Customer `/orders/new/`; `finding-phase5-order-error-summary-focus` | B2 |
| F-006-01 | Reject-dialog secondary action semantics | P2 | No | Staff `/org/payments/`; `finding-phase6-payment-reject-back-does-not-close` | B3 |
| F-006-02 | Error Summary focus after render | P2 | No | Staff Reject Payment; `finding-phase6-payment-reject-summary-focus` | B2 |
| F-007-01 | Error Summary focus after render | P2 | No | Admin `/org/settings/`; `finding-phase7-settings-error-summary-focus` | B2 |
| F-007-02 | Error Summary focus after render | P2 | No | Admin `/org/staff/`; `finding-phase7-staff-error-summary-focus` | B2 |
| F-007-03 | Local success feedback lost during auth-session refresh | P2 | No | Staff role/remove; two Phase 7 success-feedback attachments | B4 |
| F-010-01 | Malformed global CSS nesting | P2 | No | Responsive root tokens + project focus ring across app | B1 |
| F-011-01 | Native file-input value diverges from React selection state | P2 | No | Customer `/my/payment/`; `finding-phase11-invalid-payment-file-input-retains-name` | B5 |

### Severity totals

- **P0:** 0
- **P1:** 0
- **P2:** 8
- **P3:** 0
- **Frontend-owned:** 8
- **Backend-owned defects:** 0 verified
- **Environment/integration observations:** recorded separately; not counted as product findings

No finding is classified P0/P1 because the audited critical journeys remain completable, authorization boundaries remain intact, destructive operations remain Backend-authoritative, and each issue is either accessibility/feedback degradation or a recoverable interaction inconsistency rather than a broken core workflow.

### Deduplicated root-cause families

1. **B1 — Global CSS structure:** F-010-01. Close the malformed heading rule so global focus rules and responsive `:root` tokens become top-level again. This is broad in impact but mechanically small, so it should be fixed first and followed by responsive/focus smoke.
2. **B2 — Error Summary post-render focus:** F-005-01, F-006-02, F-007-01, F-007-02. Four routes use the same render-then-`requestAnimationFrame(...focus())` pattern and fail in real Chromium. Remediate through one shared, render-aware focus pattern rather than four isolated patches.
3. **B3 — Reject Payment Back action:** F-006-01. Keep this scoped to controlled Dialog close behavior and regression coverage; do not alter rejection business rules.
4. **B4 — Staff success feedback/session restore:** F-007-03. Preserve successful role/remove feedback across the `authSession.restore()` transition while keeping refreshed membership/session authority.
5. **B5 — Payment invalid-file reset:** F-011-01. Clear the native Payment file input when validation rejects the file, matching the already-safe Product image pattern.

### Phase disposition

**Phase 13 (P0/P1 remediation):** there are no verified P0/P1 findings to remediate. It should be a verification-only/no-product-change phase unless a new blocker is discovered while validating the frozen audit.

**Phase 14 (P2/shared UX remediation):** execute B1 → B2 → B3 → B4 → B5 in small reviewable changes with targeted browser regression after each root cause. B1 is first because it restores intended global CSS behavior and can change responsive/focus rendering across many routes; B2 follows so actual focus placement is fixed separately from focus-ring styling.

### Environment/dependency separation

The late full-suite timeouts/socket hang-up recorded in Phase 11 are **not product findings**. Their failure artifacts showed expected UI or a local Backend connection failure, and all affected cases passed when rerun independently. The final clean serialized regression remains a Phase 15 acceptance check.

No product source was changed during this triage phase.

## Phase 13 — P0 and P1 remediation verification

The frozen register was rechecked before any high-severity remediation work. It still contains **P0 = 0** and **P1 = 0**, so Phase 13 required no product-code change.

Critical blocker/high-impact smoke was rerun against the real local browser/backend path:

- Customer login/session restore/logout: **passed (1/1)**
- Staff organization selection + operational/admin permission boundary: **passed (1/1)**
- Organization Admin dashboard/settings + Platform Admin forbidden boundary: **passed (1/1)**
- Platform Admin scope/summary + Organization scope boundary: **passed (1/1)**
- complete cross-role golden lifecycle, including reject/resubmit/approve/payment/production/pickup/audit propagation: **passed (1/1)**

Frozen severity recount remains **8 findings total: 0 P0 / 0 P1 / 8 P2 / 0 P3**.

### Phase 13 disposition

No newly verified blocker, permission leak, destructive-action hazard, broken critical journey, or high-impact navigation/state defect was discovered by the verification smoke. Therefore:

- **P0/P1 fixes applied:** none
- **product source files changed:** none (`git status --short src` is clean)
- **severity escalation from P2 to P0/P1:** none
- **new P0/P1 finding:** none
- `git diff --check`: **passed**

Phase 13 closes as a no-op remediation phase by evidence. The next implementation work is the already frozen **P2/shared UX batches B1 → B2 → B3 → B4 → B5**.

## Phase 14 — P2 and shared UX remediation

All five frozen remediation batches were implemented without changing backend authority or business rules. Targeted browser regression is green; the definitive full-suite rerun remains Phase 15.

| Batch | Findings | Remediation | Targeted evidence | Status |
|---|---|---|---|---|
| B1 | F-010-01 | Closed the malformed global heading rule so later global selectors/media queries are top-level again | Responsive suite 320/375/768/1024/1440 = **5/5 passed**; compact tokens assert 44px target/control height and project focus ring asserts ≥3px | RESOLVED — pending full regression |
| B2 | F-005-01, F-006-02, F-007-01, F-007-02 | Replaced handler-timed Error Summary refs with a render-aware shared `useErrorSummaryFocus()` hook; extended the same shared pattern to the other existing Error Summary forms | Customer Order validation **1/1**, Staff Reject Payment **1/1**, Organization Settings/Staff **2/2**, Login/Register validation **2/2** | RESOLVED — pending full regression |
| B3 | F-006-01 | Made Reject Payment “กลับ” close the controlled dialog and clear reject-validation state without touching payment state | Staff reject/back/validation/reject journey **1/1 passed** | RESOLVED — pending full regression |
| B4 | F-007-03 | Persisted the success message across the required auth-session refresh, then restored/cleared it on the remounted Staff surface | Organization Admin member role/remove journey **1/1 passed** with success feedback assertions | RESOLVED — pending full regression |
| B5 | F-011-01 | Clear the native Payment file input whenever MIME/size validation rejects the selected proof | Invalid Payment MIME + duplicate-submit regression **1/1 passed**; native input value asserted empty | RESOLVED — pending full regression |

### Shared focus remediation scope

The observed failure was a shared timing pattern, not four unrelated pages. The new hook requests focus in component state and applies it in a layout effect after the validation state has rendered. Existing Login, Register, Organization creation, Store, Product, Variant, and Campaign forms that used the same fragile `requestAnimationFrame(ref.focus)` pattern were moved to the same helper so the root cause is removed consistently rather than left latent elsewhere.

The Customer Order submitter keeps explicit native-validation bypass on the submit control in addition to the form-level `noValidate`; real Chromium regression showed this is required for the invalid numeric value path to actually reach React submit handling and its Error Summary focus behavior.

### Phase 14 verification

- frozen P2 findings targeted: **8/8**
- targeted P2 findings now passing: **8/8**
- responsive B1 regression: **5/5 passed**
- Customer Order Error Summary regression: **1/1 passed**
- Staff Reject Payment Back + Error Summary regression: **1/1 passed**
- Organization Settings/Staff focus + success feedback regressions: **2/2 passed**
- Login/Register shared focus regressions: **2/2 passed**
- invalid Payment file reset/double-submit regression: **1/1 passed**
- Vitest: **77 files / 273 tests passed**
- ESLint: **passed**
- TypeScript `tsc --noEmit`: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- backend/API/business-rule changes: **none**
- remaining verified P2 finding with failed targeted regression: **0**
- full-suite closure status: **pending Phase 15**

## Phase 15 — Full regression and E2E rerun

The complete post-remediation browser suite was rerun serially with one Playwright worker against the real local frontend/backend stack. This avoids the host contention observed during Phase 11 and provides the definitive closure run.

### Final browser regression

- Playwright command: `npm run test:e2e -- --workers=1`
- total browser tests: **41/41 passed**
- runtime: **2.9 minutes**
- route/role interaction inventory: **passed** as test 41
- canonical user-facing routes represented by the inventory: **28/28**
- role/data browser snapshots represented by the frozen matrix: **33**
- stable source-defined route-specific interaction families: **207**
- baseline rendered-control evidence from inventory: **529 instances**
- Anonymous/authentication journeys: **8/8 passed**
- Customer commerce journeys: **5/5 passed**
- Organization Admin journeys: **5/5 passed**
- Platform Admin journeys: **3/3 passed**
- resilience/accessibility journeys: **6/6 passed**
- responsive widths 320/375/768/1024/1440: **5/5 passed**
- Staff operational journeys: **5/5 passed**
- cross-role golden lifecycle: **1/1 passed**
- QA harness smoke: **2/2 passed**

### Remediation closure

All eight frozen P2 findings that were marked resolved-pending-regression in Phase 14 remained green in the complete suite. Their final disposition is **RESOLVED**:

- F-005-01 — resolved
- F-006-01 — resolved
- F-006-02 — resolved
- F-007-01 — resolved
- F-007-02 — resolved
- F-007-03 — resolved
- F-010-01 — resolved
- F-011-01 — resolved

Final unresolved verified findings: **P0 = 0 / P1 = 0 / P2 = 0 / P3 = 0**.

### Final non-browser regression

- Vitest: **77 files / 273 tests passed**
- ESLint: **passed**
- TypeScript `tsc --noEmit`: **passed**
- production build/static export: **30/30 pages passed**
- `git diff --check`: **passed**
- temporary Playwright report/result/blob directories: **removed after the passing run**
- backend/API/business-rule changes: **none**

### Phase 15 disposition

No blocking regression, unresolved audited finding, permission regression, responsive regression, accessibility regression, or cross-role lifecycle regression remains in the executed acceptance suite. The frontend is ready for the final task-scoped diff review.

## Final route acceptance projection

This final projection makes the acceptance status explicit per canonical route. The interaction-family definitions remain in the canonical matrix above; conditional controls that were not produced by the final data state are marked **NOT-TESTABLE** instead of being silently counted as passed.

| Route | Role(s) | Expected result | Actual result | Final status |
|---|---|---|---|---|
| `/` | Anonymous / Customer | Public discovery/navigation remains usable; load failure has retry | Discovery/navigation passed; storefront-specific forced load-error state was not produced | PASS / NOT-TESTABLE (retry state) |
| `/login/` | Anonymous / authenticated alternate | Validation, password visibility, safe return routing, login/session behavior | Real validation/login/return/session/logout journeys passed | PASS |
| `/register/` | Anonymous / authenticated alternate | Validation and registration return to intended safe destination | Real validation/registration/return flow passed | PASS |
| `/stores/view/` | Anonymous / Customer | Valid Store detail and navigation work; invalid/error state is recoverable | Valid public navigation passed; invalid Store-detail state was not forced | PASS / NOT-TESTABLE (invalid Store state) |
| `/products/view/` | Anonymous / Customer | Variant/Campaign/quantity controls and role-specific order CTA work | Anonymous and Customer states plus Customer selection/order CTA passed | PASS |
| `/campaigns/view/` | Anonymous / Customer | Valid Campaign detail/product navigation work; invalid/error state is recoverable | Valid public navigation passed; invalid Campaign-detail state was not forced | PASS / NOT-TESTABLE (invalid Campaign state) |
| `/orders/new/` | Customer | Quantity validation focuses summary; valid Order creation and success navigation work | Validation focus, real Order creation, Payment/detail continuation passed | PASS |
| `/my/orders/` | Customer | History, contextual navigation, retry and pagination work when available | Real history/navigation and forced retry passed; load-more stayed data-conditional | PASS / NOT-TESTABLE (load-more) |
| `/my/order/` | Customer | Detail, cancel confirmation, Payment/Pickup actions and recovery reflect authoritative status | Pending/Payment-review/READY/RECEIVED and cancellation flows passed | PASS |
| `/my/payment/` | Customer | File validation/upload/submit and reject-resubmit status feedback stay consistent | Invalid reset, real upload, reject/resubmit/approve propagation and duplicate-submit guard passed | PASS |
| `/my/pickup/` | Customer | Not-ready and READY states expose current Pickup status/QR/token | Not-ready inventory plus real READY QR/token flow passed | PASS |
| `/notifications/` | Customer | Filters, mark-read, refresh/retry and pagination work when available | READY notification filters/mark-read passed; load-more stayed data-conditional | PASS / NOT-TESTABLE (load-more) |
| `/org/select/` | Staff / Organization Admin | Accessible Organization selection works; create/retry are available when applicable | Staff/Admin selection passed; Organization creation UI was fixture-backed rather than browser-executed | PASS / NOT-TESTABLE (create UI) |
| `/org/dashboard/` | Organization Admin | Dashboard shortcuts and report filters preserve Organization scope | Navigation plus Campaign/Store filters and clear behavior passed | PASS |
| `/org/settings/` | Organization Admin | Validation summary focuses; save persists authoritative settings | Invalid focus and real persistence passed | PASS |
| `/org/staff/` | Organization Admin | Add, role change, removal, confirmations and success feedback remain correct | Add/role/remove plus refreshed success feedback passed | PASS |
| `/org/stores/` | Organization Admin | Create/edit/deactivate/reactivate confirmations persist | Full core Store lifecycle passed | PASS |
| `/org/products/` | Organization Admin | Product/image/Variant mutations work; list controls work when data supports them | Core Product/image/Variant flows passed; load-more stayed data-conditional | PASS / NOT-TESTABLE (load-more) |
| `/org/campaigns/` | Organization Admin | Create/edit and valid lifecycle confirmations enforce Backend transitions | DRAFT → OPEN → CLOSED → PRODUCING → READY_FOR_PICKUP → COMPLETED passed; load-more stayed data-conditional | PASS / NOT-TESTABLE (load-more) |
| `/org/orders/` | Staff / Organization Admin | Filters, clear, detail and pagination respect role/Organization scope | Campaign/Customer/Status filters, clear and detail passed; load-more stayed data-conditional | PASS / NOT-TESTABLE (load-more) |
| `/org/orders/view/` | Staff / Organization Admin | Both roles can inspect; only Admin gets supported cancel mutation | Staff boundary and Admin cancellation confirmation passed | PASS |
| `/org/payments/` | Staff / Organization Admin | Filters, slip review, approve/reject/back, validation and pagination behave correctly | Filter/slip/approve/reject/back/validation passed; load-more stayed data-conditional | PASS / NOT-TESTABLE (load-more) |
| `/org/production/` | Organization Admin | Production summary loads from authoritative Campaign state | Real disposable Campaign production summary passed | PASS |
| `/org/pickups/` | Staff / Organization Admin | Filters/detail/eligible confirm handle normal and duplicate confirmation safely | Token filter/select/confirm/duplicate refresh passed; alternate filters/load-more stayed data-conditional | PASS / NOT-TESTABLE (alternate data-dependent controls) |
| `/org/audit/` | Organization Admin | Audit filtering, metadata inspection, clear and pagination work as data permits | Real Campaign Resource ID filter + metadata expansion passed; alternate filters/load-more stayed data-conditional | PASS / NOT-TESTABLE (alternate data-dependent controls) |
| `/platform/summary/` | Platform Admin | Read-only totals and Platform scope reflect Backend state | Live Organization/User totals and scope navigation passed | PASS |
| `/platform/organizations/` | Platform Admin | Approve/suspend require confirmation and persist authoritative state | Cancel-confirm, PENDING → ACTIVE, ACTIVE → SUSPENDED passed | PASS |
| `/platform/users/` | Platform Admin | Persisted Platform user status/role render read-only | Seed Platform Admin row matched Backend; no mutation controls exposed | PASS |

Final route accounting: **28/28 canonical routes classified** with explicit PASS and, where applicable, explicit NOT-TESTABLE conditional controls. There are **0 FAIL routes** after remediation and full regression.

## Phase 16 — Final diff review

The final task diff was reviewed against the task goal, frontend-only scope, constraints, and acceptance criteria.

### Review result

- all changed/untracked paths are under `frontend/**`: **passed**
- backend/infrastructure/root business-contract changes: **none**
- production/runtime dependency changes: **none**; Playwright is dev-only
- static export compatibility: **passed**
- permission/backend-authority boundaries: **preserved**
- temporary browser artifacts in the diff: **none**
- debug-only instrumentation: **none found**
- malformed/legacy Error Summary focus pattern remaining in audited forms: **none found**
- route acceptance projection: **28/28 routes explicitly classified**

### Review finding R-016-01 — mutating E2E target safety

During diff review, the harness was found to accept non-local `E2E_FRONTEND_BASE_URL` / `E2E_API_BASE_URL` overrides without an explicit destructive-test opt-in, even though the suite performs real Organization, Order, Payment, Campaign, Pickup, notification, and account mutations. This conflicted with the task constraint that destructive real-user tests must not target production data.

The review fixed this before completion:

- loopback/local targets remain the default and require no extra flag
- any non-loopback target is refused unless `E2E_TARGET_ENV=integration` **and** `E2E_ALLOW_NON_LOCAL_MUTATIONS=true` are both explicitly set
- the harness documentation now states that production targets are unsupported
- the unsafe non-local case was verified to fail at Playwright config load
- the explicitly opted-in integration case was verified to list the same 41 tests without contacting the target

R-016-01 is **resolved** and is not a product P0–P3 finding.

### Post-review verification

After the safety fix and acceptance-matrix clarification:

- complete serialized Playwright suite: **41/41 passed**
- Vitest: **77 files / 273 tests passed**
- ESLint: **passed**
- TypeScript `tsc --noEmit`: **passed**
- production build/static generation: **30/30 pages passed**
- `git diff --check`: **passed**
- non-local safety rejection check: **passed**
- explicit integration opt-in config check: **passed**
- generated Playwright report/result/blob directories cleaned again: **yes**

Final diff-review status: **PASS**. No unresolved review blocker remains.