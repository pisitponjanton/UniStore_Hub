# UniStore Hub — Campus Commerce A / Phase 8 Guest Commerce Review

**Date:** 2026-10-19
**Workspace:** `UniStore_Hub` via local BDXA only
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 8 — Guest Store/Product/Campaign Discovery and Commerce Details
**Outcome:** PASS for this scoped UI phase. No Commit, Push, Deploy, AWS/Production changes, backend API changes, DB writes or fixture cleanup.

## Work completed

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

## Verification

| Check | Result |
|---|---|
| Full Vitest unit suite | **376/376 PASS**, 93 files |
| Phase 2–8 guarded Chromium E2E | **27/27 PASS**, `phase2-to-8-exit.txt` = 0 |
| Phase 8 guest commerce targeted Browser E2E (final copy rerun) | **4/4 PASS**, Light/Dark |
| 28 canonical routes × 5 widths read-only Responsive/A11y matrix | **140/140 CAPTURED**, `route28-final-exit.txt` = 0; 0 observed browser writes, reported overflows, page errors, broken images or automated axe violations |
| TypeScript, ESLint | PASS |
| Next.js static build | **30/30 pages PASS** |
| Git diff whitespace check | PASS |

**Covered in targeted Phase 8 Browser Test:** a read-only API-shaped catalog mock for Store/Product/Campaign; campaign OPEN versus CLOSED, OPEN without products, Search, filter, clear, truthful count, product variant selection and computed 300.00 × 3 = 900.00 estimate, guest login `returnTo` keeping the same variant/organization/campaign identifiers, and no order CTA for CLOSED campaign. UI overflow was measured at 320/390/768/1024/1440/1920/2560/3840px (Store) and at 390/1440/3840px (Product/Campaign) under Light and Dark. No API writes were made. Tests are in `frontend/e2e/quality-audit/campus-a-phase8-public-commerce.spec.ts`.

**Evidence:** `frontend/quality-audit/.evidence/campus-a-phase8/` contains screenshots and JSON measurement files. Review includes Mobile Dark Product after the compact no-photo/3-step adjustment, and the campaign status panel in Light.

## Known limits / NOT_TESTED

- Browser tests use deterministic **GET-only intercepted local fixture responses**. They do not prove genuine backend stock/eligibility, actual purchase submission, payment or pickup, which remain outside this UI phase.
- Campaign product list is store-scoped according to the current source. Only Product Detail and actual order flow may validate compatibility; do not represent this as campaign-specific inventory or guarantee checkout.
- Safari/Firefox, native physical 4K displays, complete keyboard/screen-reader manual assistive-tech use and full role-by-role modal/state interaction remain in later QA phases. The 28-route matrix is a guarded responsive/a11y check, **not** every button on every state.
- Login/Register full layout and protected `returnTo` restoration remain Phase 9 and Phase 10.
- All recognized local QA fixtures remain preserved, hidden from ordinary development storefront as Phase 7 describes. No new/modified business data, no API/schema modifications.
- Existing local-development dependency risk acceptance persists and this UI testing is **not** a security clearance for production deployment.

**Next phase:** Phase 9 — Login/Register redesign. Do not begin or commit unless requested.
