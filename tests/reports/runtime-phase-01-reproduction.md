# Runtime Phase 1 — Full-Suite Failure Reproduction

Snapshot: 2026-09-30
Owner: Testing Agent (`tests/**`)

## Goal

Reproduce the reported 23 `ERR_REQUIRE_ESM` Frontend-evidence failures and determine whether they are a Testing harness race on the supported Node runtime or an execution-runtime mismatch.

## Findings

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

## Supported-runtime control

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

## Conclusion

The current 23-failure reproduction is an **unsupported Testing-agent runtime issue**, not a demonstrated Frontend application defect and not a demonstrated full-suite isolation defect on Node >=22.

Therefore:

- do not modify `frontend/**`;
- do not weaken or skip Frontend evidence;
- supported-runtime qualification must use Node >=22 explicitly;
- the Testing plan premise that a supported-runtime harness race still exists is disproven by current evidence.

A separate current-state cleanup remains: several Dev smoke TODO messages still describe the already-fixed LocalStack S3 checksum defect and should be refreshed without rewriting historical reports.
