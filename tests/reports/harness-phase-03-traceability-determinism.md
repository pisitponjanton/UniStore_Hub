# Harness Phase 3 — Deterministic Traceability Discovery

## Goal

Remove the TRACE-001 race where executable-ID discovery could recurse into generated `tests/.tmp/**` content while the Frontend static-build harness was deleting/replacing files.

## Implementation

Updated:

- `integration/traceability.test.mjs`

Executable-ID discovery no longer starts at the whole `testsRoot`.

It now scans only canonical Testing source roots:

```text
baseline.test.mjs
contract/**
integration/**
security/**
frontend/**
smoke/**
e2e/**
infrastructure/**
helpers/**
```

Within those roots, only files named:

```text
*.test.mjs
```

are treated as executable traceability sources.

Therefore these areas are no longer part of TRACE-001 discovery:

```text
tests/.tmp/**
reports/**
generated Next.js .next/**
generated static out/**
runtime logs/PID files
other non-test helper modules
```

This closes the previous TOCTOU condition where TRACE could `readdir()` a generated build directory while another test worker removed/rebuilt it.

## Regression guard

Added:

```text
TRACE-005 executable-ID discovery ignores generated tests/.tmp content
```

The test creates a real generated-looking decoy:

```text
tests/.tmp/traceability-decoy/generated.test.mjs
```

containing:

```text
TRACE-DECOY-999
```

and proves that canonical executable discovery does not see that ID.

The existing FR-08 coverage check remains `TRACE-004`; its historical test ID was preserved.

## Direct verification

Executed on Node `v24.2.0`:

```text
node --test integration/traceability.test.mjs

5 tests
5 pass
0 fail
0 todo
```

Verified checks:

- TRACE-001 FR mapping → executable canonical test IDs + artifacts
- TRACE-002 JSON/Markdown parity and exact FR order
- TRACE-003 handoff/report existence
- TRACE-004 FR-08 Customer own-Payment coverage
- TRACE-005 generated `.tmp` exclusion

## Race stress verification

While another thread repeatedly:

```text
creates generated JS files under tests/.tmp
deletes the directory
recreates the directory
```

the traceability test was executed 10 consecutive times.

Result:

```text
10 / 10 runs exit 0
ERR_REQUIRE_ESM: none
ENOENT: none
churn errors: none
```

This directly exercises the prior file-disappearance race shape without changing production or canonical test sources.

## Integration alias

Executed:

```text
npm run test:integration

36 tests
36 pass
0 fail
0 todo
```

The count increased from 35 to 36 because TRACE-005 is a new executable regression guard.

## Coverage integrity

No mapped FR test ID was removed.

The dynamic parameterized-test extraction used for CT-GOV-style definitions remains intact.

The scanner still covers all canonical test categories plus root baseline and Testing helper test files; it only removes ephemeral/generated/non-test paths from the evidence corpus.

## Phase outcome

Phase 3 is complete.

TRACE-001 no longer scans `tests/.tmp/**`, generated build output cannot satisfy a mapped executable ID, and the file-disappearance race has a dedicated regression check.

Phase 4 should now rerun every public alias plus repeated top-level `npm test` to confirm the combined Frontend-harness and traceability fixes are deterministic.
