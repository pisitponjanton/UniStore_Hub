# Phase 05 — Organization and Member Contract Verification

## Contract basis

Organization routes:

- `GET /api/v1/organizations` — Bearer JWT
- `POST /api/v1/organizations` — Bearer JWT; creator becomes `ORGANIZATION_ADMIN`
- `GET /api/v1/organizations/:organizationId` — active Staff/Admin membership or Platform Admin policy
- `PATCH /api/v1/organizations/:organizationId` — Organization Admin or Platform Admin policy

Member routes:

- `GET /api/v1/organizations/:organizationId/members` — Organization Admin
- `POST /api/v1/organizations/:organizationId/members` — Organization Admin
- `PATCH /api/v1/organizations/:organizationId/members/:userId` — Organization Admin
- `DELETE /api/v1/organizations/:organizationId/members/:userId` — Organization Admin

Member creation normalizes email, resolves an existing User, and returns `USER_NOT_FOUND` when absent. Valid membership roles are only `STAFF` and `ORGANIZATION_ADMIN`.

The final active `ORGANIZATION_ADMIN` cannot be demoted or removed; both cases must return `409 LAST_ORGANIZATION_ADMIN`.

## Test IDs

Executable surface/auth checks:

- CT-ORG-001 through CT-ORG-004
- CT-MEMBER-001 through CT-MEMBER-004

Behavior checks requiring authenticated disposable data:

- CT-ORG-005
- CT-MEMBER-005 through CT-MEMBER-009

## Latest execution

Command:

```bash
node --test contract/organization-members.contract.test.mjs
```

Result:

- CT-ORG-001..004 — FAIL: all Organization routes returned generic `404 VALIDATION_ERROR` instead of protected-route behavior
- CT-MEMBER-001..004 — FAIL: all Member routes returned generic `404 VALIDATION_ERROR` instead of protected-route behavior
- CT-ORG-005 — TODO/BLOCKED pending Organization persistence and authenticated disposable fixtures
- CT-MEMBER-005..009 — TODO/BLOCKED pending Member/Auth implementation and controlled membership fixtures

Observed implementation state: `backend/src/modules/organizations/` and `backend/src/modules/members/` are currently empty, while `backend/src/app.js` still mounts only `/health`. These are Backend-owned implementation gaps; Testing does not patch them.

Current focused result: 14 tests total — 0 pass, 8 fail, 6 todo.
