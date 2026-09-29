# Phase 07 — Campaign Contract and Lifecycle Verification

## Contract basis

Campaign management routes are Organization Admin-only:

- `GET /api/v1/organizations/:organizationId/campaigns`
- `POST /api/v1/organizations/:organizationId/campaigns`
- `GET /api/v1/organizations/:organizationId/campaigns/:campaignId`
- `PATCH /api/v1/organizations/:organizationId/campaigns/:campaignId`
- lifecycle actions: `open`, `close`, `start-production`, `ready-for-pickup`, `complete`, `cancel`

Creation starts in `DRAFT`. Campaign timestamps are planning/display fields and do not auto-change lifecycle status.

Canonical lifecycle:

```text
DRAFT
→ OPEN
→ CLOSED
→ PRODUCING
→ READY_FOR_PICKUP
→ COMPLETED
```

`OPEN → PRODUCING` must fail with `INVALID_STATUS_TRANSITION`.

Payment-review boundary:

- `CLOSED` may finish existing Payment reviews/resubmissions.
- `start-production` returns `PAYMENT_NOT_REVIEWABLE` while any Order remains `PAYMENT_REVIEW`.
- payment approved while Campaign is `CLOSED` moves the Order directly to `CONFIRMED`.
- payment submission/resubmission/approval is not reviewable once Campaign is `PRODUCING` or later.

Cancellation rules from the Testing spec:

- DRAFT → CANCELLED works.
- OPEN/CLOSED → CANCELLED only when there is no Order in PAYMENT_REVIEW or a paid-or-later state.
- PRODUCING and later cannot cancel.
- successful cancellation changes PENDING_PAYMENT/PAYMENT_REJECTED Orders to CANCELLED.

## Test IDs

Executable auth/surface checks:

- CT-CAMPAIGN-001 through CT-CAMPAIGN-010

Lifecycle/business checks requiring authenticated disposable fixtures:

- CT-CAMPAIGN-011 through CT-CAMPAIGN-019

## Latest execution

Command:

```bash
node --test contract/campaign.contract.test.mjs
```

Result:

- CT-CAMPAIGN-001..010 — FAIL: Campaign management and lifecycle action routes returned generic `404 VALIDATION_ERROR` instead of protected-route behavior.
- CT-CAMPAIGN-011..019 — TODO/BLOCKED pending authenticated disposable Campaign/Order/Payment fixtures and implemented lifecycle logic.

Observed implementation state: `backend/src/modules/campaigns/` is currently empty and `backend/src/app.js` still mounts only `/health`. This is a Backend-owned implementation gap; Testing does not patch it.

Current focused result: 19 tests total — 0 pass, 10 fail, 9 todo.
