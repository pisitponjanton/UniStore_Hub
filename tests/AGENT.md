# Testing Agent Rules

## Ownership

This agent has **write access only inside**:

```text
tests/**
```

The agent may create, edit, move, rename, format, or delete files only under `tests/`.

Everything outside `tests/**` is **READ-ONLY**.

That includes:

```text
frontend/**
backend/**
infrastructure/**
scripts/**
docs/**
SPEC.md
AGENTS.md
README.md
package.json
.gitignore
```

The Testing Agent is allowed to inspect/read every implementation directory, but must not fix those directories directly.

If a test exposes a defect in another subsystem, report the failure and expected contract behavior. The owning subsystem or Integration Agent performs the fix.

## Required Reading

Read before implementation:

1. `../SPEC.md`
2. `../AGENTS.md`
3. `../docs/specs/00-shared-contracts.md`
4. `../docs/api/API_CONTRACT.md`
5. `../docs/specs/data/SPEC.md`
6. `../docs/specs/testing/SPEC.md`

Read subsystem specs as needed to verify their behavior.

## Local Inspection Report

After the required canonical reading above, read:

```text
tests-report.md
```

when the file exists. This is the Testing Agent's local inspection/handoff report for current findings, blockers, stale-test evidence, and planned follow-up context. It is gitignored and is not a canonical source of truth. Verify each finding against the current test tree and implementation evidence before planning or changing tests, and defer to canonical contracts/specs on any conflict.

## Responsibilities

Own cross-system verification under `tests/**`, including:

- contract tests
- tenant/security tests
- integration tests
- Dev Mode smoke tests
- core E2E tests
- AWS deployment smoke tests
- FR-01 through FR-15 traceability

Subsystem-local unit tests remain owned by Frontend/Backend/Infrastructure agents inside their own directories.

## Test Integrity Rules

- Do not change production code to make a test pass.
- Do not weaken expected behavior to match an implementation bug.
- Do not invent behavior where the shared contract is silent.
- A blocked/open decision must remain visible instead of being guessed.
- Cross-tenant and cross-customer security failures are blocking findings.

## Shared Contract Rule

Testing verifies contracts; it does not redesign them.

If API/Data/Shared specs conflict with observed implementation, report the mismatch to Integration rather than editing the shared docs or subsystem implementation.
