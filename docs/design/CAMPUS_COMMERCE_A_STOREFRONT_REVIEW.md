# UniStore Hub — Storefront

> Historical implementation, testing and decision evidence consolidated by subject. This is a review archive, **not** the product/API specification. Current security and NOT_TESTED limitations remain binding.

---

## UniStore Hub — Campus Commerce A — Storefront Grid Review


**Date:** 2026-10-19
**Workspace:** UniStore_Hub (BDXA, local only)
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 6 — Storefront landing and true marketplace store grid
**Verdict:** PASS for Phase-6 scope. **No Commit, Push, Deploy, production access, backend/API change, tenant deletion or database mutation.**

### Implementation

1. Replaced the original vertically nested organization/store rows and duplicated highlighted/recommended store links in `frontend/src/modules/storefront/storefront-landing.tsx` with **one clickable card per ACTIVE store** under a full-width, compact, task-oriented Hero and an immediately available search/filter bar. No store is duplicated as a fake recommendation.
2. Added isolated `frontend/src/modules/storefront/storefront-grid.module.css` rather than scattered CSS overrides for the store cards. Each entire card links to `/stores/view/?organizationId=...&storeId=...` using original IDs, and presents: real organization name, real store name, real description (or plainly stated generic prompt), badge **เปิดให้เข้าชม** based on ACTIVE store visibility, and a **ดูหน้าร้าน** affordance with the standardized Lucide arrow. Cards have visible keyboard focus, hover, reduced-motion support, and readable light/dark token-driven backgrounds.
3. Source DTO `StorefrontStoreDTO` returns `storeId`, `organizationId`, `name`, `description` and `status` only. **No storefront image URL, category or live campaign state** is available from the directory API. Deliberately use an explicit neutral **ยังไม่มีรูปหน้าร้าน** image fallback, not fictitious store art, and do not claim an ACTIVE store currently accepts pre-orders.
4. Kept `DIRECTORY_PAGE_SIZE=12`, active-store-first ordering, Thai/English case-normalized Search, `all/with-stores/without-stores` availability selector, and full-data filtering **before pagination**. Added a real **หน่วยงาน** selector from authoritative directory organization names/IDs; selecting it or changing search/availability resets to page 1. Clearing filters restores all controls. The backend contract and tenancy access rules are untouched.
5. Organizations without active stores render as separate **non-clickable informational articles** in their own section, after store cards; they are not presented as purchasable stores. Original count summary accurately tracks storefront data, selected-filter result counts and current pagination range.
6. Removed the unused old organization-grouping helper and corresponding obsolete grouping assertion. Cleaned out 66 dead/redundant CSS selector rules for historical organization-row, featured hero and duplicated discovery components in `storefront-landing.module.css`. Public navigation remains **text-only UniStore Hub**, as approved.
7. The user-selected brand, semantic color tokens, Lucide icons, responsive content width tiers, native select styling and general protected role workspaces remain intact.

### Visual and responsive verification

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

Both Light and Dark passed all 8 width checks for column count and document overflow (none), plus: real store link query params, neutral media fallback, **12 + 12 + (2 stores + 2 empty orgs)** pagination, no-store filter, with-stores filter, organization ID filter, cross-page search, empty search results, clear filter and reset to page 1. Full cases in `frontend/e2e/quality-audit/storefront-shopping.spec.ts`; screenshots and `grid-metrics-light.json`, `grid-metrics-dark.json` in `frontend/quality-audit/.evidence/campus-commerce-storefront/`.

### Regression gates

| Gate | Result |
|---|---|
| Phase-6 deterministic Browser E2E, both schemes | **2/2 PASS** |
| Complete prior Phase-2–6 browser guard/visual E2E | **17/17 PASS**; `full-regression-e2e-exit.txt` = 0 |
| 28 canonical route × 5 widths read-only responsive/a11y matrix | **140/140 captured**; zero reported browser writes, unexpected page errors, broken images, reported overflow or automatic axe violations; `route28-final-matrix.json`, `route28-final-exit.txt` = 0 |
| Full Vitest unit tests | **371/371 PASS across 93 test files**. Previously 372 tests; one obsolete organization-grouping-only helper/assertion was removed after replacing it with store-first cards and newer real-browser coverage. |
| TypeScript and ESLint | PASS |
| Next.js Static Build | **30/30 pages PASS** |
| `git diff --check` | PASS (verified after implementation) |

### Future phases — not represented as complete

