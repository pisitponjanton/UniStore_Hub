# UniStore Hub — Account and Role Entry Redesign

Date: 2026-10-18 · Workspace: `UniStore_Hub` · Scope: `/login/`, `/register/`, `/org/select/`, and shared authenticated account-entry state.

This is a scoped frontend UX/UI implementation with test evidence. **It is not production approval** or confirmation of an actual persisted registration/login or organization creation.

## Implemented

**Login / Registration.** Converted the earlier tall, slide-like introductory region into a compact task-first account flow. The large-screen layout uses a quiet deep-teal explanation rail and a single focused form. Mobile places the form immediately after a short page description. Preserved form labels, native keyboard and autocomplete, eye toggle, input validation, focusable error summary, disabled/pending states, and server-error recovery. Updated copy to explain why UniStore Hub needs an account (pre-orders, payment status, pickups) without inventing services or promotional assets. Contextual, sanitized `returnTo` now shows a human-readable **destination label** rather than an opaque URL; switching between Login and Register preserves the destination.

**Already-authenticated account entry.** Previously the Auth Entry state ignored the requested `returnTo` and offered only generic My Orders/Notifications/Organization links. It now makes the existing sanitized destination the **primary continue action**, adds explicit My Orders when relevant, and keeps Notifications available. Organization selection appears only for an ACTIVE organization membership; Platform Administration appears only for `PLATFORM_ADMIN`. A shopper, staff or platform user sees only relevant areas. Actual enforcement remains the existing AuthenticatedBoundary and server-side RBAC, not the new navigation links. External return URLs are still sanitized to the default directory by the existing helper. No auth/session mechanics or backend contract was changed.

**Organization workspace entry.** The page now asks which authorized organization the user wants to work in. It foregrounds searchable active membership-backed organization cards, their statuses and staff/admin role, and leaves create-organization as a secondary action. Long UUIDs are accessible behind a native `details/summary` control instead of dominating the list. Dark-header counts have been contrast-corrected following inspection of mobile browser screenshots. Existing `rememberActiveOrganizationId`, role-dependent landing URLs, safe submit/validation, and create API handling remain unchanged.

**Styling / accessibility.** Reused shared brand palette and icon language, restrained backgrounds, clearer headings, semantic navigation, visible focus and reduced motion. Refined mobile and desktop layouts across 320, 390, 768, 1024 and 1440px without horizontal overflow in mocked browser checks. No third-party images/icons/dependencies were added.

## Verified

All controlled Browser E2E tests used an **isolated browser** and API-shaped read-only `GET /me` / `GET /organizations` fixtures. Any non-read API request in the new scenario was aborted; no login/register/create-organization API calls were made in that suite. The legacy form regression tested deferred HTTP 503 for login and 409 for registration by intercepting POST before the network; it verified error and pending/disabled states without writing backend data.

| Quality gate | Result |
| --- | --- |
| Unit/component tests | **338/338 PASS**, 84 files (includes 3 new account-entry tests) |
| TypeScript + ESLint | PASS |
| Next.js production build | 30/30 routes PASS |
| New Browser E2E: Chromium | **7/7 PASS** |
| New Browser E2E: Firefox | **7/7 PASS** |
| New Browser E2E: WebKit | **7/7 PASS** |
| Existing Chromium auth/error and role-switching regression | **5/5 PASS** |
| Total scoped browser tests | **26/26 PASS** |
| `git diff --check` | PASS |
| Browser widths | 320 / 390 / 768 / 1024 / 1440, no horizontal overflow |

Browser sources: `frontend/e2e/quality-audit/account-role-entry.spec.ts`, `auth-form-states.spec.ts`, `workspace-navigation.spec.ts`. Additional unit tests: `frontend/src/modules/auth/auth-entry-state.test.tsx`, `auth-forms.test.tsx`, `frontend/src/modules/organizations/organization-select-view.test.tsx`.

Ten ignored evidence PNGs were saved in `frontend/quality-audit/.evidence/redesign-account/`, consisting of mobile 390px and desktop 1440px for Guest Login, Guest Registration, already-authenticated Staff, already-authenticated Platform Admin and the Staff organization picker.

## Honest limitations and next steps

- Real backend authentication **success** (token creation, full reload restore, persistence), actual registration, successful organization creation and authenticated business mutations **remain NOT_TESTED** in this phase. The browser fixtures show the UI and navigation branches, not server authorization proof.
- Denied/forbidden edge cases for every role × route, device-native zoom, VoiceOver/NVDA and human design signoff have not been exhaustively exercised.
- The direct BDXA local browser, which was opened before introducing fixtures, stayed in the session-checking/loading state for Login and Register. The guest and authenticated **loaded forms/pages were verified using the controlled Playwright browser fixture**, not from production-backed persisted data.
- `returnTo` is validated by the pre-existing sanitization and does not grant access to any destination. Existing role boundaries still decide whether that destination is authorized.
- No backend, API contracts, RBAC, tenant data, payments, orders, organizations or seed/real records changed. **No Commit, Push or Deploy.**

**Handoff:** proceed to the next Customer experience phase with preserved shared design and strict action-specific read-only/browser-safe testing. Update `docs/design/ROUTE_ROLE_STATE_MATRIX.json` only for cases with verifiable evidence.
