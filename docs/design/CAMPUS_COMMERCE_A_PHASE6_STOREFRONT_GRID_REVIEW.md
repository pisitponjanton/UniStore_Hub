# UniStore Hub — Campus Commerce A / Phase 6 Storefront Grid Review

**Date:** 2026-10-19
**Workspace:** UniStore_Hub (BDXA, local only)
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 6 — Storefront landing and true marketplace store grid
**Verdict:** PASS for Phase-6 scope. **No Commit, Push, Deploy, production access, backend/API change, tenant deletion or database mutation.**

## Implementation

1. Replaced the original vertically nested organization/store rows and duplicated highlighted/recommended store links in `frontend/src/modules/storefront/storefront-landing.tsx` with **one clickable card per ACTIVE store** under a full-width, compact, task-oriented Hero and an immediately available search/filter bar. No store is duplicated as a fake recommendation.
2. Added isolated `frontend/src/modules/storefront/storefront-grid.module.css` rather than scattered CSS overrides for the store cards. Each entire card links to `/stores/view/?organizationId=...&storeId=...` using original IDs, and presents: real organization name, real store name, real description (or plainly stated generic prompt), badge **เปิดให้เข้าชม** based on ACTIVE store visibility, and a **ดูหน้าร้าน** affordance with the standardized Lucide arrow. Cards have visible keyboard focus, hover, reduced-motion support, and readable light/dark token-driven backgrounds.
3. Source DTO `StorefrontStoreDTO` returns `storeId`, `organizationId`, `name`, `description` and `status` only. **No storefront image URL, category or live campaign state** is available from the directory API. Deliberately use an explicit neutral **ยังไม่มีรูปหน้าร้าน** image fallback, not fictitious store art, and do not claim an ACTIVE store currently accepts pre-orders.
4. Kept `DIRECTORY_PAGE_SIZE=12`, active-store-first ordering, Thai/English case-normalized Search, `all/with-stores/without-stores` availability selector, and full-data filtering **before pagination**. Added a real **หน่วยงาน** selector from authoritative directory organization names/IDs; selecting it or changing search/availability resets to page 1. Clearing filters restores all controls. The backend contract and tenancy access rules are untouched.
5. Organizations without active stores render as separate **non-clickable informational articles** in their own section, after store cards; they are not presented as purchasable stores. Original count summary accurately tracks storefront data, selected-filter result counts and current pagination range.
6. Removed the unused old organization-grouping helper and corresponding obsolete grouping assertion. Cleaned out 66 dead/redundant CSS selector rules for historical organization-row, featured hero and duplicated discovery components in `storefront-landing.module.css`. Public navigation remains **text-only UniStore Hub**, as approved.
7. The user-selected brand, semantic color tokens, Lucide icons, responsive content width tiers, native select styling and general protected role workspaces remain intact.

## Visual and responsive verification

In Playwright read-only Chromium, using **26 mocked active stores across two organizations plus two organizations with no stores** (no persisted backend data), the new Storefront Grid produced:

| Viewport CSS width | Grid columns |
|---:|---:|
| 320px | 1 |
| 390px | 1 |
| 768px | 2 |
| 1024px | 3 |
| 1440px | 4 |
| 1920px | 5 |
| 2560px | 6 |
| 3840px | 6 |

Both Light and Dark passed all 8 width checks for column count and document overflow (none), plus: real store link query params, neutral media fallback, **12 + 12 + (2 stores + 2 empty orgs)** pagination, no-store filter, with-stores filter, organization ID filter, cross-page search, empty search results, clear filter and reset to page 1. Full cases in `frontend/e2e/quality-audit/campus-a-phase6-store-grid.spec.ts`; screenshots and `grid-metrics-light.json`, `grid-metrics-dark.json` in `frontend/quality-audit/.evidence/campus-a-phase6/`.

## Regression gates

| Gate | Result |
|---|---|
| Phase-6 deterministic Browser E2E, both schemes | **2/2 PASS** |
| Complete prior Phase-2–6 browser guard/visual E2E | **17/17 PASS**; `all-phase-e2e-exit.txt` = 0 |
| 28 canonical route × 5 widths read-only responsive/a11y matrix | **140/140 captured**; zero reported browser writes, unexpected page errors, broken images, reported overflow or automatic axe violations; `route28-final-matrix.json`, `route28-final-exit.txt` = 0 |
| Full Vitest unit tests | **371/371 PASS across 93 test files**. Previously 372 tests; one obsolete organization-grouping-only helper/assertion was removed after replacing it with store-first cards and newer real-browser coverage. |
| TypeScript and ESLint | PASS |
| Next.js Static Build | **30/30 pages PASS** |
| `git diff --check` | PASS (verified after implementation) |

## Future phases — not represented as complete

- **Phase 7:** Investigate fixture provenance and explicitly marked E2E/demo organization behavior in normal storefront and recommendations. Current name-based toggle behavior was intentionally retained without deleting or automatically hiding legitimate records. Full empty/loading/error fixture-safe browser test matrix belongs there.
- **Phase 8:** Other public store/product/campaign detail route polish.
- **Phase 9–10:** Login/Register composition and post-auth `returnTo` verification.
- **Phase 11–16:** Real clickthrough per role, controls in all modal states, cross-browser keyboard tests, native zoom 200%, real production-scale API correctness, and manual usability on physical 4K displays.
- **No real store cover image or category/preorder status** is invented from missing API fields. Showing actual cover images/categories needs grounded media and a separately approved service contract where available.
- Existing documented local dev-only `braces` dependency risk acceptance stays in force; this frontend phase does not constitute a security clearance for deployment.

**Phase 6 conclusion:** Storefront discovery is now store-first, more understandable and usable on Mobile to 4K, with a real source-backed Organization filter and honest image handling. Phase 7 is ready to begin separately.