- **Phase 7:** Investigate fixture provenance and explicitly marked E2E/demo organization behavior in normal storefront and recommendations. Current name-based toggle behavior was intentionally retained without deleting or automatically hiding legitimate records. Full empty/loading/error fixture-safe browser test matrix belongs there.
- **Phase 8:** Other public store/product/campaign detail route polish.
- **Phase 9–10:** Login/Register composition and post-auth `returnTo` verification.
- **Phase 11–16:** Real clickthrough per role, controls in all modal states, cross-browser keyboard tests, native zoom 200%, real production-scale API correctness, and manual usability on physical 4K displays.
- **No real store cover image or category/preorder status** is invented from missing API fields. Showing actual cover images/categories needs grounded media and a separately approved service contract where available.
- Existing documented local dev-only `braces` dependency risk acceptance stays in force; this frontend phase does not constitute a security clearance for deployment.

**Phase 6 conclusion:** Storefront discovery is now store-first, more understandable and usable on Mobile to 4K, with a real source-backed Organization filter and honest image handling. Phase 7 is ready to begin separately.

---

## UniStore Hub — Campus Commerce A — QA Fixture Visibility Review


**Date:** 2026-10-19
**Workspace:** UniStore_Hub (BDXA local development only)
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 7 — QA/E2E demo visibility and storefront states
**Review outcome:** PASS within Phase 7 scope; no organization, store, transaction, database, production environment or backend API changed. No Commit, Push or Deploy.

### Findings — source and actual local data

`backend/scripts/dev-seed.js` creates a deterministic local **UniStore Local Demo** organization with fixed ID `55555555-5555-4555-8555-555555555555` and **Local Demo Store** with fixed store ID `66666666-6666-4666-8666-666666666666`. Frontend E2E fixtures are also created by generator-specific journeys (e.g. `frontend/e2e/support/customer-commerce-fixtures.ts` and `organization-admin-fixtures.ts`); they persist after earlier tests.

The public `GET /api/v1/storefront/directory` returns all **ACTIVE** organizations and stores, without an immutable demo/QA provenance field. GET-only inspection of the **current local** API, cross-checked against the new frontend partition helper, found:

| Local directory metric (observed) | Count |
|---|---:|
| Total organizations | 317 |
| Strictly recognized QA/Dev Seed organizations | 317 |
| Unmatched ordinary organizations | 0 |
| Recognized QA stores | 272 |
| QA organizations without a store | 45 |
| Ordinary stores | 0 |

This is a local snapshot, not an assertion about Production or a claim that all possible future names can be reliably classified. Raw organization IDs, individual names and private customer records were **not** exported to the evidence summary.

### Changes made

1. `frontend/src/modules/storefront/storefront-directory.ts` now applies **strict compound recognition** to the presentation layer only. Dev Seed uses its exact ID; E2E/harness and QA/Golden generator signatures require both a narrowly bounded name pattern and an exact expected test description (including changed Organization Admin settings descriptions). A generic “QA”, “Demo”, “test”, “E2E”, or “Tenant Org B” name **alone never qualifies**. A false-negative QA record is intentionally preferred to accidentally hiding a real organization.
2. `frontend/src/modules/storefront/storefront-landing.tsx` partitions data once; **in local development only**, an ordinary viewer sees unmatched organizations and their real stores. The existing explicit `แสดงข้อมูล E2E/QA` control temporarily includes recognized fixtures for local testers, resets now-hidden organization filters when toggled off, and marks QA store cards/no-store organization articles with `ข้อมูลทดสอบ QA`. A visible QA-mode banner clarifies that these are **not confirmed trading shops**.
3. **Production safety:** Because the Directory DTO does not include authoritative test provenance, production builds **do not silently filter** suspicious organizations. Strong matches received from a Production API are explicitly labelled as QA instead; neither names nor guessed categories are treated as authorization conditions. Reliable backend-enforced fixture isolation requires separate schema/API approval and is not within this frontend phase.
4. The ordinary development view excludes fixture data from Store Cards, featured/recommended content (Phase 6 already removed duplicated featured cards), full-text Search, Organization selector, Store/Organization Counts, Page Count and no-store sections. Current local data therefore correctly renders **0 ordinary stores**, not 272 shopper stores.
5. **State clarity:** A response containing only recognized development fixtures shows **ยังไม่มีร้านค้าทั่วไปที่เปิดให้เข้าชม** and explains why; a truly empty API response shows the ordinary Empty State; an API failure shows Error plus Retry, and Loading remains visible while fetching. Search with no match has a distinct filter-results message. No fake stores or images are fabricated, no data is deleted and no backend API payload shape changes.
6. Updated `frontend/src/modules/storefront/storefront-landing.module.css` and `storefront-grid.module.css` for a readable QA banner and consistent themed badges.
7. Older Foundation/Hover/Responsive tests were relying on live Dev Seed cards; they now use `frontend/e2e/quality-audit/campus-a-storefront-preview.ts`, a **GET-only in-browser storefront response**, to avoid relying on real fixtures. **Phase 7 separately tests the actual local API** and the default/hide/reveal flow.

