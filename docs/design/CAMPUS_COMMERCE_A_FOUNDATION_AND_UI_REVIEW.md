# UniStore Hub — Foundation And Ui

> Historical implementation, testing and decision evidence consolidated by subject. This is a review archive, **not** the product/API specification. Current security and NOT_TESTED limitations remain binding.

---

## UniStore Hub — Campus Commerce A — Baseline Audit


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub` — local BDXA only
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Committed baseline:** `b263f76` (`main`, ahead of origin by 1 before this phase)
**Phase scope:** read-only inspection, screenshot capture, browser QA and evidence. **No application UI or Backend changes**, no data reset, Commit, Push or Deploy.

### Baseline and verification matrix

Source inventory: `docs/design/ROUTE_ROLE_STATE_MATRIX.json` and `frontend/quality-audit/coverage-baseline.json`: **28 canonical routes, 207 route action IDs plus 50 shell action IDs = 257**. This is an inventory, not a certification that every control/state was clicked.

Local browser: Next.js at `http://localhost:3000`; test backend on `http://localhost:4000/api/v1`. The Node/Playwright guarded smoke harness uses local seeded role-login, GET-only browser routes and intercepted browser mutations; **zero Browser API write operations** were issued in these scoped tests. Seed authentication uses local fixture credentials and is not a real customer checkout mutation.

- **Primary role per route:** `npx playwright test e2e/quality-audit/responsive-a11y.spec.ts --project=chromium` — PASS, 28 routes × widths 320/390/768/1024/1440 = **140 captures/checks**; no test-reported horizontal overflow, image failures, JS page errors, HTTP 5xx, clipped controls or automated axe violations. Latest evidence: `frontend/test-results/quality-audit/uxqa-19dbaea5-cca2-4f6a-bba1-7b92f2364a95/design-quality/responsive-a11y-matrix.json` and `route-01-320.png` through `route-28-1440.png`.
- **Additional authorized role variants:** `npx playwright test e2e/quality-audit/authorized-route-role-coverage.spec.ts --project=chromium` — PASS, **11 role-route combinations × 5 widths = 55 checks**, with zero blocked browser writes, page errors, broken images, horizontal overflow or automated axe violations in recorded outcomes. Latest evidence: `frontend/quality-audit/.evidence/design-quality/secondary-roles-a5da83f5-9b6e-49fc-bfcb-68e685768e24/secondary-route-role-matrix.json`.
- **Total scoped checks:** **195 route-role-viewport observations**. This does NOT test all 257 actions, every denied-role/state, full keyboard behavior, real payment/pickup writes, persisted returnTo authentication, third-party image licensing or production usability.
- **Extra live viewport review:** independent local Playwright guest browser measurements at 390, 1440, 1920, 2560 and 3840 CSS px under both light/dark browser color schemes. Evidence `frontend/quality-audit/.evidence/campus-commerce-baseline/wide-and-auth-metrics.json` with before captures `storefront-dark-390-measured.png`, `storefront-dark-3840-measured.png`, `storefront-light-390-measured.png` and `storefront-light-3840-measured.png`.

#### Canonical route families and representative roles

| Role / surface | Canonical routes |
|---|---|
| Guest/public and signed-in browsing | `/`, `/login/`, `/register/`, `/stores/view/`, `/products/view/`, `/campaigns/view/` |
| Customer transaction | `/orders/new/`, `/my/orders/`, `/my/order/`, `/my/payment/`, `/my/pickup/`, `/notifications/` |
| Staff + Organization Admin shared | `/org/select/`, `/org/orders/`, `/org/orders/view/`, `/org/payments/`, `/org/pickups/` |
| Organization Admin | `/org/dashboard/`, `/org/settings/`, `/org/staff/`, `/org/stores/`, `/org/products/`, `/org/campaigns/`, `/org/production/`, `/org/audit/` |
| Platform Admin | `/platform/summary/`, `/platform/organizations/`, `/platform/users/` |

The 28 route source roles were read from the maintained manifest; do not infer that every other role is denied correctly without corresponding negative authorization tests.

### User screenshot findings — root causes and follow-up

