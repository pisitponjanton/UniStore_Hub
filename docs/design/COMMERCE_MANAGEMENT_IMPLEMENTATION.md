# UniStore Hub — Commerce Management Redesign

Date: 2026-10-18 · Workspace: `UniStore_Hub` · Plan: Cross-Role UX/UI Redesign

Scope: `/org/stores/`, `/org/products/`, `/org/campaigns/`, plus their embedded store/product/variant/image/campaign create, edit, upload and confirmation states.

**Scoped frontend UX/UI implementation; not production release approval or an exhaustive all-state certification.**

## Experience changes

**One admin workflow.** Introduced the reusable `CommerceManagementNav` for Store → Product & Variant → Campaign workflows, shared across all three scoped pages. Every link preserves the **current organizationId**, encoded with `URLSearchParams`. The current area is semantic text with `aria-current="page"`, and never links to an invented tenant. On narrow screens this is one compact navigation row; desktop has a clear three-step caption. A new two-case unit test covers encoded tenant context and no self-link.

**Store management.** Reduced header/summary height and decorative gradients. Store inventory list is the primary task; the new-store form is a secondary, separately framed panel. The selected store editor uses a calmer bounded region rather than a disconnected floating state. Actual existing create/edit/status validation, notifications, confirmation dialogs and tenant-safe API requests remain untouched.

**Product and variants.** Prioritized store filter, product search, product photo/status and editing context. The product editor now uses visually distinct sections for basic details, image upload and variants, maintaining their existing form ownership and status policies. The uploaded image surface and selected file/progress use the same visual system. No fictional assets or fake catalog entries were added.

**Image upload lifecycle and uncertain PATCH.** The existing `ProductImageUploadView` behavior is intentionally preserved. It distinguishes no-image, selected file, presign/PUT/PATCH progress, pending save verification, uncertain response, read-only GET verification, storage unavailable and recovered status. On ambiguous PATCH responses, repeated stale GET, cross-account transitions, product switching, closed tabs and denied Session Storage, it does not silently retry PUT/PATCH. UI styling changes do not convert uncertain outcomes into success or re-send an already-sent image.

**Campaigns.** Redesigned the list, loaded-scope summary, filter, next-action guidance, creation form, editor sections, schedule facts and lifecycle regions as related steps of the same campaign workflow. Existing server-defined campaign statuses, date guards, create/edit validation and lifecycle confirmation remain intact.

**Accessibility and responsive styling.** Shared restrained warm-neutral/deep-teal palette, readable labels, flatter background surfaces, purposeful focus outlines, reduced-motion compatibility, and touch-friendly controls; list before creation form on mobile; no new decorative assets or libraries.

## Verified locally

An actual local browser run authenticated as an **Organization Admin** opened all nine admin routes in the broader organization-management suite. The three scoped commerce pages passed 320/390/768/1440px checks with no horizontal overflow or page JS errors. Browser navigated Stores → Products → Campaigns and confirmed the original `organizationId` survives each transition. A real **Staff** session was denied direct access to each of the three organization-admin commerce URLs (as well as three other admin routes), and the commerce management navigation never rendered for the denied routes.

Selected real renderings were inspected at 390px for Stores, Products and Campaigns, and at 1440px for Products. Six Git-ignored screenshot evidence files were saved in `frontend/quality-audit/.evidence/redesign-commerce-management/`: all three routes at 390px and 1440px. The 36 wider route/viewport captures of the nine-route run are in the ignored Playwright `frontend/test-results/quality-audit/` on the local workspace (test runs may clear this directory; only the six saved evidence files are persistent until removed).

### Safe E2E regression cases

- `store-management-actions.spec.ts` — store create/edit validation and status confirmation without real business writes.
- `products-variants-actions.spec.ts` — product and variant create/edit, status change and selected-editor behavior.
- `campaign-actions.spec.ts` — campaign filtering, forms, date/validation and lifecycle confirmation.
- Twelve product-image scenarios:
  `product-image-ambiguous-patch`, `product-image-stale-readback`, `product-image-session-reload`, `product-image-upload-negative-cases`, `product-image-storage-denied`, `product-image-closed-tab-recovery`, `product-image-cross-account-isolation`, `product-image-inflight-navigation`, `product-image-inflight-product-switch`, `product-image-readback-recovery`, `product-image-stale-session-response`, `product-image-storage-denied-reload`.

All targeted business-changing interactions used **controlled synthetic/intercepted network responses**, not real persisted POST/PUT/PATCH/DELETE. The local session and GET fixtures demonstrated UI and role boundaries but do not independently certify server authorization/idempotency.

| Quality gate | Result |
| --- | --- |
| Unit/component | **356/356 PASS**, 89 test files |
| TypeScript / ESLint | PASS |
| Next.js production build | **30/30 routes PASS** |
| `git diff --check` | PASS |
| Chromium browser suite: admin + staff denied, store/product/campaign, image | **17/17 PASS** |
| Firefox / WebKit: organization admin and staff denied | **2/2 each PASS** |
| Total scoped browser E2E | **21/21 PASS** |
| Responsive sizes | 320 / 390 / 768 / 1440px, no horizontal overflow |

The source `docs/design/ROUTE_ROLE_STATE_MATRIX.json` has **59 action IDs across three scoped routes** with at least one limited E2E reference each. Evidence is **PARTIAL**, not 59 exhaustive action-state matrices.

## Outstanding risks and handoff

1. Actual persisted organization stores/products/variants/campaigns mutations and real object storage upload were not sent to any backend; synthetic success/error does not certify real transactions.
2. Image upload ambiguous PATCH across lost client storage, closed/new tabs and stale GET cannot guarantee server idempotency without a backend confirmation protocol. This remains a deferred backend design/QA risk from earlier phases; **do not silently reupload**.
3. All possible role × state combinations, native 200% zoom, screen reader and physical device usability tests remain out of scope for this bounded phase.
4. Backend/API, tenant/RBAC rules, storage contracts, orders/payment/pickup and all user business records were preserved.
5. **No Commit, Push, Deploy, database reset, remote data write or AWS/Production access.**

Continue only with the next named implementation phase from the current BDXA plan; keep affected route/action evidence honest and scoped.
