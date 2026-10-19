# UniStore Hub — Cross-role Regression, Asset & Security Audit

Date: 2026-10-18 · Workspace: `UniStore_Hub` · BDXA Redesign — cross-role quality review.

**Result: scoped QA and security inventory performed; cross-browser UI regression PASS; release security gate BLOCKED by unresolved package advisories.** This is not a Production signoff.

## 1. Cross-role end-to-end regression

The same locally guarded Playwright journey set ran on three browser engines:

| Browser | Cases | Outcome | Approximate duration |
| --- | ---: | --- | ---: |
| Chromium | 19 | **19 PASS** | 73.8 s |
| Firefox | 19 | **19 PASS** | 98.0 s |
| WebKit | 19 | **19 PASS** | 87.1 s |
| **Total** | **57** | **57 PASS** | |

The seven scoped browser suites comprised:
- `account-role-entry.spec.ts`: Guest login/register entry and role-specific workspace discovery, including unauthorized navigation controls.
- `customer-responsive-journey.spec.ts`: customer orders, responsive layout and appropriate next actions.
- `staff-operations-responsive.spec.ts`: Staff orders, payment queue, pickup queue, responsive interactions and safe dialogs.
- `organization-management-responsive.spec.ts`: nine Organization Admin views, preserved organization identity and Staff denied admin routes.
- `platform-administration-responsive.spec.ts`: Platform overview, organizations, users and Organization Admin direct URL denial.
- `commerce-detail-journeys.spec.ts`: public store/product/campaign details, actual variant prices and availability gating.
- `multi-role-modal-accessibility.spec.ts`: customer cancellation, staff payment and pickup dialogs; Light/Dark, four widths, focus/Escape and accessible names.

An additional **7/7 high-risk Chromium E2E tests** passed for payment approve/reject state transitions, pickup confirmation pending/conflict/retry, platform organization status transitions, and product image ambiguous PATCH, closed tab, switched account and storage-denied reload.

Each exercise was limited to **loopback-only local target sessions** and test-controlled GET responses or intercepted write methods. **No real customer, financial, inventory, storage or organization business record was created, approved, paid, picked up or modified**.

The preceding design-quality phase independently measured **195 authorized route–role–viewport visits** across five widths and retained the honest 257 source-action manifest. Phase 13 does not re-label those route renders as exhaustive click-state certification.

### Screenshot comparison

Compared six sampled 390×844 dialog screenshots against preceding captured runs (customer order, staff payment and staff pickup, each in Light and Dark Theme). Mean absolute channel deltas ranged **3.34–9.11/255**. Dynamic content, fonts, captures and notifications prevent strict pixel equality; these are diagnostic comparisons, **not approved visual golden baselines**. Screenshot sample data is preserved under ignored `frontend/quality-audit/.evidence/cross-role-regression/screenshot-sample-compare.json`, and prior phase captures remain in the ignored modal evidence folder.

## 2. Asset origin, license and code surface

- There are **zero additional files** in `frontend/public/`, `frontend/assets/` or `frontend/src/assets/`. The `ASSET_MANIFEST.json` currently contains **zero third-party media records**, agreeing with the filesystem. No downloaded MotionSites content, third-party photo, premium video, icon pack or new font was bundled.
- The application uses authored inline SVGs in `frontend/src/components/layout/workspace-icon.tsx`. Product/store images use the **existing backend-provided `imageUrl`** at runtime, often with alt labels and loading hints; no seller's ownership/license or live CDN delivery rights could be verified from this repo alone.
- A targeted source scan of **changed TypeScript/JSX/CSS** found no `dangerouslySetInnerHTML`, `document.write`, `eval`, `new Function`, representative hardcoded private-key patterns or new hardcoded off-origin HTTP assets in non-test runtime source. This is a **heuristic code scan, not proof against XSS, token theft or malicious dependencies**.
- The payment proof link opens in a separate tab with `rel="noopener noreferrer"`; no need to duplicate mitigation. Global reduced-motion CSS suppresses transition/animation durations, including component styles that have no local override.
- Changed files in this task are scoped to `frontend/**` and `docs/design/**`; no Backend/API, database, Terraform/AWS or infra configuration changed.

