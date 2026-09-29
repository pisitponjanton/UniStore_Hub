# UniStore Hub — Testing Handoff

Snapshot: 2026-09-29  
Scope owner: Testing Agent (`tests/**` only)

## Test layers and artifacts

Cross-system coverage is organized under:

- `contract/**` — API contract/auth/envelope/business boundary tests
- `security/**` — mandatory SEC-TENANT-001..009
- `integration/**` — Data contract, notification resilience, traceability validation
- `frontend/**` — interaction and static-export checks
- `smoke/**` — Dev Mode and AWS deployment smoke
- `infrastructure/**` — CloudFormation static verification
- `e2e/**` — core, rejection, tenant, and notification end-to-end scenarios
- `reports/**` — per-phase results, FR traceability, and this handoff

FR mapping is in `reports/fr-traceability.md` and `reports/fr-traceability.json`.

## Environment snapshot

- Testing Agent: `pisitpon-janton-MacBook-Air-3.local`
- Node available on agent: `v20.13.0`
- Tests package declares: `node >=22`
- Python: `3.12.6`
- AWS CLI: unavailable (`aws: command not found`)
- Frontend current files at depth <=2: only `frontend/AGENT.md`
- Repository root currently has no `package.json`; required root Dev Mode command surface is absent
- CloudFormation static suite previously passed 12/12
- Live AWS smoke remains blocked without AWS CLI/active Learner Lab access

The Node runtime mismatch is an environment finding: the harness has been executing on Node 20 even though `tests/package.json` declares Node 22+. Phase 29 should either run on Node 22+ or preserve that mismatch as an explicit execution limitation.

## Current source drift versus earlier phase reports

Several early contract reports are historical snapshots and must be refreshed in Phase 29. Since those reports were produced, Backend source has appeared for Auth, Organizations, Members, Stores, Products, Storefront, Campaigns, and partial Orders.

Current Backend source still lacks complete request paths for the major downstream flows required by the E2E readiness gates, including Order routes/service/controller, Payments, Production, Pickups, Notifications, Audit, Platform Admin, and `backend/src/worker.js`.

Do not treat an old FAIL from phases 03-07 as proof that the same route is still absent today; Phase 29 is responsible for current regression truth.

## High-priority owning-subsystem findings

1. **Backend downstream business flow** — Order/Payment/Production/Pickup/Notification/Audit/Platform Admin request paths remain incomplete, blocking FR-07 through FR-14 and all business E2E scenarios.
2. **Worker** — `backend/src/worker.js` is absent, blocking notification processing, retry/idempotency, Dev Mode parity, and notification E2E.
3. **Frontend** — application package/routes are absent; interaction and static-export verification cannot execute.
4. **Integration/Dev Mode** — no root `package.json` or root `dev:setup/dev/dev:seed/dev:reset/dev:down` command interface exists.
5. **AWS live smoke** — AWS CLI is unavailable on this Testing Agent, so AWS-001..009 remain blocked.
6. **API/Integration contract gap** — Customer-visible Payment rejection reason is required by Testing/Frontend but no Customer-readable Payment response path is currently defined.

## Security status

Mandatory `SEC-TENANT-001` through `SEC-TENANT-009` all exist as explicit tests. Their latest dedicated security-phase results are TODO/BLOCKED, not passes. `E2E-TENANT-001` also exists and is currently blocked by missing owning business routes.

Cross-tenant failures are considered blocking when these scenarios become executable.

## Notable recorded passes

- `CT-HEALTH-001` — canonical health contract
- `DATA-001..010` — UUID/time/key/GSI/access-pattern primitives and no current request-path Scan dependency
- `CT-FILE-001..006` — selected file auth/pre-sign/direct-transfer adapter boundaries
- `CT-NOTIFY-003` — canonical SQS JSON publication adapter
- `INFRA-CFN-001..012` — CloudFormation static Learner Lab baseline
- selected auth boundaries for Production/Pickup/Report/Audit

These are narrow passes only and do not imply their entire FR is complete.

## Next verification step

Phase 29 must run the complete available `tests/**` regression on the current source, classify:

- PASS — assertion truly demonstrated
- FAIL — executable implementation mismatch/regression
- TODO/BLOCKED — owning implementation/environment prerequisite unavailable

Testing may fix only Testing-owned harness/test defects. Product/subsystem failures must remain visible for handoff.


## Phase 29 current regression refresh

The full available suite was rerun after the phase-28 handoff snapshot.

Final current result:

```text
314 tests
98 pass
24 fail
192 todo/blocked
```

Testing fixed two harness issues only: Storefront route tests no longer require live DynamoDB, and malformed-JWT verification now injects a test JWT secret. These fixes removed eight false/environment failures without changing production behavior or expected contracts.

The remaining 24 failures are current project gaps: 12 Backend/API/Worker tests, 9 Frontend/static-export tests, and 3 Dev Mode/Integration tests. See `reports/phase-29-full-regression.md` and `reports/phase-29-full-regression.log`.

Auth validation and public Storefront route surfaces now pass in the current regression, superseding the historical phase-03/04 route-absence observations. Their full FRs remain blocked because required persistence/E2E layers are still outstanding.
Auth validation and public Storefront route surfaces now pass in the current regression, superseding the historical phase-03/04 route-absence observations. Their full FRs remain blocked because required persistence/E2E layers are still outstanding.

## Post-handoff Customer Payment read update

The previously recorded API/Integration gap for Customer-visible Payment rejection reason is resolved. The canonical read path is `GET /api/v1/me/orders/:orderId/payment -> PaymentDTO`; it is ownership-scoped, requires no Organization membership, returns exact `rejectReason`, and fails closed across Customers.

Current focused evidence includes Backend-local Payment tests, root contract/security coverage, Frontend payment-service/view tests, and the updated payment-rejection E2E scenario. Notification remains an asynchronous alert and is not used as the authoritative Payment status/rejection-reason source.