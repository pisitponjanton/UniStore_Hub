# Phase 27 — Tenant and Notification End-to-End

## E2E-TENANT-001

The tenant scenario creates two Organizations with distinct Admin/Staff/Customer identities and prepares a real Order/Payment/Pickup resource in Organization B.

It then attempts these operations using Organization A identities:

- read Organization B Order by ID
- approve Organization B Payment
- request private Organization B Payment Slip URL
- update Organization B Product
- confirm Organization B Pickup
- access Customer B own Order through Customer A

Each cross-tenant/cross-customer attempt must fail with a protected error response and must not use resource ID alone as authorization.

## E2E-NOTIFY-001

The notification scenario covers all three canonical business event types:

```text
PAYMENT_APPROVED
PAYMENT_REJECTED
READY_FOR_PICKUP
```

For each business path it verifies:

```text
business action
→ SQS
→ Worker
→ Notification
→ GET /notifications
→ PATCH /notifications/:notificationId/read
```

A separate duplicate-delivery check publishes the exact same canonical SQS event twice and requires:

- `notificationId = eventId`
- `createdAt = occurredAt`
- exactly one Notification for that event

## Environment/readiness

The live scenarios are gated on their owning Backend routes and Worker so incomplete implementation cannot be reported as an E2E pass.

Live tenant/business-notification execution requires:

- `E2E_API_BASE_URL`
- deterministic `E2E_RUN_ID`
- `E2E_PLATFORM_ADMIN_TOKEN` when newly created Organizations are PENDING

The direct duplicate-event check additionally requires an authorized recipient identity plus the actual notification queue URL. It can use `E2E_AWS_ENDPOINT_URL` for LocalStack or normal AWS SDK credential resolution for AWS.

## Latest execution

Command:

```bash
node --test e2e/tenant-notification-flow.test.mjs
```

Result:

- E2E-TENANT-001 — TODO/BLOCKED because the owning Order/Payment/Pickup routes are not implemented yet.
- E2E-NOTIFY-001 business-event flow — TODO/BLOCKED because Order/Payment/Pickup/Notification routes and the Worker are incomplete.
- E2E-NOTIFY-001 duplicate-delivery idempotency — TODO/BLOCKED because Notification route/Worker are absent.

Focused summary: 3 tests total — 0 pass, 0 fail, 3 todo.

Readiness blockers currently detected:

- `backend/src/modules/orders/order.routes.js`
- `backend/src/modules/payments/payment.routes.js`
- `backend/src/modules/pickups/pickup.routes.js`
- `backend/src/modules/notifications/notification.routes.js`
- `backend/src/worker.js`

The executable tenant matrix and notification scenarios are now represented without counting blocked behavior as passed. Notification waits assert only the source-defined machine event type; they do not invent an undocumented resourceId mapping for READY_FOR_PICKUP.

The duplicate-delivery case uses a canonical version-1 event, publishes the same `eventId` twice, and requires exactly one Notification with `notificationId = eventId` and `createdAt = occurredAt` once the Worker path exists.
