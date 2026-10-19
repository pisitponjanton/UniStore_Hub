# UniStore Hub — Public Storefront Redesign

Date: 2026-10-18. Scope: homepage `/`, discovery and public store directory. Baseline: earlier work in `docs/design/FOUNDATION_IMPLEMENTATION.md`. This is a **scoped frontend implementation and browser result**, not production release approval.

## Product-facing changes

- Replaced the oversized empty public hero with a shorter, purposeful campus-commerce introduction, clear `เลือกร้านค้า` and `ติดตามคำสั่งซื้อ` actions and a concise note on availability.
- Real directory data now drives a highlighted store card directly above the fold when available. It uses the actual organization and store names/descriptions returned by `/storefront/directory`, with a simple code-drawn typographic monogram, **not fake stock merchandise images**.
- When directory data is unavailable, the companion space explains three steps to buy/track rather than fabricating a store. Mobile omits this redundant panel so primary search and the shop directory appear sooner.
- The separate discovery strip shows **up to three other stores** only when there are others, avoiding a duplicate first-card presentation. Description was adjusted to avoid implying editorial endorsement/ranking.
- Search, availability filters, page size and pagination continue to use existing `storefront-directory.ts` behavior. Search resets pagination and filters all fetched entries, not only the first page. A filtered query collapses the extra marketing panels so users see results promptly.
- A clear result count, out-of-results recovery, missing-store explanation, loading skeleton, network retry and lightweight footer are part of the same visual hierarchy.
- Original public store detail URLs, login returnTo and non-destructive user flows are preserved; production no longer receives invented campaign/pricing/photo content.
- Rebuilt `storefront-landing.module.css` with coherent warm-neutral / deep teal surface, readable text, focus and low-motion behavior across 320, 390, 768, 1024 and 1440px. Visual inspiration came from editorial hierarchy rather than copying assets from MotionSites.

## Actual browser evidence

Browser screenshot baselines were examined before implementation. After implementation, read-only Playwright supplied **API-shaped, explicitly browser-only** dummy store and organization names to prove the populated state, with captures saved (Git-ignored) at:

- `frontend/quality-audit/.evidence/redesign-storefront/populated-directory-390.png`
- `frontend/quality-audit/.evidence/redesign-storefront/populated-directory-1440.png`

The independently opened local site also rendered at 390px and 1440px, but the local session kept showing the **loading state** due to API/session conditions, not a verified populated directory. Do not treat the mocked screenshot as proof that production data loaded. No record was written or modified.

## Verification

| Test | Result |
| --- | --- |
| Unit/Component | 335/335 PASS, 84 files |
| TypeScript / ESLint | PASS |
| Next.js Production Build | PASS, 30/30 static routes |
| Chromium scoped public journeys (login/register errors, detail recovery, populated/empty/error directory) | 5/5 PASS |
| Firefox storefront discovery/empty/retry | 3/3 PASS |
| WebKit storefront discovery/empty/retry | 3/3 PASS |
| Browser viewport overflow | 320 / 390 / 768 / 1024 / 1440px PASS |
| Source action families (home only) | 6/6 have scoped browser evidence; some validate href only, not completed navigation |
| Backend API mutation | None; browser intercept rejects non-read API requests |

Test sources: `frontend/e2e/quality-audit/storefront-discovery.spec.ts`, `frontend/src/modules/storefront/storefront-landing.test.tsx`, plus prior public/auth E2E specs.

## Explicit limits and handoff

The landing aggregate API delivers only organization/store metadata. It does **not** expose complete product images, prices or campaign availability. This phase avoids speculative product data and does not fetch every store's products (which could create an expensive public API fan-out). The next phase for **Store / Product / Campaign detail** should improve real product media, details, pricing and campaign selection using their existing scoped data access.

Full Customer authenticated homepage, denied/forbidden edge states, native physical devices/200% zoom and screen-reader signoff have not yet been verified. Review the JSON route-role-state manifest for exact `NOT_TESTED` variants; do not extrapolate this guest/browser-mocked success to production.

**No changes to backend, RBAC, payment/order semantics or persisted records. No Commit/Push/Deploy.**
