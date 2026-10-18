# Phase 17 — Notification Resilience and Idempotency

## Contract basis

Notification API:

- `GET /api/v1/notifications` — Bearer JWT; current user only; optional `read` and `cursor`
- `PATCH /api/v1/notifications/:notificationId/read` — Bearer JWT + Notification ownership
- mark-read sets `readAt` to current canonical ISO UTC timestamp

Canonical notification event types:

- `PAYMENT_APPROVED`
- `PAYMENT_REJECTED`
- `READY_FOR_PICKUP`

Canonical SQS payload fields:

```text
version
eventId
type
occurredAt
organizationId
recipientUserId
resourceType
resourceId
data
```

The event must not contain password hashes, JWTs, AWS credentials, or Payment Slip binary data.

## Delivery and resilience invariants

```text
Business Lambda
→ successful core transaction
→ SQS publish
→ Worker Lambda
→ DynamoDB Notification
```

SQS publication occurs after the successful core business transaction. Notification enqueue or processing failure must not roll back committed Order/Payment state.

Mandatory failure cases:

- SQS publish failure after Payment approval
- Worker failure after message receipt

Both failures must remain observable; Worker must not report success when a required Notification write failed.

## Worker idempotency

Worker entry target is `backend/src/worker.js`.

For Worker-created Notifications:

```text
notificationId = eventId
createdAt = occurredAt
```

Notification persistence uses a conditional put. Re-delivery of the same event must resolve idempotently without creating a duplicate Notification.

## Test IDs

Immediately executable/current-source checks:

- CT-NOTIFY-001 — list auth boundary
- CT-NOTIFY-002 — mark-read auth boundary
- CT-NOTIFY-003 — SQS adapter serializes canonical event to configured queue
- CT-NOTIFY-004 — required Worker entrypoint exists

Implementation/fixture-dependent checks:

- CT-NOTIFY-005 through CT-NOTIFY-016

## Current implementation observation

At phase start:

- `backend/src/modules/notifications/` is empty.
- `backend/src/worker.js` is absent.
- `backend/src/aws/sqs.js` already provides JSON SQS publishing through `NOTIFICATION_QUEUE_URL`.
- `backend/src/app.js` does not mount Notification routes yet.

Missing Notification/Worker behavior remains Backend-owned; Testing records failures/blocked checks without modifying production.

## Latest execution

Command:

```bash
node --test integration/notification-resilience.test.mjs
```

Result:

- CT-NOTIFY-001 — FAIL: `GET /api/v1/notifications` returned generic `404 VALIDATION_ERROR` instead of the documented protected-route `401 AUTH_REQUIRED`.
- CT-NOTIFY-002 — FAIL: mark-read route returned generic `404 VALIDATION_ERROR` instead of `401 AUTH_REQUIRED`.
- CT-NOTIFY-003 — PASS: SQS adapter sends the canonical JSON event to the configured Queue URL.
- CT-NOTIFY-004 — FAIL: required Backend Worker entrypoint `backend/src/worker.js` is absent.
- CT-NOTIFY-005..016 — TODO/BLOCKED pending Notification routes/repository, Payment/Campaign publishers, Worker implementation, disposable user/tenant fixtures, and injectable failure paths.

Focused summary: 16 tests total — 1 pass, 3 fail, 12 todo.

The three failures are genuine Backend-owned implementation gaps and are intentionally preserved. The mandatory resilience cases (SQS publish failure after Payment approval and Worker failure after receipt) are not counted as passing until they exercise real committed core state and Worker retry behavior.