| ID | Severity | Observed symptom and verified source/evidence | Fix owner phase |
|---|---|---|---|
| P1-01 | **Critical UI contrast** | In the current `frontend/src/modules/storefront/storefront-landing.module.css`, `.storeRow:hover` forces **`#eef5f0`** independently of Dark Mode text. Actual local dark browser contrast of hovered store name against row: **1.03:1**; equivalent light browser: **13.21:1**. Make background/foreground an explicitly paired semantic interactive token and retest hover/focus for all roles. | 2, 4, 15 |
| P1-02 | **Major 4K responsive** | Storefront `.hero`, `.finder`, `.catalog`, `.discovery`, `.footer` use fixed `1360px` cap. In live Playwright, hero is **1360px** at 1440, 1920, 2560 and 3840 widths, using 94%, 71%, 53%, and **35%** of the viewport respectively (390px => 358px, 92%). Global `--content-max` 1240px and `--content-wide` 1440px reinforce mismatched area caps. Move to responsive container sizing with readable content limits. | 3, 6, 11–15 |
| P1-03 | **Major discovery IA** | Current `storefront-landing.tsx` builds directory entries then groups each page by organization; `.organizationList` is one vertical row/card per organization with nested `.storeRow`. User requests primary **store-first grid**. Preserve filter/page semantics, show 0-store organizations separately. | 6, 8 |
| P1-04 | **Major QA presentation** | User screenshots show `UniStore Local Demo` and `harness-phase5-...` entries mixed with visitor recommendations/directory. Current `storefront-directory.ts` `isExplicitAutomationFixture(name)` is a **name-based heuristic**; `storefront-landing.tsx` only applies it under `NODE_ENV=development` and includes fixtures when the QA toggle is enabled. The displayed `UniStore Local Demo` is not covered by that fixture-name expression. Actual data provenance/legitimate storefront classification is **NOT VERIFIED**; do not delete records or hide by generic name alone. | 6, 7 |
| P1-05 | **Major brand consistency** | User rejects boxed U logo. `storefront-header.tsx`, `auth-page-frame.tsx` and `application-shell.tsx` all render `brandMark` / store icon. They must render only text **UniStore Hub** for all roles, with no substitute logo, while preserving functional nonbranding icons. | 2, 5, 9, 11–14 |
| P1-06 | **Major interaction coherence** | Raw `↗`/`→` text glyphs appear in `storefront-landing.tsx` (8 occurrences), other storefront details, while custom `WorkspaceIcon` paths differ from raw text arrows. Native select currently uses forced `color-scheme:light` even in dark layout. Unify nonbranding icons and form focus/hover states. | 4, 5, 8, 15 |
| P1-07 | **Major spacing/auth layout** | `auth-form.module.css` contains 990 lines with later redefinitions of earlier auth `.page`, `.intro`, `.panel`, `.panelInner`; two-column desktop split and `minmax(430px,...)`, visually limited form `472px` at 1440. Align one canonical auth layout and tablet/4K/mobile spacing; retain readable form max-width. | 3, 9, 15 |
| P1-08 | **Major protected-route recovery** | `/orders/new/` wraps `OrderCreateView` in `AuthenticatedBoundary`; unauthenticated requests render `UnauthorizedState` from `state-panel.tsx`, which produces a standalone `<section>` without the normal page `<main>` and recovery shell. This corresponds to the oversized mostly empty state in screenshot 8. `LoginAction` does construct a returnTo login link; `login-form.tsx` establishes a session then navigates to sanitized return path. **Actual successful post-login returnTo behavior is NOT VERIFIED here**: don't call a redirect/session loop confirmed until an authenticated clickthrough reproduces it. Improve guard recovery and test exact query-preserving authenticated flow, without RBAC bypass. | 9, 10, 15 |

### Design authority conflict / implementation gate

The committed `frontend/.interface-design/system.md` still declares **Playful Campus Commerce v3** with purple/indigo identity and allows decorative clay/3D, while the user has now chosen **Campus Commerce A**: restrained accessible warm light/green, Dark Mode, no brand graphic. `frontend/src/app/globals.css` already contains newer deep teal semantics, but page CSS retains hardcoded light hues and duplicated overrides. Phase 2 must **update the existing canonical design authority** rather than add a parallel theme system. Keep versioned historical rationale only as needed; use a single semantic token source.

Recommended implementation order remains the active 17-phase BDXA plan. The highest-priority first actual code change in Phase 2 is the light/dark semantic token foundation and text-only brand. Phase 4 handles broken dark hover contrast; Phase 3 addresses 4K/container widths.

### Audit boundaries and tests NOT executed

