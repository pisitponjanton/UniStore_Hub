# UniStore Hub — Campus Commerce A / Phase 9 Login & Register Review

**Date:** 2026-10-19
**Workspace:** `UniStore_Hub`, BDXA local only
**Plan task:** `task_b1d40dc3-4d57-4dcd-8df2-e5e61a143fae`
**Phase:** 9 — Login/Register redesign with intentional form UX
**Scope result:** PASS for frontend-only auth presentation and guarded UI states. No Commit, Push, Deploy, backend change, API/session/return-route change, AWS/Production access, tenant modification, account creation or credential transmission.

## Source review / baseline

- Original `frontend/src/modules/auth/auth-form.module.css` had **915 lines** containing multiple stacked generations of auth layout CSS overrides, starting with `width: min(100%,2048px)`, tall full-viewport marketing intro and right-side form with a much smaller card.
- Baseline screenshots saved to `frontend/quality-audit/.evidence/campus-a-phase9/before-login-390.png`, `before-login-1440.png`, `before-register-3840.png`. In the observed 3840 CSS-pixel viewport the page was at most 2048 CSS pixels wide, with a much narrower form. The mobile entry also retained a visually weighty header before the form.
- Existing auth behavior was already implemented in `login-form.tsx`, `register-form.tsx`, `auth-entry-state.tsx`, `auth-validation.ts` and `return-route.ts`. Phase 9 deliberately **preserves all existing authentication/session flows and returnTo semantics**; Phase 10 separately owns the reported interrupted protected-order workflow and any redirect/guard fixes.

## Implemented

1. Replaced the old fragmented 915-line CSS with one concise, coherent **Campus Commerce A** `frontend/src/modules/auth/auth-form.module.css`, retaining all class names used by Login, Register, already-authenticated Auth Entry, and shared Frame.
2. **Desktop/4K:** centered split-screen editorial/commerce layout with balanced sections and a capped overall `1880px` canvas. Text-based `UniStore Hub` brand sits in the dark introductory panel, while the form lives in a semantic `--surface` card capped at `542px` normally / `560px` on extra-wide displays. This prevents 4K-size input fields, horizontally stretched copy, and unintentionally tiny cramped panels.
3. **Mobile/tablet:** below `850px`, the intro becomes a compact readable full-width top panel, the long 3-step marketing list hides visually, and the form becomes a comfortable near-full-width card. No horizontal overflow at `320,390,768,1024,1440,1920,2560,3840` CSS widths. At 200% root text size, the tested `390,768,960,1920` widths remained free of horizontal document overflow.
4. **Accessibility and state presentation:** consistent Light/Dark text/background hover contrast, 44px+ actionable password-visibility toggle and secondary links, 50px primary CTA, visible focus rings and reduced-motion overrides. Existing required fields, browser autocomplete, password show/hide `aria-pressed`, field-linked error summary/focus, server Error Notice, inline errors, and pending disabled labels were kept; form elements now explicitly set `aria-busy={pending}`.
5. **Direct/return-context:** preserves Login ↔ Register links carrying the sanitized same-origin `returnTo` path and existing contextual description, plus a return-to-store link. Actual successful sign-in/create-account and post-login protected-order continuation **are not claimed as verified** here and are Phase 10 or end-to-end auth responsibilities.
6. **Already logged in:** existing `AuthEntryState` loading and account/role-specific next-task cards retain their controls, labels, and permissions, and inherit the same cohesive form CSS. User-initial avatar is an account identity indicator, not a brand logo.
7. No fabricated brand illustration/logo, no modified backend contracts, API writes, or seeded record changes.

## Verification matrix

| Check | Result |
|---|---|
| Full frontend Vitest | **376/376 PASS** in 93 test files |
| TypeScript `tsc --noEmit`, ESLint | PASS |
| Next.js production/static Build | **30/30 pages PASS** |
| Phase 9 guarded Chromium UI/E2E | **4/4 PASS** (Login and Register, Light/Dark) |
| Responsive Phase 9 | **320,390,768,1024,1440,1920,2560,3840px** per form/per theme; no reported overflow, bounded form width |
| 200% font-size Phase 9 | **390,768,960,1920px** per form/per theme; no reported overflow |
| ReturnTo/context and interaction | Browser-verified cross-form `returnTo` query preservation; show/hide password; invalid submit linked Error Summary; mocked server error; busy/disabled submit; zero real auth writes |
| 28 canonical routes × 5 viewports read-only Responsive/A11y | **140/140 captures, PASS**; 28 routes, zero recorded browser API writes, broken images, unexpected page errors, automated axe findings and horizontal overflow |
| Full Phase 2–9 guarded Chromium suite | **31/31 PASS** on final isolated rerun. Evidence: `phase2-to-9-final.log` and `phase2-to-9-final.exit.txt` = 0 |
| `git diff --check` | PASS |

First concurrent full-suite run showed 30/31 with a Playwright trace-file `ENOENT` caused by concurrent matrix activity sharing `test-results`. The single failed Phase-5 icon test independently passed 4/4. The full 31-test suite was then rerun by itself and passed **31/31**; no UI failure was identified. Prior overlapping runner output was not used as a PASS claim.

Phase 9 screenshot/evidence folder: `frontend/quality-audit/.evidence/campus-a-phase9/`. Targeted Browser Test: `frontend/e2e/quality-audit/campus-a-phase9-auth-layout.spec.ts`. Full suite and route matrix logs stored in the same evidence folder.

## Limitations / NOT TESTED

- Browser auth POST actions are **intercepted and simulated only**, with 401 responses. They never reach live Backend and do not create accounts; this ensures no destructive/test data, credentials, or session mutation. Test results cannot guarantee authentic live signup/login to DB.
- This phase does **not** repair the previously observed protected `/orders/new?...` return path after successful login, stale session hydration, forbidden role, or blocked-route recovery: that is Phase 10, which has a dedicated E2E/guard investigation plan.
- Responsive/A11y matrix is automated smoke coverage only; not comprehensive human screen-reader certification, cross-browser Firefox/Safari tests, native browser zoom on physical 4K monitor, or real flow from authenticated role permissions.
- Previously documented local dev security-risk acceptance remains in place and UI test pass is **not** security clearance for deployment.
- All changes are inside UniStore_Hub workspace; no Commit, Push or Deploy.

**Next:** Phase 10 — interrupted protected-route returnTo recovery.
