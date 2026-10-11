# UniStore Hub — Production Readiness Phase 2: Cross-Browser & Accessibility Evidence

- Date: **2026-10-11 (Asia/Bangkok)**
- Workspace: `UniStore_Hub`
- bdxa Workspace Plan: **UniStore Hub — Production Readiness & Quality Assurance**, Phase 2
- Baseline Git revision at phase start: `15a8db0` + uncommitted Phase 1 test changes
Environment: local Docker Compose + persistent LocalStack, macOS Apple Silicon, Playwright headless Chromium, Firefox and WebKit.

## Phase disposition

**COMPLETED FOR THE SCOPED AUTOMATED TESTS. NOT A PRODUCTION / WCAG CERTIFICATION.**

Firefox Playwright 142.0.1 and WebKit Playwright 26.0 were installed on the existing machine. Chromium was already present. The existing Docker Compose stack was not running at the start of Phase 2; `docker compose -f docker-compose.dev.yml up -d` restored it and retained the persistent `scripts/dev/.state/localstack` directory, with no reset, purge or deletion. LocalStack remains a development substitute; the Phase 1 unsigned-S3 privacy blocker was not changed or resolved.

Browser projects are opt-in using `E2E_ENABLE_CROSS_BROWSER=1` in `frontend/playwright.config.ts`; the default `npm run test:e2e` continues using Chromium only, so existing pipelines are not forced to download other browsers.

## Executed route/viewport matrix

The executable source is `frontend/e2e/route-viewport-matrix.spec.ts`.

| Role / surface group | Distinct routes | Viewport pairs per browser | Firefox | WebKit |
|---|---:|---:|---|---|
| Anonymous / Guest | 6 | 11 | PASS | PASS |
| Customer | 6 | 11 | PASS | PASS |
| Staff | 5 | 11 | PASS | PASS |
| Organization Admin, core | 7 | 11 | PASS | PASS |
| Organization Admin, operations | 5 | 11 | PASS | PASS |
| Organization Admin, Audit | 1 | 11 | PASS | PASS |
| Platform Admin, Summary | 1 | 11 | PASS | PASS |
| Platform Admin, Organizations | 1 | 11 | PASS | PASS |
| Platform Admin, Users | 1 | 11 | PASS | PASS |
| **Total** | **33 role/route surfaces; 28 unique routes** | **11 sizes** | **363 PASS measurements** | **363 PASS measurements** |

Required viewport pairs (width × height): **320×568, 360×800, 375×667, 390×844, 430×932, 768×1024, 820×1180, 1024×768, 1280×800, 1440×900 and 1920×1080**.

**726 new Firefox + WebKit DOM viewport measurements** completed, with no confirmed document-level horizontal overflow, horizontally clipped visible heading/control or unnamed visible form control. Every role/surface also received automated axe-core WCAG 2.0/2.1 A/AA checks at **390×844 and 1440×900** (66 checks per browser, **132 automated cross-browser axe scans**) with zero confirmed final automated violations in tested DOM.

Important scope notes: Audit and Platform Users tables use bounded axe sampling excluding `tbody tr:nth-child(n+4)` because accumulated test records make exhaustive scans impractical; normal route/viewport DOM measurements were performed at every size. Intentional closed mobile drawers are excluded from clipping counts. A legitimate wide Audit table has keyboard-accessible internal horizontal scrolling; its table contents do not cause document-level overflow.

Platform Admin was split into three independently repeatable matrix groups because attempting to scan all three high-data-density Platform routes as one job exceeded remote command execution limits. Each route **was successfully scanned separately** at all 11 sizes; this reduces orchestration size without reducing viewport coverage. The previous Chromium Phase 9 full 363-point baseline stands; Phase 2 also reran Chromium Guest, Platform Summary and Platform Users at the 11 sizes (3/3 focused matrix groups passed).

### Scoped keyboard / interactive workflow evidence

