# UniStore Hub — Customer Experience Redesign

Date: 2026-10-18 (Bangkok). Workspace: `UniStore_Hub`. Scope: `/orders/new/`, `/my/orders/`, `/my/order/`, `/my/payment/`, `/my/pickup/`, `/notifications/`.

**Scoped frontend redesign complete, not production signoff.** No authenticated data mutation, commit, push, or deployment was performed. The previously modified, uncommitted Foundation and Storefront files remain in the worktree.

## Experience changes

- Introduced reusable `CustomerJourneyNav` (with isolated CSS and component tests), shared across all six real Customer routes, the checkout success state and the pickup not-ready state. Links are limited to real universal destinations (store directory, the user's orders, notifications). A scoped return-to-order link is created **only with a supplied orderId**. On small screens the secondary nav becomes one row to avoid duplicating the application shell and delaying the primary task. An active Checkout tab remains a clickable link back to shopping; a completed order is not inferred.
- Reworked the visual hierarchy of the new order review, My Orders inbox, single-order details, payment proof, pickup credentials and notifications using the same warm-neutral and deep-teal foundation. Priority is given to next user actions, authoritative status, amounts and progress. Actions and error states retain the existing verified keyboard/focus handling.
- My Orders highlights orders requiring attention, keeps distinct action and detail destinations and loaded-page filters. Payment shows the backend-owned amount and proof status before upload; rejected-proof recovery still uses the same existing flow. Pickup credentials display only when the preexisting order/pickup guards allow it; the not-ready branch explicitly says not to travel. Notifications link to authoritative order/payment/pickup detail, not to a guessed status.
- Simplified the responsive checkout review heading so it does not orphan a word at 390px; its total remains explicitly an **estimate**. All prices, money operations, image URLs, IDs, dates and status transitions remain backend-owned or are derived from previously existing DTO/formatter logic.
- Existing `getCustomerOrderGuidance`, `getOrderJourneySteps`, `canCustomerCancelOrder`, payment file checks, idempotency safeguards, pickup token security and notification update behavior are **not rewritten**. The Phase changes are view, navigation, style and regression coverage, not payment/order logic changes.

## Evidence and validation

Actual rendered Browser screenshots were inspected for Checkout, My Orders, Order Detail, Payment, Pickup and Notifications at 390px. After reducing unnecessary mobile navigation, the full safe customer journey was rerun with the local seed Customer account against read-only local data.

Twelve 390/1440px screenshots are preserved in Git-ignored `frontend/quality-audit/.evidence/redesign-customer/` (two for each of the six routes). The browser suite also captured **40 route/viewport screenshots per browser run** in ignored `frontend/test-results/quality-audit/` for widths 320 / 390 / 768 / 1440px. The fixture includes ten public/customer pages in the broader browser journey; six are in this phase.

The following E2E suites passed:
- `customer-responsive-journey.spec.ts` in **Chromium, Firefox and WebKit**, including 10 route views × 4 widths, no horizontal overflow, visible customer journey navigation, real read-only seed state and a Notifications → Orders click.
- `customer-orders-actions.spec.ts`: loaded-page priority, filter, initial GET 503, pagination 503, retry and navigation.
- `customer-create-order-actions.spec.ts`: invalid quantity, pending, server conflict, synthetic success and safe recovery, with every mutation intercepted.
- `customer-order-cancel-actions.spec.ts`: cancellation dialogs, pending, 409, synthetic success and recovery without a real cancellation.
- `customer-payment-initial-actions.spec.ts` and `customer-payment-upload-actions.spec.ts`: initial and rejected proof cases, synthetic presign/PUT, invalid file, rejection, conflict and retry without real payment mutation.
- `customer-pickup-actions.spec.ts`: not-ready, refresh, 503 recovery, received state and QR/pickup restrictions.
- `notification-actions.spec.ts` and `filter-recovery.spec.ts`: loaded filters, mark read with simulated conflicts/success, pagination and recoverable 503.
- `order-detail-safe-actions.spec.ts`: additional organization order detail regression, with browser-only intercepted behavior.

All customer business-changing browser requests were **intercepted or explicitly blocked**; no real orders, slips, pickups, cancellations, notifications or organization data were created or changed. Local seed GETs read existing disposable development data only. Avoid treating synthetic POST/PUT/409/200 responses as proof of production data persistence, transaction isolation or exactly-once behavior.

### Final checks

| Gate | Result |
| --- | --- |
| Full Unit/Component suite | 341/341 PASS, 85 files |
| TypeScript | PASS |
| ESLint | PASS |
| Next.js production build | 30/30 PASS |
| `git diff --check` | PASS |
| Chromium customer/browser regression suites | 10/10 PASS (1 responsive + 9 scenario specs) |
| Firefox + WebKit customer responsive | 2/2 PASS |
| Total scoped Browser E2E | **12/12 PASS** |
| Browser responsive widths | 320 / 390 / 768 / 1440, no horizontal overflow |

`frontend/src/modules/orders/customer-journey-nav.test.tsx` adds three tests covering universal safe links, encoded order context and absence of fabricated payment/pickup links.

## Limitations and handoff

1. Browser tests cover an extensive, **bounded** set of states. They do not certify every route × user × status × modal permutation. Unverified states and roles stay `NOT_TESTED` in `ROUTE_ROLE_STATE_MATRIX.json`.
2. The real Production backend was not modified or exercised. Actual customer payment upload, order creation, cancellation, pickup redemption and notification read persistence still need separately authorized disposable integration fixtures and failure-path tests before production signoff.
3. Native VoiceOver/NVDA, device hardware, browser zoom at 200%, real-world user usability and visual stakeholder acceptance are still outstanding.
4. Cross-role backend RBAC and operation/payment idempotency guarantees were not changed or independently re-audited in this phase.
5. The source app has many existing test evidence files under `frontend/e2e/quality-audit`. Newly added test filenames use feature names rather than implementation phase numbers.

**Next phase:** Staff/Organization operations redesign. Preserve backend contracts and existing customer status guidance, inspect each operational role/page and verify safely with intercepted writes.
