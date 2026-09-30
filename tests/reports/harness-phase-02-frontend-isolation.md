# Harness Phase 2 — Frontend Harness Isolation

## Goal

Make Testing-owned Frontend executable evidence and static-build qualification safe under parallel top-level test discovery without reducing Frontend coverage or modifying `frontend/**`.

## Changes

Updated:

- `helpers/frontend-suite-evidence.mjs`

### Vitest evidence isolation

Frontend evidence now:

- batches newly requested Frontend suite files into one Vitest child instead of spawning one child per suite
- runs Vitest with `--no-cache` so Testing does not rely on or mutate the shared `frontend/node_modules/.vite` result cache
- serializes Testing-owned Vitest evidence processes across Node test workers with an atomic lock under `tests/.tmp/frontend-harness.lock`
- records the lock owner PID and automatically clears a stale lock when that recorded process no longer exists
- removes inherited `NODE_TEST_CONTEXT` from child processes as before

The lock is used only around Vitest evidence processes. It is not used around the isolated Next.js static build.

### Static-build isolation

The old global temp path:

```text
tests/.tmp/frontend-static-build
```

was replaced with a unique per-build directory created by `mkdtemp()` under:

```text
tests/.tmp/frontend-static-builds/<pid>-<unique>/
```

Each build:

- copies Frontend source into its own Testing-owned temp directory
- excludes Frontend `node_modules`, `.next`, `out`, and `.git`
- symlinks the installed Frontend dependency tree read-only for dependency resolution
- writes Next.js `.next` and `out` only inside the unique Testing-owned temp directory
- continues to use a real Next.js production `--webpack` static build

This removes the previous cross-process `rm(tests/.tmp/frontend-static-build)` collision.

## Concurrency verification

Two independent Node processes were started concurrently and both requested the same executable Frontend session evidence through the helper.

Result:

```text
process 1: exit 0 / evidence-ok
process 2: exit 0 / evidence-ok
```

No `ERR_REQUIRE_ESM`, `ENOENT`, lock timeout, or shared-cache failure occurred.

## Cross-system Frontend verification

After isolation changes:

```text
npm run test:frontend

33 tests
33 pass
0 fail
0 todo
```

The complete interaction/static-export suite remained executable.

The isolated static build completed successfully and canonical exported route checks continued to pass.

## Standalone Frontend verification

The owning Frontend subsystem suite was rerun on Node v24.2.0.

Result:

```text
60 test files passed
190 tests passed
```

Testing did not replace executable Frontend evidence with static source-only assertions.

## Scope integrity

Current repository status after this phase shows only:

```text
M  tests/helpers/frontend-suite-evidence.mjs
?? tests/reports/harness-phase-01-race-reproduction.md
?? tests/reports/harness-phase-02-frontend-isolation.md
```

inside Testing ownership.

The pre-existing generated change:

```text
M frontend/next-env.d.ts
```

remains outside Testing ownership and was not modified by this phase.

## Remaining work

Phase 2 intentionally does not change TRACE-001 source discovery.

The traceability scanner still recursively enters `tests/.tmp/**`, including generated static-build output. Phase 3 must restrict executable-ID discovery to canonical Testing source paths and exclude temp/generated trees.

## Phase outcome

Frontend harness isolation is complete:

- executable Frontend evidence remains real
- Testing Vitest cache mutation is disabled
- Testing Vitest processes are cross-worker serialized
- stale lock recovery is present
- static builds no longer share one removable temp root
- Frontend subsystem remains 190/190 passing
- cross-system Frontend remains 33/33 passing