| Browser | Critical responsive interactions | Auth/validation/unsafe redirects | Guest→Login→Checkout return context | Image/no-image media tests |
|---|---|---|---|---|
| Firefox | **5/5 PASS** at 320, 375, 768, 1024, 1440px | **3/3 PASS** | **1/1 PASS** | **2/2 PASS** |
| WebKit | **5/5 PASS** at 320, 375, 768, 1024, 1440px | **3/3 PASS** | **1/1 PASS** | **2/2 PASS** |
| Chromium (focused phase 2 regressions) | **2/2 PASS** at 320, 1440px | Phase 9 / prior baselines | Prior test coverage | Phase 9 / prior baselines |

Interactive cases include payment-slip input and submission button, mobile drawer open/close and focus restoration, Staff Payments filter/selected row, approve/cancel confirmation dialog, and Organization Admin Audit table reachability. Asset-focused tests check no-photo placeholders, label contrast, positive quantity pricing, real-image `object-fit: contain` and lack of viewport overflow.

### Browser-specific findings and resolution

1. **Firefox `NS_BINDING_ABORTED` and WebKit `cancelled` diagnostics (TEST-HARNESS FIXED).** Rapid authorized page navigation cancels in-flight local GET requests differently per engine. The original fixture treated them as network failure while Chromium classified its `net::ERR_ABORTED` as a navigation abort. `frontend/e2e/support/qa-fixture.ts` now classifies those precise codes as `request-aborted` **only for GET requests to the local API or Next.js static assets**, preserving event evidence. Other request failures, HTTP 4xx/5xx (subject to explicitly expected negative tests) and all page errors remain monitored.
2. **Sequential focus behavior (TEST ADAPTED).** In Gecko and WebKit, programmatically focusing a button and then pressing Tab/Shift+Tab did not consistently reselect the same button due to sequential-focus anchoring/browser keyboard policy. The actual keyboard sequence is now tested **from the preceding file input**, with expected focus and focus-visible outline on the Submit button. The WebKit/macOS path uses `Option+Tab` / `Option+Shift+Tab` for full-control keyboard navigation. Passed in both Firefox and WebKit at 320px and 1440px. Actual Safari.app/macOS keyboard preference settings were **not manually verified**.
3. **Firefox subpixel touch-target rounding (TEST ADAPTED).** A 44px CSS-height button returned `43.999969px` from `getBoundingClientRect()` at 375px. The test now accepts 0.01px rounding tolerance while still requiring exact `--control-height: 44px` / `--target-min: 44px`. No smaller CSS target was introduced.
4. **Nested overflow observations (MONITOR).** Desktop Login/Register content on Chromium/Firefox/WebKit has non-root nested scroll-width observations. WebKit Production's `#production-campaign-id` input shows internal text overflow at several widths; Firefox Org Products filter and WebKit Staff editing buttons also appeared in a nested-overflow diagnostic at 1024px. Neither DOM scan found page-level horizontal overflow or horizontally clipped visible controls. Manual screenshot examination is **pending** before treating all nested cases as visual defects or approved exceptions.
5. **No verified application presentation or business-logic bug requiring a source fix** was found in the exercised new browser matrix. Changes were limited to test-harness diagnostics, opt-in browser configuration, bounded dense-data matrix partitioning, responsive focus/rounding assertions and documentation.

## Reproduce Phase 2 tests

From `frontend/` after the canonical local `docker compose -f docker-compose.dev.yml up -d` (from the repository root):

```bash
npx playwright install firefox webkit
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/route-viewport-matrix.spec.ts --project=firefox
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/route-viewport-matrix.spec.ts --project=webkit
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/responsive-interactions.spec.ts --project=firefox
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/responsive-interactions.spec.ts --project=webkit
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/storefront-media-accessibility.spec.ts --project=webkit
```

The matrix uses nine test groups per browser. If remote command execution is limited to 60 seconds, run `--grep 'matrix platform-users'`, `--grep 'matrix organization-b-audit'` or other individual group selectors. Each run attaches JSON measurements and diagnostic evidence to ignored Playwright test-results; binaries are installed in the machine's Playwright browser cache, not committed to the repository.

## Real-device and assistive technology work — NOT TESTED

