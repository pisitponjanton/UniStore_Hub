# UniStore Hub — Store, Product and Pre-order Detail Redesign

Date: 2026-10-18 · Workspace: `UniStore_Hub` · Scope: `/stores/view/`, `/products/view/`, `/campaigns/view/`

**Scoped frontend implementation complete.** This report is not a production approval and does not certify a successful persisted order. The approved baseline remains the last committed version; redesign edits remain local and uncommitted.

## Experience redesign

**Store detail** now presents a readable store identity, current number of OPEN preorder rounds, direct in-page actions for reviewing rounds and products, and precise counts of all rounds and items. OPEN rounds appear before other visible statuses; closed ones remain viewable. Browser Back/history-safe focus handling for jump links is retained. Context breadcrumb links to the public store directory.

**Pre-order campaign** now states the authoritative API-owned campaign status prominently, explains what the shopper can do in each status, displays the close date in the primary status panel and provides a clear in-page product shortcut only for `OPEN` rounds. The four existing dates (open, close, payment deadline, pickup) remain in the timeline without substituting new data. The closed-round UI never advertises a checkout shortcut. Breadcrumbs keep the store context.

**Product detail** now highlights its actual minimum active-variant price near the title, plus a safe `เลือกตัวเลือกและคำนวณยอด` anchor for available variants. It retains genuine short-lived backend `imageUrl` when present and a plain explicit 'no photo' state when absent. No speculative product shots. Variant, campaign, quantity, live estimated total and the login-gated order link use existing backend-aware logic, IDs and query contract. A selected non-OPEN round is explicitly explained even if another round is available, and no purchase link appears until a valid OPEN round/variant/quantity combination exists. The title area, controls, accessible focus and mobile spacing were optimized for quick comprehension.

**Design system** uses the existing deep-teal/warm-neutral brand foundation: lighter restrained cards, readable text contrast, real API-status labels, consistent 44px-ish controls and smaller mobile no-photo areas. There are no third-party assets or dependencies added, and MotionSites is inspiration only, not a copied layout/template.

## Verified in browser

A locally isolated browser opening the three existing routes stayed in an **API/session-loading state** rather than reliably loading the seeded backend dataset. That is a blocker to calling the real-data view verified.

For controlled verification, a read-only Playwright suite supplies **API-shaped browser-only responses** for a store with a real-looking schema, product variant pricing, one OPEN and one CLOSED campaign, and navigation URLs. These objects are **test fixtures only**; no new store/order/customer/media content was persisted.

Screenshots from the rendered browser are saved as Git-ignored evidence in `frontend/quality-audit/.evidence/redesign-details/`:

- `store-390.png` and `store-1440.png`
- `campaign-open-390.png` and `campaign-open-1440.png`
- `product-390.png` and `product-1440.png`

The source test `frontend/e2e/quality-audit/commerce-detail-journeys.spec.ts` tests real browser DOM, not just Jest mocks, at 320 / 390 / 768 / 1024 / 1440px without horizontal overflow. Every intercepted non-read `/api/v1/` request is aborted. Tests cover actual href construction, preorder ordering, OPEN/CLOSED CTA differences, quantity invalidation, variant price multiplication, navigation and login returnTo.

## Current regression evidence

| Check | Result |
| --- | --- |
| Unit/component | **335/335 PASS**, 84 test files |
| TypeScript `--noEmit` | PASS |
| ESLint | PASS |
| Production build | **30/30 static routes** |
| `git diff --check` | PASS |
| Chromium: new loaded/detail flows + existing 503 recovery | **4/4 PASS** |
| Firefox: new loaded/detail flows | **3/3 PASS** |
| WebKit: new loaded/detail flows | **3/3 PASS** |
| Browser widths for new loaded fixture states | **320/390/768/1024/1440** no horizontal overflow |

The legacy product media/component tests additionally check a genuine supplied `imageUrl` is kept as the `img` src and has meaningful alt text; the browser fixture screenshots intentionally exercise the no-photo branch instead.

## Remaining work / known limits

1. **Authenticated checkout action and real persisted order creation are NOT_TESTED** in this redesign phase; do not infer idempotency/payment guarantees from the read-only browser run.
2. Production-backed loaded store/product/campaign pages were not available in this isolated session; browser fixture success is not a backend integration pass.
3. Other role variants, native physical-device zoom and VoiceOver/NVDA have not been exhaustively visited. `ROUTE_ROLE_STATE_MATRIX.json` preserves these as `NOT_TESTED`.
4. Deep-link invalid/not-found and all permission-state permutations are not exhaustively exercised, though existing scoped 503 recovery continues to pass.
5. No real shop or product photo asset was downloaded, because no explicit authoritative licensed product imagery was available; live `imageUrl` continues to work, and missing imagery is identified plainly.
6. All backend/API/tenant/RBAC/order/payment contracts and real/seeded records remain untouched. No Commit, Push or Deploy.

**Handoff:** continue with Account/Login/Registration and cross-role entry, focusing on understandable returnTo, session hydration and user orientation.
