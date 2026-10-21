# UniStore Hub — Campus Commerce A Interface System

> **Status: Approved, Phase 2 foundation (2026-10-19).**
> This is the **single canonical visual authority** for `frontend/**`, superseding the historical "Playful Campus Commerce v3" purple/3D language. Git history preserves the previous document.
> UX direction chosen by the project owner: **A — Campus Commerce**. Implementation phases are tracked in BDXA `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`. Frontend's semantic CSS token source remains `src/app/globals.css`; never introduce a parallel palette/theme.

## Product goal and domain

UniStore Hub is a campus marketplace and pre-order tool for faculty groups, clubs and university units. People first need to **find a real store and product**, inspect an open pre-order campaign, then **order, pay and collect**. Staff review queues and payment slips, Organization Admins manage products and campaigns, and Platform Admins handle governance.

Campus Commerce A must look like a dependable **real shopping service**, not an anonymous SaaS dashboard or a decorated pitch deck. Product/content clarity wins over visual effects.

### Identity — explicit user directive

1. The only **visible brand** in every public, authenticated, mobile, sidebar, auth and footer shell is the wordmark **`UniStore Hub` as selectable text**.
2. **No brand symbol, badge, square U, monogram, illustrative store logo, pictogram before/after the wordmark, or substitute graphic mark.** Keep the brand focusable as the existing accessible home link where applicable.
3. Functional icons (orders, staff, search, notification, arrow, pickup) are allowed **when they identify actual actions**. A separate icon-system phase will standardize their family; do not substitute arbitrary Unicode arrows or stickers for the brand.
4. Store media, partner logos owned by third parties, and the first letter of a real store name in a neutral product placeholder are **not UniStore branding**; do not conflate these with forbidden brand-mark treatments.
5. Brand text must render clearly at 320px width, 200% zoom, with Thai + English font metrics and no reliance on hidden image alternatives.

## Colors and semantics

Design intent: **soft daylight, botanical green/teal, credible warm neutrals, highly legible text**, with a muted dark companion rather than a harsh black-mode inversion.

All live semantic variables reside in `src/app/globals.css`.

| Semantic property | Light | Dark | Use |
|---|---|---|---|
| Canvas `--canvas` | `#F7F8F4` | `#111D1A` | Whole-page environment |
| Surface `--surface` | `#FFFFFF` | `#1D2D29` | Cards/inputs/panels |
| Muted `--surface-muted` | `#EEF3EE` | `#283D35` | Low-emphasis groups |
| Hover `--surface-hover` | `#E9F3ED` | `#2D473E` | Interactive surface **with paired foreground** |
| Selected `--surface-selected` | `#D9EEE3` | `#315549` | Selected row/tab |
| Ink `--ink` | `#193630` | `#F2F8F3` | Primary text |
| Secondary `--ink-secondary` | `#455F55` | `#CCDED2` | Descriptions/labels |
| Brand `--brand` | `#126357` | `#93DDBD` | Primary action |
| Brand hover `--brand-hover` | `#0C4F45` | `#B5EDCE` | Hover on primary action |
| On-brand `--brand-on` | `#FFFFFF` | `#133025` | Text on brand |
| Brand soft `--brand-soft` | `#E3F2E9` | `#254639` | Soft calls to action |
| Focus `--focus` | High-contrast teal | Bright mint | Visible keyboard focus |

`--on-surface`, `--on-surface-secondary`, `--on-hover`, and `--on-selected` alias the theme-appropriate ink family. **Never set a pale hover background with inherited dark theme pale text.** Respect 4.5:1 WCAG AA for regular text and 3:1 for sufficiently large text. Focus indicator must be visible against both adjoining surfaces.

### Token decision rules

- Use `--canvas`, `--surface`, `--surface-muted`, `--surface-hover`, `--ink`, `--ink-secondary`, `--brand`, `--brand-strong`, `--brand-on`, `--line` and role-specific status tokens instead of hardcoded per-page colors. Any new status tokens belong in global CSS first.
- Borders/controls must remain readable across themes: `--line`, `--line-strong`, `--control-line`, `--focus`, and explicit disabled/validation semantics.
- Green is the shopping/identity color; don't equate `--brand` with semantic payment success. Preserve `--success`, `--warning`, `--danger`, `--info`.
- Avoid purple v3 gradients, clay blobs, pictogram logos, multicolor cards with hard-to-read labels and fake product imagery. Warm ivory and light tan may accent **real categories**, not compromise contrast.
- Light-first does **not** mean disabling dark mode. Both `prefers-color-scheme` themes remain first-class; test actual hovered/focused text in the browser.
- Use `color-mix()` thoughtfully where paired foreground readability is measurable; do not assume percentages guarantee WCAG AA.

## Type and spatial scale