- No editing of app source, no Backend/DB mutation, no remote browsing, Git Commit/Push/Deploy, or real user authentication occurred in this phase.
- The **195 successful captures** are page-structure/viewport checks and scoped axe audits, not verified mouse/keyboard clickthroughs for all 257 actions. The protected-order recovery bug and full returnTo after login require independent Phase 10 end-to-end validation.
- The extra wide-screen guest measurement used development/local data and found one visible store row under each theme. E2E-harness store names were not present in that default view; screenshot reports showing many fixtures may reflect the user's QA toggle being enabled. This does **not** establish source provenance of any store.
- No full performance/Core Web Vitals, true physical 4K monitor colorimetry, screen reader assessment, 200% browser zoom or authentic visual approval was completed. Those belong to later phases.
- Historical docs `docs/design/ROUTE_ROLE_STATE_MATRIX.json` and `frontend/.interface-design/system.md` should not be silently treated as current Design A specifications until deliberately revised in their respective implementation phases.

**Phase 1 verdict:** Baseline source + browser/role audit completed and documented. Known visual defects are **OPEN for future implementation**, not fixed by these passing observational tests. Phase 2 may start with explicit user instruction.

---

## UniStore Hub — Campus Commerce A — Implementation & Review


**Date:** 2026-10-19
**Plan:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Scope:** Workspace-only Phase 2: token/design authority + text-only branding and associated hover guard. **No Commit, Push, Deploy or business-record mutation.**

### Completed implementation

1. **Canonical design authority replaced** in `frontend/.interface-design/system.md` with the approved **Campus Commerce A** visual foundation: warm light backgrounds, muted greens/teal, readable dark mode, clear Thai typography, role-specific density, semantics, responsive intent, accessibility states and a text-only brand directive. The old purple/Playful v3 design is now historical in Git, not a parallel active standard.
2. **Global semantic tokens updated** in `frontend/src/app/globals.css`. Light/dark canvas, raised/muted/hover/selected surfaces, foreground hierarchy, brand/on-brand colors, accents, gradients and ambient effects now share a coherent botanical color world. Added theme-resolving `--on-surface`, `--on-surface-secondary`, `--on-hover`, and `--on-selected` foreground aliases. Existing status role tokens and protected interactions remain intact.
3. **Removed logo symbols and tagline from brand links** across `frontend/src/modules/storefront/storefront-header.tsx`, `frontend/src/modules/auth/auth-page-frame.tsx` and `frontend/src/components/layout/application-shell.tsx`. Every global shell brand is now visible text **UniStore Hub** alone. Removed related orphan `.brandMark` and brand-subtitle selectors from each of the corresponding CSS modules. Functional navigation icons elsewhere are preserved.
4. **Fixed a directly contradictory hardcoded hover color** in `frontend/src/modules/storefront/storefront-landing.module.css`: `.storeRow:hover` now uses `--surface-hover` plus `--on-hover`, removing the previously measured ~1.03:1 Dark Mode text contrast defect.
5. **Mobile-specific regression corrected** in `frontend/src/modules/storefront/storefront-view.module.css`. Previous `@media (max-width:420px)` hid `.brandCopy` because a logo-only mode existed. Header now wraps brand text and navigation onto readable lines at mobile widths instead of hiding `UniStore Hub` after logo removal.

### Regression evidence

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| Unit tests `npm test -- --reporter=dot` | **360/360 PASS (91 files)** |
| Local guarded new foundation E2E `e2e/quality-audit/campus-commerce-ui.spec.ts` | **4/4 PASS**, covering two schemes, guest public/auth wordmark, hovered directory text contrast >=4.5:1, responsive Guest widths 390/1440/3840 CSS px, and authenticated Customer/Staff/Org Admin/Platform Admin wordmark |
| Existing 28-route Chromium viewport/a11y regression | **140/140 CAPTURED** (28 routes × 320/390/768/1024/1440); all recorded outcomes free of browser page errors, 5xx, broken images, clipping, unlabeled controls, horizontal overflow and automated axe violations; **zero browser API writes** |
| `npm run build` | **PASS; 30/30 static pages** |
| `git diff --check` | PASS |
| Post-fix mobile live verification | Light and Dark at 390px each show `UniStore Hub`, **zero brand icons and zero horizontal overflow** |
| Extra before/after screenshot record | `frontend/quality-audit/.evidence/campus-commerce-baseline/` → `frontend/quality-audit/.evidence/campus-commerce-foundation/` |

