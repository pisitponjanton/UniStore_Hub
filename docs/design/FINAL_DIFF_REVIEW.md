# UniStore Hub — Final Diff Review

Review date: 2026-10-18 · Baseline: `9007ec3` (`main`) · Task: Complete Cross-Role UX/UI Redesign · Planned final phase: Review Diff.

**Verdict: REVIEW NOT PASSED — security release blocker remains open.** The scoped UX/UI changes and bounded frontend regressions pass, but the current frontend lockfile contains unresolved security advisories. **Do not approve full plan completion, release, deploy or commit-readiness as security-cleared on the basis of the browser results.** This final review was carried out without modifying package versions, Backend or business data.

## 1. Diff inventory, scope and engineering integrity

- Existing Git baseline remains `9007ec3` on `main`. `git status` before this final review: **87 modified tracked files and 48 untracked source/design files**. The new review report is additional.
- All changes are in `frontend/**` and `docs/design/**`; no Backend, DB, AWS, infrastructure or GitHub workflow files changed. `frontend/package.json` and `frontend/package-lock.json` are unchanged: the dependency vulnerabilities **were not introduced by this redesign** but are present in the active baseline.
- There is **nothing staged**. No Commit, Push or Deploy, no seed reset, no production traffic, no backend business data mutation.
- The tracked diff contains about **3,029 inserted and 1,923 removed lines across 87 files**, largely the public storefront, role shells, navigation, forms, styles and browser tests; 48 new files include reusable components/tests, an evidence matrix generator and handoff documents. Newly added filenames are descriptive rather than `phaseNN` source/test filenames.
- Changed React/TypeScript mostly adds route-appropriate navigation, plain-language copy, responsive/card layout and focus/status cues. A targeted review of changed executable source found **no new API mutation payload/endpoint/method changes**; some existing navigation and session-context behavior is intentionally redesigned and covered by unit/browser tests. The new navigation links preserve authorized tenant context; existing RBAC checks remain mandatory.
- Search of changed source found no representative hardcoded private keys, `eval`, `document.write`, or `dangerouslySetInnerHTML`. This heuristic does not certify absence of all vulnerabilities. Existing download link uses `noopener noreferrer`.
- Every evidence source path referenced from the current `ROUTE_ROLE_STATE_MATRIX.json` was checked for stale references (none found outside the intentionally ignored dynamic evidence). All 28 canonical routes, 207 route-action IDs and 50 shared-shell action IDs remain mapped.

## 2. Actual verification used for this review

| Verification | Observed result |
| --- | --- |
| Unit/component | **360/360 PASS**, 91 files |
| TypeScript `tsc --noEmit` | PASS |
| ESLint | PASS |
| Next.js production static build | **30/30 routes PASS** |
| `git diff --check` | PASS |
| Chromium / Firefox / WebKit scoped cross-role E2E | **19/19 in each browser; 57/57 total PASS** |
| High-risk isolated Chromium E2E | **7/7 PASS**, intercepted writes |
| Earlier authorized route × role × viewport coverage | **195/195 sampled route renders PASS**, 39 route–role pairs / 5 widths |
| Earlier modal samples | **72/72 sampled combinations PASS** |
| Source asset manifest | 0 new downloaded media, manifest 0 entries; consistent |
| Git index | 0 staged files |
| Security `npm audit --omit=dev` | **FAIL: two High-severity package findings** |
| Full `npm audit` | **FAIL: two Critical, seven High, one Moderate** |

Browser results are **scoped real local UI and intercepted/synthetic business transition tests**, not real financial/order/pickup/organization persistence verification. Screenshot baselines from local Dev browser include dynamic content; six recent modal image pairs were sampled, but strict pixel equality, human design signoff and real Core Web Vitals were not established.

## 3. Blocking finding — vulnerable toolchain dependencies

**F-SEC-01 — HIGH / RELEASE BLOCKER:** The locked production dependency graph includes `next@16.3.7`, flagged by `npm audit` with six advisories, including image-optimizer SSRF (`GHSA-cjq9-62q9-8jv4`), SSG/ISR cache behavior and development endpoint disclosure. The same graph includes `source-map-js@1.2.1` through Next/PostCSS, flagged for a denial-of-service weakness (`GHSA-68fv-2mgg-jv7q`). `npm audit` identifies `next@16.4.2` as a remediation candidate; `source-map-js >=1.2.2` is the patched range.

Current deployment settings in `frontend/next.config.ts` explicitly use `output: "export"` and `images.unoptimized: true`. Therefore some server-only advisory attack paths may not be reachable **in the deployed static frontend**, but this does not eliminate vulnerable transitive dependencies or other installation environments. Do not claim an active exploit without an environment-specific test. Still require a verified patched lockfile or a formal documented exception before release signoff.

