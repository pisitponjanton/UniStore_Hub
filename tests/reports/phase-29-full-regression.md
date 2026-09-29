# Phase 29 — Full Cross-System Regression

## Command

```bash
node --test
```

The complete available `tests/**` suite was executed against the current repository source.

## Testing-owned defects found and fixed

The first regression run produced:

- 314 tests
- 90 pass
- 32 fail
- 192 todo/blocked

Eight failures were Testing-harness/environment defects rather than product regressions.

### 1. Storefront contract isolation

Seven Storefront tests were reaching the real DynamoDB repository from an otherwise route-level/public-contract test. Without disposable persistence, those requests returned HTTP 500 even though the Storefront routes now exist.

Testing fix:

- `helpers/backend-app.mjs` now supports creating the real Backend app with dependency-injection options through exported `createApp(options)`.
- `contract/storefront.contract.test.mjs` injects a deterministic empty Organization repository for public route/surface checks.

Focused rerun:

```text
CT-STOREFRONT-001..008
8 pass, 0 fail
```

This does not mock away Storefront authorization behavior; it removes an unrelated live-DynamoDB prerequisite from route/public-envelope verification.

### 2. Malformed JWT contract isolation

`CT-AUTH-004` initially returned HTTP 500 because the Testing Agent environment has no `JWT_SECRET`. The Backend JWT service correctly maps malformed JWTs to `TOKEN_INVALID` when a secret is configured.

Testing fix:

- the Health/Auth contract app fixture now injects a test-only JWT secret through the Backend's normal `createApp(options)` dependency path.

Focused rerun:

```text
CT-HEALTH-001 + CT-AUTH-001..004 = PASS
CT-AUTH-005..007 = TODO/BLOCKED
```

No production code or contract expectation was changed.

## Final regression result

After Testing-owned fixes:

```text
tests      314
pass        98
fail        24
todo       192
skipped      0
```

Full log:

- `reports/phase-29-full-regression.log`

The 24 remaining failures are preserved as genuine current project readiness gaps.

## Failure classification

### Backend / API / Worker — 12 failing tests

Orders / own-order route integration:

- `CT-ORDER-004`
- `CT-ORDER-005`
- `CT-ORDER-006`

Current source contains an Order module, but the current `backend/src/app.js` does not mount an Order router. The current Order router itself only exposes tenant Order creation; the documented `/api/v1/me/orders...` routes are not present through the application request path.

Pickup:

- `CT-PICKUP-004`

The documented Customer own-Pickup route is not mounted/implemented.

Platform Admin:

- `CT-GOV-003`
- `CT-GOV-004`
- `CT-GOV-005`
- `CT-GOV-006`
- `CT-GOV-007`

Platform Admin routes remain absent and return generic route-not-found instead of protected-route behavior.

Notifications / Worker:

- `CT-NOTIFY-001`
- `CT-NOTIFY-002`
- `CT-NOTIFY-004`

Notification list/mark-read routes are absent and `backend/src/worker.js` is still missing.

### Frontend / Static Export — 9 failing tests

Frontend application baseline:

- `FE-001`
- `FE-002`
- `DEV-003`

Static export baseline:

- `STATIC-001`
- `STATIC-002`
- `STATIC-003`
- `STATIC-004`
- `STATIC-005`
- `STATIC-006`

Current `frontend/` still contains only `AGENT.md` at the inspected file depth; there is no package manifest, App Router baseline, Next config, or `out/` export.

### Dev Mode / Integration — 3 failing tests

- `DEV-001` — no root `package.json` / required Dev Mode command surface
- `DEV-007` — no local Worker entrypoint
- `DEV-008` — no root `dev:reset` implementation/safety guard

These remain Integration/Backend-owned gaps.

## Blocked/TODO classification

The 192 TODO results are not passes.

Major blocked groups include:

- authenticated disposable-data behavior for Organization/Member/Store/Product/Campaign/Order
- Payment submit/review/resubmit
- tenant isolation `SEC-TENANT-001..009`
- Production aggregation
- Pickup persistence/token/duplicate-confirm behavior
- file ownership/MIME/size/HEAD validation
- Notification failure independence and idempotency
- Report/Audit/Platform behavior
- Frontend interactions and static build
- LocalStack Dev Mode parity
- AWS-001..009 live deployment smoke
- all defined E2E business scenarios

## Environment limitation

This regression ran with:

- Node `v20.13.0`
- tests package requirement: Node `>=22`

The suite executed successfully enough to produce the classification above, but a release-grade rerun should use Node 22+.

AWS CLI also remains unavailable on this Testing Agent, so AWS smoke tests correctly remain TODO/BLOCKED.

## Regression conclusion

The Testing harness now distinguishes deterministic contract checks from persistence/environment prerequisites more accurately.

Current regression truth is:

- 98 demonstrated passes
- 24 executable implementation/readiness failures
- 192 explicit blocked checks

No genuine product failure was converted to TODO or weakened to make the suite pass.
