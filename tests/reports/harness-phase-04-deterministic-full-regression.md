# Harness Phase 4 — Deterministic Full Regression

## Goal

Verify that the Frontend harness isolation from Phase 2 and deterministic traceability discovery from Phase 3 remove Testing-owned top-level race failures while preserving genuine environment TODO/BLOCKED states.

## Runtime

Executed with:

```text
Node v24.2.0
```

which is inside the declared `Node >=22` Testing baseline.

## Public aliases

All public aliases completed successfully.

### Contract

```text
npm run test:contract

198 tests
196 pass
0 fail
2 todo
```

The two TODOs remain the intentional live/deployed file-boundary checks.

### Integration

```text
npm run test:integration

36 tests
36 pass
0 fail
0 todo
```

The count is 36 because Phase 3 added `TRACE-005`, which proves generated `tests/.tmp/**` content cannot satisfy traceability executable-ID discovery.

### Security

```text
npm run test:security

11 tests
11 pass
0 fail
0 todo
```

### Frontend cross-system

```text
npm run test:frontend

33 tests
33 pass
0 fail
0 todo
```

No `ERR_REQUIRE_ESM`, `ENOENT`, lock timeout, or module-resolution error was observed.

The owning Frontend subsystem evidence from Phase 2 remains:

```text
60 test files
190 tests
190 pass
```

### Smoke

```text
npm run test:smoke

24 tests
9 pass
0 fail
15 todo
```

The TODOs remain genuine environment/deployment blockers, including:

- canonical Backend port 4000 collision
- live LocalStack/business-flow prerequisites
- current Payment Slip direct-PUT incompatibility evidence
- AWS CLI/Learner Lab absence

### E2E — safe default

```text
npm run test:e2e

5 tests
0 pass
0 fail
5 todo
```

This is the intended result without live E2E runtime variables.

It does not supersede the earlier live qualification evidence.

### Infrastructure

```text
npm run test:infrastructure

12 tests
12 pass
0 fail
0 todo
```

Static Infrastructure remains separate from live AWS smoke.

## Repeated authoritative top-level regression

Executed the authoritative top-level suite three consecutive times:

```text
npm test
```

All three runs produced exactly the same result:

```text
Run 1
324 tests
302 pass
0 fail
22 todo
0 skipped

Run 2
324 tests
302 pass
0 fail
22 todo
0 skipped

Run 3
324 tests
302 pass
0 fail
22 todo
0 skipped
```

Automated log comparison confirmed:

```text
all_same = true
ERR_REQUIRE_ESM = none
ENOENT = none
Cannot find module = none
```

The full-suite test count increased from the previous 323 to 324 because `TRACE-005` is a new executable regression guard.

## Race result

The previously identified Testing-owned race surfaces are now closed:

1. Frontend Vitest evidence no longer relies on the shared Vite result cache and is cross-process serialized.
2. Static builds use unique Testing-owned temp directories instead of one globally removed path.
3. TRACE-001 no longer recurses into `tests/.tmp/**` or generated build output.
4. TRACE-005 verifies generated temp tests cannot enter the canonical executable-ID corpus.

Three consecutive top-level runs plus all public aliases completed without harness failure.

## Environment blockers preserved

The deterministic default regression remains green because unavailable live dependencies are represented as TODO/BLOCKED by contract.

That does **not** mean the current live integration findings have been resolved.

Current known live findings still include:

- Payment Slip direct pre-signed PUT incompatibility with LocalStack from the previous live E2E qualification
- canonical `localhost:4000` collision with a non-UniStore service
- AWS CLI / active Learner Lab deployment unavailable

No FAIL was converted into TODO merely to make this regression pass.

## Phase outcome

Phase 4 is complete.

Deterministic baseline:

```text
Node: v24.2.0

Top-level npm test, 3/3 identical:
324 total
302 pass
0 fail
22 todo
0 skipped

Aliases:
Contract       196 pass / 2 todo
Integration     36 pass
Security        11 pass
Frontend        33 pass
Smoke            9 pass / 15 todo
E2E              5 todo
Infrastructure  12 pass
```

Phase 5 can now rerun the live local E2E flow against the current Backend handoff and update live product evidence according to the observed result.