The latest complete 28-route test JSON is `frontend/test-results/quality-audit/uxqa-2ee37a75-e9b7-45f2-80a6-8041f7425c37/design-quality/responsive-a11y-matrix.json`. Phase 2 screenshot JSON: `frontend/quality-audit/.evidence/campus-commerce-foundation/visual-baseline.json`. Both light/dark mobile after screenshots were refreshed after fixing the temporary hidden-wordmark regression.

### Known gaps carried forward — NOT fixed/NOT certified here

- **Phase 3:** Actual 4K fluid expansion/layout caps, comprehensive spacing and container queries. Passing the 3840px no-overflow wordmark test does **not** mean 4K makes good use of the whole display.
- **Phase 4:** Audit all hover/active/selected/focus/disabled/validation state combinations for all CSS modules and both themes. Only the explicitly broken Storefront directory hover and the foundation-level primitives were addressed here; do not claim every possible hover contrast is solved.
- **Phase 5:** All mismatched operational icons/raw `↗`/arrow symbols still await harmonization. Only prohibited logo graphics were removed in Phase 2.
- **Phase 6–8:** Storefront full Store Card Grid, QA E2E fixture visibility and public catalog details are unchanged.
- **Phase 9–10:** Login/Register major layout redesign and protected-route returnTo after successful sign-in are unchanged.
- **Phase 11–14:** Dedicated route-specific Customer, Staff, Organization Admin and Platform Admin UX improvements continue in their planned phases.
- **Phase 15+:** 200% browser zoom, full keyboard focus sequences, all 257 action IDs in every state, production integration and physical 4K colorimetry remain NOT_TESTED.
- **Security:** Existing local, time-limited vendored development-only `braces` risk acceptance remains unchanged. This visual work does not imply a clean full npm audit or permission to deploy.

### Phase verdict

**PASS within Phase-2 authorized scope.** The selected A design tokens and *text-only* `UniStore Hub` brand are in the frontend, the discovered mobile logo-removal regression was corrected, and scoped real-browser/tests/build checks pass. No work on Phase 3 requirements is represented as completed.

---

