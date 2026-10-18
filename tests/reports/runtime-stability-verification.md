# Runtime Stability Verification

Consolidated reference for feature-focused QA. Records are retained as separate dated observations; earlier metrics may be superseded by later results. Refer to `../../frontend/quality-audit/frontend-qa-signoff.md` for final scoped QA scope, and the root `../../WEB_QUALITY_AUDIT.md` for remaining gaps.

## Contents

- [Runtime Reproduction](#record-01-runtime-reproduction)
- [Runtime Stress Regression](#record-02-runtime-stress-regression)
- [Runtime Review](#record-03-runtime-review)


---

<a id="record-01-runtime-reproduction"></a>

## Runtime Reproduction

### Runtime Phase 1 — Full-Suite Failure Reproduction

Snapshot: 2026-09-30
Owner: Testing Agent (`tests/**`)

#### Goal

Reproduce the reported 23 `ERR_REQUIRE_ESM` Frontend-evidence failures and determine whether they are a Testing harness race on the supported Node runtime or an execution-runtime mismatch.

#### Findings

The `tests` workspace default shell currently resolves:

```text
node -v
v20.13.0

which node
/usr/local/bin/node
```

This does not satisfy `tests/package.json`:

```json
"engines": {
  "node": ">=22"
}
```

Under this unsupported Node 20.13.0 runtime, Testing-owned Frontend evidence that launches Vitest reproduces the observed startup error:

```text
Error [ERR_REQUIRE_ESM]:
require() of ES Module .../frontend/node_modules/vite/dist/node/index.js
from .../frontend/node_modules/vitest/dist/config.cjs not supported
```

The failure is reproducible even with a single Testing Frontend file, so it is not evidence of a cross-file/full-suite concurrency race:

```text
node --test frontend/frontend-interaction.test.mjs
23 total / 2 pass / 21 fail

node --test frontend/static-export.test.mjs
10 total / 8 pass / 2 fail
```

#### Supported-runtime control

The same current repository was then executed explicitly with:

```text
/Users/mba135816/.nvm/versions/node/v24.20.0/bin/node
```

which satisfies the declared Node >=22 contract.

Results:

```text
frontend/frontend-interaction.test.mjs
23 / 23 pass

frontend/static-export.test.mjs
10 / 10 pass
```

The authoritative complete Testing regression was also run on Node v24.20.0 and completed successfully:

```text
324 tests
302 pass
0 fail
22 todo
0 cancelled
0 skipped
exit code 0
duration ~51.5s
```

No `ERR_REQUIRE_ESM`, `ENOENT`, or Frontend module-resolution failure occurred on the supported runtime.

#### Conclusion

The current 23-failure reproduction is an **unsupported Testing-agent runtime issue**, not a demonstrated Frontend application defect and not a demonstrated full-suite isolation defect on Node >=22.

Therefore:

- do not modify `frontend/**`;
- do not weaken or skip Frontend evidence;
- supported-runtime qualification must use Node >=22 explicitly;
- the Testing plan premise that a supported-runtime harness race still exists is disproven by current evidence.

A separate current-state cleanup remains: several Dev smoke TODO messages still describe the already-fixed LocalStack S3 checksum defect and should be refreshed without rewriting historical reports.

---

<a id="record-02-runtime-stress-regression"></a>

## Runtime Stress Regression

### Runtime Phase 2 — Supported-Node Stress Regression

Snapshot: 2026-09-30
Owner: Testing Agent (`tests/**`)

#### Runtime used

All qualification in this phase was executed with the supported runtime explicitly placed first on PATH:

```text
/Users/mba135816/.nvm/versions/node/v24.20.0/bin
Node v24.20.0
```

This satisfies the declared `tests/package.json` engine contract `Node >=22`.

#### Frontend cross-system evidence

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

#### Authoritative top-level regression stress

The complete Testing suite was executed three consecutive times with Node v24.20.0.

##### Run 1

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

##### Run 2

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

##### Run 3

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

#### Remaining TODO meaning

The 22 TODOs are environment/live-qualification gates rather than regression failures. Current blockers still include canonical port `4000` being occupied by a non-UniStore service and unavailable live AWS Learner Lab tooling/credentials where required.

Current smoke text no longer treats the resolved Backend LocalStack S3 checksum incompatibility as an active defect.

#### Phase outcome

Supported-runtime qualification is deterministic on Node v24.20.0:

```text
3 / 3 complete top-level runs PASS
0 regression failures
```

The earlier `ERR_REQUIRE_ESM` result is attributable to executing the Testing workspace under unsupported Node v20.13.0, not to the current supported-runtime Frontend harness.

---

<a id="record-03-runtime-review"></a>

## Runtime Review

### Runtime Phase 4 — Review Diff

Snapshot: 2026-09-30
Owner: Testing Agent (`tests/**`)

#### Review scope

Reviewed only the current supported-runtime cleanup task changes under `tests/**`:

- `smoke/dev-mode-b.test.mjs`
- `reports/testing-handoff.md`
- `reports/runtime-stability-verification.md#record-01-runtime-reproduction`
- `reports/runtime-stability-verification.md#record-02-runtime-stress-regression`

The unrelated generated working-tree change `frontend/next-env.d.ts` is outside Testing ownership and is not part of this task.

#### Findings

No blocking finding was found.

The smoke changes update only stale TODO/blocker descriptions. They do not remove, skip, weaken, or change executable assertions.

The current Testing handoff now distinguishes:

- supported qualification runtime: Node v24.20.0, satisfying Node >=22;
- unsupported workspace-default runtime: Node v20.13.0;
- resolved LocalStack S3 checksum incompatibility;
- remaining canonical port 4000 collision;
- remaining live AWS Learner Lab prerequisite blocker.

FR traceability remains:

```text
PASS    14
BLOCKED  1
FR-15   BLOCKED
```

#### Verification reviewed

Supported-runtime evidence already completed in this task:

```text
Frontend cross-system: 33 / 33 pass

Top-level run 1:
324 total / 302 pass / 0 fail / 22 todo

Top-level run 2:
324 total / 302 pass / 0 fail / 22 todo

Top-level run 3:
324 total / 302 pass / 0 fail / 22 todo
```

All three top-level runs exited 0 with no `ERR_REQUIRE_ESM`, `ENOENT`, or module-resolution failure.

Additional review checks:

```text
git diff --check                         PASS
node --check smoke/dev-mode-b.test.mjs PASS
stale checksum blocker grep             CLEAN
FR traceability status parse            PASS
```

#### Constraint review

- No `frontend/**` source/config change was made by Testing.
- No Frontend evidence was downgraded to source-only checks.
- No executable test was skipped or removed.
- Historical reports were not rewritten; new current-runtime reports were added.
- Genuine port-4000 and AWS live blockers remain visible.
- No false full-project PASS is claimed.

#### Review outcome

```text
PASS
blocking findings: 0
```
