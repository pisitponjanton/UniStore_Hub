# Locally reviewed development dependency: braces

## Why it exists

This repository uses `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` during development and linting. Upstream `braces@3.0.3` remains flagged for unbounded AST recursion (`GHSA-vfj7-8cjw-p6xm`, `CVE-2026-93687`), and **no patched upstream release was available on 2026-10-18**.

To avoid bringing an unreviewed third-party fork into the supply chain, this repository keeps an auditable copy of the original **MIT-licensed braces 3.0.3** source in `vendor/braces/`, together with its upstream LICENSE and README. A small local patch rejects excessively deep input/AST structures before recursive processing. `braces-3.0.3.tgz` is a locally versioned npm archive assembled from that exact local source.

**Do not describe this as an official `braces` patch release. Its package name and version remain `braces@3.0.3` deliberately. The full npm advisory remains open and must not be hidden.**

## Changes from upstream

The original public API and most source are unchanged. The following files have a targeted bound of 128 nested levels:

- `lib/parse.js`: reject overly deep nesting of curly braces and parentheses while parsing, before the recursive walkers are invoked.
- `lib/compile.js`: guard recursive AST compilation, including direct user-supplied ASTs.
- `lib/expand.js`: guard expansion's AST walk and recursive array combination.
- `lib/stringify.js`: guard recursive AST stringification.
- `lib/utils.js`: guard recursive flattening of nested arrays.

The limit is deliberately conservative to avoid call-stack exhaustion. Inputs deeper than 128 levels are rejected with a controlled `RangeError`, not silently shortened or reinterpreted. The same behavior must be retained in future revisions.

Upstream source: https://github.com/micromatch/braces/tree/3.0.3  
Security advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm  
License: MIT (`vendor/braces/LICENSE`).

## Reproducibility

The root frontend `package.json` declares `braces: file:vendor/braces-3.0.3.tgz` as an explicit **devDependency**. `micromatch` resolves the same root installation via regular npm semver deduplication. This avoids an npm 11 problem where transitive `file:` overrides may resolve relative to nested `node_modules` paths and omit local-package dependencies.

```sh
cd frontend
npm ci
npm run test:security:braces
npm run lint
npm test
npm run build
npm audit --omit=dev
npm audit
```

`npm run test:security:braces` checks that the actual installed copy used by `micromatch` matches the tracked source, ordinary glob handling works, and maliciously deep parse/compile/expand/stringify/flatten paths throw a predictable `RangeError`. Running it immediately after a fresh `npm ci` verifies package integrity and dependency resolution.

When changing the patch, edit the tracked source **first**, then run `npm pack ./vendor/braces --pack-destination ./vendor --ignore-scripts` to update the tracked tarball and lockfile as appropriate. Never edit `node_modules` directly. Review and retest any new npm install graph before using it.

The tarball SHA-256 for this reviewed archive is `cf9d1ceef10badc2a90da5550fd235bcbb33b1f96cafcd22cd42afac84e485e4`. This is a *repository-owned, reviewed archive*, not an npm publisher's signed/security-certified release.

## Security disposition

The package is used by a **developer-only ESLint** dependency chain, absent from production dependency-only installs. `npm audit --omit=dev` should remain clear. Full `npm audit` may still report **five High affected package nodes**, all tracing to this one unpatched upstream advisory, even after applying the local mitigation. Conversely, if a file-based dependency stops appearing in an audit, that should not be counted as proof the patch is safe.

**No risk waiver or external security signoff is implied**. A code owner should review the patch, track the upstream advisory and remove the local copy when an official patched release is published and verified.

The ESLint configuration ignores `vendor/**` because original upstream CommonJS files do not follow the application's ESM-style lint rules; the rest of the app's security linting remains enabled. The separate CommonJS security verification script has only its `no-require-imports` rule excluded. This is not permission to ignore any other security lint warnings.

Compatibility review: see docs/design/BRACES_PATCH_TECHNICAL_REVIEW.md. The local stringify patch was corrected to retain upstream escapeInvalid behavior after a 672-case comparison with the official npm package.


## Expansion output budget — 2026-10-19

The local hardening now also includes an **unconfigurable maximum of 65,536 expanded values** for explicit brace expansion, enforced in \`lib/expand.js\` and \`lib/utils.js\`. Repeated shallow alternatives can generate exponentially many strings without deep recursion, so nested-depth guards alone were insufficient. A \`rangeLimit: false\` option cannot bypass this expansion-count guard. Normal compile/glob behavior remains available; use \`braces.compile\` when an enormous explicit array is unnecessary. More than 65,536 expansions now intentionally throws \`RangeError\`. This quota is not a complete byte/CPU/heap guarantee.

The reviewed tarball and all source hashes were deliberately updated after the MIT source changes, with \`npm ci\` and local security regression verification. See \`docs/design/BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md\`. These are local mitigations, not a published upstream patched release or a security waiver.
