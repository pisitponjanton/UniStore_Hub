# Runtime Phase 2 — Supported-Node Stress Regression

Snapshot: 2026-09-30
Owner: Testing Agent (`tests/**`)

## Runtime used

All qualification in this phase was executed with the supported runtime explicitly placed first on PATH:

```text
/Users/mba135816/.nvm/versions/node/v24.20.0/bin
Node v24.20.0
```

This satisfies the declared `tests/package.json` engine contract `Node >=22`.

## Frontend cross-system evidence

```text
npm run test:frontend
33 tests
33 pass
0 fail
0 todo
```

This includes:

- Frontend interaction evidence: 23/23 PASS
- Static export evidence: 10/10 PASS
- real Vitest execution
- real isolated Next.js static production build

No Frontend source or dependency change was required.

## Authoritative top-level regression stress

The complete Testing suite was executed three consecutive times with Node v24.20.0.

### Run 1

```text
324 tests
302 pass
0 fail
22 todo
0 cancelled
0 skipped
duration_ms 32441.103875
exit 0
```

### Run 2

```text
324 tests
302 pass
0 fail
22 todo
0 cancelled
0 skipped
duration_ms 30480.921792
exit 0
```

### Run 3

```text
324 tests
302 pass
0 fail
22 todo
0 cancelled
0 skipped
duration_ms 29901.079166
exit 0
```

Across all three runs there was no:

```text
ERR_REQUIRE_ESM
ENOENT
module-resolution failure
```

## Remaining TODO meaning

The 22 TODOs are environment/live-qualification gates rather than regression failures. Current blockers still include canonical port `4000` being occupied by a non-UniStore service and unavailable live AWS Learner Lab tooling/credentials where required.

Current smoke text no longer treats the resolved Backend LocalStack S3 checksum incompatibility as an active defect.

## Phase outcome

Supported-runtime qualification is deterministic on Node v24.20.0:

```text
3 / 3 complete top-level runs PASS
0 regression failures
```

The earlier `ERR_REQUIRE_ESM` result is attributable to executing the Testing workspace under unsupported Node v20.13.0, not to the current supported-runtime Frontend harness.
