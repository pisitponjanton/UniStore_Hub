# UniStore Hub — Design Quality, Accessibility & State Review

Date: 2026-10-18 · Workspace: `UniStore_Hub` · Goal: cross-role frontend design quality for the current redesign.

**Result: bounded browser review and the discovered scoped fixes complete. This is not a full WCAG 2.2 AA certification, exhaustive user-action state matrix, backend authorization approval or a production deployment signoff.**

## Coverage and evidence

The canonical source manifest `frontend/quality-audit/coverage-baseline.json` declares **28 routes**, with **39 authorized route–role combinations** across Guest, Customer, Staff, Organization Admin and Platform Admin.

- Ran a primary-role suite on all 28 routes at **320 / 390 / 768 / 1024 / 1440px**: **140/140 automated route–viewport checks CAPTURED**, no page JS errors, broken images, horizontal overflow, clipped form controls or missing input labels in that evaluated state. The browser blocked business-mutating API requests.
- Ran an additional role-combination suite on **11 secondary authorized route–role pairs at the same five widths**: **55/55 checks PASS** with no page JS errors, overflow, broken images or prohibited writes.
- **195/195 total authorized route–role–viewport checks** in their sampled visible/default states. This is route-level coverage, **not** 195 exhaustive interaction-state checks.
- Automated `axe-core 4.13` scanned **all 39 authorized route–role pairs at 390px** against supported WCAG 2.0/2.1 and **WCAG 2.2 AA** tags, including the available target-size rule. Zero violations in the final run. This does **not** establish full WCAG compliance.
- Five representative pages were tested in Dark Theme in normal and **200% root text size** conditions, **10/10 states PASS** without horizontal overflow or detected color-contrast/button-name/label violations. Root font scaling is **not** a substitute for real native browser zoom.
- Customer-order, staff-payment and staff-pickup modal scenarios were exercised in **Chromium, Firefox and WebKit**, light/dark, at four viewport widths (320/390/768/1440): **72 sampled modal combinations PASS** for accessible modal naming, keyboard focus containment, Escape/return focus, contrast and geometry. Fixture navigation and modal opening were nonmutating.
- Verified shell menu navigation, main-content skip link, keyboard Escape, drawer inertness and logout for **Staff / Organization Admin / Platform Admin**, and sampled 11 business-page 503 error/retry recovery paths plus the shared loading skeleton.
- Additional scoped browser tests exercised Login/Register pending/validation/503/conflict, mobile order filters, Notifications and Audit filter/reset/503/retry and modal keyboard behavior.

Primary browser matrix: `frontend/quality-audit/.evidence/design-quality/responsive-28routes-5widths.json`. Secondary matrix: `frontend/quality-audit/.evidence/design-quality/secondary-roles-*/secondary-route-role-matrix.json`. Theme matrix: `frontend/quality-audit/.evidence/design-quality/theme-200pct-matrix.json`.

An additional compact, machine-readable evidence ledger is in `docs/design/DESIGN_QUALITY_COVERAGE.json`. Sixteen representative screenshots from the primary 28-route run and four representative Dark Theme/text-scaling images are retained locally in the Git-ignored design-quality evidence folder. These are sampling artifacts, not a human-approved design gallery.

## Real defects found and corrected

1. **Storefront search/filter contrast in Dark Theme.** Both inputs had a hardcoded light background but dynamically inherited the light-colored Dark Theme text variable. Axe reported two contrast failures (approximately 1.04:1). The controls now use a matching explicit dark foreground, light native form color scheme and readable placeholder, with no impact to their values or searches. `theme-and-text-scaling.spec.ts` now requires zero axe violations and no 200% text overflow.
2. **Organization entry count legibility.** The “หน่วยงาน” count label was styled by `span:last-child`. A recently added jump-to-list link became the last child, leaving the label with low contrast on a dark background. The CSS now targets the correct direct second span independently of neighboring links. The full 140-case WCAG2.2-tag browser pass confirmed the correction.
3. **Stale shell regression test.** The switch-organization test still looked for the previous heading “เลือกหน่วยงานที่จะทำงาน”, although the redesigned live heading is “วันนี้จะทำงานกับหน่วยงานไหน?”. Updated only the obsolete test text; safe role navigation passed afterward for all three tested shell roles.
4. **Coverage blind spot.** The prior responsive suite exercised one primary role per route and only four widths. Expanded it to 1024px, enabled supported WCAG 2.2 AA axe tags and added a separate test for the 11 secondary authorized pairs; this closes *route–role–viewport* coverage, but not action–state completeness.

Relevant source changes: `frontend/src/modules/storefront/storefront-landing.module.css`, `frontend/src/modules/organizations/organization-view.module.css`, `frontend/e2e/quality-audit/responsive-a11y.spec.ts`, `authorized-route-role-coverage.spec.ts`, `theme-and-text-scaling.spec.ts`, `role-shell-actions.spec.ts`.

## Verification gates

| Test gate | Result |
| --- | --- |
| Primary responsive 28 × 5, Chromium | 140/140 CAPTURED |
| Additional authorized role combinations 11 × 5, Chromium | 55/55 PASS |
| Dark Theme and 200% root font representative matrix | 10/10 PASS |
| Modal matrices: 3 scenarios × 3 engines × 2 themes × 4 widths | 72/72 combinations PASS |
| Role shell menu and keyboard flows | 3/3 PASS |
| Sampled 503 recovery routes and skeleton | 2/2 Playwright tests PASS, containing 11 route recoveries |
| Auth, filters, Notifications/Audit and modal regressions | 5/5 Playwright tests PASS |
| Unit/component tests | **360/360 PASS** (91 files) |
| TypeScript / ESLint / production build / `git diff --check` | **PASS TypeScript / PASS ESLint / 30 of 30 Next.js routes / PASS diff-check** |

## Explicitly not certified

- **257 source-declared user-action IDs** (207 route actions and 50 shared-shell actions) have **zero exhaustive, all role × loading/empty/error/pending/validation/success/conflict/forbidden/keyboard-state matrices**. Earlier individual scoped browser proofs remain useful, but all-state certification is **NOT_TESTED**.
- Full end-to-end cross-browser coverage of all 39 route-role pairs is not claimed: the 195-case route matrix ran under **Chromium**; Firefox and WebKit were used for representative modal/focus matrices.
- Native browser zoom at 200%, OS display scaling, physical devices, VoiceOver/NVDA, cognitive usability interviews and human visual signoff remain **NOT_TESTED**. Root-font CSS scaling was sampled, but cannot replace native zoom.
- Production money/order/pickup/organization writes, persistence/idempotency, backend RBAC, third-party assets and security were not exercised here. All mutation-related browser tests used local fixtures/intercepts, not real business records.
- Tooltips and hover states that were not present in the sampled routes/states are not certified.
- No new animations, remote libraries, AI-generated images or unsupported server actions were introduced. API, tenant, RBAC, payment/order/pickup and infrastructure contracts are unchanged. **No Commit, Push, Deploy, database reset or remote data writes.**

**Next:** phase 13 is a separate end-to-end cross-role regression and asset/security review. Preserve all missing-state evidence and require backend-owned disposable fixtures before certifying transactional behavior.