- Primary face: **Noto Sans Thai** with readable English metrics. Keep existing declared fallback order; no decorative Latin font that breaks Thai.
- Reading body **16px**, secondary **14px minimum where practical**. Scale clearly from labels to headings; use weight plus color before gratuitous font-size changes. Body line height 1.5–1.7; large headlines 1.1–1.25.
- Existing `--space-1/2/3/4/5/6/8/10/12/...` are canonical 4px multiples. Avoid random negative margins and stacking contradictory end-of-file CSS patches.
- Product cards should foreground store/product identity, real price and state, next action, then small metadata. Do not put internal organization IDs or fixture jargon on public-facing cards.
- Controls maintain >=40px basic height and comfortable 44px touch zones; focus rings are visible, errors associated with input labels and action names.
- Card geometry: ~8–14px practical corners; larger feature cards may use existing hero radius. Shadows mark elevation only, not every row.

## Interaction semantics — Phase 4 implemented

Shared components use paired text and background tokens rather than fading entire disabled controls:

- **Buttons:** primary/secondary/quiet/danger states use theme-aware surfaces; disabled and pending actions use `--control-disabled-bg`, `--control-disabled-ink`, `--control-disabled-line`, no whole-element opacity reduction, preserving readable labels; focus-visible gets an explicit 3px outline.
- **Inputs and dropdowns:** `--control-native-scheme` (light/dark) follows the active browser theme. Field, select option, selected option, hovered input, disabled field and validation styles have explicit foreground/background pairs. Storefront finder no longer hardcodes a light select inside dark mode.
- **Rows/cards:** shared table hover and keyboard focus-within use `--interactive-row-bg`/`--interactive-row-ink`, selected row uses `--interactive-selected-bg`/`--interactive-selected-ink`, while storefront cards and rows use semantic foreground/background colors.
- **Dialogs:** Radix dialog focus and Escape-to-close/focus restoration behavior is checked in unit tests; explicit focus-visible outline is provided on its Close control. Full real-browser modal clickthrough across all roles remains in later QA phases.
- **Sizing:** shared control-height small/medium/large uses 40/44/48px, with shared minimum/comfortable targets 44/48px.

Verified 2026-10-19 in Chromium: 14 semantic foreground/background token combinations exceeded 4.5:1 in Light and Dark. In-context Storefront hover text measured 11.48:1 (Light) and 9.36:1 (Dark); native select measured 12.66:1 / 14.95:1. Evidence is stored in `frontend/quality-audit/.evidence/campus-a-phase4/` and the Phase 4 review document.

The static inventory scans 38 CSS files, 237 interactive selector rules, and flags 68 cases where a rule changes background without explicitly changing text color. These are **review candidates, not proven WCAG violations**, and the remaining role/state permutations are NOT_TESTED until the later comprehensive cross-role interaction audit.

## Functional icon system — Phase 5 implemented

**Approved dependency:** `lucide-react@0.468.0` pinned in `frontend/package.json` and lockfile. `frontend/src/components/ui/app-icon.tsx` is the **single icon vocabulary**; `frontend/src/components/layout/workspace-icon.tsx` is a compatibility re-export for existing route navigation. Do not add custom stroke SVGs, Unicode navigation arrows, or a second icon package.

- All functional icons are **line SVGs** with an optical default 18px, absolute 1.8px stroke, matching caps/joins and theme-inherited `currentColor`. Small arrows can use 15–17px, menu icons 18–20px. Icons are noninteractive decorations inside named links/buttons and always `aria-hidden=true` / `focusable=false`.
- Navigation roles are mapped to coherent symbols for store, orders, payment, pickup, notifications, dashboard, organization, staff, products, campaigns, production, settings, audit, users and platform. Symbols now come from Lucide, not handmade paths. Action links use `arrow-up-right` or `arrow-right`; step chevrons use `chevron`.
- Both the visible brand wordmark and responsive/authenticated brand links remain **text-only `UniStore Hub`** — no U monogram, square, brand logo or pictogram is added. Illustrations formerly rendering `U`/`!`/`฿`/`✓` now use contextual Lucide symbols; no-image fallbacks use the neutral `image-off` icon.
- The **store's own initial letter** in a real store-name preview or an account initial is not a UniStore logo. Do not erase legitimate content while removing brand art.
- The local Next.js development status badge is disabled (`devIndicators:false`) so that it does not overlay screenshot/UI reviews. This setting does not change application navigation.
- Git-locked vendored `braces` tarball is copied before `npm ci` in **`frontend/Dockerfile.dev` only**, ensuring the local frontend Docker image can be rebuilt reproducibly. Never make this a production/database change.