### Performance limitations

The built Next.js site uses **`output: "export"`** and `images.unoptimized: true` (i.e., static HTML/JS/CSS hosted separately from the backend). The existing local export currently totals approximately **2.97 MB across 210 files**, of which **2.11 MB across 63 `_next/static` files**. These are summed artifact sizes, **not per-route transfer sizes, compressed network payloads, LCP/INP/CLS or measured user performance**. No new heavy motion or image dependency was added, but no production Core Web Vitals or asset CDN test was conducted.

## 3. Security findings — explicit RELEASE BLOCKER

Two separate `npm audit` runs were executed against the currently installed frontend lockfile. Full raw reports are preserved under the Git-ignored `frontend/quality-audit/.evidence/cross-role-regression/` folder.

| Scope | Critical | High | Moderate | Status |
| --- | ---: | ---: | ---: | --- |
| `npm audit --omit=dev` | 0 | **2** | 0 | **OPEN** |
| `npm audit` (incl. dev tools) | **2** | **7** | **1** | **OPEN** |

Production-included affected packages:

1. `next@16.3.7`: reports six Next.js advisories, covering server cache/SSG/ISR behavior, image optimizer SSRF and Dev server disclosures. A supported remediation candidate reported by npm is **`next@16.4.2`**. References: `GHSA-cjq9-62q9-8jv4`, `GHSA-4jqv-mc3x-m676`, `GHSA-3w37-wq28-93x7`. This project uses Static Export and unoptimized external images, reducing exposure to several server-specific cases but **not making affected versions security-cleared**.
2. `source-map-js@1.2.1`, reached through `next → postcss → source-map-js`: `GHSA-68fv-2mgg-jv7q` high-severity DoS in indexed section offsets. Patched range starts at `1.2.2`.

Additional development/test-tool advisories include `vitest@3.2.7` / `tinypool` Critical entries, `eslint-config-next` and related lint dependencies High entries, and `@vitest/mocker` Moderate. **Do not run `npm audit fix` blindly**: the current recommended resolutions include major version upgrades/downgrades and could change the Next/Vitest toolchain. Test a minimal, compatible, explicitly authorized dependency remediation as a separate implementation activity with lockfile, build and E2E checks.

`npm audit` reports vulnerable package version ranges, **not proof of exploitability in this particular deployment**. Conversely, browser tests passing do not eliminate package advisories. **Release/commit readiness should remain blocked pending security remediation or an explicit risk decision.**

## 4. Status and follow-up

| Quality gate | Result |
| --- | --- |
| Cross-browser scoped E2E | **57/57 PASS** |
| Extra intercepted high-risk E2E | **7/7 PASS** |
| Scoped real-data writes | **0** |
| Source Asset Manifest match | **PASS** (no new third-party media) |
| Source security heuristic | **No listed patterns detected** |
| Unresolved `npm audit` advisories | **OPEN: 2 High production; 2 Critical in full dependency scan** |
| Unit/component | **360/360 PASS** (91 files) |
| TypeScript / ESLint / Next.js production build / `git diff --check` | **PASS / PASS / 30 of 30 routes / PASS** |

Not certified: 257 actions across every role/action/state combination; backend persistence, payment idempotency, AWS deploy/CSP, physical devices, screen readers, real 200% browser zoom, complete assets ownership or real-world Core Web Vitals.

**Hand-off to review-diff:** Inspect the complete uncommitted task diff; treat unpatched package advisories as an explicit security/release blocker, not as a UX regression failure or a reason to rewrite APIs. Preserve all data and require a bounded dependency remediation with user authorization before production signoff.

No Commit, Push, Deploy or actual data mutations were performed.
