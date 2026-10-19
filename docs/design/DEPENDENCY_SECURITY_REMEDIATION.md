# UniStore Hub — Dependency Security Remediation

Date: 2026-10-18 · Workspace: `UniStore_Hub` · Original baseline `9007ec3` · Active BDXA fix-review findings F-SEC-01 / F-SEC-02.

**Status: Production audit cleared, Critical advisories cleared, development-only ESLint vulnerability family still OPEN. Do not consider full audit clean or Final Review approved.**

## Authorized scope and exact changes

The user authorized continued Phase 15 security remediation. Changes are limited to `frontend/package.json`, `frontend/package-lock.json` and explanatory design/test evidence. No Backend, API, database, tenant, payment, pickup, upload logic or production deployment changes.

| Dependency | Previous locked version | New locked version | Reason |
| --- | --- | --- | --- |
| `next` | 16.3.7 | **16.4.2** | Patched Next.js advisories, keep compatible 16.x static export |
| `eslint-config-next` | 16.3.7 | **16.4.2** | Align Next.js lint configuration, preserve rules |
| `vitest` | 3.2.7 | **5.0.5** | Patched Critical tinypool and Vitest mocker findings |
| Transitive `source-map-js` | 1.2.1 | **1.2.2** | Patched DoS issue; narrowly pinned through npm `overrides.source-map-js` |

Node.js on the development machine: **v24.20.0**, npm **11.19.0**; Next.js 16.4.2 requires Node >=20.9.0, Vitest 5.0.5 supports ^22.12.0, ^24.0.0, or >=26.0.0. Future developers using older Node versions must update Node before running Vitest 5. This change is a **toolchain compatibility requirement**.

The npm install emits warnings about packages with install scripts not included in the machine's `allowScripts` policy. These scripts were **not explicitly approved** or bypassed in this remediation. Unit, lint, TypeScript and production build nevertheless pass in the existing environment.

## Security audit before → after

| Severity | Before: production `--omit=dev` | After: production | Before: all dependencies | After: all dependencies |
| --- | ---: | ---: | ---: | ---: |
| Critical | 0 | **0** | 2 | **0** |
| High | 2 | **0** | 7 | **5** |
| Moderate | 0 | **0** | 1 | **0** |

After the upgrade: `npm audit --omit=dev --json` exits **0** with total vulnerabilities **0**. The full `npm audit --json` exits **1** with five High flagged package nodes: `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next`. **All five are the same transitive vulnerability chain**, not five separate vulnerabilities: `eslint-config-next@16.4.2 → @next/eslint-plugin-next@16.4.2 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`.

The `braces <=3.0.3` deep nested brace pattern stack-exhaustion DoS advisory is `GHSA-vfj7-8cjw-p6xm` (CVE-2026-93687). As checked on 2026-10-18, **3.0.3 is the latest published upstream release and no official patched version exists**. Evidence: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm and https://github.com/micromatch/braces/issues/84 . This makes an ordinary upstream semver upgrade unable to clear the remaining full-audit warning.

This affected chain belongs to the **development-time ESLint configuration**, not the production static frontend runtime; `npm audit --omit=dev` is clean. Its most relevant attack path is untrusted deeply nested glob patterns passed into the process running lint. The local lint job uses trusted repository inputs, but this is a constrained exposure assessment, **not formal risk acceptance or proof the library cannot be reached otherwise**.

**Do not silence `npm audit`, blindly downgrade `eslint-config-next` to Next 14, remove security lint rules or add a third-party `braces` fork merely to make the report green.** A fork or vendored defensive patch is a separate supply-chain decision requiring source/provenance review, explicit authorization, repeatable lockfile and full tests.

## Engineering and browser verification

