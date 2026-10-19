# UniStore Hub — Development Dependency / Static Export Isolation Check

Date: 2026-10-19 · BDXA Phase 15 — Fix Review Findings.

**Purpose:** provide repeatable evidence that the locally guarded `braces@3.0.3` dependency currently remains development-only and that its characteristic patch and advisory strings do not appear in the generated frontend static files. **This is not a Security risk waiver, penetration test, or full production release approval.**

## Implementation

`frontend/scripts/security/verify-runtime-isolation.cjs` verifies:

- The root package declares `braces` only as `devDependencies.braces = file:vendor/braces-3.0.3.tgz`, not under `dependencies` or `optionalDependencies`.
- Every locked `node_modules/braces` occurrence has `dev: true`; the root locked entry still refers to the reviewed local archive. Any newly nested/production-classified copy is rejected.
- An actual Static Export exists under `frontend/out/`. Its HTML, JS, MJS and CSS are scanned for characteristic vendor guards and the upstream Advisory ID. Empty/missing assets fail closed. The current run scanned **75 assets** and found no characteristic vendored patch code.

`frontend/scripts/security/verify-runtime-isolation.test.cjs` has **six passing synthetic tests**: clean lock/export, production or optional dependency promotion, nested/production-marked copies, injected vendor strings in emitted JS, missing or unreadable build output, and missing locked dependency. Command:

```sh
cd frontend
npm run build
npm run test:security:runtime
```

**Limitations:** The static scan looks for known patch/advisory strings, not a complete bundle provenance analysis. It does not prove all code is safe, that other deployment modes cannot import `braces`, or that local developer/CI processes cannot consume attacker-supplied glob patterns. In this repository, Next is currently built with `output: "export"`; this check must be repeated after every build/configuration/dependency update. Do not rely on it for a server-side Next deployment.

## Additional recursion stress

The existing `npm run test:security:braces` now checks both 512-level and 4,000-level nested braces and parentheses below the upstream maximum input length, confirming they throw controlled `RangeError` instead of exhausting the JavaScript call stack. The original 160-level nested text/AST/array tests and normal glob compatibility checks remain in place. This tests the published recursive-walker failure mode, **not** arbitrary combinatorial output growth, memory exhaustion, or all possible denial-of-service attacks.

## Current technical gates

| Gate | Observed result |
| --- | --- |
| Synthetic runtime isolation tests | 6/6 PASS |
| Static Export token scan | 75 files inspected, no characteristic vendor patch strings |
| Local vendor guard and large nesting stress | PASS |
| Audit review classifier unit tests | 9/9 PASS |
| Live `npm audit --omit=dev` | 0 findings |
| Live `npm audit` | 5 High affected development-only nodes from one upstream braces Advisory |
| Live `npm run audit:review` | Exit **2**, MANUAL_SECURITY_REVIEW_REQUIRED |
| Review/waiver | **PENDING / NOT GRANTED** |

The production and development audit distinction was also checked against the installed dependency tree: `npm explain braces` resolves exclusively through the root local devDependency and the ESLint plugin's `fast-glob → micromatch` chain. The output of `npm ls braces --omit=dev --all --json` does not list a production dependency (npm may exit nonzero when a specifically requested package is absent).

Upstream advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) still lists affected versions through 3.0.3 with no official patched version as checked on 2026-10-19.

**Next release condition:** retain code-owner assessment and a documented disposition of the upstream-version-based warning. These tests supplement, but do not replace, `docs/design/SECURITY_PATCH_ACCEPTANCE_PACKET.md`. No Commit, Push, Deploy or business-data changes.