## UniStore Hub — Campus Commerce A — Fluid Responsive & 4K Review


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub` (local BDXA workspace only)
**Plan:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 3 — Fluid responsive layout, 4K and spacing foundation
**Outcome:** **PASS within Phase-3 scope**; subsequent interaction, true store-first grid, auth UX and other-role redesign phases remain open. **No Commit, Push or Deploy.**

### Changes made

1. Updated `frontend/src/app/globals.css` width tiers: `--content-marketplace: 3360px`, `--content-visual: 2920px`, `--content-wide: 3000px`, `--content-operations: 2880px`, `--content-max: 2680px`, `--content-detail: 2480px`, `--content-customer: 1960px`; retained bounded `--content-narrow: 900px` and `--content-reading: 720px` for forms/prose/status. The global `--page-gutter` is now fluid `clamp(16px, 2.4vw, 72px)`, retaining compact 24px/20px/16px/12px overrides in existing media queries. Spacing remains built around shared 4px/8px tokens.
2. In `frontend/src/modules/storefront/storefront-landing.module.css` aligned **hero, finder, catalog, discovery, loading area and footer** to the same 3360px maximum and shared gutter. Removed double content padding at catalog/discovery/footer where their outer widths now already account for gutters, ensuring consistent aligned content edges. The interim existing organization directory now uses `repeat(auto-fill, minmax(min(100%, 760px), 1fr))`, not infinitely long stretched 4K cards. The teaser grid remains intentionally capped near 1920px to keep three featured tiles readable.
3. In `frontend/src/modules/storefront/storefront-view.module.css`, public navigation can use wide marketplace tiers and the public store/product/campaign content uses a bounded `--content-detail` width, avoiding an unreadably stretched detail page.
4. In `frontend/src/modules/orders/organization-orders.module.css`, staff-accessible organization order screens now use `--content-operations` instead of fixed 1440px.
5. In `frontend/src/modules/auth/auth-form.module.css`, the complete auth split screen is now bounded at 2048px and centered on ultra-wide viewports; **individual form inputs remain bounded**. Dedicated Login/Register composition improvements remain Phase 9.
6. Updated the canonical `frontend/.interface-design/system.md` with live sizing rules and measured outcomes. No second design-system layer was added.

### Verified live browser viewport matrix

Measured from the actual local Next.js site after data loaded, under Light and Dark browser color schemes and reduced motion:

| CSS viewport | Main storefront hero/catalog width | Organization directory columns* | Document overflow |
|---:|---:|---:|---:|
| 320px | 296px | 1 | 0 |
| 390px | 358px | 1 | 0 |
| 768px | 720px | 1 | 0 |
| 1024px | 975px | 1 | 0 |
| 1440px | 1371px | 1 | 0 |
| 1920px | 1828px | 2 | 0 |
| 2560px | 2437px | 3 | 0 |
| 3840px | **3360px** | **4** | 0 |

*Measured while one live store row was present; number of actual visible cards is determined by filtered data and pagination.

**Before:** 4K storefront hero limited to 1360px, about 35% of width.
**After:** 3360px out of 3840px, **87.5% of the viewport**. The hero, finder and catalog now share left edge x=240px at 3840px. At 1920px hero uses ~95.2%; at 2560px ~95.2%. These are CSS viewport measurements, not a claim about the user's physical monitor's scaling setting.

#### 4K role-specific main content widths

| Authenticated role | Main at 3840px | Notes |
|---|---:|---|
| Customer | 1960px | Keeps transaction/prose content readable |
| Staff (organization order queue) | 2880px | Expands operational space |
| Organization Admin | 2680px | Expands management/reporting surfaces |
| Platform Admin | 3000px | Wide management workspace |

All scoped role/viewport checks had **zero document horizontal overflow**. The wider account panels and tables are not automatically certified for every interaction or exceptionally long data string.

### QA and testing evidence

- **Phase 3 Chromium adaptive browser tests:** `frontend/e2e/quality-audit/campus-commerce-ui.spec.ts` — **4/4 PASS**. Covers Light/Dark, Guest Storefront widths 320/390/768/1024/1440/1920/2560/3840, Customer/Staff/Org Admin/Platform Admin widths 390/1024/1920/2560/3840, no document overflow, header/catalog alignment, loaded directory column count, and 4K width thresholds. **56 route–role–viewport observations** documented in `frontend/quality-audit/.evidence/campus-commerce-responsive/responsive-metrics.json`. Captured **26 PNG screenshots** in the same evidence directory.
- **Text accessibility scaling smoke:** `frontend/e2e/quality-audit/responsive-accessibility.spec.ts` — **1/1 PASS**, **24 synthetic root-font 200%-size observations** for the public landing, Login and Register under two themes and widths 390/768/960/1920. None exhibited document-level overflow. This is CSS text enlargement, **not native browser zoom** or assistive-technology certification. Metrics: `frontend/quality-audit/.evidence/campus-commerce-responsive/text-scale-200pct.json`.
- **28-route responsive and read-only security regression:** `e2e/quality-audit/responsive-a11y.spec.ts` — **1/1 PASS**; **28 canonical routes × five widths = 140 captured states** with no reported horizontal overflow, broken images, clipped controls, page errors or automated axe violations in the recorded outcomes; **0 intercepted API writes**. Durable copy of the full result: `frontend/quality-audit/.evidence/campus-commerce-responsive/route28-final-matrix.json`. Runner log and exit-code evidence: `route28-final-archive.log` and `route28-final-exit.txt` (0).
- **Existing Phase 2 foundation smoke:** **4/4 PASS** after Phase 3 updates, including text-only `UniStore Hub` brand, both color schemes and hovered store-row contrast.
- **Unit tests:** **360/360 PASS** across 91 files.
- **`npx tsc --noEmit`, `npm run lint`: PASS**.
- **`npm run build`: PASS**, Next.js static export generated **30/30 static pages**.
- **`git diff --check`: PASS**. Only in-workspace frontend/design documentation and tests were touched; no business data was changed.

### Scope boundaries / deferred findings

- The interim multi-column **organization** directory is not the requested store-first image/card grid. Preserve that independent redesign for **Phase 6**, with Search/Filter/Pagination and truthfully labeled fixture data for Phase 7. Do not treat the interim columns as completion of Phase 6.
- Dedicated primitive hover/focus/selected/disabled contrast and keyboard/multi-overlay interactions remain **Phase 4**, coherent icon replacement **Phase 5**.
- Login/Register visual refactor is **Phase 9**; `returnTo` after successful authentication and protected-route recovery is **Phase 10**, not asserted here.
- All cross-role route action combinations, native 200% browser zoom, real 4K monitor inspection, 4K at operating-system scale 200%, full assistive-technology/manual UX testing and production API integrations are **NOT_TESTED**, reserved for later audit/review.
- Frontend existing local development-only `braces` security risk exception remains documented in earlier phase evidence and was not modified, hidden or declared clean.
- No Git Commit, Push, Deploy, external workspace or Production access.

**Phase 3 verdict:** PASS for **fluid containers, shared gutters, responsive width tiers, interim organization column scaling, and guarded viewport regression**. Phase 4 may begin upon next explicit continuation request.

---

## UniStore Hub — Campus Commerce A — Interaction & Overlay Review


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub`, local BDXA only
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 4 — Accessible interaction and overlay component states
**Verdict:** **PASS for the scoped shared interaction-component foundation.** This is not a statement that every modal, role, browser or 257 action IDs has been manually operated. No Commit, Push, Deploy, AWS access or real business-data changes.

