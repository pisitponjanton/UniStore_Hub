# Phase 26 — Payment Rejection End-to-End

## Canonical source-backed flow

`E2E-PAYMENT-REJECT-001` covers:

```text
Order
→ upload slip
→ Payment PENDING_REVIEW
→ Staff rejects with required reason
→ Payment REJECTED
→ Order PAYMENT_REJECTED
→ PAYMENT_REJECTED notification
→ Customer uploads replacement slip
→ same paymentId reused
→ reject/reviewer fields cleared
→ Payment PENDING_REVIEW
→ Staff approves
→ Order PAID
→ PAYMENT_REJECTED Audit exists
→ PAYMENT_APPROVED Audit exists
```

The executable scenario also verifies that replacement submission changes `slipKey` while retaining the logical `paymentId`.

## Customer-visible rejection reason contract gap

The Testing spec explicitly requires:

```text
Customer sees rejection reason
```

The Frontend spec likewise says Customer can view payment state/rejection reason.

However, the current API contract does not define a Customer-readable Payment detail endpoint, and `OrderDTO` does not include Payment or `rejectReason`. The documented tenant Payment detail endpoint is Staff / Organization Admin only.

Testing therefore does **not** invent a route, extend OrderDTO, or assume the notification message contains the rejection reason. The exact Customer-visible rejection-reason read path is kept as an explicit TODO/BLOCKED contract-integration finding.

## Readiness gate

Before creating disposable E2E data, the executable flow requires:

- Orders route
- Payments route
- Notifications route
- Audit route
- Notification Worker

Live execution additionally requires `E2E_API_BASE_URL` and deterministic `E2E_RUN_ID`; a Platform Admin token is required if a newly created Organization remains `PENDING`.

## Latest execution

Command:

```bash
node --test e2e/payment-rejection-flow.test.mjs
```

Result:

- E2E-PAYMENT-REJECT-001 core reject/resubmit/approve/Audit/notification flow — TODO/BLOCKED because the owning Backend implementations are still incomplete:
  - `backend/src/modules/orders/order.routes.js`
  - `backend/src/modules/payments/payment.routes.js`
  - `backend/src/modules/notifications/notification.routes.js`
  - `backend/src/modules/audit/audit.routes.js`
  - `backend/src/worker.js`
- E2E-PAYMENT-REJECT-001 Customer-visible exact rejection reason — TODO/BLOCKED because the current source contracts require the UX behavior but do not define a Customer-readable Payment detail endpoint or an OrderDTO field carrying `rejectReason`.

Focused summary: 2 tests total — 0 pass, 0 fail, 2 todo.

No blocked check is counted as passing, and Testing did not invent an API route/response shape to close the source-contract gap.
