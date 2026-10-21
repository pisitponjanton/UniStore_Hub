# UniStore Hub — Campus Commerce A / Phase 7 QA Fixture Visibility Review

**Date:** 2026-10-19
**Workspace:** UniStore_Hub (BDXA local development only)
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 7 — QA/E2E demo visibility and storefront states
**Review outcome:** PASS within Phase 7 scope; no organization, store, transaction, database, production environment or backend API changed. No Commit, Push or Deploy.

## Findings — source and actual local data

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

## Changes made

1. `frontend/src/modules/storefront/storefront-directory.ts` now applies **strict compound recognition** to the presentation layer only. Dev Seed uses its exact ID; E2E/harness and QA/Golden generator signatures require both a narrowly bounded name pattern and an exact expected test description (including changed Organization Admin settings descriptions). A generic “QA”, “Demo”, “test”, “E2E”, or “Tenant Org B” name **alone never qualifies**. A false-negative QA record is intentionally preferred to accidentally hiding a real organization.
2. `frontend/src/modules/storefront/storefront-landing.tsx` partitions data once; **in local development only**, an ordinary viewer sees unmatched organizations and their real stores. The existing explicit `แสดงข้อมูล E2E/QA` control temporarily includes recognized fixtures for local testers, resets now-hidden organization filters when toggled off, and marks QA store cards/no-store organization articles with `ข้อมูลทดสอบ QA`. A visible QA-mode banner clarifies that these are **not confirmed trading shops**.
3. **Production safety:** Because the Directory DTO does not include authoritative test provenance, production builds **do not silently filter** suspicious organizations. Strong matches received from a Production API are explicitly labelled as QA instead; neither names nor guessed categories are treated as authorization conditions. Reliable backend-enforced fixture isolation requires separate schema/API approval and is not within this frontend phase.
4. The ordinary development view excludes fixture data from Store Cards, featured/recommended content (Phase 6 already removed duplicated featured cards), full-text Search, Organization selector, Store/Organization Counts, Page Count and no-store sections. Current local data therefore correctly renders **0 ordinary stores**, not 272 shopper stores.
5. **State clarity:** A response containing only recognized development fixtures shows **ยังไม่มีร้านค้าทั่วไปที่เปิดให้เข้าชม** and explains why; a truly empty API response shows the ordinary Empty State; an API failure shows Error plus Retry, and Loading remains visible while fetching. Search with no match has a distinct filter-results message. No fake stores or images are fabricated, no data is deleted and no backend API payload shape changes.
6. Updated `frontend/src/modules/storefront/storefront-landing.module.css` and `storefront-grid.module.css` for a readable QA banner and consistent themed badges.
7. Older Foundation/Hover/Responsive tests were relying on live Dev Seed cards; they now use `frontend/e2e/quality-audit/campus-a-storefront-preview.ts`, a **GET-only in-browser storefront response**, to avoid relying on real fixtures. **Phase 7 separately tests the actual local API** and the default/hide/reveal flow.

## QA evidence and verification

- **Unit regression:** `storefront-directory.test.ts` checks exact IDs, matching generator name+description, and legitimate lookalikes that must remain visible. `storefront-landing.test.tsx` checks Dev-only opt-in, QA labelling, true fixture-only empty state, real-shop names containing QA/Demo, and Production never silently filtering strongly matched records.
- **Chromium Playwright:** `frontend/e2e/quality-audit/campus-a-phase7-qa-visibility.spec.ts` — **6/6 PASS** across Light/Dark:
  - Mocked 17 legitimate stores, 1 legitimate no-store organization and 3 strongly recognized QA fixture organizations (3 stores + 1 no-store organization).
  - Confirmed the default counts (17 real stores/1 no-store org) and QA mode counts (20 total stores/2 no-store orgs), legitimate “Demo QA Student Club” remains discoverable, QA organization is absent from default Search/Organization filter, 12-per-page pagination and separate no-store section, explicit QA toggle/badges, and selected-filter reset on hiding.
  - Simulated Loading → HTTP 503 Error → user Retry → authoritative empty response with no permanent DB writes; accommodates React StrictMode initial duplicate read requests.
  - Read actual local development Directory, verified the seeded Local Demo Store is hidden by default, reversible QA view works and hides again.
  - Captured Mobile (390px), Tablet (768px), Desktop (1440px) and 4K CSS viewport (3840px) without reported horizontal document overflow for the scenarios sampled.
- **Read-only live API census:** `frontend/quality-audit/.evidence/campus-a-phase7/live-local-provenance-summary.json`. Browser screenshots, JSONs, runner logs and test evidence are in the same evidence folder.
- **Full unit tests:** **374/374 PASS** across 93 test files.
- **Phase 2–7 guarded Chromium E2E:** **23/23 PASS** (`all-phase-2-to-7-e2e-exit.txt` = 0).
- **TypeScript / ESLint:** PASS. **Next.js Static Build:** 30/30 pages PASS.
- **28-route responsive/a11y regression:** **140/140 captures PASS** (28 canonical routes × 5 CSS viewports) in read-only Chromium, **0 browser API writes**, with no reported overflow, broken images, unexpected page errors or automated axe violations. Durable evidence: `frontend/quality-audit/.evidence/campus-a-phase7/route28-final-matrix.json`, `route28-final.log` and `route28-final-exit.txt` = 0.
- **`git diff --check`:** PASS after implementation, before phase closure.

## Limits and follow-up

- Test provenance has no authoritative, immutable `isFixture` flag. Frontend compound signatures are a practical *local-display* policy, not a security boundary. Adding backend provenance or quarantining QA organizations in a test-specific datastore would be the durable solution, but modifying API contracts, tenancy or real data is **outside current authorization**.
- This local database snapshot has **zero genuine ordinary stores**, so the normal home page intentionally shows a truthful empty state. To demonstrate actual marketplace cards without QA mode, new genuine storefront content must be created through an approved workflow, not invented by the UI.
- QA opt-in is an explicit dev-environment UI control, not a production-capable privileged test-data management console. Test access does not grant write permissions.
- Other public product/campaign detail UX is Phase 8. Login/Register and protected-route returnTo are Phase 9–10. Full five-role interactions/modal states, Safari/Firefox, native zoom, physical 4K displays and production-scale data belong to later QA and security review.
- Existing dev-only vendored `braces` security risk acceptance remains unchanged; no claim of risk-free deployment is made.

**Phase 7 verdict: PASS** for the scoped local presentation policy; ready for separately authorized Phase 8.
