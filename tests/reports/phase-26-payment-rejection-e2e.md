# Phase 26 — Payment Rejection End-to-End

## Canonical source-backed flow

`E2E-PAYMENT-REJECT-001` now covers:

```text
Order
→ upload slip
→ Payment PENDING_REVIEW
→ Staff rejects with required reason
→ Payment REJECTED
→ Order PAYMENT_REJECTED
→ Customer reads GET /me/orders/:orderId/payment
→ Customer sees exact PaymentDTO.rejectReason
→ PAYMENT_REJECTED notification is delivered independently
→ Customer uploads replacement slip
→ same paymentId reused
→ rejectReason/reviewedBy/reviewedAt cleared
→ Customer own-Payment read returns PENDING_REVIEW with cleared review fields
→ Staff approves
→ Order PAID
→ Customer own-Payment read returns APPROVED
→ PAYMENT_REJECTED Audit exists
→ PAYMENT_APPROVED Audit exists
```

The executable scenario also verifies that replacement submission changes `slipKey` while retaining the logical `paymentId`.

## Customer-visible rejection reason contract resolution

The previous contract gap is resolved by the canonical Customer endpoint:

```http
GET /api/v1/me/orders/:orderId/payment
```

Success returns the canonical `PaymentDTO`. The E2E flow now reads the rejected Payment through this Customer-owned endpoint before waiting for the notification, proving that the notification is not the authoritative source of `rejectReason`.

The corresponding contract/security coverage verifies:

- exact persisted `rejectReason` is returned to the owning Customer
- Customer access requires Order ownership, not Organization membership
- Customer A cannot read Customer B Payment
- an owned Order without a Payment returns `PAYMENT_NOT_FOUND`
- a mismatched Payment record fails closed
- Staff/Admin tenant Payment-review detail is not reused by the Customer route

## Readiness gate

Before creating disposable E2E data, the live flow requires:

- Orders route
- Payments route
- Notifications route
- Audit route
- Notification Worker

Live execution additionally requires `E2E_API_BASE_URL` and deterministic `E2E_RUN_ID`; a Platform Admin token is required if a newly created Organization remains `PENDING`.

## Current verification

Focused non-live verification now passes through Backend-local, contract, security, Frontend, and traceability tests.

The live E2E scenario remains environment-gated when `E2E_API_BASE_URL` / `E2E_RUN_ID` are not configured. This environment gate is distinct from the former API-contract gap: the Customer Payment read contract is now defined and asserted inside the live scenario.

No blocked environment check is counted as a functional pass.