### Implemented changes

1. **Single light/dark semantic state system** in `frontend/src/app/globals.css`: paired `--control-disabled-bg`, `--control-disabled-ink`, `--control-disabled-line`, `--control-option-bg`, `--control-option-ink`, `--interactive-row-bg`, `--interactive-row-ink`, `--interactive-selected-bg`, `--interactive-selected-ink` and `--control-native-scheme`. Native UI options use the actual Light/Dark scheme, not forced Light Mode. Updated modal overlay tint to calm forest/charcoal rather than previous purple scrim.
2. **Shared primitive controls** in `frontend/src/components/ui/primitives.module.css`: removed whole-button opacity fading on Disabled, instead use visible explicit background/text/border; same treatment for disabled Dialog Close. Explicit focus-visible outlines on buttons and Dialog Close, selected option backgrounds/foregrounds, and table hover/focus-within and selected-row pairs. Fields use readable foreground/background during hover/focus; select options receive explicit colors.
3. **Consistent minimum touch-area sizing**: shared small/medium/large buttons and controls use 40/44/48px; minimum/comfortable targets 44/48px. Individual operational controls and special route-specific icons will receive focused review in later Phases.
4. **Storefront finder** in `frontend/src/modules/storefront/storefront-landing.module.css`: native search Input and Dropdown use theme-driven colors and border/hover/disabled states. Dropdown options match the theme; primary Search button uses semantic brand/on-brand colors rather than hardcoded aqua.
5. **Storefront discovery and directory interactions**: discovery-card palette now uses semantic Light/Dark surfaces, label hierarchy and hover colors. Store Rows use a paired foreground/background on Hover and Focus. Disabled pagination no longer globally fades text.
6. **Interaction tests**: new `frontend/src/components/ui/button.test.tsx` covers Pending/Disabled click protection, aria-busy and usable labels. Existing Dialog unit test expanded with Escape close and focus restoration. New read-only browser verification `frontend/e2e/quality-audit/campus-commerce-ui.spec.ts` measures actual CSS foreground/background and focus on the local Storefront and Login pages under both themes. No fixtures were created/edited.

### Verified actual browser contrast

Computed from actual Chromium color values using WCAG contrast ratio math, not guessed from source:

| Pair / state | Light | Dark | Required |
|---|---:|---:|---:|
| Store Row name on Hover | **11.48:1** | **9.36:1** | ≥4.5:1 |
| Native Select text/background | **12.66:1** | **14.95:1** | ≥4.5:1 |
| Disabled text/background semantic pair | **5.55:1** | **6.24:1** | ≥4.5:1 |

- **14/14** sampled semantic state foreground/background pairs exceeded **4.5:1**, including normal/hover/disabled/selected/options/danger/primary button roles in both themes. Source: `frontend/quality-audit/.evidence/campus-commerce-interaction/semantic-state-contrast.json`.
- **Keyboard Focus**: Chromium inspected visible Focus outlines on the actual Storefront Select and Login email input. Dialog Escape and trigger-focus restoration were verified in jsdom/Vitest, not all real-browser dialog instances.
- Featured discovery cards were absent from the default local fixture when sampled; the optional interactive hover check for their live instance is recorded as **NOT_TESTED**. Their CSS colors were replaced with semantic pairs.
- Screenshots: `frontend/quality-audit/.evidence/campus-commerce-interaction/light-storefront-control-hover.png`, `dark-storefront-control-hover.png`, `light-login-field-focused.png`, `dark-login-field-focused.png`.

