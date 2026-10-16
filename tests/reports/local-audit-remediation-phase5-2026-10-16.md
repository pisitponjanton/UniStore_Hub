# UniStore Hub — Local Audit Remediation Phase 5: Mobile Store Discovery & Nested Overflow

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 5
- **Status:** COMPLETED for local mobile shopping discovery, auth artwork containment and Audit filter/grid accessibility. Remaining Phase 6–8 and live AWS security/performance remain unverified.
- **Environment:** Existing localhost Docker Compose / LocalStack on the user's BDXA Mac, real Chromium via Playwright; **no AWS account, Deploy, Git Commit/Push, Docker reset or deletion of historical LocalStack records**.

## 1. Baseline from real Browser (before edits)

Measured absolute vertical positions in a 390px-wide Chromium viewport after storefront data loaded:

| Element | Before | After all Phase 5 edits | Improvement |
|---|---:|---:|---:|
| First real featured Store link | **1,951px** | **838px** | 1,113px earlier, ~57% |
| Directory heading `#storefront-heading` | **3,182px** | **1,130px** | 2,052px earlier, ~64% |
| First Store link inside paginated directory | **3,593px** | **1,542px** | 2,051px earlier, ~57% |
| Total document horizontal overflow | 0px | 0px | Remained clean |

Viewport height was 844px for the 390px baseline and comparison. First featured Store is now at the bottom edge of the first viewport; no claim that the *full store card* is visible without scrolling on every small phone. The storefront search and two primary actions remain available near the top.

Other widths measured after the main edit: at 320px first Store 996px and catalog 1313px, 360px first Store 922px/catalog 1213px, 430px first Store 845px/catalog 1137px; the final 390px extra compact-spacing edit moved first Store from 858px to 838px and catalog from 1150px to 1130px. Mobile/desktop automated acceptance uses viewport-appropriate limits, not a single arbitrary breakpoint.

**Desktop comparison:** 768px/1440px kept original hero illustration and all four featured Store cards, and displayed the non-interactive step-by-step purchase guide above featured discovery, as before.

## 2. Changes made, with owned files

- `frontend/src/modules/storefront/storefront-landing.module.css`
  - Mobile-only `max-width:620px`: tighter Hero, headline/body/gaps, a 2-column actions row (single column at ≤360px), compact search form and summary, hidden decorative Hero illustration, shortened featured-card height and discovery whitespace.
  - Put **one featured Store first**, then the searchable, paginated **full directory**, then the non-interactive “ซื้อและติดตามในที่เดียว” guide on small screens. The guide is visually repositioned using CSS flex order, not removed; desktop order and design remain unchanged. It contains no interactive buttons/links, so visual repositioning does not change the keyboard action order.
  - Hide other mobile featured cards visually (their shops are still available via the full directory), preserve all four on larger widths; a duplicated “ดูผลลัพธ์” CTA in the mobile search panel is hidden because the primary “ดูร้านที่เปิดอยู่” anchor and Enter-search behavior remain available.
  - Empty state, search/filter and pagination behavior is unchanged; no API-contract or commerce logic edits.
- `frontend/src/modules/auth/auth-form.module.css`
  - Reduce rotated desktop illustration's maximum effective width by 12px to avoid an observed **~4px nested overflow** in `.authVisual`/`.introBody` on Login/Register while preserving its original slight rotation. The page never had whole-document horizontal overflow.
- `frontend/src/modules/audit/audit-view.module.css`
  - Change 4-filter-grid → 2-column breakpoint from 1000px to **1180px**, because the authenticated sidebar leaves substantially less *content width* than viewport width at 1024px. Previously the filter row was the true unintended nested overflow, not the table.
  - Keep the **intentional** 820px-minimum Audit table within the focusable `overflow-x:auto` frame; no audit data density or horizontal scrolling behavior was removed.
- `frontend/e2e/mobile-layout-phase5.spec.ts` (**new**, read-only tests)
  - Verify Mobile storefront at 320/360/390/430px, early Store/Directory y-positions, full-page clipping, a visible real Store, search no-results and clearing filters.
  - Verify Tablet/Desktop 768/1440px hero/guide/store-card composition and no clipping.
  - Verify Login/Register at 320/390/1280/1440/1920px, including no nested illustration overflow and visible inputs.
  - Verify authenticated read-only Audit at 1024px: **two filter-grid columns without overflow**, horizontal table frame remains `tabIndex=0` and scrolls with ArrowRight.