**Evidence:** Unit tests `frontend/src/components/ui/app-icon.test.tsx` and the existing media suite; read-only Chromium role/browser checks `frontend/e2e/quality-audit/campus-a-phase5-icons.spec.ts` across Guest, Customer, Staff, Organization Admin and Platform Admin in Light/Dark, with captured screenshots under `frontend/quality-audit/.evidence/campus-a-phase5/`. Source inventory confirms zero banned Unicode arrow/emoji navigation glyphs and zero remaining `styles.brandMark` usages in `frontend/src/**/*.tsx`. Arithmetic multiplication `×` in prices is intentionally kept as math, not iconography.

Deferred: screen-specific UI icon density, tooltips and touch targets will be revisited with actual content and all state permutations during role redesign Phases 6–15. Do not equate a read-only icon smoke test with verified behavior of all 257 action IDs.

## Responsive intent by task

**Phase 3 implemented (2026-10-19):** Replaced unintended common 1240/1360/1440px caps with task-sized fluid containers while retaining bounded reading/form widths. The visible organization directory is an interim multi-column layout; **a store-first card grid and QA fixture visibility remain Phase 6–7**, not Phase 3.

### Implemented content width tiers

| Variable / surface | Maximum | Explanation |
|---|---:|---|
| `--content-marketplace` | 3360px | Storefront hero, finder, directory and footer; aligned gutters |
| `--content-visual` | 2920px | Wide visual panels |
| `--content-wide` | 3000px | Platform Admin |
| `--content-operations` | 2880px | Staff/organization order queues |
| `--content-max` | 2680px | Administration/reporting page shells |
| `--content-detail` | 2480px | Store, product and campaign views |
| `--content-customer` | 1960px | Customer transactions and order tracking |
| `--content-narrow` / `--content-reading` | 900px / 720px | Intentionally bounded prose/status |
| Auth shell | 2048px | Balanced split form; Phase 9 handles full auth redesign |

Gutters use `--page-gutter: clamp(16px, 2.4vw, 72px)` with 24/20/16/12px compact viewport overrides. Shared spacing remains a 4px/8px system.

Measured local browser: Storefront hero increased from **1360px (~35%)** to **3360px (87.5%)** at a 3840px CSS viewport. Storefront hero, finder and catalog align. A temporary organization-first directory grid shows 1/2/3/4 columns at 1440/1920/2560/3840px. Customer/Staff/Organization Admin/Platform Admin main content at 3840px measures **1960/2880/2680/3000px**, with no tested horizontal overflow.

All eight viewport tiers were checked in Light/Dark under reduced motion. Additional **synthetic 200% root-font text scaling** checks passed for public/auth screens, but are **not native browser zoom**. Formal zoom and assistive-technology certification remain Phase 15.

The UI must preserve task-specific readable prose widths and does not need every card or form to fill the 4K display.

- **Store discovery:** use card grid, meaningful category/store filters and available width; favor 3–6 columns when readable, depending on actual viewport and content. Avoid a single stretched 4K directory row.
- **Auth:** carefully centered bounded form with legible content; on wide screens, a split composition is acceptable only when both sides remain in usable balance. The dedicated form-layout redesign belongs to Phase 9.
- **Customer workflow:** clear breadcrumb/task state and purchase summary rather than fancy empty space.
- **Staff:** density and rapid queue scanning take priority, with deliberate row/column widths.
- **Org Admin/Platform Admin:** information-rich yet calm workspaces with scope-aware nav and authorization clarity.
- Test widths **320, 390, 768, 1024, 1440, 1920, 2560, 3840 CSS px**, 200% zoom and keyboard use. Physical 4K pixel density is not equivalent to CSS 3840 viewport and should be documented separately.

### Phase 6 implemented — Store-first campus marketplace

**The previous organization-row directory and duplicated featured-store links have been retired.** The home page now shows a compact task-first Hero, accessible Search, the existing Store Availability selector, and a new Organization selector driven by real public API organization IDs. Under the filters the primary result is a **card per active store**, linked with both organization and store ID. No-store organizations are listed separately as non-store articles. No fake store is created.

- New isolated card styles: `frontend/src/modules/storefront/storefront-grid.module.css`. Card variants have clear name, organization, description, truthful `ACTIVE` / **เปิดให้เข้าชม** label, and whole-card focusable click target.
- Layout columns under source data with enough entries: **1 at <=640px**, **2 up to 820px**, **3 up to 1100px**, **4 up to 1499px**, **5 from 1500–2099px**, **6 from 2100px upward**. Capped at 6 even on 4K; card copy stays readable.
- Public Storefront Store DTO includes only `storeId`, `organizationId`, `name`, `description`, `status`. **No media URL, product category, or current pre-order campaign status exists in this aggregate DTO.** Use an honest neutral no-store-image surface and do not infer that an ACTIVE store has an open campaign. A real category filter or actual cover image requires an explicit legitimate data contract in a future scoped phase; the current Organization selector is the grounded filter.
- Preserve 12 entries/page across store and no-store results, with all active store entries sorted before empty organizations as in the existing directory helper. Search is full dataset before pagination, Thai/English name matching, and both status and organization filters reset to Page 1. Do not treat featured/recommended duplication as more distinct stores.
- Cross-theme deterministic Playwright verified **26 stores and 2 empty organizations** across 3 pages, filtering, clearing, full dataset search, link parameters, 8 viewport column counts, no horizontal overflow, and neutral media fallback. These are browser-mocked GET responses, **not data created in DB**. Actual local data visibility and fixture filtering are separately Phase 7.