### Test gates after changes

| Check | Result |
|---|---|
| Full Vitest Unit suite | **364/364 PASS**, 92 files |
| Phase 2–4 guarded Chromium E2E | **11/11 PASS** across four suites (text-only Brand, Responsive, synthetic text scale, interaction focus/contrast). `interaction-regression-exit.txt` = 0 |
| 28 canonical-route Chromium visual/a11y regression | **140/140 CAPTURED** (28 routes × 320/390/768/1024/1440 CSS px). Recorded outcomes: zero Browser writes, reported horizontal overflow, broken images, page errors, and automated axe violations; see `route28-final-matrix.json` and `route28-guarded-exit.txt` = 0 |
| TypeScript | PASS |
| ESLint | PASS |
| Next.js Static Build | **30/30 pages PASS**, after the core styling implementation |
| `git diff --check` | PASS |

### Audit depth and tracked risk

A static heuristic reviewed **38 CSS files and 237 interaction rules**. It flagged **68 background-changing rules without explicit `color` declarations**, including 14 in shared-component styles and 54 in route-specific styles. **This is not a verified count of WCAG failures**, since inherited text color can remain compliant; these need real browser review under their actual role/state. Complete machine-readable ledger: `frontend/quality-audit/.evidence/campus-commerce-interaction/interaction-rule-inventory.json`.

#### Deferred / NOT_TESTED

- Exhaustive clicking and screenshots of every real Modal/Popup/Dropdown/Toast/Tooltip under each Guest/Customer/Staff/Organization Admin/Platform Admin state, including pending/failed transitions. This remains later Phase 11–15 work; do not call it certified by the scoped tests.
- Keyboard trap/return-focus browser-level confirmation for every Radix dialog trigger is NOT_TESTED; component unit tests cover representative behavior.
- Safari/WebKit and Firefox rerun after Phase 4, native browser zoom 200%, assistive technology, all 257 route/shell actions, production payment/pickup workflows and actual user testing are NOT_TESTED.
- Functional icon standardization/Unicode arrow replacement (Phase 5), store-first card grid (Phase 6), fixture display (Phase 7), Login/Register overall composition (Phase 9), and verified post-auth returnTo (Phase 10) are **not** complete.
- Existing documented local development-only `braces` risk acceptance persists; this UI review does not clear full `npm audit` or authorize deployment.

**Scope:** Only files inside current `UniStore_Hub` were modified. No code was committed, pushed or deployed. Continue Phase 5 separately on user instruction.

---

