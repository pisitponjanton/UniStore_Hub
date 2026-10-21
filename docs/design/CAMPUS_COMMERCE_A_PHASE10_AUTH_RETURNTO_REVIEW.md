# UniStore Hub — Campus Commerce A / Phase 10 Auth ReturnTo & Protected Order Recovery

**Date:** 2026-10-19
**Workspace:** `UniStore_Hub` (local BDXA only)
**Task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 10 — Fix auth returnTo and protected-route continuation
**Outcome:** PASS for Phase 10 frontend session/navigation scope; final regression, responsive matrix and build passed. No Commit, Push, Deploy, real account, order, database or backend changes.

## Source-derived root causes

1. `LoginForm` and `RegisterForm` linked “กลับไปหน้าที่กำลังใช้งาน” directly to their `returnPath`. When that destination was a protected `/orders/new` and the user was still anonymous, clicking Back immediately re-entered `AuthenticatedBoundary` and showed another unauthorized state. The previous `UnauthorizedState` took very little vertical space above a huge empty canvas, without a visible public product recovery.
2. `AuthSessionStore.restore()` memoized one in-flight `/me` promise. `establish(newToken)` wrote the new token then called `restore()`; if old-token `restorePromise` was still pending, it reused that result. A late stale success or stale `TOKEN_EXPIRED` could replace the newly authenticated state or clear the new token. Logout could also race an older in-flight `/me` success.
3. `AuthenticatedBoundary` checked API failure flags before testing `auth.status === "loading"`, potentially displaying the wrong recovery UI during hydration. The Order page had no contextual recovery variant. `OrderCreateView` treated forbidden product fetches as generic errors and did not explicitly recover after definitive session invalidation.

## Work completed

1. **Safe anonymous back navigation** — `frontend/src/modules/auth/return-route.ts` now exports `getUnauthenticatedExit`. The helper keeps the actual successful sign-in `returnTo` untouched, but sends an anonymous user leaving a protected checkout to the public product when both authoritative organization and product UUIDs are well formed. Campaign ID is carried only when valid; incomplete checkout and all other protected routes safely fall back to `/`. Both Login and Register use this helper in their secondary Back link, so there is no anonymous checkout/login loop.
2. **Hydration-safe contextual order gate** — `frontend/src/modules/auth/auth-recovery.tsx`, `auth-recovery.module.css`, `access-boundary.tsx`, `use-auth-navigation-context.ts` and `frontend/src/app/orders/new/page.tsx` provide an order-specific recovery kind. During hydration a proper Loading heading is shown; for anonymous checkout, a compact, keyboard-accessible, Mobile–4K state offers sign-in preserving all query values plus public product fallback; forbidden conditions show explicit recovery without bypassing access rules. The text-only `UniStore Hub` brand stays consistent.
3. **Race-free session bootstrap** — `frontend/src/modules/auth/session.ts` versions restore generations. A new login invalidates any outstanding previous `/me` operation; a stale response (including `TOKEN_EXPIRED`) cannot overwrite or clear the newer valid session. Logout also invalidates old in-flight session requests. Repeated calls inside the same generation are still deduplicated; authoritative `/me` is still required before opening protected content.
4. **Protected order data validation** — `frontend/src/modules/orders/order-create.tsx` logs out on definite `TOKEN_INVALID` / `TOKEN_EXPIRED` errors and re-enters the guarded sign-in step; a genuine 403 has distinct forbidden UI with public store and personal-order-list exits. The order service and business validation remain unchanged.
5. **Tests** — Added focused unit tests for stale expired-token login race, logout restoration race, exact `returnTo` including variant/campaign/product IDs, public Back links and external returnTo rejection. Added read-only Chromium E2E for anonymous checkout → login → exact order continuation, slow authenticated session, expired-token fallback, already-authenticated Login page continuation and forbidden product response under Light/Dark. Auth Login POST in the E2E is intercepted and supplied a **synthetic token**; `GET /me` and public store/product/campaign API also receive synthetic responses. Order/create POST is blocked. The test does **not** establish that the local Production/Backend login succeeds with real credentials.

## Verification

| Gate | Result |
|---|---|
| Focused Phase-10 Chromium | **8/8 PASS**, Light/Dark: initial 6/6 in `targeted-v2.log`, plus 2/2 existing-session Login entry; all confirmed in final 39/39 suite |
| Full frontend Vitest | **382/382 PASS**, 94 test files |
| TypeScript | PASS |
| ESLint | PASS, zero warnings after unused import was removed |
| `git diff --check` | PASS |
| Phase 2–10 guarded browser regression | **39/39 PASS** on final serial rerun; `phase2-to-10-final.log`, `phase2-to-10-final-exit.txt` = 0 |
| Next.js Static Build | **30/30 Pages PASS** |
| 28 canonical routes × 5 widths read-only Responsive/A11y | **140/140 PASS**, 28 routes, 0 browser writes, overflows, page errors, automated axe findings or broken images; `route28-final-exit.txt` = 0 |

Browser evidence: `frontend/quality-audit/.evidence/campus-a-phase10/`, including anonymous-order Mobile screenshot and correctly authenticated order-ready Desktop screenshot; there is no claim that a real order was submitted.

## Limits and next action

- This is a **frontend-only** fix of navigation/Session/Guard logic. It neither changes authorization policy nor creates DB entries. A true end-to-end live signup/login/checkout would require explicitly approved controlled credentials and test data. No personal credentials were supplied or transmitted during QA.
- Native physical 4K, full screen-reader/manual accessibility and production browser matrix remain beyond automated Chromium checks.
- An existing wide-screen order-ready layout overlap visible in the read-only screenshot is an acknowledged **Phase 11 customer journey visual issue**, not silently represented as repaired in Phase 10.
- `AuthSessionStore` still falls back to anonymous on a non-definitive `/me` network failure while preserving the access token; a comprehensive offline/retry product policy would be a separate reliability decision, not an auth bypass.
- Existing dev-only dependency security risk acceptance remains in place; no claim of production readiness or security clearance is made.

**Next:** Phase 11 — Customer journey, checkout/order, payment, pickup and notification UX, only after Phase 10 closes successfully.
