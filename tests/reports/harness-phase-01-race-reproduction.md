# Harness Phase 1 — Full-Suite Race Reproduction

## Goal

Reproduce the reported top-level `npm test` instability, compare it with the public category aliases, and identify Testing-owned shared-resource/concurrency hazards before changing the harness.

## Baseline

Repository HEAD during this phase:

```text
34d9979 chore: add root integration commands
ee5f85c test: modernize cross-system qualification suite
```

Testing working tree was clean before this phase.

Runtime:

```text
Node v24.2.0
```

This satisfies the declared `Node >=22` Testing baseline.

## Top-level regression reproduction

Executed three consecutive times:

```text
npm --prefix tests test
```

All three runs returned the same result:

```text
323 tests
301 pass
0 fail
22 todo
0 skipped
exit 0
```

No `ERR_REQUIRE_ESM`, `ENOENT`, or `Cannot find module` failure was reproduced in these three current runs.

Therefore the reported failure is intermittent rather than a deterministic current failure.

The default TODO count is now 22 rather than the previous 23 because the Integration-owned root command surface has since been committed and one prior Dev blocker now executes/passes.

## Public alias comparison

All public aliases completed independently under the same Node runtime.

```text
test:contract
198 tests
196 pass
0 fail
2 todo

test:integration
35 tests
35 pass
0 fail
0 todo

test:security
11 tests
11 pass
0 fail
0 todo

test:frontend
33 tests
33 pass
0 fail
0 todo

test:smoke
24 tests
9 pass
0 fail
15 todo

test:e2e
5 tests
0 pass
0 fail
5 todo

test:infrastructure
12 tests
12 pass
0 fail
0 todo
```

The independently executed aliases show no category-local deterministic failure.

## Race candidate 1 — TRACE-001 scans generated temporary build output

Current traceability discovery recursively walks the entire `testsRoot`.

It excludes only directory names:

```text
reports
node_modules
```

It does **not** exclude:

```text
.tmp
generated static build output
Next.js .next/output chunks
```

Current `tests/.tmp/frontend-static-build` contains:

```text
194 *.js / *.mjs files
```

including generated files under:

```text
.tmp/frontend-static-build/.next/**
.tmp/frontend-static-build/out/_next/**
```

At the same time, the Frontend static-build helper begins with:

```text
rm(tests/.tmp/frontend-static-build, recursive=true)
→ copy Frontend
→ build
```

In the top-level Node test runner, `frontend/static-export.test.mjs` and `integration/traceability.test.mjs` are separate test files and can execute in parallel.

That creates a direct TOCTOU race:

```text
TRACE readdir generated directory
→ Frontend build helper removes/replaces tempRoot
→ TRACE readFile/readdir on a now-disappeared path
→ possible ENOENT / file-disappearance failure
```

This is a concrete Testing-owned race even though it did not trigger in the three current full-suite runs.

Phase 3 should restrict traceability discovery to canonical Testing source directories/files and explicitly exclude `.tmp/**`.

## Race candidate 2 — Frontend evidence processes share Frontend runtime/cache state

`helpers/frontend-suite-evidence.mjs` launches a separate Vitest child for each requested Frontend suite:

```text
node <frontend>/node_modules/vitest/vitest.mjs run <suite> --reporter=verbose
```

For multi-suite evidence calls the helper uses:

```text
Promise.all(files.map(runFrontendSuite))
```

All children use the same:

```text
cwd = frontend/
frontend/node_modules
frontend/node_modules/.vite
vitest.config.ts
```

The Frontend installation currently has:

```text
frontend/node_modules/.vite
```

as shared cache state.

Additionally, `frontend/frontend-interaction.test.mjs` and `frontend/static-export.test.mjs` are separate Node test files, so independent helper module instances can spawn Frontend/Vitest work concurrently during the top-level suite.

This shared cache/runtime state is the strongest current candidate for the reported intermittent Frontend loader/`ERR_REQUIRE_ESM` pattern.

Phase 2 should isolate or serialize Frontend executable evidence so parallel top-level test discovery cannot make separate Vitest processes mutate/read the same transient Vite state concurrently.

## Race candidate 3 — static build temp path is globally fixed

The Frontend static build always uses:

```text
tests/.tmp/frontend-static-build
```

and unconditionally removes it before each build.

The `buildPromise` cache is process-local only. It does not protect:

- another Node test worker with its own helper module instance
- another concurrent `npm test` invocation
- TRACE-001 reading that tree

Therefore the temp build is not parallel-safe.

Phase 2 should use a unique Testing-owned build root per runner/process and clean only that owned root.

## Current conclusion

The previously reported race was **not reproduced as a failure** in three consecutive current top-level runs, but the current harness contains two concrete shared-state defects and one non-isolated temp-path defect that can explain intermittent behavior:

1. TRACE-001 recursively scans `.tmp/frontend-static-build` while that tree is deleted/rebuilt.
2. Multiple Frontend evidence children share the same Frontend/Vite cache/runtime state.
3. Static build output uses one global Testing temp path.

The category aliases passing independently is consistent with a concurrency/isolation issue rather than an individual contract/Frontend test defect.

## Phase handoff

Phase 2 should address Frontend harness isolation only.

Phase 3 should separately make traceability discovery deterministic and canonical-source-only.

No coverage should be removed, no executable Frontend check should be replaced by static-only assertions, and no genuine environment TODO/BLOCKED state should be promoted.