## UniStore Hub — Campus Commerce A — Functional Icon & Text-only Branding Review


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub`, local BDXA workspace only
**Plan:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 5 — Consistent functional icon system and brand removal
**Verdict:** **PASS for Phase-5 authorized scope.** No Git Commit, Push, Production Deploy, Backend business-state change, or DB reset.

### Change summary

- Pinned **`lucide-react@0.468.0`** (Lucide SVG icon set) in `frontend/package.json` and `frontend/package-lock.json`, replacing several differing handwritten line icons and ad hoc Unicode glyphs with one vetted, size- and stroke-consistent icon family. No remote CDN or generated icon images.
- Created `frontend/src/components/ui/app-icon.tsx` as the canonical icon wrapper. Standardize 18px optical default (overridable 15–20px), 1.8px absolute strokes, inherent `currentColor`, `aria-hidden=true`, `focusable=false` and vertical alignment. The original `frontend/src/components/layout/workspace-icon.tsx` now delegates to this single shared vocabulary, retaining the existing `navigationIcon(href)` API and mapping all relevant Customer/Staff/Organization Admin/Platform Admin destinations to standardized Lucide icons.
- Replaced **15 Unicode directional arrows** (`↗` / `→`) across Storefront Landing and Detail views, Orders, Staff next task, Production and Organization Commerce Nav with semantic Lucide `arrow-up-right`/`arrow-right` SVG elements. The icon is decorative and does not become part of the link's screen-reader name. Arithmetic multiplication `×` remains unchanged where it describes amount × quantity.
- Changed shared `BrandIllustration` to display **contextual functional Lucide icons** for market/parcel/product/payment/pickup/notification instead of the old square **`U`** or `!`, `฿`, `✓` character art. Neutral missing-image placeholders use a consistent `image-off` icon rather than an em dash. Existing informative/hidden-media labels are preserved.
- Kept the visible **UniStore Hub text-only wordmark** on public, mobile, Login/Register and authenticated shells; no new symbol/logo was introduced. Account initials and store names are legitimate domain data and were not erased. `frontend/next.config.ts` disables the *development-only* Next.js status overlay so it does not obscure screenshots/UI.
- **Local Docker frontend dependency synchronization:** the running `unistore-hub-dev-frontend-1` was initially unhealthy because the old dev image had no `lucide-react`. The first rebuild uncovered a pre-existing `frontend/Dockerfile.dev` ordering fault: `npm ci` ran before the in-repo vendored `braces-3.0.3.tgz` was available. Added `COPY vendor/braces-3.0.3.tgz ./vendor/braces-3.0.3.tgz` before `RUN npm ci`. Rebuilt/recreated **only the local Frontend Service** using `docker compose -f docker-compose.dev.yml up -d --no-deps --build frontend`. Verified healthy container, HTTP 200 and real rendered Lucide SVGs. Backend, LocalStack and Worker containers were not rebuilt or restarted as part of this action.

### Source and browser coverage

- Machine-readable source report: `frontend/quality-audit/.evidence/campus-commerce-icons/icon-source-inventory.json`, which scanned `frontend/src/**/*.tsx`. Result: **zero** banned Unicode navigation arrows/emoji glyphs; **zero** usages of `styles.brandMark`; **11 source files** reference the shared `AppIcon`. Inspect the report to avoid conflating arithmetic, store initials, or third-party imagery with prohibited branding.
- Lucide and media behavior: `frontend/src/components/ui/app-icon.test.tsx`, existing `media.test.tsx`, both verify SVG decoration, hidden semantics, no U/image-dash art, consistent size and label behavior.
- Browser tests: `frontend/e2e/quality-audit/campus-commerce-ui.spec.ts` — **4/4 PASS** in Chromium. Guest at 390/1440/3840px across Light/Dark, plus authenticated Customer, Staff, Organization Admin and Platform Admin at 1440px across both themes. Verified brand links contain text only and no SVG/image, key CTA arrow is `lucide-arrow-up-right`, sampled role nav icons are Lucide and decorative, no remaining rendered `↗`/`→` glyphs on the public Storefront, no tested document overflow, and no unlabeled interactive links/buttons on those sample routes.
- Screenshots: `frontend/quality-audit/.evidence/campus-commerce-icons/`, includes 12 role/mobile/4K images, `icon-e2e-names.log` and `icon-e2e-names-exit.txt` = 0. Images inspected include public mobile and authenticated Platform Admin Dark; the text-only wordmark and consistent SVG navigation are visible.
- **28-route responsive/a11y regression:** `e2e/quality-audit/responsive-a11y.spec.ts` — **140/140 captures/checks** (28 routes × widths 320/390/768/1024/1440), with no reported JavaScript page errors, broken images, horizontal overflow or automated axe violations. **0 browser API writes.** Durable evidence `frontend/quality-audit/.evidence/campus-commerce-icons/route28-final-matrix.json` and `route28-final-exit.txt` = 0.
- **Full unit suite: 372/372 PASS across 93 files.** `npm run lint` and `npx tsc --noEmit`: PASS. `npm run build`: **30/30 static pages PASS**. `git diff --check`: PASS.

### Known limitations and deferred work

- This is a standardized functional icon system, **not** an assertion that every modal, popover, interactive error state or all 257 route/shell action IDs have been manually clicked across all Role × Browser combinations. A focused real-browser action audit is deferred to Phases 11–16.
- Store-first marketplace grid and fixture-safe data display remain Phase 6/7; Login/Register redesign remains Phase 9; protected-route `returnTo` remains Phase 10.
- Real 4K physical display comparison, touch hit-target checks on every icon-only control, all narrow viewports for every role, browser WebKit/Firefox and screen-reader certification remain later QA.
- Existing tracked local-development vendored `braces` acceptance was **not changed or declared risk-free**. The Dockerfile change is build-order-only to preserve the locked dependency. No Production Dockerfile or business-state logic was changed.

**Phase 5 scope result:** Unified iconography and text-only brand across tested screens, dependency/build reproducibility restored for local frontend, source and guarded browser regression passed. Ready for **Phase 6 — Storefront Landing and true store-first marketplace grid** on next user instruction.

---