- `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: **PASS**, updated lockfile resolves consistently.
- `npm ls --depth=0`: **PASS**, no incompatible direct dependency.
- `npm test -- --reporter=dot`: **360/360 PASS** in 91 test files using Vitest 5.0.5.
- `npx tsc --noEmit`: **PASS**.
- `npm run lint`: **PASS** under eslint-config-next 16.4.2.
- `npm run build`: **PASS**, Next.js 16.4.2 generated **30/30 static routes**.
- `git diff --check`: **PASS**.
- Chromium / Firefox / WebKit selected E2E rerun: **57/57 PASS** (19/19 Chromium, 19/19 Firefox, 19/19 WebKit); safe locally seeded GET / intercepted mutations.

Current audit JSON evidence (Git ignored) at `frontend/quality-audit/.evidence/security-upgrade/production-audit-after.json`, `full-audit-after.json`, and `audit-summary-after.json`, plus Browser log/status JSON.

- Additional Chromium high-risk intercepted payment-review, pickup confirmation, platform approval and product-image retry/isolation tests: **7/7 PASS**.
- Refreshed `npm audit --omit=dev`: **0 vulnerabilities**. Refreshed full `npm audit`: **5 High**, **0 Critical**, **0 Moderate** (one transitive ESLint-only braces chain).

## Disposition and steps before Final Review

- **F-SEC-01: FIXED** for the current production dependency graph; npm audit production 0.
- **F-SEC-02: PARTIALLY FIXED**: former Critical and Moderate package vulnerabilities resolved; residual upstream-unpatched `braces` High chain remains in development ESLint.
- **Full task security signoff: NOT YET APPROVED.** Do not close BDXA Fix Review/Final Review as fully passed unless residual finding is addressed through a reviewed patch/fork or explicitly documented and approved risk acceptance.

After the Browser rerun, confirm all unit/type/lint/build gates and the actual diff again. Do not Commit, Push or Deploy without a separate request.

## Local MIT-licensed braces mitigation — 2026-10-19

The remaining development-time GHSA-vfj7-8cjw-p6xm has no official published fix. User-authorized remediation vendors the original braces 3.0.3 under `frontend/vendor/braces/` (including MIT LICENSE), limits AST/paren nesting and recursive compile/expand/stringify/flatten work to a controlled depth of 128, and retains the original version and provenance.

Packaging uses a source-matched, committed `frontend/vendor/braces-3.0.3.tgz` as the direct **devDependency** (`braces: file:vendor/braces-3.0.3.tgz`), deduplicated by micromatch. A nested npm file: override was tested and rejected: npm 11 resolved it relative to micromatch and failed to install fill-range. This final method successfully passed **a fresh `npm ci`**, not merely a dry-run.

The new `npm run test:security:braces` checks source integrity after install, micromatch resolution, normal globs and controlled errors for deeply nested brace/paren/AST/flatten inputs. `vendor/**` is ignored by app-specific ESLint rules because it is unmodified-in-style upstream CommonJS; the security test has only its CommonJS require-import rule relaxed. Other application lint remains active. Maintenance and provenance instructions: `frontend/vendor/README.md`.

**Post-patch verification:** local security test PASS, unit 360/360 PASS, TypeScript PASS, ESLint PASS, static build 30/30 PASS, Chromium/Firefox/WebKit 57/57 E2E PASS, additional 7/7 high-risk intercepted E2E PASS. No backend, deployment or business-data mutation.

**Audit transparency:** production npm audit 0 findings. Full `npm audit` **still reports 5 High affected package nodes** through braces → micromatch → fast-glob → ESLint, because the retained upstream package version remains in the advisory's affected range. Do not misrepresent the result as full npm-audit clearance. The local patch is **internally regression-tested mitigation, not a vendor-issued patched release or formal security approval**. An independent code-owner review and a documented decision on the residual scanner finding are still needed for production release approval.


## WebKit trace-artifact regression and permanent runner — 2026-10-19

During an initial WebKit regression run, two tests failed at `browserContext.close()` with ENOENT errors referencing missing Playwright `.network` / `.trace` files inside the shared default `test-results` directory. The failure occurred during trace finalization, after the browser-visible assertions, while overlapping Playwright jobs were running; it was not a demonstrated UI or `braces` regression.

The two failing tests and one related authorization case were rerun **sequentially with an isolated `--output` path**: **WebKit 3/3 PASS with `trace=retain-on-failure` enabled**, and **3/3 PASS with tracing disabled**. The full 19-case WebKit suite then ran through the new checked-in `npm run test:e2e:cross-role -- webkit` runner: **19/19 PASS**, with ordinary trace settings and per-invocation isolated artifacts. This supports shared-artifact contention as the cause of the original failures; it does not prove that no Playwright artifact race is possible in other configurations.

The runner lives in `frontend/scripts/quality/run-cross-role-regression.cjs`. With no browser argument, it serializes Chromium, Firefox and WebKit; with one or more browser names, it runs only those engines. Each browser receives a distinct Playwright `--output` directory under the ignored `frontend/quality-audit/.evidence/cross-role-regression/<run-name>/` folder, retaining logs and a machine-readable `result.json`. **Do not start independent Playwright processes concurrently against the same fixture data or shared default outputs.** Original local E2E write guards and authorization checks are unchanged.

This resolves the two flaky trace-finalization test failures observed in the previous WebKit run. It does **not** change the unchanged npm advisory result: full audit retains five development-only High nodes linked to upstream `braces@3.0.3`; production audit remains 0. No formal security waiver or release approval is granted by the test repair.


## Compatibility audit of the local braces patch

An additional technical source review compared the vendor patch with the published braces 3.0.3 npm tarball. Initially, 20 of 672 comparisons differed under the escapeInvalid stringify option; this incompatibility was corrected while keeping recursion-depth guards. After repacking the local archive, updating its lockfile integrity and reinstalling with npm ci, all 672 combinations matched upstream and the dedicated security regressions passed. Full technical evidence: [BRACES_PATCH_TECHNICAL_REVIEW.md](BRACES_PATCH_TECHNICAL_REVIEW.md). The full npm audit still flags five development-only High nodes, and no independent security acceptance has been granted.


## Final compatibility regression verification

After correcting local braces stringify escapeInvalid semantics, the patched package was repacked, its exact SHA-512 npm lock integrity updated, and installed afresh via npm ci. Differential behavior: 672 of 672 comparisons match original npm braces@3.0.3 for supported normal inputs; deep-recursion guards remain covered by permanent tests. Unit 360/360, lint, TypeScript, static build 30/30, cross-browser 57/57 and high-risk E2E 7/7 all pass after the correction. The five remaining npm audit High nodes in the ESLint-only braces chain are not silently suppressed; independent security acceptance is still pending. See [BRACES_PATCH_TECHNICAL_REVIEW.md](BRACES_PATCH_TECHNICAL_REVIEW.md).

## Audit gate added — 2026-10-19

Added a **non-waiving, fail-closed** dependency review gate in `frontend/scripts/security/audit-review.cjs` with eight controlled regression cases and two npm scripts: `npm run test:security:gate` and `npm run audit:review`. The latter executes live production and full npm audits and returns **exit 2** if the only remaining finding is the documented development-only `braces` advisory propagation, **exit 1** for unrecognized/new vulnerabilities or invalid lock/archive, and **exit 0** only for two clean audits. Exit 2 is not a pass or risk acceptance. Actual run: **MANUAL_SECURITY_REVIEW_REQUIRED**.

See [SECURITY_AUDIT_GATE_IMPLEMENTATION.md](SECURITY_AUDIT_GATE_IMPLEMENTATION.md). The previously failed BDXA Final Review is not superseded, and Security signoff remains pending.


## Reviewed-package identity controls — 2026-10-19

The fail-closed Security Gate now pins the reviewed vendor archive SHA-256 independently of the npm lockfile, runs installed-code security verification, and pins all ten vendor source/package/license/README file hashes. A new regression test demonstrated and fixed a previously possible archive-and-SRI joint replacement. Gate tests pass 9/9; the live gate returns exit 2 because the five development-only upstream braces advisory nodes remain. No risk waiver or Production approval is implied. See [SECURITY_PATCH_ACCEPTANCE_PACKET.md](SECURITY_PATCH_ACCEPTANCE_PACKET.md) and [SECURITY_AUDIT_GATE_IMPLEMENTATION.md](SECURITY_AUDIT_GATE_IMPLEMENTATION.md).


## Combinatorial expansion follow-up — 2026-10-19

A source-level review found that repeated **shallow** alternatives can produce exponentially many values even without deep AST recursion. A locally enforced maximum of **65,536 expanded values** now bounds explicit expansion counts (including numeric ranges when the caller requests `rangeLimit:false`). Ordinary behavior still matched upstream on **672/672** differential cases, and the repacked MIT source passed a fresh `npm ci`, security checks, Unit 360/360, TypeScript, ESLint and static Build 30/30. This is not a hard cap on total output bytes/CPU, not a confirmed official upstream fix, and not a waiver for the five remaining development-only High audit nodes. Full evidence: [BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md](BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md).


## Final expansion budget regression evidence — 2026-10-19

The local development-only braces mitigation now rejects excessive **shallow Cartesian expansions**, not just deep recursive parsing. A hard cap of 65,536 output values applies even when numeric rangeLimit is set to false; explicit range/flatten guards are regression-tested. The rebuilt original-version MIT package was installed with npm ci, SHA-512 lockfile/SHA-256 review pins aligned, and ordinary upstream compatibility checked 672/672. Final engineering verification: Unit 360/360, TypeScript, ESLint, Next Static Build 30/30, browser Chromium/Firefox/WebKit 57/57, and additional intercepted high-risk browser scenarios 7/7 all passed. Production npm audit 0; full npm audit still reports 5 High affected dev-only package nodes. This expansion count bound is not a total-memory or CPU guarantee, and independent Security signoff or a formal risk exception has NOT been granted. Full details: BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md.