### QA evidence and verification

- **Unit regression:** `storefront-directory.test.ts` checks exact IDs, matching generator name+description, and legitimate lookalikes that must remain visible. `storefront-landing.test.tsx` checks Dev-only opt-in, QA labelling, true fixture-only empty state, real-shop names containing QA/Demo, and Production never silently filtering strongly matched records.
- **Chromium Playwright:** `frontend/e2e/quality-audit/storefront-shopping.spec.ts` — **6/6 PASS** across Light/Dark:
  - Mocked 17 legitimate stores, 1 legitimate no-store organization and 3 strongly recognized QA fixture organizations (3 stores + 1 no-store organization).
  - Confirmed the default counts (17 real stores/1 no-store org) and QA mode counts (20 total stores/2 no-store orgs), legitimate “Demo QA Student Club” remains discoverable, QA organization is absent from default Search/Organization filter, 12-per-page pagination and separate no-store section, explicit QA toggle/badges, and selected-filter reset on hiding.
  - Simulated Loading → HTTP 503 Error → user Retry → authoritative empty response with no permanent DB writes; accommodates React StrictMode initial duplicate read requests.
  - Read actual local development Directory, verified the seeded Local Demo Store is hidden by default, reversible QA view works and hides again.
  - Captured Mobile (390px), Tablet (768px), Desktop (1440px) and 4K CSS viewport (3840px) without reported horizontal document overflow for the scenarios sampled.
- **Read-only live API census:** `frontend/quality-audit/.evidence/campus-commerce-fixture-visibility/live-local-provenance-summary.json`. Browser screenshots, JSONs, runner logs and test evidence are in the same evidence folder.
- **Full unit tests:** **374/374 PASS** across 93 test files.
- **Phase 2–7 guarded Chromium E2E:** **23/23 PASS** (`regression-foundation-to-fixture-visibility-e2e-exit.txt` = 0).
- **TypeScript / ESLint:** PASS. **Next.js Static Build:** 30/30 pages PASS.
- **28-route responsive/a11y regression:** **140/140 captures PASS** (28 canonical routes × 5 CSS viewports) in read-only Chromium, **0 browser API writes**, with no reported overflow, broken images, unexpected page errors or automated axe violations. Durable evidence: `frontend/quality-audit/.evidence/campus-commerce-fixture-visibility/route28-final-matrix.json`, `route28-final.log` and `route28-final-exit.txt` = 0.
- **`git diff --check`:** PASS after implementation, before phase closure.

### Limits and follow-up

- Test provenance has no authoritative, immutable `isFixture` flag. Frontend compound signatures are a practical *local-display* policy, not a security boundary. Adding backend provenance or quarantining QA organizations in a test-specific datastore would be the durable solution, but modifying API contracts, tenancy or real data is **outside current authorization**.
- This local database snapshot has **zero genuine ordinary stores**, so the normal home page intentionally shows a truthful empty state. To demonstrate actual marketplace cards without QA mode, new genuine storefront content must be created through an approved workflow, not invented by the UI.
- QA opt-in is an explicit dev-environment UI control, not a production-capable privileged test-data management console. Test access does not grant write permissions.
- Other public product/campaign detail UX is Phase 8. Login/Register and protected-route returnTo are Phase 9–10. Full five-role interactions/modal states, Safari/Firefox, native zoom, physical 4K displays and production-scale data belong to later QA and security review.
- Existing dev-only vendored `braces` security risk acceptance remains unchanged; no claim of risk-free deployment is made.

**Phase 7 verdict: PASS** for the scoped local presentation policy; ready for separately authorized Phase 8.

---

## UniStore Hub — Campus Commerce A — Guest Commerce Review


**Date:** 2026-10-19
**Workspace:** `UniStore_Hub` via local BDXA only
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 8 — Guest Store/Product/Campaign Discovery and Commerce Details
**Outcome:** PASS for this scoped UI phase. No Commit, Push, Deploy, AWS/Production changes, backend API changes, DB writes or fixture cleanup.

### Work completed

1. **Store Detail** — `frontend/src/modules/storefront/store-view.tsx`
   - Added accessible Search inside the actual returned store products (Thai/English normalized product name and description), inline result counts, zero-match message and focus-aware clear control.
   - Added campaign filter **ทุกรอบขาย / เฉพาะรอบที่เปิดรับ** based on the authoritative `OPEN` status, with a helpful no-OPEN state and reset. The original quick links still scroll/focus without polluting browser history. Original individual store, product and campaign IDs and link destinations remain untouched.
   - The full loaded catalog remains intact when searching or filtering; nothing is removed from backend records.