**F-SEC-02 — HIGH (development/test toolchain):** Including developer dependencies, `npm audit` reports **2 Critical, 7 High, 1 Moderate**. The Critical findings are associated with `vitest@3.2.7`/`tinypool`, with additional Next ESLint and mocker/glob dependencies affected. npm's suggested automatic fixes for several items involve major upgrades/downgrades. Those should be **reviewed as a separate controlled dependency maintenance task**; blindly running `npm audit fix` risks an incompatible test/build toolchain.

Both findings predate the redesign (package and lockfile are untouched). They are **release blockers, not regressions newly introduced by the UX/UI diff**. Still unresolved at the end of Phase 14 review.

### Required remediation before re-review

1. Obtain explicit authorization to update frontend development/runtime dependencies and lockfile, outside the current UX/UI-only implementation scope.
2. Determine the smallest compatible patched versions (start by evaluating Next 16.4.2 and patched `source-map-js`); handle Vitest/tinypool and ESLint advisories in a deliberate, compatible toolchain change. Do not automatically apply a suggested major downgrade.
3. Run `npm ci`, production and complete npm audits, unit/component, TypeScript, ESLint, static build, and high-risk Chromium/Firefox/WebKit E2E again. Verify no security regression and record resolved or accepted advisories with rationale.
4. Re-run Final Diff Review on the updated **unstaged** diff, then close the plan only if blockers are cleared. Commit/Push/Deploy remain separate user-authorized actions.

## 4. Other deferred integration and coverage risks — not evidence of test pass

- Source action matrix maps **257 IDs** but **0** exhaustive 257 × all roles × loading/empty/forbidden/validation/pending/success/error/conflict/keyboard state matrices were certified. This risk has been represented as NOT_TESTED across the work; limited tested interactions remain valid.
- Persisted backend mutation/idempotency tests were not run: payment approval/rejection, pickup, platform approval, inventory and image storage all used intercepted writes, not live business operations. Product-image PATCH ambiguous response across a new tab/denied SessionStorage still needs server-end acknowledgment design to *guarantee* no duplicates. Client GET-only verification mitigates, not guarantees.
- Real browser zoom 200%, physical mobile devices, native VoiceOver/NVDA, complete human usability testing, real-world LCP/INP/CLS and legal provenance of backend-hosted seller photos were not independently certified.
- There are no newly downloaded licensed third-party photos/icons/fonts. SVG icons were authored inline; product imagery comes from the original product API. MotionSites content was inspiration only, not copied.
- Static export size is approximately 2.97 MB across 210 output files, not the compressed network cost of any one page. Performance metrics are therefore descriptive, not proof of good Core Web Vitals.

## 5. Final disposition

**Scoped UX/UI behavior and browser/engineering gates: PASS.**  
**Security release/complete-task gate: BLOCKED.**  
**Full task completion: DO NOT CERTIFY until F-SEC-01 and F-SEC-02 are remediated or explicitly risk-accepted through an authorized process.**

Source evidence: `docs/design/DESIGN_QUALITY_COVERAGE.json`, `docs/design/ASSET_SECURITY_AUDIT.json`, `docs/design/CROSS_ROLE_REGRESSION_IMPLEMENTATION.md`, `frontend/quality-audit/.evidence/cross-role-regression/` (ignored local outputs), and `docs/design/ROUTE_ROLE_STATE_MATRIX.json`.

No Commit, Push, Deploy or actual business data writes performed.

## BDXA review disposition

The `review_diff` was submitted with `passed=false` and findings `F-SEC-01` and `F-SEC-02`. BDXA recorded revision **15**, created active **Phase 15 — Fix review findings**, and returned the Final **Phase 14 — Review diff** to **pending**. Confirmed overall task status remains **active**, with **13 completed of 15 current phases**. No patch, risk waiver or release approval was made in this review.

The dependency upgrade/lockfile change needs **explicit authorization** because the active redesign scope authorizes UX/UI work only. Do not close Phase 15 as fixed merely because package advisories predate the redesign. Re-review after a controlled patch and tests or an explicit authorized risk-acceptance decision.

## Security remediation follow-up — 2026-10-18

After the failed Final Review, the user authorized continued work on Phase 15. The newer, compatible frontend dependency versions and lockfile now contain Next.js 16.4.2, eslint-config-next 16.4.2, Vitest 5.0.5 and a scoped source-map-js 1.2.2 override; full detail, reproducibility checks and new browser tests are in [DEPENDENCY_SECURITY_REMEDIATION.md](DEPENDENCY_SECURITY_REMEDIATION.md).

- **F-SEC-01: RESOLVED at the npm production dependency level** (`npm audit --omit=dev` 0 vulnerabilities). This does not certify production app security beyond packages.
- **F-SEC-02: NOT FULLY RESOLVED** (full `npm audit` now 0 Critical, 5 High, 0 Moderate, all tracing to development-only eslint-config-next → fast-glob → micromatch → braces@3.0.3). The upstream braces High-severity nested pattern advisory has **no published upstream patch** at this time; an unreviewed third-party fork or silenced audit would not be acceptable proof. A vetted local patch/fork or explicit documented risk acceptance remains needed.
- Unit 360/360, TS, lint and static build 30/30 passed after the dependency changes. The cross-browser rerun is **57/57 PASS** (19/19 per Chromium, Firefox, WebKit) plus **7/7** additional intercepted high-risk E2E cases; details are in the linked dependency report.

