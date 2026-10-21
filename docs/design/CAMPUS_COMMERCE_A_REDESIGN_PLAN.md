# UniStore Hub — Campus Commerce A Design System vNext

**Status:** Planning only. BDXA plan ID: task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae
**Scope:** UniStore_Hub workspace only. Baseline commit: b263f76.
**Direction:** Selected option A (Campus Commerce): clean and accessible campus marketplace, warm light surfaces, restrained green/teal, cohesive dark theme.

## Non-negotiable brand rule

Show **UniStore Hub as text only** in every header, nav, sidebar, account/auth page, mobile shell and other brand location for all roles. Remove the square U letter logo pictured by user, other brand monograms, boxed store marks and replacement logos. Functional icons for actual operations remain allowed; unify their design family separately.

## Layout and interaction design rules

- Use semantic paired tokens for canvas/surface/foreground/hover/active/selected/focus/disabled/error in light and dark themes. Never put light text on a hardcoded light hover background; check every component in a real browser.
- Refactor inconsistent spacing to consistent 4px/8px steps. Stop piling conflicting final overrides. Treat content typography, labels, cards, forms, menus, inputs and tables as one shared system.
- Support CSS viewports 320, 390, 768, 1024, 1440, 1920, 2560 and 3840px, 200% zoom and high device pixel ratio. Marketplace grid/admin tables should use available desktop/4K space; prose and forms retain comfortable readable widths. Test actual 4K screenshots, not just a CSS media query.
- Replace vertical organization-directory rows on the public first page with **adaptive store card grid** backed by real store data, search, filters and pagination; keep separate treatment for organizations with zero stores.
- Investigate E2E/demo stores and organizations showing publicly. Prevent clearly identified QA fixtures leaking into normal browsing by **non-destructive** vetted display logic, never by deleting seeded records or broad string matching that could hide real stores.
- Replace ugly raw arrow glyphs with a coherent accessible functional icon family (for example Lucide), consistent size/stroke/hover and screen-reader name.
- Redesign Login and Register as deliberate responsive experiences. Test guest order-entry URL with returnTo and actual auth transitions; do not assume an auth bug solely from a screenshot of an unauthenticated protected route. Preserve safe query context and RBAC. Even legitimate denials need a compact recoverable page, not empty full-screen blocks.

## BDXA Phase index

1. Baseline browser/source audit and 28-route/257-action inventory.
2. Design A visual foundation and **text-only UniStore Hub branding**.
3. Fluid responsive 4K and spacing foundation.
4. Shared controls, hover/active/focus/disabled/modal accessibility.
5. Cohesive functional icon system and removal of all brand icons.
6. First-page Store Card Grid and marketplace search/filter.
7. Controlled QA/E2E fixture visibility and directory state handling.
8. Public store/product/campaign detail pages and preorder entry.
9. Login/Register visual and form-state redesign.
10. Protected-route returnTo/session continuation and recovery UX.
11. Customer order, payment, pickup, notification journeys.
12. Staff operations, payment review, pickup and production queues.
13. Organization Admin, management, stores/products/variants and tenant-aware navigation.
14. Platform Admin, access-control edges and administrative states.
15. Responsive/light-dark/4K/motion/keyboard/contrast audit on 28 routes and 5 roles.
16. Local Chromium/Firefox/WebKit guarded tests, TypeScript, unit, lint, static build, security/asset report.
17. Final BDXA diff review and truthful handling of any remaining risk.

## Acceptance and constraints

- All 28 canonical routes and Guest, Customer, Staff, Organization Admin and Platform Admin context. Validate screenshots at relevant viewports, overlays and states; keep the 207 route + 50 shell action ledger. Explicitly mark unverified interactions as NOT_TESTED.
- Target WCAG 2.2 AA text contrast, keyboard focus and readable input/selection states in light and dark modes.
- No backend/API/tenant/RBAC/order/payment/pickup/storage changes, business data deletion, reset, external workspace access or production actions. Work only in UniStore_Hub.
- Preserve prior locally reviewed vendored security patch and exception; never claim the five known development-only npm-audit High nodes are cleared.
- **This turn only creates a plan and plan document. No application changes, Git Commit, Push, or Deploy.** Wait for the user's next request before starting Phase 1.

Reference: screenshots supplied by user on 2026-10-19 show the current broken hover, exposed harness data, directory list, 4K width, mismatched icons, select and spacing, Login/Register and protected order-entry state.
