# Phase 10 — Payment Review Flow Verification

## Contract basis

Payment review routes:

- `GET /api/v1/organizations/:organizationId/payments` — Staff / Organization Admin
- `GET /api/v1/organizations/:organizationId/payments/:paymentId` — Staff / Organization Admin
- `POST /api/v1/organizations/:organizationId/payments/:paymentId/approve`
- `POST /api/v1/organizations/:organizationId/payments/:paymentId/reject`

Customer access remains through their own Order payment flow and does not grant review permission.

Approval behavior:

- Campaign `OPEN` → Payment `APPROVED`, Order `PAID`
- Campaign `CLOSED` → Payment `APPROVED`, Order `CONFIRMED`
- Campaign `PRODUCING` or later → `PAYMENT_NOT_REVIEWABLE`, with no approval
- approval records `reviewedBy` and `reviewedAt`
- approval creates Audit
- approval updates the CampaignOrderLink projection
- `PAYMENT_APPROVED` is published after the core transaction

Reject behavior:

- reason is required and must be non-empty
- Payment → `REJECTED`
- Order → `PAYMENT_REJECTED`
- persist `rejectReason`, reviewer, and review timestamp
- create Audit
- publish `PAYMENT_REJECTED`

Authorization boundaries:

- reviewer must have active Staff/Admin membership in the same Organization
- Customer must not perform Payment review
- cross-tenant approve/reject must fail
- Staff must not access another tenant’s private Payment slip

## Test IDs

Executable auth/surface checks:

- CT-PAYMENT-REVIEW-001 through CT-PAYMENT-REVIEW-004

Business/state/security checks requiring authenticated disposable fixtures:

- CT-PAYMENT-REVIEW-005 through CT-PAYMENT-REVIEW-016

## Latest execution

Command:

```bash
node --test contract/payment-review.contract.test.mjs
```

Result:

- CT-PAYMENT-REVIEW-001..004 — FAIL: Payment list/detail/approve/reject routes returned generic `404 VALIDATION_ERROR` instead of protected-route behavior.
- CT-PAYMENT-REVIEW-005..016 — TODO/BLOCKED pending authenticated disposable Payment/Order/Campaign/Audit/Event/private-slip fixtures and implementation.

Observed implementation state: `backend/src/modules/payments/` and `backend/src/modules/orders/` remain empty. `backend/src/app.js` mounts Health/Auth/User only, so Payment review endpoints are not mounted yet. This is a Backend-owned implementation gap; Testing does not patch it.

Current focused result: 16 tests total — 0 pass, 4 fail, 12 todo.