Details: `docs/design/CAMPUS_COMMERCE_A_PHASE6_STOREFRONT_GRID_REVIEW.md` and `frontend/quality-audit/.evidence/campus-a-phase6/`.

### Phase 7 implemented — QA fixture visibility and truthful guest states

- The local development aggregate contains **317 active organizations**, all corresponding to deliberate Dev Seed or test generator records in this observed snapshot (**272 QA stores, 45 QA organizations with no store**). This is a read-only observation, not new seed data.
- A normal **development** visitor now sees only organizations not matching strict recognition criteria. The deterministic local seed is recognized by exact organization ID; generated E2E records require paired generator-style organization name AND exact known QA description. Broad matches such as `QA`, `Demo`, `Tenant Org B` or `E2E` alone must never hide a potentially legitimate record.
- An explicit **development-only** `แสดงข้อมูล E2E/QA` control reveals recognized records without altering the API payload, and all shown QA store/no-store cards are labelled `ข้อมูลทดสอบ QA`. A clear banner distinguishes QA inspection mode from the visitor marketplace. Toggling off resets hidden organization selection and result pagination.
- A truly empty API response uses the existing generic Empty State; an API failure uses Error + Retry; an API containing only identified dev fixtures uses a different **no ordinary shops available** explanation, not a misleading search-only empty state.
- Because the API contains **no immutable `fixture` flag**, production **does not silently hide** records based on test-like naming. High-confidence recognized records may be explicitly labelled as test records if returned. Fully trustworthy production-side separation requires an authoritative backend provenance field and separately approved API migration; this visual review is not a security/access-control boundary.
- Counts, Search, Organization/Availability filters, Pagination and no-store sections are derived from the currently presented data, preventing hidden fixture counts or names from leaking into ordinary recommendations and filter options. Real-shop names containing `QA` or `Demo` are intentionally preserved.
- Existing Phase 2–4 visual hover/grid tests now use a deterministic read-only intercepted GET ordinary-store preview, not fragile real Dev Seed records. Phase 7 independently verifies the actual live local fixture default and explicit QA toggle.

Evidence: `docs/design/CAMPUS_COMMERCE_A_PHASE7_FIXTURE_VISIBILITY_REVIEW.md`, `frontend/quality-audit/.evidence/campus-a-phase7/`, and E2E suite `frontend/e2e/quality-audit/campus-a-phase7-qa-visibility.spec.ts`.

### Phase 8 implemented — Store, Product, Campaign guest commerce details

**Store Detail** now offers real client-side name/description Search within the loaded store's product list, and an OPEN-only campaign filter. Filter counts reflect the actual loaded list, with explicit filter-empty states and reset controls; store-level totals and links remain unchanged. OPEN campaigns sort first. Direct focus-aware in-page links and the scoped organization/store URLs continue to work.

**Product Detail** includes a compact three-step purchase guide and a selected-variant unit price × chosen quantity breakdown adjacent to the derived estimate, before redirecting to the existing authenticated order entry path. Only ACTIVE product variants from the authoritative existing service are selectable. A campaign must be OPEN, the quantity must be a positive integer, and the auth gate must pass for a purchase CTA; the backend order creation contract, selection IDs, returnTo login target and existing status guards remain unchanged. No quantity is falsely promised to be persisted through the existing link (it is chosen again in order entry if required).

**Campaign Detail** retains the authoritative status badge, exact dates/timeline and product link campaign context. The hero CTA is present only when the campaign is OPEN **and at least one product is available for viewing**; otherwise the text explains why it cannot proceed. Critically, the existing service returns the **store product catalog** rather than proven campaign-product membership, so the section labels products as store catalog and instructs customers to check actual eligibility on Product Detail. Do not claim all store products are orderable in that campaign.

**Visual implementation:** one semantic Light/Dark token system, clear keyboard-focus styling, consistent media fallbacks, fit-for-purpose desktop/4K card grids, bounded readable detail copy and compact 3-step guide with Mobile no-image fallback. No generated or invented catalog images; real product media continues to display only when the API provides it.

