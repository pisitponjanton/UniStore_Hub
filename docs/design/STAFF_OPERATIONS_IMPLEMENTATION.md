# UniStore Hub — Staff Operations Redesign

Date: 2026-10-18 · Workspace: `UniStore_Hub`. Scope: `/org/orders/`, `/org/orders/view/`, `/org/payments/`, and `/org/pickups/` for **STAFF** role.

**Scoped frontend redesign complete, not production approval.** No backend/API/tenant/RBAC/payment/order/pickup contract or real record was modified; no Commit, Push or Deploy.

## What changed

### One operational workflow

The four views now use a consistent editorial interface for day-to-day operations. Introduced the shared `StaffOperationNav` under `frontend/src/modules/operations/`, with links to Orders, Payment Review and Pickup. Every link uses the **actual current organizationId**, URL-encoded; this is navigation only, not authorization. On small screens it is a single compact row and does not repeat a full dashboard before the queue. Organization detail still has a clear route back to its Orders queue.

Queue cards prioritize backend-owned current status, next required action, recent timing and accessible action buttons instead of decorative gradients or engineering names. Visible headings and metadata were localized for staff readers (e.g., "คำสั่งซื้อ", "หลักฐาน", "รายการรับสินค้า" with shortened real IDs). The complete authoritative IDs, actual token, and current state continue to be available where needed for verification.

### Action-aware orders

Added `StaffOrderNextTask` to the order detail. It maps each of the existing **nine** order statuses to a safe explanation, linking only `PAYMENT_REVIEW` to the organization's Payment queue and `READY_FOR_PICKUP` to the organization's Pickup queue. Other statuses show a truthful wait/terminal notice instead of a new action or a fake ability to change state. Organization cancellation still uses existing `canOrganizationCancelOrder` and its guarded confirmation dialog; STAFF did not gain cancel permissions.

### Payment decision and pickup confirmation

Payment Review now emphasizes status, the matching order total, the temporary private proof viewer, three-step review guidance, and the approve/reject controls. Approval dialog copy explicitly explains that server state is checked again before a decision is committed; rejection still requires the validated reason, with its existing focus and pending rules. Pickup Review emphasizes the receipt token, linked order and handover checks. Confirmation is still available **only** when `canConfirmPickup` permits it; duplicate 409/retry and terminal feedback behavior are unchanged.

Across the four pages, the visual system uses quieter warm-neutral surfaces, a restrained dark-teal emphasis on action rows, readable text contrast, natural spacing, visible focus and reduced motion. No speculative product/receipt imagery, new icon libraries or external assets were added.

## Browser evidence

The actual local development UI was opened in Playwright as the **STAFF** role with local seed session and GET-only access. The run checked Orders, Payments and Pickups at **320, 390, 768 and 1440px** without horizontal document overflow. It followed a real Orders → Order Detail → Orders route and verified the status-based next-task region. Payment selection and reject modal were exercised, including Escape dismissal.

The local Pickup queue had **0 available records**. Its empty state was seen against the local dataset. A non-empty Pickup selection, confirmation dialog, pending state, duplicate 409 and success were tested in existing **browser-only synthetic intercept** suites, not against real fulfilled orders. Payment approval/rejection and organization cancellation similarly used intercepted writes; no real business record was changed.

Evidence saved as nine Git-ignored images in `frontend/quality-audit/.evidence/redesign-staff/`:

- Orders, Payment Review, Pickup and Order Detail at 390px and 1440px (eight images)
- Payment rejection dialog at 390px (one image)

The browser suite is `frontend/e2e/quality-audit/staff-operations-responsive.spec.ts`. Supplemental scoped safe tests include `staff-queue-filters.spec.ts`, `payment-review-safe-actions.spec.ts`, `payment-review-decision-matrix.spec.ts`, `pickup-confirm-safe-actions.spec.ts`, `order-detail-safe-actions.spec.ts`, and `multi-role-modal-accessibility.spec.ts`.

## Verification

| Gate | Result |
| --- | --- |
| Unit/component tests | **352/352 PASS** (87 files; 11 new operations component cases) |
| TypeScript / ESLint | PASS |
| Next.js production build | **30/30** static routes PASS |
| `git diff --check` | PASS |
| Browser test cases, Chromium | **9/9 PASS** (1 responsive, 2 payments, 2 queue/pickup, 4 dialog/detail) |
| Browser tests, Firefox / WebKit | **1/1 each** PASS |
| Total scoped Browser E2E | **11/11 PASS** |
| Browser widths | 320 / 390 / 768 / 1440px: no horizontal overflow |

The full source quality manifest `docs/design/ROUTE_ROLE_STATE_MATRIX.json` preserves the distinction between a **scoped PASS** and exhaustive approval for all states/roles. Four routes and 32 source user-action families have related scoped browser/component evidence; this is not 32 exhaustive state matrices.

## Known limits and handoff

1. Real persisted payment approval/rejection, pickup handover, order cancellation and conflict handling have **not** been verified against an owned disposable backend in this UI phase. Tests use network interception or GET-only local fixtures.
2. Local pickup list was empty; screenshots of Pickup show the true empty state, not populated selection.
3. Full authorization against all role combinations, 200% zoom, VoiceOver/NVDA and physical device UX are not certified. `organizationAdmin` and other unverified role rows remain `NOT_TESTED` for these routes.
4. Server-side state machines, payment idempotency, pickup token security, authorization and tenant checks are unchanged, but are not independently integration-signed off.
5. No Commit, Push, Deploy, DB reset or AWS/Production access.

**Handoff:** continue with the planned next Organization Administration redesign, preserving the current role constraints and verified task-oriented queue behavior.
