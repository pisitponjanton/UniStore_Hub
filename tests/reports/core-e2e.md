# Phase 25 — Core End-to-End Scenario

## Canonical scenario

`E2E-CORE-001` follows the Testing/API contracts exactly:

```text
Register
→ Login
→ Create/Access Organization
→ Create Store
→ Create Product / Variant
→ Create Campaign
→ Open Campaign
→ Customer creates Order
→ Customer uploads Payment Slip through Pre-signed S3 PUT
→ Staff approves Payment
→ Production Summary includes paid Order
→ close Campaign → Order CONFIRMED
→ start production → Order IN_PRODUCTION
→ ready for pickup → Order READY_FOR_PICKUP
→ Customer receives READY_FOR_PICKUP notification
→ Customer obtains own Pickup
→ Staff confirms Pickup
→ Order RECEIVED
```

The test also verifies server-authoritative Order pricing/snapshots for the disposable line item and the documented Product/Variant quantity in Production Summary.

## Execution model

The test is deliberately environment-gated rather than replacing the E2E path with mocked repositories.

Required live-run inputs:

- `E2E_API_BASE_URL`
- deterministic disposable `E2E_RUN_ID`
- `E2E_PLATFORM_ADMIN_TOKEN` when a newly created Organization is `PENDING`

Optional:

- `E2E_TEST_PASSWORD`

The flow registers separate Organization Admin, Staff, and Customer users. Staff is then added through the documented member-by-email endpoint.

If the created Organization is `PENDING`, the test uses the documented Platform Admin approval endpoint before operational Store/Product/Campaign work.

## Source readiness gate

Before creating any disposable data, the scenario verifies that the owning Backend pieces exist for Campaign lifecycle, Orders, Payments, Production, Pickups, Notifications, and Worker processing. Missing owning implementations keep the entire scenario TODO/BLOCKED so a partial run cannot leave misleading half-created E2E state.

At phase start the Backend still lacks several of those required modules/routes and `backend/src/worker.js`.

## Latest execution

Command:

```bash
node --test e2e/core-flow.test.mjs
```

Result:

- E2E-CORE-001 — TODO/BLOCKED before creating disposable data.

Missing owning implementations detected by the readiness gate:

- `backend/src/modules/orders/order.routes.js`
- `backend/src/modules/payments/payment.routes.js`
- `backend/src/modules/production/production.routes.js`
- `backend/src/modules/pickups/pickup.routes.js`
- `backend/src/modules/notifications/notification.routes.js`
- `backend/src/worker.js`

Focused summary: 1 test total — 0 pass, 0 fail, 1 todo.

The full executable scenario is implemented and ready to run when the owning modules exist and a live E2E environment is supplied. The blocked result is intentionally not counted as passing.
