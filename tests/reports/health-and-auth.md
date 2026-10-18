# Phase 03 — Health and Auth Contract Verification

Status is generated from the Testing Agent perspective. Production fixes are outside `tests/**`.

## Contract basis

- `GET /health` is public and must return `{ success: true, data: { status: "ok" } }`.
- `POST /api/v1/auth/register` is public.
- `POST /api/v1/auth/login` is public.
- `GET /api/v1/me` requires Bearer JWT.
- Missing/invalid/expired auth maps to documented 401 auth error codes.
- Register/Login success returns `user + token + expiresIn`.
- Storage implementation fields must not leak through API responses.

## Test IDs

- CT-HEALTH-001
- CT-AUTH-001
- CT-AUTH-002
- CT-AUTH-003
- CT-AUTH-004
- CT-AUTH-005 — blocked until auth + disposable data environment exists
- CT-AUTH-006 — blocked until auth + disposable data environment exists
- CT-AUTH-007 — blocked until controlled auth fixtures exist

The executable surface tests intentionally assert the canonical contract. A missing route is a product failure, not a reason to weaken or skip the assertion.

## Latest execution

Command:

```bash
node --test contract/health-auth.contract.test.mjs
```

Result:

- CT-HEALTH-001 — PASS
- CT-AUTH-001 — FAIL: expected 400 validation response, received 404
- CT-AUTH-002 — FAIL: expected 400 validation response, received 404
- CT-AUTH-003 — FAIL: expected 401 AUTH_REQUIRED, received 404
- CT-AUTH-004 — FAIL: expected 401 TOKEN_INVALID, received 404
- CT-AUTH-005..007 — TODO/BLOCKED pending auth implementation and controlled disposable data

Observed implementation state: `backend/src/modules/auth/` is empty and `backend/src/app.js` currently mounts only `/health`. This is a Backend-owned implementation gap. Testing does not patch it.