**Evidence:** `docs/design/CAMPUS_COMMERCE_A_PHASE8_PUBLIC_COMMERCE_REVIEW.md`, `frontend/e2e/quality-audit/campus-a-phase8-public-commerce.spec.ts`, `frontend/quality-audit/.evidence/campus-a-phase8/`. Phase 9 owns Login/Register redesign; Phase 10 owns detailed post-login returnTo recovery.

### Phase 9 implemented — Intentional Login/Register design

- **Layout:** Single-source `frontend/src/modules/auth/auth-form.module.css` replaces ~915 lines of repeatedly overridden auth CSS with one bounded, coherent split-screen login/register layout, a form card max width of 542px (560px on 4K), and an overall readable 1880px max canvas. On Mobile <=850px, the editorial introduction becomes a compact header and the account form occupies readable available width, not a narrow 4K sliver or a viewport-wide input line. Long register forms can scroll naturally.
- **Brand:** Text-only **UniStore Hub** on both auth routes, never a fake U badge, image logo or emoji. Rich introduction remains truthful: campus shops, orders, payments and pickup are accessible only according to account permissions.
- **UI:** Consistent semantic token-based Light/Dark panels, labels, controls, hover/focus, full-width 50px primary submit CTA, 44px interactive password visibility/secondary navigation targets, responsive 320–3840px and 200%-text scaling. Already-authenticated action cards reuse this same system without role/policy changes.
- **Behavior preserved:** Forms still use existing `auth-validation` rules, required labels, field-linked ErrorSummary with focus, server Error Notice, loading/disabled state (now also `aria-busy` on form), password-show button with `aria-pressed`, autocomplete hints and `useAuthNavigationContext` direct/returnTo links. No modifications to `auth-service`, auth token/session management or `return-route`. Login/register success still delegates existing navigation behavior. Detailed protected-route returnTo/RBAC incident belongs to Phase 10.
- **QA:** `frontend/e2e/quality-audit/campus-a-phase9-auth-layout.spec.ts` verifies both direct routes and returnTo-context forms with **intercepted GET /me and synthetic POST login/register failures** to prevent credential transmission or account creation. Covers 320–3840 widths, desktop/mobile, 200%-text scaling, error summary, reveal-password, busy/disabled and recovery links. Screenshots and metrics: `frontend/quality-audit/.evidence/campus-a-phase9/`. Report: `docs/design/CAMPUS_COMMERCE_A_PHASE9_AUTH_LAYOUT_REVIEW.md`.
- No commit, push or deploy; no backend/API, DB, AWS or tenant changes. Native zoom, manual screen readers, full actual authenticated order continuation and real signup/login against seeded accounts are outside this scoped visual phase.

### Phase 10 implemented — Authentication returnTo and protected order recovery

- A guest visiting a properly formed `/orders/new/?organizationId=...&campaignId=...&productId=...&variantId=...` sees a compact, accessible state with `UniStore Hub` text-only wordmark, an explicit sign-in action that preserves the full original query in `returnTo`, and a **back-to-product** action that goes to the public product instead of looping through the protected order gate.
- `getUnauthenticatedExit` is deliberately separate from the **successful** sign-in `returnTo`. It constructs public `/products/view/?organizationId=...&productId=...&campaignId=...` only for valid UUIDs; for incomplete/invalid order parameters or other protected routes it links to the public storefront. Normal successful login/register still returns to the exact sanitized original order URL including `variantId`, subject to subsequent authorization/stock validation.
- `AuthenticatedBoundary recoveryKind="order"` is enabled on `/orders/new` only. It prioritizes session hydration before anonymous/forbidden UI, with grounded loading, login, unauthorized and forbidden recovery actions. Generic Org/Platform/RBAC boundaries remain untouched.
- `AuthSessionStore` now versions in-flight `/me` restorations. Calling `establish(newToken)` invalidates pending old-token responses; a late old `TOKEN_EXPIRED` response cannot clear a newly obtained token. Logout also invalidates pending restorations. Parallel calls for the **same** token/session generation are still deduplicated. Access is still determined from authoritative `/me` identity/memberships, not from client-supplied role data.
- In `OrderCreateView`, a definitive invalid token on contextual product fetch logs out and returns to the guarded sign-in recovery rather than being stranded on a generic fetch error. A genuine API 403 displays an explicit no-permission state with safe store/order-list recovery. No RBAC checks, payment state, order payload, prices, or business rules were relaxed.
- Regression sources: `frontend/src/modules/auth/return-route-recovery.test.ts`, extended `session.test.ts`, `frontend/e2e/quality-audit/campus-a-phase10-return-to-order.spec.ts`. Browser responses are fully intercepted; **no real user login, order write, payment, or test tenant creation** is performed. Screenshots and results are in `frontend/quality-audit/.evidence/campus-a-phase10/`.
- The presentation of the order-creation form and visual overlap concerns discovered in its existing wide-screen layout are separately Phase 11 Customer Journey scope, not claimed as fixed here. This phase focuses on reaching the correct, authorized step without loops.