**The previous BDXA failed review decision is NOT superseded by this addendum.** The full plan remains active until unresolved F-SEC-02 is handled and final review is re-run.

## Controlled in-repository braces patch follow-up — 2026-10-19

Additional user-authorized work placed the MIT-licensed `braces@3.0.3` source and patched build archive under `frontend/vendor/`. The local change guards deeply nested pattern/AST processing, including direct AST compilation, expansion, stringification and recursive flattening. Installed source matches the archived reviewable source by checksum. `npm ci` installed it successfully, and micromatch resolved the same copy.

Verification after clean installation: **security regression PASS, unit 360/360 PASS, TS PASS, lint PASS, Build 30/30 PASS, Chromium/Firefox/WebKit 57/57 PASS, seven high-risk intercepted browser cases PASS**. Full `npm audit` remains at **5 High nodes** from the same upstream braces dependency chain; `npm audit --omit=dev` reports **0**. No patched official upstream release exists; the package retains version 3.0.3 intentionally.

**Decision:** F-SEC-02 has a **locally implemented and tested mitigation**, but its version-based scanner warning persists and there is no independent code-owner signoff or formal exception decision. This does not supersede the previous failed Review Diff or grant Production approval. The next reviewer should inspect the source, MIT attribution and reproducible archive described in `frontend/vendor/README.md`, then explicitly decide whether the mitigation is sufficient. Full details: [DEPENDENCY_SECURITY_REMEDIATION.md](DEPENDENCY_SECURITY_REMEDIATION.md).


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

## Additional runtime isolation evidence — 2026-10-19

Added `npm run test:security:runtime`, combining six fail-closed synthetic dependency/bundle tests and a scan of the current Next Static Export. In the verified export, **75 HTML/JS/CSS/MJS files** were inspected with no characteristic strings from the vendored development-time `braces` guard; all locked braces entries were development-only. The local recursion test also now exercises 512- and 4,000-level nested adversarial inputs below the upstream length cap, with controlled errors. This is bounded evidence, **not a complete supply-chain or production-exploitability certification**. Details: [RUNTIME_DEPENDENCY_ISOLATION.md](RUNTIME_DEPENDENCY_ISOLATION.md). The residual five High npm audit nodes remain visible and manual Security acceptance is still pending.


## Combinatorial expansion follow-up — 2026-10-19

A source-level review found that repeated **shallow** alternatives can produce exponentially many values even without deep AST recursion. A locally enforced maximum of **65,536 expanded values** now bounds explicit expansion counts (including numeric ranges when the caller requests `rangeLimit:false`). Ordinary behavior still matched upstream on **672/672** differential cases, and the repacked MIT source passed a fresh `npm ci`, security checks, Unit 360/360, TypeScript, ESLint and static Build 30/30. This is not a hard cap on total output bytes/CPU, not a confirmed official upstream fix, and not a waiver for the five remaining development-only High audit nodes. Full evidence: [BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md](BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md).


## Final expansion budget regression evidence — 2026-10-19

The local development-only braces mitigation now rejects excessive **shallow Cartesian expansions**, not just deep recursive parsing. A hard cap of 65,536 output values applies even when numeric rangeLimit is set to false; explicit range/flatten guards are regression-tested. The rebuilt original-version MIT package was installed with npm ci, SHA-512 lockfile/SHA-256 review pins aligned, and ordinary upstream compatibility checked 672/672. Final engineering verification: Unit 360/360, TypeScript, ESLint, Next Static Build 30/30, browser Chromium/Firefox/WebKit 57/57, and additional intercepted high-risk browser scenarios 7/7 all passed. Production npm audit 0; full npm audit still reports 5 High affected dev-only package nodes. This expansion count bound is not a total-memory or CPU guarantee, and independent Security signoff or a formal risk exception has NOT been granted. Full details: BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md.

## Subsequent workspace-only final re-review — 2026-10-19

The earlier **REVIEW NOT PASSED** verdict above remains the historical 2026-10-18 pre-remediation finding. On 2026-10-19 the user **explicitly accepted only a time-bounded, in-workspace residual development-time braces risk**, recorded in [WORKSPACE_SECURITY_EXCEPTION.md](WORKSPACE_SECURITY_EXCEPTION.md), **not** an independent Security approval or Production deployment authorization. The final local scoped re-review and fresh 57/57 cross-browser result are documented in [WORKSPACE_FINAL_DIFF_REVIEW_2026-10-19.md](WORKSPACE_FINAL_DIFF_REVIEW_2026-10-19.md). That newer disposition applies **only to closing the local UX/UI task plan**, retains five High full-audit nodes and the fail-closed exit-2 gate, and does not certify release-readiness. No Commit, Push or Deploy.
