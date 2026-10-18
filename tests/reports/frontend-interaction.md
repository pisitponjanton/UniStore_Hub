# Phase 19 — Frontend Interaction Verification

## Source-backed interaction requirements

Frontend interaction coverage must verify:

- public Storefront browse works without JWT; Order creation requires authentication
- Login and Register success/error flows
- session restore via `GET /api/v1/me`
- JWT stored only in `sessionStorage` key `unistoreHub.accessToken`
- logout clears the session token
- 401 becomes anonymous/login behavior
- 403 keeps authenticated state and renders forbidden behavior
- loading / success / empty / error+retry / unauthorized / forbidden remote states
- invalid runtime query parameters render controlled invalid-link state
- Customer own-order flow
- Order payload does not submit authoritative price/total
- Payment rejection reason display and resubmission
- direct Browser ↔ S3 upload flow
- Production view consumes Backend summary and is not exposed to Staff
- Pickup duplicate-confirm conflict UX
- Notification read/unread + mark-read
- role-aware navigation for Customer, Staff, Organization Admin, and persisted Platform Admin

Frontend visibility remains UX only; Backend authorization is authoritative.

## Required frontend structure

The Frontend spec defines a Next.js App Router application with at least:

- `frontend/package.json`
- `frontend/src/app/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`
- feature modules/services/session utilities under `frontend/src/**`

## Test IDs

Current source-presence checks:

- FE-001 — Next.js package manifest exists
- FE-002 — required App Router entry/login/register pages exist

Interaction checks prepared for execution when Frontend exists:

- FE-003 through FE-023

## Current implementation observation

At phase start, `frontend/` contains only `AGENT.md` plus empty `public/` and `src/` directories. There is no `package.json` and no application source file under `src/`.

Therefore browser/component interaction behavior cannot yet be exercised. Testing records the missing application baseline as a real Frontend-owned failure and keeps behavior tests explicitly blocked rather than inventing or mocking a nonexistent UI.

## Latest execution

Command:

```bash
node --test frontend/frontend-interaction.test.mjs
```

Result:

- FE-001 — FAIL: `frontend/package.json` does not exist.
- FE-002 — FAIL: required App Router pages are absent; first missing path is `frontend/src/app/page.tsx`.
- FE-003..023 — TODO/BLOCKED because the Frontend application, routes, modules, shared API client, session utilities, and browser/component harness do not yet exist.

Focused summary: 23 tests total — 0 pass, 2 fail, 21 todo.

The two failures are genuine Frontend-owned baseline gaps. The 21 interaction requirements are intentionally not counted as passing. No mock-only substitute is used because the phase is intended to verify the real cross-system UI behavior once the Frontend implementation exists.