### Phase 11 implemented — Customer journeys and account workspace

- **Scope:** Signed-in customer Checkout, My Orders/Order Detail, Payment proof upload, Pickup token/QR and Notifications. Read status, ownership and valid transitions only from existing backend and application helpers. No backend/API modifications, invoice/payment amount overrides, new permission shortcuts or real DB writes.
- **Checkout:** The previous 4:3 image fallback with `min-height:250px` plus intrinsic aspect sizing could exceed its grid track and overlap product title/description at 1440px. `order-create.module.css` now uses bounded 220px media and `min-height:0`, a balanced zero-min-content two-column product Grid, safer wrapping and a compact 82px image on Mobile. Estimated price, positive quantity validation, OPEN campaign gating and `confirm` submission remain unchanged.
- **Order list/detail:** Uniform light/dark neutral surfaces, readable 4K content max width, bounded responsive columns, high-contrast active filter controls, useful 44px+ order actions, overflow-proof long order IDs and visible keyboard focus. Existing actionable-first status grouping, cancel confirmation and conflict-to-refresh behavior are preserved.
- **Payment:** The original proof upload / server-authoritative total and state are untouched. Responsive amount header, narrow-width file picker constraints, safe text wrapping and high-contrast focus/selected feedback. Direct presigned PUT, submission and review status logic unchanged.
- **Pickup:** Guarded token and QR view remains visible only when the existing backend order state permits it; not-ready flow continues to suppress QR creation. Narrow layouts stack token/QR, wrap long tokens and preserve a usable alternative when local QR generation fails.
- **Notifications:** Action-first grid stacks at tablet widths; long text no longer forces horizontal overflow; unread/read/filter/refresh controls preserve accurate state, and inline mark-read uses the existing route without changing business contracts.
- **Verification:** `frontend/e2e/quality-audit/campus-a-phase11-customer-workspace.spec.ts` uses only API-shaped mocked GET responses and an explicitly intercepted PATCH mark-read; it blocks all unmocked mutations. Covers six customer route families in both themes, 390/768/1024/1440/3840 CSS widths, text/media non-overlap, filtered order rows, cancel-dialog dismissal, upload-required validation, pickup token, notifications mark-read, network Error → Retry, no-notifications Empty and not-ready Pickup. Screenshots/metrics: `frontend/quality-audit/.evidence/campus-a-phase11/`; review: `docs/design/CAMPUS_COMMERCE_A_PHASE11_CUSTOMER_WORKSPACE_REVIEW.md`.
- **Not covered:** Real order creation/cancellation, actual upload to storage, payment approval and pickup confirmation, physical 4K display calibration, browser/assistive tech manual checks or every possible backend failure state. High-risk mutations remain intercepted.


### Phase 12 implemented — Staff operations task-first workspace

- **Scope:** Organization Staff operational routes: Orders queue/detail, Payments review, Pickups handover. A shared read-only Production Summary is styled consistently but its route is **Organization Admin only**; Staff access remains forbidden by `OrganizationBoundary` and is browser-tested. No backend endpoints, RBAC, tenant filtering, order/payment/pickup state rules, or stored records were changed.
- **Navigation and filters:** `staff-operation-nav.module.css` and `queue-priority-controls.module.css` use 44px+ focusable targets, readable active states, unselected-state hover contrast under Light and Dark themes, and a fully visible two-column responsive filter group instead of inaccessible horizontal clipping. Counts still refer **only to loaded records**, not total system records.
- **Orders:** `organization-orders.module.css` now bounds the 4K operational canvas to 2600px, uses min-content-safe queue rows and labels, keeps next-task links 44px+, and adapts three server-backed filter fields from 3 → 2 → 1 columns without overflowing. Staff can inspect Order details; admin-only cancellation still requires existing authorization and confirmation.
- **Payments:** `organization-payments.module.css` adjusts Queue/Review detail from a minimum 370px right column to proportional, readable widths; below 1180px columns stack in flow without hidden detail. Selected row, 2-column authoritative payment/order facts, approval/rejection trigger focus and filters are legible. **The existing confirm/reject dialogs and authoritative server recheck remain unchanged.**
- **Pickup:** `organization-pickups.module.css` makes Token/Order detail readable, selected row distinguishable, and confirmation actions accessible. Workbench stacks below 1180px; filters adapt 4 → 2 → 1 columns. **No pickup handover is ever confirmed by browser QA.**
- **Production Report:** `production-summary-view.module.css` bounds the read-only organization-admin report, keeps quantity table/variant cards readable and prevents overflow for long identifiers on Mobile. Staff remains denied.
- **Browser QA:** `frontend/e2e/quality-audit/campus-a-phase12-staff-operations.spec.ts` uses synthetic membership and intercepted API-shaped read responses. Exercises Staff Orders, Order Detail, Payment selection and approval modal Escape, Pickup selection and confirm modal Escape, Staff denial on production and cross-tenant access, and authorized Org Admin report. Covers Light/Dark and 320–3840 widths without horizontal overflow; screenshots/metrics in `frontend/quality-audit/.evidence/campus-a-phase12/`. Every unexpected POST/PATCH is blocked; no real writes.
- **Not tested:** Live approval/rejection/confirmation, source-backed production report at the customer’s actual data scale, every filter-pagination combination, OS-native zoom/screen-reader testing, non-Chromium browser parity. Testing simulated UI flows **does not authorize data mutation**. Report: `docs/design/CAMPUS_COMMERCE_A_PHASE12_STAFF_WORKSPACE_REVIEW.md`.


