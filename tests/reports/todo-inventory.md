# TODO / BLOCKED Inventory Classification

Snapshot: 2026-09-30

This report classifies every active explicit `todo:` / `t.todo()` source marker in the cross-system Testing suites before any bulk assertion conversion.

Classification is about **what should happen next**, not test success. Category A is not PASS.

## Summary

| Category | Meaning | Markers |
|---|---|---:|
| A | Stale blocker or executable now with current implementation / deterministic Testing fixtures | 167 |
| B | Genuine environment blocker | 20 |
| C | Historical / duplicate readiness guard | 5 |
| **Total** |  | **192** |

The inventory count was obtained from the active `.mjs` suites under `contract/`, `integration/`, `security/`, `frontend/`, `smoke/`, `e2e/`, and `infrastructure/`.

## Category A — stale / executable now

These markers should be addressed in Phase 4 and Phase 5 by writing executable assertions against the current implementation. They must not simply be relabeled PASS.

| File | A markers |
|---|---:|
| `contract/campaign.contract.test.mjs` | 9 |
| `contract/file-security.contract.test.mjs` | 11 |
| `contract/health-auth.contract.test.mjs` | 3 |
| `contract/order.contract.test.mjs` | 16 |
| `contract/organization-members.contract.test.mjs` | 6 |
| `contract/payment-review.contract.test.mjs` | 12 |
| `contract/payment-submission.contract.test.mjs` | 12 |
| `contract/pickup.contract.test.mjs` | 12 |
| `contract/production.contract.test.mjs` | 12 |
| `contract/report-audit-platform.contract.test.mjs` | 17 |
| `contract/store-product.contract.test.mjs` | 6 |
| `frontend/frontend-interaction.test.mjs` | 21 |
| `frontend/static-export.test.mjs` | 4 |
| `integration/data-contract.test.mjs` | 5 |
| `integration/notification-resilience.test.mjs` | 12 |
| `security/tenant-isolation-a.test.mjs` | 4 |
| `security/tenant-isolation-b.test.mjs` | 5 |
| **Total A** | **167** |

Why these are A now:

- Backend currently contains Order, Payment, Production, Pickup, Notification, Audit, Platform Admin, Reports, file services and `backend/src/worker.js`.
- Organization routes mount the current business routers.
- Backend subsystem evidence is 261/261 passing on supported Node 24.
- Frontend exists, has real routes/components/services/tests, and subsystem evidence is 190/190 passing.
- Frontend static export currently builds successfully.

Many A markers still need carefully constructed authenticated/tenant/domain fixtures. That work belongs to Phase 4/5. The implementation evidence only removes the old "module does not exist" blocker; it does not prove the cross-system assertion by itself.

### File-security exceptions

`contract/file-security.contract.test.mjs` has 13 total TODO markers. Eleven are A because S3 adapters/metadata authorization can be exercised deterministically through current dependency injection or controlled fixtures.

Two remain B:

- line 173 — deployed/private Files bucket public-access-block evidence
- line 179 — actual integrated Browser ↔ S3 transfer-boundary observation

## Category B — genuine environment blockers

These must stay blocked until their actual prerequisites are available.

### Live E2E environment — 9 markers

`e2e/core-flow.test.mjs`:

- line 133 — requires `E2E_API_BASE_URL` + `E2E_RUN_ID`
- line 180 — requires `E2E_PLATFORM_ADMIN_TOKEN` when a new Organization is PENDING

`e2e/payment-rejection-flow.test.mjs`:

- line 35 — requires `E2E_API_BASE_URL` + `E2E_RUN_ID`
- line 77 — requires `E2E_PLATFORM_ADMIN_TOKEN` when a new Organization is PENDING

`e2e/tenant-notification-flow.test.mjs`:

- line 209 — tenant-denial E2E requires base URL + run ID
- line 260 — tenant-denial E2E requires Platform Admin token when needed
- line 382 — notification business-flow E2E requires base URL + run ID
- line 413 — notification business-flow E2E requires Platform Admin token when needed
- line 589 — duplicate delivery requires API URL, queue URL, run ID, recipient token and recipient user ID

These blockers must not be bypassed by mocking the live E2E path.

### Dev Mode / LocalStack — 8 markers

`smoke/dev-mode-a.test.mjs`: 3 markers.

They depend on canonical root Integration/Dev support such as:

```text
dev:setup
real LocalStack table/bucket/queue
real local auth persistence
canonical localhost services
```

`smoke/dev-mode-b.test.mjs`: 5 markers.

They depend on:

```text
real LocalStack data parity
Browser/Backend-authorized LocalStack file flow
LocalStack SQS -> Local Worker -> DynamoDB Notification
root dev:reset
non-local endpoint refusal
full production-parity business rules in Dev Mode
```

Some blocker text in these markers is stale — e.g. Worker/business modules now exist — but the **environment dependency remains genuine**. Phase 6 should update the reason text when the canonical root Dev environment exists; it should not turn these into mocked smoke tests.

### AWS deployment — 1 source marker

`smoke/aws-deployment.test.mjs` has one shared `t.todo()` deployment gate.

That source marker can produce multiple runtime AWS TODO tests. It remains B because live AWS qualification requires:

- AWS CLI
- active AWS Academy Learner Lab credentials
- region `us-east-1`
- deployed `unistore-hub-dev`
- CloudFormation outputs / live resources

### File deployment/integration — 2 markers

`contract/file-security.contract.test.mjs`:

- line 173 — deployed/private bucket public-read protection
- line 179 — integrated browser direct-transfer observation

## Category C — historical readiness guards

Five conditional E2E source guards still check whether implementation files exist and report the old "owning implementations are incomplete" blocker.

Current repository evidence shows the required implementations exist, so these guards are now historical. They should be removed or rewritten around actual runtime prerequisites; they must not be converted into unconditional PASS.

| File / line | Historical guard |
|---|---|
| `e2e/core-flow.test.mjs:122` | Core owning-implementation file-presence gate |
| `e2e/payment-rejection-flow.test.mjs:24` | Payment/Order/Notification/Audit/Worker presence gate |
| `e2e/tenant-notification-flow.test.mjs:199` | Tenant-flow Order/Payment/Pickup presence gate |
| `e2e/tenant-notification-flow.test.mjs:372` | Notification business-flow implementation presence gate |
| `e2e/tenant-notification-flow.test.mjs:576` | Duplicate-delivery Notification/Worker presence gate |

Category C exists because these checks are no longer the useful blocker. The useful blocker is the Category B disposable environment.

## Phase handoff

Phase 4 should consume Category A Backend/Data/Security markers first:

```text
contract/**
integration/data-contract
integration/notification-resilience
security/**
```

Phase 5 should consume Category A Frontend/static-export markers:

```text
frontend/frontend-interaction.test.mjs
frontend/static-export.test.mjs
```

Phase 6 should execute Category B Dev/E2E only after Root/Integration supplies the canonical disposable environment.

Phase 7 should execute the AWS Category B checks only with AWS CLI + active Learner Lab deployment.

Category C should be cleaned when the related E2E suites are touched, keeping the real environment gate intact.

## Integrity rule

This classification does **not** change any TODO into PASS.

For every Category A item the required sequence remains:

```text
stale TODO
→ executable assertion
→ run the assertion
→ PASS / FAIL according to evidence
```

For Category B:

```text
missing environment
→ remain TODO/BLOCKED
→ execute only when prerequisite exists
```

For Category C:

```text
historical readiness guard
→ remove/rewrite stale guard
→ retain the genuine runtime/E2E blocker
```

Machine-readable summary: `reports/todo-inventory.json`.
