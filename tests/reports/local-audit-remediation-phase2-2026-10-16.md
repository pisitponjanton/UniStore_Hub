# UniStore Hub — Local Audit Remediation Phase 2: Platform Admin Loading & API Performance

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace Plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 2
- **Status:** COMPLETED for the *targeted local Platform Admin performance, state and navigation scope*. Overall 67-case full regression and real AWS production acceptance are **NOT** signed off.
- **Runtime:** Existing Docker Compose development environment on localhost:3000/4000, LocalStack DynamoDB. No AWS account accessed, no Compose rebuild/reset or deletion of existing data, no commit/push.

## 1. Baseline and reproduced problems

Previous 2026-10-16 live authenticated measurements against the populated local development dataset:

| Check | Before Phase 2 (single preceding run) |
|---|---:|
| GET /api/v1/platform/summary | 2,649 ms, HTTP 200 |
| GET /api/v1/platform/users | 4,585 ms, HTTP 200, 189,888 bytes |
| Chromium Summary h1 visible | 16,424 ms |
| Chromium Users h1 visible | 6,954 ms |

The original Platform Admin E2E failed on headings/navigation after 5-second assertions. During Phase 2, the first optimization shortened normal API latency, but controlled browser repeats **still** exhibited occasional load-state/assertion timeouts, especially with Next.js development-server resource loading. A failed trace showed loading screens and aborted in-flight API requests; other failure screenshots showed expected destination headings present by the time failure artifacts were collected. These observations distinguish **slow/transient completion** from a consistently broken route, but the precise impact of host contention, dev compilation and navigation timing on each failed attempt cannot be conclusively isolated.

## 2. Backend correction (owned files in backend/)

**Changed:**
- `backend/src/aws/dynamodb.js` — add table-scoped `BatchGetCommand` adapter returning items and unprocessed keys.
- `backend/src/modules/users/user.repository.js` — `getManyByIds` partitions distinct User profile keys into groups of at most 100, retries unprocessed keys with bounded exponential delay, restores caller/index order and represents a missing record as null.
- `backend/src/modules/platform-admin/platform-admin.service.js` — validate complete PlatformUserLink index before reads; use batch read for real repository, preserve fail-closed error on missing profiles, existing UserDTO mapping/status counts/order. For injected legacy/test repositories lacking `getManyByIds`, use bounded 12-way reads rather than unbounded concurrency.

**Preserved:** `GET /platform/users` and `GET /platform/summary` response envelopes/DTOs and counts, tenant restrictions, Platform Admin authorization, User index and Organization scope; no DynamoDB schema or new AWS resources. No private passwordHash or PK/SK exposed. Existing read-only Platform User view semantics preserved.

Actual local post-BatchGet measurement, **three sequential HTTP 200 samples per endpoint**:

| API | Post-change samples (ms) | Mean | Approximate reduction vs earlier one-run baseline |
|---|---|---:|---:|
| Summary | 557, 484, 428 | **490 ms** | **81%** |
| Users | 368, 370, 387 | **375 ms** | **92%** |

Summary payload stayed **110 bytes**; Users payload stayed **189,888 bytes**. These are *local and nonstatistical* before/after comparisons; no claims about production p95 or user-perceived latency. The full User list remains a relatively large response; consider pagination only through a **separate API-contract decision**, not silently here.

## 3. Frontend loading and E2E correction (owned files in frontend/)

**Changed:**
- `frontend/src/modules/platform-admin/platform-summary-view.tsx` and `platform-users-view.tsx`: each displays its correct semantic page `h1` and helpful Loading State **while data is being fetched**. Error/Unauthorized/Forbidden states remain separate. Data-specific totals and rows still require a successful real API response; headings alone do **not** mean the API succeeded.
- Corresponding `*.test.tsx`: add regression assertions that the semantic page heading and loading indicator are present while an API Promise remains unresolved.
- `frontend/e2e/platform-admin.spec.ts`: scope the readiness behavior to the affected Platform Admin cross-page journey; `domcontentloaded` rather than all development-only subresources at initial navigation/back; explicit bounded assertions for actual summary counts (**20 seconds**) and destination route headings (**20 seconds**); scenario budget **90 seconds**. The test still asserts persisted totals match backend, all expected navigation destinations, role denial and diagnostic safety. It cannot pass just by rendering the initial loading heading.

**Why timeouts are adjusted:** Repeated normal Chromium runs before this change had failures on a single 5-second expectation or a default `load` navigation while subsequent evidence displayed the actual expected state. Backend request fanout was independently fixed first. The targeted E2E still fails if required real API data or authorization state never becomes available; extending timeout alone was not considered a performance fix.

## 4. Verified regression results

| Test | Outcome |
|---|---|
| Backend `npm test` | **297 PASS / 0 FAIL** |
| Backend syntax `npm run check` | **177 JavaScript files passed** (latest syntax run) |
| Frontend `npm run test -- src/modules/platform-admin` | **12 PASS / 0 FAIL** across 5 files |
| Frontend `npx tsc --noEmit` | **PASS** |
| Targeted Playwright `e2e/platform-admin.spec.ts` navigation case; `--workers=1 --retries=0 --repeat-each=3` | **3/3 PASS, 0 retries**, 1.0 min |
| `git diff --check` | **PASS** |

The earlier trial of the 3-repeat case before stabilizing the load-state assertions had 3 FAIL under the previous default 5s conditions. A subsequent 3-repeat run with partial adjustments had 1 PASS/2 FAIL. The **final** verified command resulted in 3 clean PASS. Historical failures are **not erased** by the later positive result.

Latest final browser evidence is in the BDXA Mac's temporary directory `/tmp/unistore-phase2-final-repeat/` and earlier failure traces in `/tmp/unistore-phase2-resume-repeat/`; do not claim these are permanently published files. No source artifact screenshots/traces were added to Git. Tests did not deliberately create Order/Payment/Pickup transactions during this phase.

## 5. Integrity and remaining handoff

- Git changes for this phase are restricted to `backend/src/aws/dynamodb.js`, `backend/src/modules/users/user.repository.js`, `backend/src/modules/platform-admin/platform-admin.service.js`, `backend/tests/platform-admin.test.js`, `backend/tests/primitives.test.js`, `frontend/src/modules/platform-admin/platform-summary-view.tsx`, `frontend/src/modules/platform-admin/platform-users-view.tsx`, their two view tests and `frontend/e2e/platform-admin.spec.ts`.
- Original pending changes to `WEB_QUALITY_AUDIT.md` and previously created `tests/reports/aws-live-validation-checklist.md` and `tests/reports/local-audit-remediation-phase1-2026-10-16.md` remain preserved; no unrelated cleanup.
- **Phase 3 pending:** 28-route Inventory internal `test.setTimeout(55_000)`, verification of disposable test-owned pending orders and request-context-safe cleanup; do **not** bulk cancel unidentified historical LocalStack records.
- **Phase 4 pending:** broader four flaky cross-role cases; do not infer they are all resolved by this narrow Platform fix.
- **Phase 5 pending:** mobile storefront discovery / nested overflow.
- **Phase 6–7 pending:** offline AWS hardening, full **67 distinct-case** Chromium regression, contract/security and final audit update.
- **AWS live tests:** All still `NOT RUN` in `tests/reports/aws-live-validation-checklist.md`. Real AWS security/performance and real-user production readiness still **NO-GO / NOT CERTIFIED**.

**Phase 2 targeted local acceptance: PASS.** Do not proceed to Phase 3 automatically or commit/push without another user instruction.
