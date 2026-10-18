# Phase 13 — Data Contract Verification

## Contract basis

This phase verifies the locked DynamoDB/Data conventions:

- generated IDs are UUID v4
- timestamps are canonical ISO 8601 UTC strings
- money is integer satang
- primary storage uses `PK` + `SK`
- alternate lookup uses `GSI1PK` + `GSI1SK`
- Organization-owned application entities store explicit `organizationId`
- OrderItem snapshots keep `productName`, `variantName`, `unitPrice`, `quantity`, and `totalPrice`
- Campaign order listing uses `CampaignOrderLink` rather than full-table Scan
- Audit keys are `ORG#{organizationId} / AUDIT#{createdAt}#{auditId}`
- Notification keys are `USER#{userId} / NOTIFICATION#{createdAt}#{notificationId}`
- normal application request paths must not depend on DynamoDB Scan

## Executable checks

`integration/data-contract.test.mjs` directly exercises the current Backend ID/time/key helpers and statically checks `backend/src/**` for request-path Scan usage.

Executable IDs:

- DATA-001 — UUID v4 generation
- DATA-002 — canonical UTC timestamp format
- DATA-003 — organization membership role/status tokens
- DATA-004 — core PK/SK builders
- DATA-005 — GSI1 lookup builders
- DATA-006 — CampaignOrderLink key
- DATA-007 — tenant-qualified Order child partitions
- DATA-008 — tenant-qualified Pickup lookup
- DATA-009 — Audit/Notification key namespaces
- DATA-010 — no `ScanCommand` / `.scan()` dependency in `backend/src/**`

## Blocked persistence checks

The following remain TODO/BLOCKED rather than being inferred from key helpers:

- DATA-011 — integer-satang Order persistence and immutable OrderItem snapshots
- DATA-012 — explicit `organizationId` on every Organization-owned persisted entity
- DATA-013 — transactional CampaignOrderLink fields/status projection
- DATA-014 — Notification worker event-id idempotency
- DATA-015 — canonical Payment/Pickup persisted statuses

These require owning subsystem persistence implementations and disposable integration data.

## Latest execution

Command:

```bash
node --test integration/data-contract.test.mjs
```

Result:

- DATA-001..010 — PASS
- DATA-011..015 — TODO/BLOCKED

Focused summary: 15 tests total — 10 pass, 0 fail, 5 todo.

Verified against the current Backend:

- `createId()` produces UUID v4.
- `nowIsoUtc()` produces canonical ISO 8601 UTC timestamps.
- current key builders match the required PK/SK/GSI1 shapes for implemented access patterns.
- CampaignOrderLink, Order child, Pickup, Audit, and Notification key builders match the Data contract.
- no `ScanCommand` or `.scan()` dependency is present in current `backend/src/**` request-path source.

Persistence-level checks remain blocked where owning Order/Payment/Pickup/Audit/Notification implementations are not yet available; they are not counted as passing.
