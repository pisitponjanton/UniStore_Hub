# UniStore Hub — Non-waiving Dependency Security Gate

Date: 2026-10-19 · Active BDXA scope: Phase 15 — Fix Review Findings.

**Status: implemented and tested. Full dependency audit remains open, and this gate does not authorize risk acceptance, release, Commit, Push or Deploy.**

## Purpose

The frontend currently uses a locally mitigated MIT copy of upstream `braces@3.0.3` as a development-only package because the original upstream `GHSA-vfj7-8cjw-p6xm` has no verified official patched release. The local patch has reproducible archive and source-integrity checks and normal-input compatibility comparisons, but npm still marks its original version vulnerable. This file **must not be treated as a signed vendor patch or a security waiver**.

The audit guard is implemented in `frontend/scripts/security/audit-review.cjs`; synthetic fail-closed regression tests are in `frontend/scripts/security/audit-review.test.cjs`.

## How to run

```sh
cd frontend
npm ci
npm run test:security:braces
npm run test:security:gate
npm run audit:review
```

`npm run audit:review` invokes **both real npm audits** and records a machine-readable evidence file at the Git-ignored `frontend/quality-audit/.evidence/security-upgrade/audit-review-gate.json`.

| Exit | Meaning | Approval implication |
| --- | --- | --- |
| **0** | Both runtime and full npm audits are clean, archive matches lockfile | Audit checks are clear, but no automatic Production approval |
| **2** | Runtime audit clean; exactly the five documented development-only nodes and known `braces` advisory remain | **Manual Security Review required** — not a pass |
| **1** | New/unknown issues, changed advisory identity or dependency chain, npm audit failed, or vendor archive/lockfile invalid | **Blocked** — investigate before release |

The status comparison is deliberately exact. It checks the `braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next` advisory propagation; it also validates package identity, dependency classification as development-only, the local `file:vendor/braces-3.0.3.tgz` reference and SHA-512 lockfile integrity. An extra vulnerability on **an already-listed package** fails closed instead of being misclassified as the existing approved-to-review advisory.

The guard does not intercept business APIs, suppress `npm audit`, rewrite dependency versions or automatically accept the risk.

## Verification

- Audit review gate unit tests: **8/8 PASS**, including clean cases, known existing alert, new production issue, new development package, a different advisory on the same package, changed advisory chain/severity, invalid metadata, tampered lock/archive.
- Actual audit review: **exit 2 / MANUAL_SECURITY_REVIEW_REQUIRED**, not exit 0.
- Actual `npm audit --omit=dev`: **0 vulnerabilities**.
- Actual full `npm audit`: **5 High package nodes**, all originating from the documented braces advisory chain; no Critical/Moderate in the measured run.
- Existing dedicated `test:security:braces` checks the installed MIT-patched package against tracked source and verifies depth-exhaustion guards.
- Source: `frontend/vendor/README.md`, `docs/design/BRACES_PATCH_TECHNICAL_REVIEW.md`, and `docs/design/DEPENDENCY_SECURITY_REMEDIATION.md`.

This is an additional **technical evidence gate**. It does not demonstrate that all denial-of-service possibilities were eliminated, nor does it substitute for an independent patch review, real Production penetration testing or explicit risk signoff.

## Unresolved decision

**F-SEC-01:** Production dependency vulnerability finding remediated, runtime audit clean.

**F-SEC-02:** A locally tested mitigation exists, but the upstream `braces@3.0.3` remains flagged. The security code owner must assess the patch and decide whether the version-based residual warning is acceptable or should block release. Until that decision is made, **Phase 15 and Final Review must remain open**, even though the browser, unit, lint, type and build checks passed in prior scoped runs.

No Commit, Push, Deploy or production data changes were performed.


## Reviewed-package identity hardening — 2026-10-19

A new regression initially demonstrated that the prior audit gate could classify a vendor archive as the known acceptable-for-review advisory even after the archive had been modified and the lockfile SHA-512 had been recomputed to match. The gate now pins the **SHA-256 of the exact reviewed archive** in `frontend/scripts/security/audit-review.cjs`, rejects all other archives irrespective of lockfile contents, and executes the installed-code security verifier before processing live npm advisories.

The installed-code verifier separately pins per-file SHA-256 for **all ten reviewed upstream/vendor files** (source, license, README and package metadata); it rejects additions, removals, vendor changes and differences from installed package contents. These review pins **must not be regenerated automatically by installs or build scripts**; changing the patch requires a new source review and deliberate re-pinning.

Security Gate regression tests now pass **9/9**, including a modified archive and matching forged lockfile scenario. The live Security Gate still deliberately returns **exit 2 — MANUAL_SECURITY_REVIEW_REQUIRED**, not a signoff. Acceptance criteria and accountable review fields are in [SECURITY_PATCH_ACCEPTANCE_PACKET.md](SECURITY_PATCH_ACCEPTANCE_PACKET.md).

## Additional runtime isolation evidence — 2026-10-19

Added `npm run test:security:runtime`, combining six fail-closed synthetic dependency/bundle tests and a scan of the current Next Static Export. In the verified export, **75 HTML/JS/CSS/MJS files** were inspected with no characteristic strings from the vendored development-time `braces` guard; all locked braces entries were development-only. The local recursion test also now exercises 512- and 4,000-level nested adversarial inputs below the upstream length cap, with controlled errors. This is bounded evidence, **not a complete supply-chain or production-exploitability certification**. Details: [RUNTIME_DEPENDENCY_ISOLATION.md](RUNTIME_DEPENDENCY_ISOLATION.md). The residual five High npm audit nodes remain visible and manual Security acceptance is still pending.


## Combinatorial expansion follow-up — 2026-10-19

A source-level review found that repeated **shallow** alternatives can produce exponentially many values even without deep AST recursion. A locally enforced maximum of **65,536 expanded values** now bounds explicit expansion counts (including numeric ranges when the caller requests `rangeLimit:false`). Ordinary behavior still matched upstream on **672/672** differential cases, and the repacked MIT source passed a fresh `npm ci`, security checks, Unit 360/360, TypeScript, ESLint and static Build 30/30. This is not a hard cap on total output bytes/CPU, not a confirmed official upstream fix, and not a waiver for the five remaining development-only High audit nodes. Full evidence: [BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md](BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md).
