# Phase 8 — Current Traceability Refresh

## Goal

Refresh the canonical FR-01..FR-15 current-state traceability and Testing handoff from the latest executable evidence produced in Phases 4–7, while preserving historical phase reports unchanged.

## Canonical sources updated

- `reports/fr-traceability.json`
- `reports/fr-traceability.md`
- `reports/testing-handoff.md`

`fr-traceability.json` remains the canonical machine-readable source.

The Markdown matrix is refreshed from the same mapping and is protected by executable JSON/Markdown parity checks.

## Current FR readiness

Current status after applying the Testing-spec minimum-verification rules:

```text
PASS    12
FAIL     1
BLOCKED  2
TOTAL   15
```

### PASS

- FR-01 Authentication + JWT
- FR-02 Organization
- FR-03 Staff / Member
- FR-04 Store
- FR-05 Product / Variant
- FR-06 Pre-order Campaign
- FR-07 Order
- FR-09 Production Summary
- FR-10 Pickup QR / Token
- FR-11 Dashboard / Report
- FR-12 Audit Log
- FR-14 Platform Admin

These statuses are based on current executable contract/security/integration/Frontend evidence and, where the minimum verification requires an integration/E2E layer, the successful stages reached during Phase 6.

A later unrelated stage failing in a broad E2E scenario does not invalidate a requirement whose own minimum verification was already demonstrated.

### FAIL

`FR-08 Payment Slip / Verification`

Current deterministic Payment/File/ownership/rejection/resubmission and Frontend boundaries pass, but the required live direct-upload path was executed and failed:

```text
Backend-issued pre-signed Payment Slip PUT
→ LocalStack S3
→ HTTP 400 InvalidRequest
→ Value for x-amz-checksum-crc32 header is invalid
```

Because this path actually executed and showed a current incompatibility, FR-08 is recorded as FAIL rather than BLOCKED.

### BLOCKED

`FR-13 In-app Notification`

Current deterministic Notification/API/Worker/idempotency/mark-read evidence passes and the live duplicate-delivery path passes SQS → Local Worker → DynamoDB → Notification API.

The required live business-event path remains blocked transitively because PAYMENT_APPROVED/PAYMENT_REJECTED/READY_FOR_PICKUP cannot all be reached through the current Payment Slip upload failure.

`FR-15 Health Check`

- current health contract passes
- current Backend health passed on an isolated qualification port
- canonical `localhost:4000` was occupied by a non-UniStore service
- deployed AWS health cannot run because AWS CLI/Learner Lab credentials are unavailable

Therefore the Testing-spec `local + AWS smoke` minimum is not complete.

## Stale traceability removed

The refreshed artifacts no longer claim that the following implementations are absent:

- Frontend
- Order
- Payment
- Production
- Pickup
- Notification
- Worker
- Audit
- Platform Admin
- Report
- root Dev Mode command surface

Historical phase reports that originally recorded those conditions were not rewritten.

## Current evidence incorporated

### Phase 4

```text
Contract:    198 total / 196 pass / 0 fail / 2 live-file TODO
Integration:  35 total /  35 pass / 0 fail / 0 todo
Security:     11 total /  11 pass / 0 fail / 0 todo
```

### Phase 5

```text
Frontend cross-system: 33 / 33 pass
Frontend subsystem:   190 / 190 pass
Frontend static build: PASS
Backend subsystem:    261 / 261 pass
```

### Phase 6

```text
Local DEV checks, excluding AWS:
15 total / 9 pass / 0 fail / 6 blocked

Live E2E:
5 total / 1 pass / 4 fail / 0 todo
```

The one live E2E pass is duplicate Notification delivery/idempotency.

All four live failures share the Payment Slip LocalStack checksum incompatibility.

### Phase 7

```text
AWS live smoke:
9 total / 0 pass / 0 fail / 9 blocked

Static Infrastructure:
12 total / 12 pass / 0 fail / 0 todo
```

Static Infrastructure evidence is not treated as a replacement for live AWS smoke.

## Traceability guard verification

Executed under Node `v24.2.0`:

```text
node --test integration/traceability.test.mjs

4 tests
4 pass
0 fail
0 todo
```

Verified:

- FR-01..FR-15 exist exactly once
- IDs are ordered
- JSON and Markdown table are in parity
- mapped test IDs resolve to executable definitions
- referenced evidence artifacts exist
- FR-08 retains the resolved Customer own-Payment read/ownership mapping

Full Integration suite after the refresh:

```text
npm run test:integration

35 tests
35 pass
0 fail
0 todo
```

## Handoff refresh

`reports/testing-handoff.md` now reflects:

- Node 24 qualification instead of the historical Node 20 snapshot
- current Backend/Frontend implementation reality
- current LocalStack Dev Mode surface
- current deterministic security results
- current local E2E PASS/FAIL evidence
- the Payment Slip checksum failure
- canonical port 4000 collision
- AWS CLI/Learner Lab blocker
- current 12 PASS / 1 FAIL / 2 BLOCKED FR status

## Phase outcome

Phase 8 is complete.

Phase 9 must run the full supported-Node regression and may change current FR status only if that new executable evidence demonstrates a different current result.
