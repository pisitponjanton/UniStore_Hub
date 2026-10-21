# UniStore Hub — Campus Commerce A / Phase 1 Baseline Audit

**Date:** 2026-10-19
**Workspace:** `UniStore_Hub` — local BDXA only
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Committed baseline:** `b263f76` (`main`, ahead of origin by 1 before this phase)
**Phase scope:** read-only inspection, screenshot capture, browser QA and evidence. **No application UI or Backend changes**, no data reset, Commit, Push or Deploy.

## Baseline and verification matrix

Source inventory: `docs/design/ROUTE_ROLE_STATE_MATRIX.json` and `frontend/quality-audit/coverage-baseline.json`: **28 canonical routes, 207 route action IDs plus 50 shell action IDs = 257**. This is an inventory, not a certification that every control/state was clicked.

Local browser: Next.js at `http://localhost:3000`; test backend on `http://localhost:4000/api/v1`. The Node/Playwright guarded smoke harness uses local seeded role-login, GET-only browser routes and intercepted browser mutations; **zero Browser API write operations** were issued in these scoped tests. Seed authentication uses local fixture credentials and is not a real customer checkout mutation.

- **Primary role per route:** `npx playwright test e2e/quality-audit/responsive-a11y.spec.ts --project=chromium` — PASS, 28 routes × widths 320/390/768/1024/1440 = **140 captures/checks**; no test-reported horizontal overflow, image failures, JS page errors, HTTP 5xx, clipped controls or automated axe violations. Latest evidence: `frontend/test-results/quality-audit/uxqa-19dbaea5-cca2-4f6a-bba1-7b92f2364a95/design-quality/responsive-a11y-matrix.json` and `route-01-320.png` through `route-28-1440.png`.
- **Additional authorized role variants:** `npx playwright test e2e/quality-audit/authorized-route-role-coverage.spec.ts --project=chromium` — PASS, **11 role-route combinations × 5 widths = 55 checks**, with zero blocked browser writes, page errors, broken images, horizontal overflow or automated axe violations in recorded outcomes. Latest evidence: `frontend/quality-audit/.evidence/design-quality/secondary-roles-a5da83f5-9b6e-49fc-bfcb-68e685768e24/secondary-route-role-matrix.json`.
- **Total scoped checks:** **195 route-role-viewport observations**. This does NOT test all 257 actions, every denied-role/state, full keyboard behavior, real payment/pickup writes, persisted returnTo authentication, third-party image licensing or production usability.
- **Extra live viewport review:** independent local Playwright guest browser measurements at 390, 1440, 1920, 2560 and 3840 CSS px under both light/dark browser color schemes. Evidence `frontend/quality-audit/.evidence/campus-a-phase1/wide-and-auth-metrics.json` with before captures `storefront-dark-390-measured.png`, `storefront-dark-3840-measured.png`, `storefront-light-390-measured.png` and `storefront-light-3840-measured.png`.

### Canonical route families and representative roles

| Role / surface | Canonical routes |
|---|---|
| Guest/public and signed-in browsing | `/`, `/login/`, `/register/`, `/stores/view/`, `/products/view/`, `/campaigns/view/` |
| Customer transaction | `/orders/new/`, `/my/orders/`, `/my/order/`, `/my/payment/`, `/my/pickup/`, `/notifications/` |
| Staff + Organization Admin shared | `/org/select/`, `/org/orders/`, `/org/orders/view/`, `/org/payments/`, `/org/pickups/` |
| Organization Admin | `/org/dashboard/`, `/org/settings/`, `/org/staff/`, `/org/stores/`, `/org/products/`, `/org/campaigns/`, `/org/production/`, `/org/audit/` |
| Platform Admin | `/platform/summary/`, `/platform/organizations/`, `/platform/users/` |

The 28 route source roles were read from the maintained manifest; do not infer that every other role is denied correctly without corresponding negative authorization tests.

## User screenshot findings — root causes and follow-up

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

## Design authority conflict / implementation gate

The committed `frontend/.interface-design/system.md` still declares **Playful Campus Commerce v3** with purple/indigo identity and allows decorative clay/3D, while the user has now chosen **Campus Commerce A**: restrained accessible warm light/green, Dark Mode, no brand graphic. `frontend/src/app/globals.css` already contains newer deep teal semantics, but page CSS retains hardcoded light hues and duplicated overrides. Phase 2 must **update the existing canonical design authority** rather than add a parallel theme system. Keep versioned historical rationale only as needed; use a single semantic token source.

Recommended implementation order remains the active 17-phase BDXA plan. The highest-priority first actual code change in Phase 2 is the light/dark semantic token foundation and text-only brand. Phase 4 handles broken dark hover contrast; Phase 3 addresses 4K/container widths.

## Audit boundaries and tests NOT executed

- No editing of app source, no Backend/DB mutation, no remote browsing, Git Commit/Push/Deploy, or real user authentication occurred in this phase.
- The **195 successful captures** are page-structure/viewport checks and scoped axe audits, not verified mouse/keyboard clickthroughs for all 257 actions. The protected-order recovery bug and full returnTo after login require independent Phase 10 end-to-end validation.
- The extra wide-screen guest measurement used development/local data and found one visible store row under each theme. E2E-harness store names were not present in that default view; screenshot reports showing many fixtures may reflect the user's QA toggle being enabled. This does **not** establish source provenance of any store.
- No full performance/Core Web Vitals, true physical 4K monitor colorimetry, screen reader assessment, 200% browser zoom or authentic visual approval was completed. Those belong to later phases.
- Historical docs `docs/design/ROUTE_ROLE_STATE_MATRIX.json` and `frontend/.interface-design/system.md` should not be silently treated as current Design A specifications until deliberately revised in their respective implementation phases.

**Phase 1 verdict:** Baseline source + browser/role audit completed and documented. Known visual defects are **OPEN for future implementation**, not fixed by these passing observational tests. Phase 2 may start with explicit user instruction.