### Phase 13 implemented — Organization Admin and tenant-scoped management

- **Scope:** Authorized Organization Admin routes `/org/select`, `/org/dashboard`, `/org/settings`, `/org/staff`, `/org/stores`, `/org/products`, `/org/campaigns`, `/org/audit` plus shared `/org/orders`, `/org/payments`, `/org/pickups`, `/org/production` reviewed in Phase 12. Changes are **frontend-only CSS**; no backend/DB/RBAC/session/business rules were changed.
- **Desktop/4K:** Admin canvas bounded at 2600px (retains Phase 3's greater-than-2300px dashboard requirement on 3840 CSS px). Main task views use proportional queue/summary with editor/side panel maximum 640–720px, and naturally stack into a single column at tablet widths. Long IDs, prices and names wrap; important links/buttons expose 44px+ targets and visible keyboard-focus outlines.
- **Tenant context:** Existing `OrganizationAdminNav` route links retain the **same** verified `organizationId` across dashboard, staff and settings; switching organizations explicitly returns to `/org/select/`. The active tenant name remains displayed by the existing workspace header/shell, not fabricated or read from untrusted route labels.
- **Concrete screenshot fix:** `Settings` previously rendered “ข้อมูลที่แสดง” one character per line around 1440px because its `sectionHeading` occupied too little of the CSS Grid. Scope the edit-section heading to **one full-width row** and cap form editor at 760px, with a 1100px max panel and a proportionally constrained explanatory side panel. Browser regression asserts minimum 145px heading width.
- **Theme and states:** Light/Dark hover on selected rows preserves `--ink` and `--brand-soft` contrast; focus styling and minimum target sizes are applied to settings, staff, stores, product/variant, campaign, audit and navigation modules. Date, status, membership and campaign lifecycle values still come from existing API DTOs.
- **Read-only QA:** `frontend/e2e/quality-audit/campus-a-phase13-organization-admin.spec.ts` intercepts API GETs with synthetic active Org Admin membership/records. It samples 8 routes × 8 widths (320–3840px) × 2 themes, captures Mobile/Desktop/4K screenshots, validates overflow, same-tenant admin navigation, settings field validation without actual PATCH, last-admin removal guard, audit visibility and denied STAFF/other-tenant access. Every unexpected POST/PATCH/DELETE is blocked.
- **Evidence:** `frontend/quality-audit/.evidence/campus-a-phase13/`, review `docs/design/CAMPUS_COMMERCE_A_PHASE13_ORG_ADMIN_REVIEW.md`.
- **Limits:** Does not certify every mutation/modal state, actual membership additions/removals or settings PATCH, backend data correctness, mobile browser/native zoom/screen reader, or role/action permutations. Comprehensive cross-role QA remains Phase 15.


### Phase 14 implemented — Platform Admin and shared role edges

- Platform overview, organization review and read-only user directory use Campus Commerce A's **text-only UniStore Hub** identity and semantic Light/Dark tokens. The admin canvas expands to up to 3040 CSS px on 4K; compact metrics remain within 2600px, organization cards use two columns above 2100px while preserving PENDING-first DOM ordering, and metadata/action slots remain individually bounded and readable. Narrow viewports use stacked review cards and a semantic user row-card table.
- Platform workspace nav/filter chips have readable default, hover, active, keyboard focus and pressed states with >=44px click targets; theme-safe ink/background pairings are `--ink`, `--ink-secondary`, `--surface-hover`, `--brand-soft`, `--brand-strong`, `--brand-on`, `--focus`. The existing `ConfirmDialog` remains the only path to approval/suspension.
- Existing Platform Users API is GET-only; no fake user status mutation UI has been added. Non-platform roles (anonymous/Customer/Staff/Organization Admin) remain rejected by `PlatformAdminBoundary`, and organization workflows remain subject to their existing service/state-transition semantics. Platform is never inferred from a tenant organization role.
- `frontend/e2e/quality-audit/campus-a-phase14-platform-admin.spec.ts` performs 3 routes × 8 viewports × 2 themes geometry, 4 non-platform roles × 3 routes × 2 themes forbidden controls, empty/error states, filter/search, dialog Escape and simulated approval. **Every browser API write is blocked except a narrowly intercepted test-only POST that returns a synthetic DTO; no real mutation or DB traffic is permitted.**
- Artifacts and test limits: `docs/design/CAMPUS_COMMERCE_A_PHASE14_PLATFORM_ADMIN_REVIEW.md`, `frontend/quality-audit/.evidence/campus-a-phase14/`. Exhaustive browser/action inventory, WCAG AA contrast matrix, all popup states and cross-browser verification remain Phase 15.


### Phase 15 audited — comprehensive responsive, theme and interaction evidence

- Phase 15 browser route verification: **28 canonical routes × 8 CSS widths (320–3840) × Light/Dark = 448/448** direct visual geometry observations, 168 screenshot files at 390/1440/3840; zero reported horizontal overflow, clipped focusables, broken images, page errors or axe A/AA findings in the loaded snapshots. This covers one primary authorized role per route, not all role/state combinations.
- Additional authorized route/role cases: **11 combinations × 5 widths = 55 checks**, no reported overflow, image error, page error, axe finding or intercepted business writes.
- Modal interaction: **24 direct nonmutating Customer/Staff dialog cases** at four widths × two themes, with focus trap, Escape, focus return and bounded geometry; separate Platform Admin modal checks. No real approval, rejection, cancellation or pickup confirmation.
- Text scaling: 7 representative route surfaces × 2 themes × 2 widths at CSS root font-size 200% = **28/28** no overflow/clipped controls; NOT a claim of native 200% browser zoom or physical screen reader testing.
- Action proof inventory: **257 stable IDs**; **23** had a direct current-run PASS for one named state and **234** have no current-run direct action proof (NOT_TESTED). **0** are certified across every declared state. Neither screenshots nor normal route loads imply an action pass.
- Link to authoritative scope/evidence and unresolved limits: `docs/design/CAMPUS_COMMERCE_A_PHASE15_COMPREHENSIVE_AUDIT.md`, `frontend/quality-audit/.evidence/campus-a-phase15/`. Existing local fixture display provenance is heuristic in the presentation layer, not immutable backend proof. Firefox/WebKit, native browser zoom, release/security checks and integration mutation tests remain Phase 16.


## Component and state contract

Base components: Primary/Secondary/Quiet/Danger buttons; Links; Inputs/Selects/Search; Cards; Tabs/Sidebar; Dialog/Drawer; Tables/Queues; Toast/Notice; Status; Loading/Empty/Error/Unauthorized/Forbidden.

Each component requires **default, hover, focus-visible, active, selected, disabled, pending, success and failure** states where relevant. Screen reader names, contrast, pointer and keyboard interactions should be consistently supported in all authorized roles. Keep a separate operational style density but shared semantics.

### Areas of work / progression

| Phase | Boundary |
|---|---|
| 2 (completed) | Single authority, semantic light/dark colors, *text-only wordmark* in all global shells, regression snapshots |
| 3 (implemented) | Responsive 4K/grid-container widths and spacing calibration |
| 4 (implemented) | Shared primitive interactive states, contrast and guarded keyboard/overlay checks; broader cross-role permutations remain Phase 15 |
| 5 (implemented) | Lucide functional icon set, Unicode arrow clean-up, and removal of legacy U-shaped brand illustrations |
| 6 (implemented) | Real store-first grid, organization/store filters, honest media fallback and mobile–4K pagination/visibility |
| 7 (implemented) | Development-only strict fixture isolation; explicit QA mode, counts, filters, and real loading/empty/error states |
| 8 | Public store/product/campaign detail |
| 9–10 | Auth UX and verified protected-route returnTo |
| 11–14 | Customer, Staff, Org Admin, Platform Admin route families |
| 15–17 | 28-route/5-role responsive and interaction QA, cross-browser tests, final diff review |

## Safety and evidence

- Do not change backend access decisions, tenant isolation, business transitions, API payloads, payment or pickup semantics for a visual rewrite.
- Local QA/demo tenant data should not be deleted or blurred into consumer products; review explicit safe provenance before any filtering.
- Every phase must record before/after browser screenshots and test its own claims. A rendered route does not mean all its controls, roles, auth states and modals have been verified.
- Only mutate workspace files on user request. No Git commit, push, deploy or production access under the current phase-by-phase implementation authorization.
- Known prior development-only `braces` audit exception remains recorded as a local, time-bounded risk; visual work must not alter or conceal it.

**Historical note:** Old Playful Campus Commerce v3 and purple/3D recommendations are superseded, not to be reintroduced into CSS modules. This file replaces that authority rather than introducing a second design system.
