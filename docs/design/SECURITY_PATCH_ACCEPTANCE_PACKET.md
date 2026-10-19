# UniStore Hub — Security Patch Acceptance Packet

Prepared: 2026-10-19 · Workspace: `UniStore_Hub` · Active BDXA Phase 15 — Fix Review Findings.

**Decision needed: independent security code-owner review of the local `braces@3.0.3` mitigation. No waiver, production approval, or BDXA phase completion has yet been granted.**

## Scope and risk context

The original F-SEC-01 production dependencies were updated to `next@16.4.2` and transitive `source-map-js@1.2.2`. The production dependency graph currently has **zero npm audit findings**.

F-SEC-02 was partially resolved with `vitest@5.0.5` and aligned `eslint-config-next@16.4.2`. Full `npm audit` still reports **five High-affected packages**, all from one development-only `braces@3.0.3` advisory (`GHSA-vfj7-8cjw-p6xm`). The package is reached by `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. The real audited package has not received a verified official patched upstream version as checked on 2026-10-19.

A locally vendored MIT package provides recursion-depth guards in `lib/parse.js`, `compile.js`, `expand.js`, `stringify.js`, and `utils.js`. The archive keeps its original upstream version, so **the remaining npm audit warning is not suppressed**. Use the advisories, test evidence and audited patch—not merely the scanner count—to make an explicit security decision.

## Findings corrected during implementation review

- A differential comparison against the published upstream package found a `stringify({escapeInvalid:true})` compatibility defect. Fixed it and established **672/672 identical standard behavior comparisons**.
- Security Gate initially accepted an altered archive if its lockfile SRI was recomputed. Added a constant SHA-256 pin for the reviewed archive and a regression proving a modified archive + modified lockfile now blocks.
- The installed-code check now validates the **entire ten-file reviewed source set**, including `LICENSE`, package metadata and all source files, with per-file SHA-256; it rejects extra/missing/changed files, not just differences between two potentially modified local copies.
- The live audit gate invokes the installed `braces` security test before classifying known vulnerability findings. Unknown production/development advisories, new advisories on existing packages and changed transitive chains fail closed.

## Reproducible verification

Run from `frontend/`:

```sh
npm ci
npm run test:security:braces
npm run test:security:gate
npm run audit:review
npm audit --omit=dev
npm audit
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e:cross-role
```

`npm run audit:review` deliberately uses distinct exit states:
- `0`: both npm audits clean
- `2`: precisely the reviewed dev-only advisory remains, independent security decision required
- `1`: unknown vulnerability, failed audit, invalid integrity or unreviewed patch

The audit gate's actual result after remediation remains **exit 2**. Its targeted unit tests pass **9/9**, vendor integrity and recursion tests pass, and the established frontend engineering baseline was **360/360 unit, 30/30 static routes, 57/57 cross-browser scoped journeys and 7/7 high-risk intercepted E2E** in the latest completed suites. These numbers do not certify every UI role/action/state or server financial transaction.

Technical materials: `docs/design/BRACES_PATCH_TECHNICAL_REVIEW.md`, `docs/design/DEPENDENCY_SECURITY_REMEDIATION.md`, `docs/design/SECURITY_AUDIT_GATE_IMPLEMENTATION.md`, `frontend/vendor/README.md`, and `docs/design/FINAL_DIFF_REVIEW.md`.

## Review requirements and signoff

Before marking F-SEC-02 resolved, a designated Security/code owner must:
1. Compare all five patched library files to the upstream npm MIT source and assess recursion limits, branch coverage, normal glob compatibility, excessive expansion and residual CPU/memory exhaustion.
2. Confirm installed package identity, reviewed SHA-256, lockfile SRI and repeatable clean install.
3. Confirm development-only reachability and whether untrusted pattern input can reach ESLint/glob execution in CI or developer environments.
4. Choose **one explicit disposition**: (a) accept the local mitigation with a documented time-limited exception for the upstream version-based advisory, (b) require additional hardening before acceptance, or (c) replace the vendor copy with a verified official patched dependency once released.
5. Record the reviewer identity, review date, evidence, decision/rationale, constraints, exception expiry and follow-up owner. This file **does not contain a filled-in approval**.

**Current decision:** PENDING. No production deployment, commit, push or test-data mutation occurred. Keep Phase 15 in progress until an authorized decision and final re-review.


## This session’s final QA gates

- New regression: the gate previously returned status 2 for a replaced archive whose npm lockfile SRI was updated to match. The same regression now passes by requiring status 1 (blocked) for unreviewed archives.
- Reviewed archive and all 10 vendored files have fixed SHA-256 fingerprints in the verification scripts, not generated during installation.
- Security Gate tests: **9/9 PASS**; installed vendor guard verification **PASS**.
- Frontend Unit: **360/360 PASS**; TypeScript/ESLint **PASS**; static Build **30/30 PASS**; `npm ci --dry-run` **PASS**.
- Live gate: **MANUAL_SECURITY_REVIEW_REQUIRED (exit 2)**, exactly five High dev-only upstream advisory nodes. This is **not** a security approval, and no waiver has been granted.

## Additional runtime isolation evidence — 2026-10-19

Added `npm run test:security:runtime`, combining six fail-closed synthetic dependency/bundle tests and a scan of the current Next Static Export. In the verified export, **75 HTML/JS/CSS/MJS files** were inspected with no characteristic strings from the vendored development-time `braces` guard; all locked braces entries were development-only. The local recursion test also now exercises 512- and 4,000-level nested adversarial inputs below the upstream length cap, with controlled errors. This is bounded evidence, **not a complete supply-chain or production-exploitability certification**. Details: [RUNTIME_DEPENDENCY_ISOLATION.md](RUNTIME_DEPENDENCY_ISOLATION.md). The residual five High npm audit nodes remain visible and manual Security acceptance is still pending.


## Combinatorial expansion follow-up — 2026-10-19

A source-level review found that repeated **shallow** alternatives can produce exponentially many values even without deep AST recursion. A locally enforced maximum of **65,536 expanded values** now bounds explicit expansion counts (including numeric ranges when the caller requests `rangeLimit:false`). Ordinary behavior still matched upstream on **672/672** differential cases, and the repacked MIT source passed a fresh `npm ci`, security checks, Unit 360/360, TypeScript, ESLint and static Build 30/30. This is not a hard cap on total output bytes/CPU, not a confirmed official upstream fix, and not a waiver for the five remaining development-only High audit nodes. Full evidence: [BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md](BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md).


## Final expansion budget regression evidence — 2026-10-19

The local development-only braces mitigation now rejects excessive **shallow Cartesian expansions**, not just deep recursive parsing. A hard cap of 65,536 output values applies even when numeric rangeLimit is set to false; explicit range/flatten guards are regression-tested. The rebuilt original-version MIT package was installed with npm ci, SHA-512 lockfile/SHA-256 review pins aligned, and ordinary upstream compatibility checked 672/672. Final engineering verification: Unit 360/360, TypeScript, ESLint, Next Static Build 30/30, browser Chromium/Firefox/WebKit 57/57, and additional intercepted high-risk browser scenarios 7/7 all passed. Production npm audit 0; full npm audit still reports 5 High affected dev-only package nodes. This expansion count bound is not a total-memory or CPU guarantee, and independent Security signoff or a formal risk exception has NOT been granted. Full details: BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md.

## Live verification refresh — 2026-10-19 (Phase 15 continuation)

Read-only/current-toolchain recheck against the existing workspace checkout, without modifying application logic, dependencies, the vendored patch or any business records:

- `npm run test:security:braces`: PASS; installed file hashes and micromatch resolution matched the locally reviewed package, with nesting and expansion safety tests passing.
- `npm run test:security:gate`: 9/9 PASS.
- `npm run test:security:runtime`: 6/6 PASS and 75 emitted static assets scanned with no characteristic local guard strings.
- `npm run audit:review`: exit **2**, `MANUAL_SECURITY_REVIEW_REQUIRED`, precisely five High development-only nodes from the documented braces advisory; this is not audit clearance.
- `npm view braces version`: 3.0.3 from the configured npm registry at check time (not evidence that a future patched release cannot appear).
- `npx tsc --noEmit`: PASS; `npm run lint`: PASS.
- `npm test -- --reporter=dot`: **360/360 PASS**, 91 files.
- `npm run build`: PASS; Next.js 16.4.2 static generation **30/30**.
- `git diff --check`: PASS.
- Cross-browser E2E and high-risk intercepted browser tests were **not rerun in this verification refresh**. Their last documented results remain 57/57 and 7/7, respectively; these are historical, not fresh test claims.

**Disposition: Phase 15 remains in progress** because independent code-owner Security signoff or explicit documented risk acceptance is still pending. Do not mark `review_diff` passed, deploy, commit, push, or claim a clean full audit based on these passing engineering checks.

## Workspace-only owner risk acceptance — 2026-10-19

The user/project owner explicitly authorized continuation **inside the UniStore_Hub workspace only**. The precise scope, time-bounded conditions (review no later than 2026-11-18), residual braces advisory, locally reviewed patch evidence, and release/production exclusions are recorded in [WORKSPACE_SECURITY_EXCEPTION.md](WORKSPACE_SECURITY_EXCEPTION.md). This is **not an independent external Security/code-owner signoff** and does not change the fail-closed audit gate: full npm audit still reports five High development-only affected package nodes; live gate still returns exit 2. No Commit, Push, Deploy, cloud access, or external changes were authorized. Phase 15 may proceed as workspace-scoped mitigation with accepted residual risk, followed by a separate Final Diff Review.
