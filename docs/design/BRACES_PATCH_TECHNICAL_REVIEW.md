# Braces — Controlled Local Security Patch Technical Review

Review date: 2026-10-19 · Scope: `frontend/vendor/braces/`, `frontend/vendor/braces-3.0.3.tgz`, `frontend/scripts/security/verify-braces.cjs`.

**Status: local technical review and compatibility correction performed. Not an upstream security release, independent audit, formal risk waiver or Production approval.**

## Security motivation and provenance

The upstream npm package `braces@3.0.3` is affected by advisory `GHSA-vfj7-8cjw-p6xm`, concerning deeply nested input and stack exhaustion. It is reached from **development-only** `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. The frontend uses Next.js Static Export; production dependency-only `npm audit --omit=dev` currently reports zero findings. Full `npm audit` still lists five High affected nodes from this same upstream advisory.

The reviewer fetched the published `braces@3.0.3` npm tarball with `npm pack --ignore-scripts` and compared its ten source, package and license files against the vendored MIT package. The untouched files (`LICENSE`, `README.md`, `index.js`, `package.json`, `lib/constants.js`) matched the npm original. Only the intended five source files differed.

### Changes reviewed

- `lib/parse.js`: denies curly-brace/parenthesis nesting when the parser stack reaches the local maximum (128).
- `lib/compile.js`: propagates a recursion depth counter, including direct AST input.
- `lib/expand.js`: propagates depth both in AST walking and recursive array combination.
- `lib/stringify.js`: propagates recursion depth **without passing the parent object to the original stringify helper**; that original behavior is important for `escapeInvalid` compatibility.
- `lib/utils.js`: guards recursive flattening of array nesting.

The limit is a local policy, **not** a guarantee of overall CPU/memory boundedness. Normal options and patterns below the limit should remain unchanged; maliciously deep input is rejected via controlled `RangeError`.

## Compatibility defect discovered and corrected

A differential test against npm's original source exercised **672 combinations** of ordinary and nested patterns, method calls (`braces()`, `braces.expand()`, `braces.stringify()`) and options (default, `escapeInvalid`, `expand`, `keepEscaping`). The initial local patch had **20 behavior differences**, all involving `stringify` plus `escapeInvalid: true`.

Root cause: passing `node` as the recursive stringify helper's parent changed the library's original invalid-brace escaping behavior. Corrected the recursion to increment only the guard's depth while keeping the original default parent semantics. After rebuilding the local npm tarball, updating its lockfile SHA-512 integrity and running **fresh `npm ci`**, the same differential corpus returned **672/672 identical results, zero differences**.

Added permanent regression assertions for `stringify` on numeric ranges, empty braces and single-choice braces with `escapeInvalid`, alongside the existing pathological nesting tests. Also added a lockfile archive-integrity check: the test compares the archive SHA-512 against the lockfile and the installed source's SHA-256 against the tracked vendor source.

## Verification and artifact identity

- Current archive: `frontend/vendor/braces-3.0.3.tgz` (source in `frontend/vendor/braces/`).
- Original npm package `braces@3.0.3` downloaded only into the ignored QA evidence folder; it was **not added as a project runtime dependency**.
- Reinstalled using `npm ci` successfully. A valid local tarball and lockfile integrity are required; hand-editing `node_modules` alone is not acceptable.
- Security regression: **PASS**, including normal glob handling, micromatch resolution, deep parser/AST/flatten guards, archive-source consistency and three `escapeInvalid` fixtures.
- Unit/component tests: **360/360 PASS**.
- TypeScript: **PASS**.
- ESLint: **PASS**, retaining application rules; only the ignored, temporary QA evidence and third-party vendor folder are excluded from app-style linting.
- Static Build: **30/30 routes PASS**.
- Post-correction cross-browser journeys: **Chromium 19/19, Firefox 19/19, WebKit 19/19; 57/57 PASS**, recorded with isolated evidence outputs. Additional Chromium high-risk intercepted scenarios: **7/7 PASS**.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- Full `npm audit`: **0 Critical, 5 High, 0 Moderate**. These remaining alerts are not represented as closed merely because local code differs from upstream.

## Remaining security and acceptance conditions

1. This is a targeted Stack Overflow mitigation. Complex patterns can also cause **combinatorial output growth**; that is not a certified fix for every resource-exhaustion mode. The tested `braces` helpers remain subject to their existing limits and normal API semantics.
2. `npm audit` is version/advisory-based and cannot independently validate this local, same-version patch. Full audit's five High nodes remain open and visible.
3. No external code owner or independent security assessor has signed off on the patch. **Formal Security risk acceptance remains PENDING.**
4. Remove the local fork when an official patched release is available and passes the same compatibility/security/regression gates.
5. Backend authorization, payment/order/pickup persistence and production penetration testing are out of this code review's scope. No user business data was changed.

**Disposition:** locally reviewed and regression-tested mitigation with an additional compatibility bug found and corrected. Do not mark whole-system Production release security-cleared or silently waive the remaining full npm audit result.