## 3. Verified real Browser and Frontend Regression

| Check | Result |
|---|---|
| New targeted `e2e/mobile-layout-phase5.spec.ts` | **4/4 PASS**, no retries, 23.3s initial browser run |
| Final combined new Browser E2E + Guest/Audit matrix: `--workers=1 --retries=0` | **6/6 PASS**, 1.1min |
| Existing Guest role/viewport matrix (6 routes × 11 sizes = 66 measurements) | **PASS**; 0 geometry failures, **0 nested overflow**, 0 browser diagnostics |
| Existing Organization Audit role/viewport matrix (1 route × 11 sizes) | **PASS**; 0 geometry failures, **0 nested overflow**, 0 browser diagnostics |
| Existing Storefront Tracking anonymous and four authenticated roles | **5/5 PASS**, 0 retries, from earlier existing regression run |
| Frontend complete `npm test` | **299/299 PASS** across 80 files |
| Frontend `npm run lint` | **PASS**, no ESLint errors |
| Frontend `npx tsc --noEmit` | **PASS** |
| `git diff --check` | **PASS** |

The first existing Audit matrix *before its breakpoint correction* reported one nested-overflow case at 1024px while the keyboard-focusable table scrolled intentionally. We isolated the filter-grid width as the unintended overflow and re-ran: the final Guest and Audit matrix results both report `nestedOverflow=0`. This distinction prevents treating intended table scrolling as a defect.

Read-only Browser coordinate sampling also confirmed no document horizontal overflow at 320, 360, 390, 430, 768 or 1440px and direct link continuity to real Store URLs.

**Temporary/ignored proof on the BDXA Mac:** `/tmp/unistore-phase5-browser.log`, `/tmp/unistore-phase5-existing-e2e.log`, `/tmp/unistore-phase5-final.log`, and Playwright traces under their matching `/tmp/*` output directories. Ignored screenshot captures in `frontend/test-results/phase5-mobile-390.png`, `phase5-mobile-390-store.png` and `phase5-desktop-1440.png`. These are not permanent sandbox links and not committed artifacts.

## 4. Safety, boundaries and remaining work

- Source/config diff of **this Phase** is confined to the 3 listed Frontend CSS module files plus the newly added E2E spec and this report. Older pending changes to `WEB_QUALITY_AUDIT.md`, Backend/Frontend files from Phases 1–4 and `tests/reports/aws-live-validation-checklist.md` remain intact.
- The new Phase 5 E2E specs are **read-only**; the existing `organization-b-audit` matrix may create and business-cancel its own synthetic LocalStack Order as part of its pre-existing fixture. Do not claim that soft-cancel deletes historical records. No production data or remote payment is involved.
- This is Chromium emulation at specific viewport sizes, **not** certification on physical iPhone/Android/Safari VoiceOver/TalkBack. It confirms key flows/geometry and keyboard behavior but not full WCAG 2.2 AA conformance.
- Mobile repositioning places the **non-interactive** purchase guide after the catalog **visually**, while DOM reading sequence remains based on source markup; assess actual screen-reader narrative and consider a future semantic-reordering improvement if needed before accessibility certification.
- No wholesale Frontend redesign, account/login logic change, API change, AWS deployment, CloudFormation update or cloud security claim.
- **Phase 6 next:** offline AWS readiness hardening under the original Learner Lab constraints, no account access or live writes. **Phase 7:** full local combined Chromium suite including new Phase 5 tests, contract/security and report updates; the original “67” historical count is expected to change because Phase 3 split inventory into five tests and Phase 5 added four new tests.
- `tests/reports/aws-live-validation-checklist.md`: every live AWS check still **NOT RUN**. Production security/backup/restore/rollback and HTTPS real-user use remain **NO-GO / NOT CERTIFIED**.

**Phase 5 local acceptance: PASS.** Do not start Phase 6 or Commit/Push unless separately requested.