2. **Product Detail** — `frontend/src/modules/storefront/product-view.tsx`
   - Placed a compact, visually readable three-step instruction: select variant → choose an OPEN campaign → review estimate and proceed.
   - Added source-backed unit-price × quantity breakdown beside the dynamic estimated total. Existing ACTIVE variant filtering, invalid quantity validation, campaign unavailable guards, guest Login `returnTo` and authenticated Order Entry URL/payload were preserved.
   - Product images are displayed only if a real `imageUrl` is provided; mobile no-image fallback is intentionally compact and clearly labelled, without fabricated artwork.

3. **Campaign Detail** — `frontend/src/modules/storefront/campaign-view.tsx`
   - The headline action is offered only when `status === OPEN` **and** the loaded store has visible products. An OPEN campaign with zero visible products states this clearly and offers no misleading purchase CTA. CLOSED/COMPLETED/etc. existing statuses retain their business semantics.
   - Important contract discovery: `getCampaignView` lists products via `GET .../stores/{storeId}/products` (store catalog), **not a proven campaign-membership API**. The labels were therefore corrected to **สินค้าของร้าน / สินค้าที่เปิดให้เข้าชม**, and the copy asks users to verify availability and selections on Product Detail. It no longer falsely declares each listed store product orderable within the selected campaign.
   - Kept the campaign-specific product link context and exact authoritative time/status fields.

4. **Design System** — `frontend/src/modules/storefront/storefront-view.module.css`
   - Added shared toolbar Input/Select/Empty/Reset treatments with semantic Light/Dark text/background pairings and visible keyboard focus, responsive 44px or larger controls, consistent card hover focus states, and compact explanatory order steps.
   - The campaign status panel now uses theme semantic tokens rather than forcing a beige Light Mode panel when the rest of the site is Dark.
   - On Mobile, no-image product placeholders are large enough to show their honest label; the purchase steps fit in three compact columns instead of long stacked cards. The broader catalog grid grows on wide/4K viewports with a bounded 6-column presentation.

### Verification

| Check | Result |
|---|---|
| Full Vitest unit suite | **376/376 PASS**, 93 files |
| Phase 2–8 guarded Chromium E2E | **27/27 PASS**, `regression-foundation-to-public-commerce-exit.txt` = 0 |
| Phase 8 guest commerce targeted Browser E2E (final copy rerun) | **4/4 PASS**, Light/Dark |
| 28 canonical routes × 5 widths read-only Responsive/A11y matrix | **140/140 CAPTURED**, `route28-final-exit.txt` = 0; 0 observed browser writes, reported overflows, page errors, broken images or automated axe violations |
| TypeScript, ESLint | PASS |
| Next.js static build | **30/30 pages PASS** |
| Git diff whitespace check | PASS |

**Covered in targeted Phase 8 Browser Test:** a read-only API-shaped catalog mock for Store/Product/Campaign; campaign OPEN versus CLOSED, OPEN without products, Search, filter, clear, truthful count, product variant selection and computed 300.00 × 3 = 900.00 estimate, guest login `returnTo` keeping the same variant/organization/campaign identifiers, and no order CTA for CLOSED campaign. UI overflow was measured at 320/390/768/1024/1440/1920/2560/3840px (Store) and at 390/1440/3840px (Product/Campaign) under Light and Dark. No API writes were made. Tests are in `frontend/e2e/quality-audit/storefront-shopping.spec.ts`.

**Evidence:** `frontend/quality-audit/.evidence/campus-commerce-public-commerce/` contains screenshots and JSON measurement files. Review includes Mobile Dark Product after the compact no-photo/3-step adjustment, and the campaign status panel in Light.

### Known limits / NOT_TESTED

- Browser tests use deterministic **GET-only intercepted local fixture responses**. They do not prove genuine backend stock/eligibility, actual purchase submission, payment or pickup, which remain outside this UI phase.
- Campaign product list is store-scoped according to the current source. Only Product Detail and actual order flow may validate compatibility; do not represent this as campaign-specific inventory or guarantee checkout.
- Safari/Firefox, native physical 4K displays, complete keyboard/screen-reader manual assistive-tech use and full role-by-role modal/state interaction remain in later QA phases. The 28-route matrix is a guarded responsive/a11y check, **not** every button on every state.
- Login/Register full layout and protected `returnTo` restoration remain Phase 9 and Phase 10.
- All recognized local QA fixtures remain preserved, hidden from ordinary development storefront as Phase 7 describes. No new/modified business data, no API/schema modifications.
- Existing local-development dependency risk acceptance persists and this UI testing is **not** a security clearance for production deployment.

**Next phase:** Phase 9 — Login/Register redesign. Do not begin or commit unless requested.

---
