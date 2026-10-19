# UniStore Hub — Braces Expansion Budget Hardening

Review date: 2026-10-19 · Workspace `UniStore_Hub` · BDXA Phase 15 — Fix Review Findings.

**Disposition: local resource-exhaustion hardening implemented and engineering-tested; independent Security approval and remediation of the version-based upstream Advisory remain outstanding. This is not a complete denial-of-service certification or a production release authorization.**

## Finding and bounded reproduction

The existing local `braces@3.0.3` MIT patch stopped recursively nested inputs above 128 levels but did not bound **combinatorial expansion of shallow, repeated choices**. With `braces.expand('{a,b}'.repeat(n))`, depth stays low while the number of expanded strings doubles with every added group.

A controlled local experiment measured 256 (n=8), 1,024 (n=10), 4,096 (n=12), and 16,384 (n=14) output strings. A much larger input would consume substantial memory. The existing `rangeLimit` option limits individual numeric ranges, **not the Cartesian product of many comma choices**, and can be disabled by a caller.

## Mitigation

Modified the reviewed, vendored MIT `braces@3.0.3` source (not application/backend logic):

- `vendor/braces/lib/utils.js`: defines an internal hard cap `MAX_EXPANSION_RESULTS = 65536`, and rejects recursive flattening when it would exceed the cap. The existing maximum recursion depth of 128 remains in place.
- `vendor/braces/lib/expand.js`: checks the outer Cartesian product before allocating intermediate results, guards result array growth during append, and checks numeric ranges against the hard cap even when `options.rangeLimit === false`. It also guards against `fill-range` unexpectedly returning more than the cap.

The bound is intentionally **not user-configurable**. `braces.expand('{a,b}'.repeat(16))` still yields 65,536 strings; 17 choices throws a controlled `RangeError`, rather than constructing 131,072 strings. Numeric expansion `{1..70000}` and `{1..65537}` with `rangeLimit: false` also throw before range materialization.

The original standard compile path and ordinary glob semantics remain available. The permanent `npm run test:security:braces` now covers this output quota alongside deeply nested parser/AST and normal micromatch behavior.

## Installation and source integrity

The local package archive `frontend/vendor/braces-3.0.3.tgz` was rebuilt from the reviewed source; the root lockfile includes its exact SHA-512 integrity. The audit gate pins the local archive SHA-256 separately, and the installed-code verifier pins each of the ten reviewed package files by SHA-256. After regenerating the archive/pins intentionally, **a fresh `npm ci` succeeded**; all three integrity layers and the installed-vs-vendor source checks passed.

The original MIT source, upstream version number and license remain intact. The default package version is deliberately **not** disguised as a new official patched release.

## Verification

| Check | Result |
| --- | --- |
| Explicit choices: 16 groups | 65,536 results, PASS |
| Explicit choices: 17 groups | controlled `RangeError`, PASS |
| Numeric range larger than the cap with `rangeLimit:false` | controlled `RangeError`, PASS |
| Flat array larger than cap | controlled `RangeError`, PASS |
| Existing nested depth and source/lock integrity tests | PASS |
| Differential tests against original upstream on ordinary patterns/options | **672/672 identical** |
| `npm ci` | PASS |
| Unit/component | **360/360 PASS** |
| TypeScript / ESLint / Next Static Build | **PASS / PASS / 30 of 30 PASS** |
| Cross-browser E2E after expansion hardening | Chromium 19/19, Firefox 19/19, WebKit 19/19; **57/57 PASS** in the isolated-output sequential runner |
| Production dependency audit | **0 findings** |
| Full audit | **Five High-affected dev-only package nodes, same upstream braces Advisory** |
| Additional high-risk intercepted browser tests | **7/7 PASS** (payment, pickup, platform, product images) |
| Independent patch signoff | **PENDING** |

## Residual caveats

A hard count of 65,536 strings does not directly cap **total character bytes**, worst-case heap usage, or adversarial resource exhaustion through other unrelated library/runtime paths. The guard covers this identified expansion-count vector; it is **not proof that all untrusted patterns are safe**. This toolchain library is currently in an ESLint Development-only dependency chain, absent from the inspected Next.js Static Export.

A legitimate consumer previously expanding more than 65,536 values will now receive a `RangeError`. This is an intentional bounded-compatibility change, which must be accounted for before extending the package's use. The 672-case differential corpus covers ordinary patterns, **not output sets above the new cap**.

The upstream Advisory `GHSA-vfj7-8cjw-p6xm` remains present in `npm audit`; neither the version-based scanner nor this technical review verifies the local fix as an upstream patched release. Full risk acceptance requires an accountable Security/code-owner decision. No Commit, Push, Deploy or production business-data mutation was made.
