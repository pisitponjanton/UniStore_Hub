# Phase 22 — Dev Mode Smoke Set B

## Source-backed scope

This phase covers the remaining mandatory Dev Mode checks.

### DEV-005 Data parity

Dev Mode must preserve production semantics for:

- UUID v4 IDs
- ISO 8601 UTC timestamps
- integer satang
- role/status tokens
- `User.platformRole`
- Pickup token format
- file MIME/size rules
- PK/SK/GSI1 access patterns
- CampaignOrderLink
- OrderItem snapshots

Local development must use DynamoDB-compatible semantics rather than a simplified JSON/in-memory substitute for normal integration work.

### DEV-006 File parity

Canonical local flow:

```text
Browser
→ Local Backend authorization
→ LocalStack S3 Pre-signed URL
→ Browser ↔ LocalStack S3
```

Object-key, MIME, size, ownership, and HEAD-validation contracts remain the same as AWS.

### DEV-007 Notification parity

Canonical local flow:

```text
Business Service
→ LocalStack SQS
→ Local Worker
→ LocalStack DynamoDB Notification
```

Local Worker must reuse the same event validation, idempotency, recipient ownership, Notification shape, and failure semantics.

### DEV-008 Reset safety

`dev:reset` is destructive and must verify that `AWS_ENDPOINT_URL` points to localhost/LocalStack before deleting anything. A non-local endpoint must abort.

### DEV-009 No business bypass

Development mode must not:

- auto-approve Payments
- auto-confirm Pickups
- skip Payment rejection reason
- allow `OPEN → PRODUCING`
- bypass Organization status/membership
- make Payment Slip public
- write Notifications directly from Payment service without SQS

Tenant/RBAC/ownership/status rules remain authoritative in Dev Mode.

## Test mapping

- DEV-005 — shared Backend primitive/key parity plus blocked real LocalStack persistence round-trip
- DEV-006 — LocalStack AWS/S3 adapter endpoint capability plus blocked real Payment Slip flow
- DEV-007 — Worker entrypoint presence plus blocked real SQS→Worker→DynamoDB flow
- DEV-008 — root reset-command/safety-guard inspection plus blocked destructive refusal execution
- DEV-009 — executable development auth boundary plus blocked full tenant/RBAC/status parity scenario

## Current implementation observation

The current Backend already reuses shared UUID/time/key helpers and AWS SDK adapters that accept `AWS_ENDPOINT_URL`. S3 enables path-style addressing when a local endpoint is configured.

However:

- the root Dev Mode command interface is still absent
- `backend/src/worker.js` is absent
- Notification persistence/worker flow is absent
- Product/Payment/File/Pickup end-to-end local flows are incomplete
- a real LocalStack table/bucket/queue setup is not available

Testing therefore verifies only currently observable parity and leaves real local integration behavior blocked rather than treating adapter capability as end-to-end success.

## Latest execution

Command:

```bash
node --test smoke/dev-mode-b.test.mjs
```

Result:

- DEV-005 shared primitive/key parity — PASS: UUID v4, canonical UTC timestamp, and CampaignOrderLink key semantics reuse the production Backend helpers.
- DEV-005 real LocalStack persistence parity — TODO/BLOCKED pending DEV-001 table setup and implemented Order/Payment/Pickup persistence.
- DEV-006 LocalStack adapter capability — PASS: AWS client configuration accepts `http://localhost:4566`; S3 enables path-style addressing for the local endpoint.
- DEV-006 real Payment Slip flow — TODO/BLOCKED pending Payment/File services plus local Files bucket/CORS.
- DEV-007 Worker entrypoint — FAIL: `backend/src/worker.js` is absent.
- DEV-007 real SQS→Worker→DynamoDB Notification — TODO/BLOCKED.
- DEV-008 reset implementation/safety guard — FAIL: root `package.json` is absent, therefore no root `dev:reset` implementation exists to inspect.
- DEV-008 non-local reset refusal — TODO/BLOCKED until the reset command exists.
- DEV-009 protected-route auth in development — PASS: an unauthenticated Organization route returns `401 AUTH_REQUIRED`; there is no blanket development auth bypass on this observable boundary.
- DEV-009 full tenant/RBAC/status parity — TODO/BLOCKED pending disposable LocalStack data and currently missing business flows.

Focused summary: 10 tests total — 3 pass, 2 fail, 5 todo.

The two failures are genuine project-owned readiness gaps. The five TODO checks remain blocked and are not counted as passes.