Playwright WebKit is **not** the shipping Safari.app, and emulated viewports are **not** physical iPhone/iPad/Android devices. The following must be performed manually in an authorized staging environment or a prepared physical-device lab:

1. **iOS Safari/iPadOS Safari and Android Chrome** — open the public Landing, Store, Campaign and Product; rotate portrait/landscape; test zoom 200%, text-size scaling, form keyboard overlap, sticky checkout button, file picker/camera permission, long scroll and click/touch target reachability.
2. **macOS Safari.app, Firefox desktop UI and Windows Chrome/Edge** — test real browser zoom, Back/Forward, print/download, file picker, modal overlay clipping, focus ring, reduced-motion and responsive cutoffs. The automated WebKit engine does not prove Safari.app parity.
3. **macOS VoiceOver or iOS VoiceOver** — enable the screen reader *with a human tester*, navigate by headings, landmarks and form labels, read authentication validation, checkout totals and failed-upload errors, inspect Campaign/Product price semantics, and operate menu/dialogs via keyboard; record announcements and focus order.
4. **Android TalkBack / Windows NVDA** — repeat core Customer, Staff and Admin role tasks and record interaction obstacles, active state announcements, keyboard shortcuts and dialog restoration.
5. **Manual visual appraisal** — inspect representative screenshots at 320×568, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080, with particular attention to dense Audit/Platform tables, Login/Register content and `#production-campaign-id` internal scrolling. Automated no-overflow assertions are not pixel-by-pixel visual approval.
6. **WCAG 2.2 AA / 4.5:1 gradient review** — manually confirm contrast over gradients and image-backed sections, 24px minimum target-size exceptions, reflow, forced-colors, high-contrast settings and user-adjusted fonts. Automated axe-core WCAG 2.0/2.1 A/AA is necessary but not sufficient.

**Status: MANUAL/BROWSER-APP HARDWARE CHECKS PENDING, NO ACCESSIBILITY CERTIFICATION.**

## Final regression gates executed in this phase

| Gate | Observed result |
|---|---|
| Firefox + WebKit route/role responsive matrix | **18/18 group runs passed**, 726 measurements, 132 sampled automated axe checks |
| Firefox + WebKit responsive critical interactions | **10/10 passed** (five viewports × two engines) |
| Firefox + WebKit focused auth/return tests | **8/8 passed** (3 auth/validation tests + 1 guest return test per engine) |
| Firefox + WebKit storefront media checks | **4/4 passed** |
| Chromium focused matrix rerun | **3/3 passed** (Guest, Platform Summary, Platform Users) |
| Chromium focused interaction rerun | **2/2 passed** at 320px and 1440px |
| Frontend Vitest | **292/292 passed**, 80 files |
| Backend Node Unit Tests | **287/287 passed** |
| ESLint and TypeScript | **PASS** |
| Next.js Production Build/Static Export | **PASS**, 30 generated static app routes |
| `git diff --check` | **PASS** |

The earlier Chromium Phase 9 matrix is a prior baseline, not a full new Chromium matrix execution in this phase. Firefox and WebKit tests used locally installed Playwright browser builds, not the shipping standalone browsers. Real-device and manual assistive technology tests remain **NOT TESTED**.

## Safety, outstanding blockers and next phase

- Only the local Docker Compose stack and locally installed Playwright binaries were used. No new remote port, real AWS/STAGING access, push, deploy, commit or database reset occurred.
- Browser role tests may create disposable local accounts/orders and cancel self-created orders when possible. Older LocalStack records remain persistent; no bulk cleanup was attempted.
- All Phase 1 blockers remain in `tests/reports/production-readiness-phase1-2026-10-11.md`: 5 legacy live E2E TODO, 2 file-contract TODO, 3 local smoke TODO and 9 AWS smoke TODO. This Phase 2 evidence does not close them.
- Follow-up Phase 3: benchmark measurable performance, load behavior and scaling against the canonical persistent LocalStack/dev environment; do not invent Lighthouse or Core Web Vitals results.
