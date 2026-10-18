# Local Ux Audit 2026 10 16

Consolidated reference for feature-focused QA. Records are retained as separate dated observations; earlier metrics may be superseded by later results. Refer to `../../frontend/quality-audit/frontend-qa-signoff.md` for final scoped QA scope, and the root `../../WEB_QUALITY_AUDIT.md` for remaining gaps.

## Contents

- [Local Audit Remediation 2026 10 16](#record-01-local-audit-remediation-2026-10-16)
- [Local Audit Remediation 2026 10 16](#record-02-local-audit-remediation-2026-10-16)
- [Local Audit Remediation 2026 10 16](#record-03-local-audit-remediation-2026-10-16)
- [Local Audit Remediation 2026 10 16](#record-04-local-audit-remediation-2026-10-16)
- [Local Audit Remediation 2026 10 16](#record-05-local-audit-remediation-2026-10-16)
- [Local Audit Remediation 2026 10 16](#record-06-local-audit-remediation-2026-10-16)
- [Local Audit Remediation 2026 10 16](#record-07-local-audit-remediation-2026-10-16)
- [Local Audit Remediation 2026 10 16](#record-08-local-audit-remediation-2026-10-16)


---

<a id="record-01-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Local Audit Remediation, Phase 1: Baseline, Ownership & Reproduction

- **Date:** 2026-10-16 (Asia/Bangkok)
- **BDXA workspace plan:** `UniStore Hub — Local Audit Remediation & AWS Handoff`, Phase 1
- **Environment:** only already-running `docker-compose.dev.yml` / Next.js Dev + Express API + LocalStack on loopback
- **Outcome:** **PHASE 1 BASELINE CAPTURED**; Phase 2–7 code fixes and full clean regression are **NOT STARTED**.
- **Scope:** read-only repo, API and DynamoDB inspection; narrow browser E2E cases that only navigate/inspect. **No source code edits, no test-created orders in this Phase, no LocalStack reset/delete, no AWS calls, no commit/push.**

#### 1. Canonical source and ownership review

Read and cross-checked:
- `SPEC.md`, `AGENTS.md`, `docs/specs/00-shared-contracts.md`
- `docs/specs/frontend/SPEC.md`, `docs/specs/backend/SPEC.md`, `docs/specs/data/SPEC.md`, `docs/specs/testing/SPEC.md`, `docs/specs/integration/SPEC.md`, `docs/architecture/AWS_ARCHITECTURE.md`
- `frontend/AGENT.md`, `backend/AGENT.md`
- `../../WEB_QUALITY_AUDIT.md` §§18–21; `tests/reports/production-readiness-2026-10-11.md#record-03-production-readiness-2026-10-11` and other previous handoffs.

Ownership:
- Frontend agent: `frontend/**` (pages, loading/UX, `frontend/e2e/**` subsystem-local browser tests).
- Backend agent: `backend/**` (Platform Admin queries/authorization/repositories).
- Testing agent: `tests/**` cross-system tests and evidence, no arbitrary edits to application.
- Integration/root: shared spec/contract reconciliation, final diff and cross-subsystem compatibility.
- Infrastructure and Deployment remain limited to the approved Learner Lab architecture; live AWS validation is deferred to `tests/reports/aws-live-validation-checklist.md`.

#### 2. Initial Git and Docker baseline

At Phase 1 entry, Git status listed ONLY:
- ` M WEB_QUALITY_AUDIT.md` — pre-existing uncommitted audit content; **preserve**.
- `?? tests/reports/aws-live-validation-checklist.md` — user-requested deferred AWS checklist; **preserve**.

Services already running at start:
- Backend `127.0.0.1:4000`: healthy.
- Frontend `127.0.0.1:3000`: healthy.
- LocalStack `127.0.0.1:4566`: healthy.
- Worker: running. Seed and Bootstrap: exited **0** as expected.

Fresh **read-only** HTTP observations:
- `GET /health`: **200**, ~**2.6 ms** at the observed instant.
- `GET /api/v1/storefront/directory`: **200**, **701 ms**, response body about **151,080 bytes**.
- `GET /` on Frontend: **200**, **39 ms** to receive HTML. This is not time to browser hydration/data-ready state.

The current Phase 1 did **not** run application mutations or a Docker build/restart.

#### 3. Platform Admin performance — code path and reproduction

`backend/src/modules/platform-admin/platform-admin.service.js`:
- `listAllUsers()` paginates through all PlatformUserLink records.
- It then loops over each link and **awaits `userRepository.getById(link.userId)` sequentially**. This creates an N+1 read pattern.
- `getSummary()` calls `listAllOrganizations()` and the same `listAllUsers()`; hence even count-only Summary pays the all-user full-profile read cost.
- `listUsers()` returns all User DTOs. The frontend `platform-users-view.tsx` renders the result after its full API request completes; `platform-summary-view.tsx` similarly waits for a full Summary API response.
- **Hypothesis, not yet proven as unique root cause:** sequential per-user reads and lack of pagination/aggregation are likely to dominate as test user records accumulate. Investigate data-contract compatibility before changing the API.

Preserved **prior same-day authenticated diagnostic evidence** in `/tmp/unistore-fullqa-8smodgef/platform-timing.log`:
- Login: 200 in **435 ms**.
- `GET /api/v1/platform/summary`: 200 in **2,649 ms**.
- `GET /api/v1/platform/users`: 200 in **4,585 ms**; **189,888-byte** payload.
- Chromium Platform Summary heading visible after **16,424 ms**; Platform Users heading after **6,954 ms** with 25s waits.
- An original Playwright case failed its 5s title assertion; its isolated rerun also failed on different navigation stages, corroborating intermittent latency but not necessarily an authorization bug.
- These times were from an earlier same-day run, **not newly measured authenticated timings in this Phase**.

**Fresh Phase 1 narrow, read-only Playwright reproduction:**
```text
e2e/platform-admin.spec.ts
  grep: Platform Admin can navigate
  --workers=1 --retries=0
  Result: 1 PASS in 19.1s (suite wall time)

e2e/staff-operational.spec.ts
  grep: Staff can select the seed Organization
  Result: 1 PASS in 7.7s

e2e/storefront-tracking-navigation.spec.ts
  grep: authenticated platformAdmin tracking
  Result: 1 PASS in 2.3s
```
All three were **read-only navigation** cases and ran with isolated output under `/tmp/unistore-phase1-*-readonly`. PASS in these narrow reruns **does not erase** earlier 4 FLAKY + 1 FAIL; it supports timing/contention sensitivity and requires Phase 2/4 profiling under repeated controlled runs. The mutation-heavy Payment Approval case and Guest Matrix were **not rerun in this baseline Phase**; archived traces and error snapshots from the previous full E2E suite are preserved, without inventing new reproduction.

#### 4. Interaction Inventory hard timeout / cleanup-risk verification

`frontend/e2e/interaction-inventory.spec.ts`:
- Explicit `test.setTimeout(55_000)` overrides an attempted `--timeout=180000` command-line default.
- It visits **28 routes serially**, waits after every navigation and reads visible controls, then calls `cancelPendingOrder(request, orderId)` in `finally`.
- Prior archived full-suite and targeted rerun failed at 55s, and teardown disposed the request context before cleanup succeeded. `frontend/test-results/interaction-inventory.json` is still **absent** in the new inspection.
- **Confirmed test design weakness:** one slow serial 28-route test coupled to the same timeout-constrained Playwright request context for teardown. A failed request does not establish that every corresponding Order was left pending.
- Required in Phase 3: defensible batching or per-test budgets, record exactly owned disposable order IDs before use, robust and verified cleanup with valid context, independent state check. Do not simply extend a global timeout; do not cancel unknown historical records.

#### 5. Read-only LocalStack order inventory (data safety)

Against the **single seeded organization** `55555555-5555-4555-8555-555555555555`, ran read-only DynamoDB Query with limited projection (status, createdAt, customerId, orderId); no Scan of all tenants, no write, no deletion.

| Scope | Count |
|---|---:|
| Orders currently under this demo organization (all dates) | **564** |
| Orders with `createdAt` starting `2026-10-16` | **31** |
| Status for those 31 | 12 PENDING_PAYMENT, 8 CANCELLED, 7 PAYMENT_REVIEW, 3 PAID, 1 PAYMENT_REJECTED |
| Orders created Oct 16 by known seed Customer | **4** |
| Known seed Customer Oct 16: PENDING_PAYMENT | **3** |
| Known seed Customer Oct 16: CANCELLED | **1** |

**Classification:** three `PENDING_PAYMENT` seed-customer Orders from today are **possible** abandoned E2E inventory records, but attribution to any specific test is **NOT PROVEN** because the test does not record a run marker / exact owned IDs in durable evidence. Other QA runs can share the seeded Customer. **DO NOT cancel/delete these three solely from this report.** Correlate logs, creation windows, distinct order IDs and fixtures before any cleanup, and obtain explicit approval for destructive correction where appropriate. This phase changed no order state.

Read-only query method: `docker compose -f docker-compose.dev.yml exec -T backend node -e ...` with AWS SDK `QueryCommand` on the seeded organization partition, `SK` prefix `ORDER#`, using existing container-configured LocalStack endpoint. Printed only aggregate counts to avoid leaking customer records.

#### 6. Source ownership / corrective handoff

| Finding | Suspected code owner | Work in next phase | Phase |
|---|---|---|---|
| Platform Summary and Users slow loading; backend N+1 per-user lookups | Backend + Frontend jointly, root integration contract check | Profile reads/query pagination and presentation; preserve current role gate and DTO/API surface; measure before/after | 2 |
| 28-route E2E inventory exceeds 55s; cleanup context disposed | Frontend E2E and Testing verification | Split/limit tests, fix teardown, record owned fixtures, verify cleanup, rerun real inventory | 3 |
| Payment approval success feedback not visible in time | Frontend organization payments + E2E | Confirm authoritative payment/order transitions vs ephemeral toast and wait sequence | 4 |
| Staff selector and Platform storefront tracking navigation intermittent | Frontend session/navigation + E2E | Instrument hydration/transition; semantic waits, controlled latency and no duplicated actions | 4 |
| Guest matrix sometimes lacks first h1 | Frontend rendering + E2E/a11y | Verify async headings/error/empty states and harness waits without weakening accessibility assertions | 4 |
| Mobile home first store link at ~1951px; full directory begins ~3182px (390px view) | Frontend | Task-first discovery reordering, verify real search/filter/empty states and desktop identity | 5 |
| Login/Register nested overflow, Audit table 1024px | Frontend | Visual/keyboard check first; fix only actual clipping; allow intended horizontal-scroll table | 5 |
| JWT CLI args, S3 release rollback/data backup design, AWS-only proof | Deployment/Infra/Integration + Testing | Offline hardening and explicit AWS live checklist; no AWS access without separate owner authorization | 6 / AWS deferred |

#### 7. Phase decision / gates

- Phase 1 baseline, source ownership, previous full-suite failed/flaky evidence and read-only data classification: **COMPLETED**.
- Platform performance root cause: **hypothesis to validate Phase 2**; fresh narrow Platform Browser test PASSED, which emphasizes intermittent rather than consistently broken navigation.
- Inventory/test cleanup: **known blocking test-design defect**; possible remaining LocalStack Order fixtures are NOT attributable yet; **no deletion authorized**.
- No source edits, no AWS calls, no Commit/Push. Original WEB_QUALITY_AUDIT.md §§1–21 and the AWS checklist remain untouched.
- **Next authorized task:** Phase 2 — Platform Admin Loading & API Performance only. Do not start it as part of completing Phase 1.

---

<a id="record-02-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Local Audit Remediation Phase 2: Platform Admin Loading & API Performance

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace Plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 2
- **Status:** COMPLETED for the *targeted local Platform Admin performance, state and navigation scope*. Overall 67-case full regression and real AWS production acceptance are **NOT** signed off.
- **Runtime:** Existing Docker Compose development environment on localhost:3000/4000, LocalStack DynamoDB. No AWS account accessed, no Compose rebuild/reset or deletion of existing data, no commit/push.

#### 1. Baseline and reproduced problems

Previous 2026-10-16 live authenticated measurements against the populated local development dataset:

| Check | Before Phase 2 (single preceding run) |
|---|---:|
| GET /api/v1/platform/summary | 2,649 ms, HTTP 200 |
| GET /api/v1/platform/users | 4,585 ms, HTTP 200, 189,888 bytes |
| Chromium Summary h1 visible | 16,424 ms |
| Chromium Users h1 visible | 6,954 ms |

The original Platform Admin E2E failed on headings/navigation after 5-second assertions. During Phase 2, the first optimization shortened normal API latency, but controlled browser repeats **still** exhibited occasional load-state/assertion timeouts, especially with Next.js development-server resource loading. A failed trace showed loading screens and aborted in-flight API requests; other failure screenshots showed expected destination headings present by the time failure artifacts were collected. These observations distinguish **slow/transient completion** from a consistently broken route, but the precise impact of host contention, dev compilation and navigation timing on each failed attempt cannot be conclusively isolated.

#### 2. Backend correction (owned files in backend/)

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

#### 3. Frontend loading and E2E correction (owned files in frontend/)

**Changed:**
- `frontend/src/modules/platform-admin/platform-summary-view.tsx` and `platform-users-view.tsx`: each displays its correct semantic page `h1` and helpful Loading State **while data is being fetched**. Error/Unauthorized/Forbidden states remain separate. Data-specific totals and rows still require a successful real API response; headings alone do **not** mean the API succeeded.
- Corresponding `*.test.tsx`: add regression assertions that the semantic page heading and loading indicator are present while an API Promise remains unresolved.
- `frontend/e2e/platform-admin.spec.ts`: scope the readiness behavior to the affected Platform Admin cross-page journey; `domcontentloaded` rather than all development-only subresources at initial navigation/back; explicit bounded assertions for actual summary counts (**20 seconds**) and destination route headings (**20 seconds**); scenario budget **90 seconds**. The test still asserts persisted totals match backend, all expected navigation destinations, role denial and diagnostic safety. It cannot pass just by rendering the initial loading heading.

**Why timeouts are adjusted:** Repeated normal Chromium runs before this change had failures on a single 5-second expectation or a default `load` navigation while subsequent evidence displayed the actual expected state. Backend request fanout was independently fixed first. The targeted E2E still fails if required real API data or authorization state never becomes available; extending timeout alone was not considered a performance fix.

#### 4. Verified regression results

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

#### 5. Integrity and remaining handoff

- Git changes for this phase are restricted to `backend/src/aws/dynamodb.js`, `backend/src/modules/users/user.repository.js`, `backend/src/modules/platform-admin/platform-admin.service.js`, `backend/tests/platform-admin.test.js`, `backend/tests/primitives.test.js`, `frontend/src/modules/platform-admin/platform-summary-view.tsx`, `frontend/src/modules/platform-admin/platform-users-view.tsx`, their two view tests and `frontend/e2e/platform-admin.spec.ts`.
- Original pending changes to `../../WEB_QUALITY_AUDIT.md` and previously created `tests/reports/aws-live-validation-checklist.md` and `tests/reports/local-ux-audit-2026-10-16.md#record-01-local-audit-remediation-2026-10-16` remain preserved; no unrelated cleanup.
- **Phase 3 pending:** 28-route Inventory internal `test.setTimeout(55_000)`, verification of disposable test-owned pending orders and request-context-safe cleanup; do **not** bulk cancel unidentified historical LocalStack records.
- **Phase 4 pending:** broader four flaky cross-role cases; do not infer they are all resolved by this narrow Platform fix.
- **Phase 5 pending:** mobile storefront discovery / nested overflow.
- **Phase 6–7 pending:** offline AWS hardening, full **67 distinct-case** Chromium regression, contract/security and final audit update.
- **AWS live tests:** All still `NOT RUN` in `tests/reports/aws-live-validation-checklist.md`. Real AWS security/performance and real-user production readiness still **NO-GO / NOT CERTIFIED**.

**Phase 2 targeted local acceptance: PASS.** Do not proceed to Phase 3 automatically or commit/push without another user instruction.

---

<a id="record-03-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Local Audit Remediation Phase 3: Inventory E2E Reliability & Safe Cleanup

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace:** `UniStore_Hub` / BDXA current plan Phase 3
- **Status:** COMPLETED — targeted local Inventory browser, artifact readiness, timeout recovery and cleanup verified.
- **Scope:** Existing localhost Docker Compose frontend/backend and LocalStack only. No AWS, no production data, no database reset, no historical-order deletion, no commit/push.

#### 1. Original defect and correction

Original `frontend/e2e/interaction-inventory.spec.ts` defined one test with a hard-coded `test.setTimeout(55_000)`, serially visited 33 role-specific renderings of 28 canonical routes, waited 600ms per page, created a Customer pending Order, and attempted cancellation in `finally` with the Playwright `request` fixture. On a timeout that request context had already been disposed; historical retries failed and `frontend/test-results/interaction-inventory.json` was missing.

**Implemented only inside `frontend/e2e/interaction-inventory.spec.ts`:**

1. Split the 33 route cases into **five serial role-scoped tests**: Anonymous 6, Customer 7, Organization Admin 13, Staff 4, Platform Admin 3. Per-role budget 90s; setup has separate 60s budget, teardown has separate 90s budget. No single global 55s test. Retain full canonical route table and 28-distinct-path acceptance.
2. Create exactly **one new disposable Order for the inventory run**, not a shared historical Order. Immediately write a **unique run-owned JSON journal** under Git-ignored `frontend/test-results/interaction-inventory-owned-order-<runId>.json`, including its exact Order ID, organization, owner role, timestamp and pending cleanup state.
3. In `test.afterAll`, allocate a **new independent Playwright APIRequestContext** (30s per request, not the expired per-test `request` fixture). Cancel **only the new journal-owned Order**, re-fetch the same Order through Customer authenticated API and require persisted `status=CANCELLED`. Update the run journal to `verified-cancelled` or `failed` plus error. Keep journal if cleanup fails so recovery is attributable; do not sweep old or unidentified records.
4. Publish `frontend/test-results/interaction-inventory.json` only after full 33-snapshot completion, 28 unique URL paths and verified Order cleanup; incomplete runs do not overwrite a previous successful artifact.
5. Fix a **false-positive inventory** found during this Phase: the first split run reported 5/5 PASS yet numerous authenticated pages were snapshotted during pre-hydration (0 interactive controls). Added page `main` and semantic `main h1` visibility checks, bounded waiting for transient loading indicators, polling for **at least one visible control**, plus explicit per-page assertion. A route cannot silently pass with a zero-control snapshot. Readiness failure now mentions the route label.
6. Add opt-in `E2E_INVENTORY_FORCE_TEST_TIMEOUT_ROLE` fault-injection hook (default unset) for a local failure-path verification without changing app behavior. No new runtime dependencies.

#### 2. Verified browser results and artifact quality

**Final clean command**, run with local Chromium, one worker, `--retries=0`, existing localhost guard:

```bash
cd frontend
node node_modules/@playwright/test/cli.js test e2e/interaction-inventory.spec.ts \
  --workers=1 --retries=0 --reporter=line \
  --output=/tmp/unistore-phase3-release-traces
```

- **5/5 role-scoped tests PASS**, **0 retries**, **31.9 seconds** total on the existing development environment.
- Output: `frontend/test-results/interaction-inventory.json` (Git-ignored), generated 2026-10-16T07:39:29.518Z.
- `snapshotCount=33`, `canonicalUserFacingRouteCount=28`, 28 unique normalized URL paths, role counts 6/7/13/4/3.
- **Zero-control snapshots: 0**; smallest page 6 controls, largest 594; some large tables/menus account for high counts. This is a control census, not a complete visual/accessibility certification.
- Matching journal for the final run: `cleanupStatus=verified-cancelled` and run ID matches the output artifact.
- Chromium run captured **37 diagnostic events**: 35 canceled requests during navigation, one HTTP 404 and one associated console error in the Customer Payment view before a slip exists. These have not been blanket-cleared as defects or asserted to be absent; browser errors should be assessed in later UX/Flaky phases if unexpectedly visible.
- Earlier **false-green 5/5** (0 controls on many pages) was **not** accepted as phase success. The stricter readiness suite produced an intermediate failure on an Organization Admin page that still showed loading after 25s; a targeted Organization Admin rerun passed, and the final full run passed with data-ready snapshots.

#### 3. Verified cleanup, including timeout failure

- All new inventory Orders from this Phase are recorded in unique journals; all Phase-3 journal records now show **`verified-cancelled`**.
- During an intermediate test failure, the separate cleanup context's *previous* 10s login limit was exceeded; the failed journal retained the exact ID. **Recovered only that journal-owned Order**, after reading its current `PENDING_PAYMENT` state, then canceled and independently verified `CANCELLED`. No other Order was changed by recovery.
- Improved teardown APIRequestContext request budget to 30s, separate from the route test timeout.
- **Deliberate failure-path test:** locally set `E2E_INVENTORY_FORCE_TEST_TIMEOUT_ROLE=anonymous` and run only `capture anonymous`; runner intentionally **FAILED at 1-second timeout**, as expected. The `afterAll` hook **still canceled its own Order and verified `CANCELLED`** using its independent context. It did not replace the last complete `interaction-inventory.json`. This expected failure is a *teardown proof*, not an application regression. Temporary log: `/tmp/unistore-phase3-forced-timeout.log`.
- Read-only DynamoDB count after the final run for the **seed Customer and 2026-10-16 only**: 11 Orders, 8 `CANCELLED` and **3 `PENDING_PAYMENT`**. The previous Phase-1 baseline was **3 pending** in that same customer/date scope. Thus no additional pending seed-Customer Orders remain from this Phase. The 3 pre-existing pending Orders remain **unattributed and untouched**; never cancel them from a date/status heuristic.
- Cancellation is a **business soft-cancel**, not deletion of the audit record; the canceled orders remain in the Dev DB as expected. No claim of physical record cleanup or zero other test fixtures.
- Independent request contexts do not protect against a forced OS process kill or machine power failure; the per-run journal is the recovery marker for those cases. Do not claim crash-proof cleanup without an external recovery service.

#### 4. Local validation, boundaries and next steps

- TypeScript `npx tsc --noEmit`: **PASS** after the test refactor.
- `git diff --check`: **PASS**.
- Docker Compose unchanged and running; no `up --build`, reset, volume deletion or AWS actions.
- Prior pending modifications from Phase 2, `../../WEB_QUALITY_AUDIT.md`, the Phase 1/2 reports and `tests/reports/aws-live-validation-checklist.md` are preserved, not overwritten or committed.
- This Phase added/changed only `frontend/e2e/interaction-inventory.spec.ts` plus this report; generated output/journals are in Git-ignored `frontend/test-results`. Temporary runner logs/traces under `/tmp` can be pruned later without deleting the journal that proves ownership.
- **Phase 4** is next: assess flaky payment success feedback, Staff navigation, Platform tracking and Guest matrix; preserve full authoritative state checks. **Phase 7** will run all 67 distinct cases again and append the latest result to the historical `../../WEB_QUALITY_AUDIT.md`.
- AWS-only test items remain `NOT RUN` in `tests/reports/aws-live-validation-checklist.md`; no production-ready claim.

**Phase 3 local acceptance:** **PASS** — full control inventory generated, 28 canonical routes verified, all snapshots contain visible controls, deliberate timed-out test successfully cleaned up its owned fixture, no new pending seed-Customer Order residue. Do not start Phase 4 until separately requested.

---

<a id="record-04-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Local Audit Remediation Phase 4: Flaky Cross-Role Journey Stabilization

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 4
- **Scope:** Frontend Payment feedback and four formerly flaky Playwright scenarios on existing localhost Docker Compose/LocalStack.
- **Status:** Targeted Phase 4 **COMPLETED**. Full 67-case E2E requalification and real AWS tests remain **NOT RUN** here.
- **No commit, push, deployment, LocalStack reset, historical Order cleanup, or AWS action.**

#### 1. Findings from the four historical flaky cases

Reference: `../../WEB_QUALITY_AUDIT.md` §21.5 (FLAKY-21-01 through FLAKY-21-04). Initial **read-only** local baseline of the Staff selection, Platform Tracking and Guest Matrix cases: **3/3 PASS, 0 retries, 14.1s**. Therefore the previous flakiness was intermittent; failures were not automatically reproduced in this fresh baseline.

| Historical case | Root cause / observed risk | Targeted correction |
|---|---|---|
| FLAKY-21-01 Organization Admin Payment Feedback | `OrganizationPaymentsView.handleApprove` awaited an additional Payment + Order GET after the successful mutation and **only then** set the success notice. A slow or failed refresh could hide a committed successful approval and show a generic error. | Publish authoritative mutation success and update list/detail immediately, before attempting readback. A readback error preserves clear success feedback and says latest details still need refresh; never treat a committed mutation as an approval failure. Apply same handling to reject for consistent safety. |
| FLAKY-21-02 Staff Organization → Orders | Cross-page Next.js client routing and auth restoration sometimes outlasted default 5s heading assertion in Dev. Backend RBAC previously verified. | Use DOM-ready initial navigation, bounded 20s wait on **actual Staff Orders heading**, preserve all staff menu visibility and admin-route denial assertions. |
| FLAKY-21-03 Platform Admin storefront tracking | The homepage intentionally hides authenticated tracking link while session state is loading. A 5s assertion may race auth hydration/back/forward on Dev. | Use DOM-ready initial navigation/history and bounded 20s assertion for **authenticated /my/orders href**. Still verify navigation URL, absence of login gate and forward/back transitions. |
| FLAKY-21-04 Guest Route/Viewport Matrix | Guest route first h1 could appear after 12s in Next.js Dev and generic h1 may be outside the intended content. | Wait for visible main and its semantic h1 (20s), and for Guest avoid a **true loading placeholder**, preserving all 11 viewport geometry/a11y/console assertions. |

A trial Guest heading matcher `/กำลัง|loading/i` was **too broad**, because the legitimate Thai Login heading contains “กำลังดำเนินการ”. The trial failed twice for a test-assertion mistake, not app behavior; fixed to a beginning-of-heading pattern for genuine loading messages `/^(กำลังโหลด|กำลังตรวจสอบบัญชี|loading)/i`, then reran successfully. The Playwright runner sometimes printed `Internal error: step id not found: fixture@79` during a failing run; the final successful Guest run did not report an assertion failure and no claim of fixing the runner itself is made.

#### 2. Changed files and business-safety design

- `frontend/src/modules/payments/organization-payments-view.tsx`
  - On successful `approvePayment`, update Payment UI and show confirmation **before** `refreshSelected`; failed readback sets an honest “approved but latest details not loaded” success notice, without offering/retriggering a second approve.
  - Same post-mutation/readback distinction for `rejectPayment`; no change to server-side authorization or Payment state transition rules.
- `frontend/src/modules/payments/organization-payments-view.test.tsx`: test success notice before a pending readback, successful approval despite readback error, and preserved rejection success on failed readback. Retain existing approval/rejection and validation assertions.
- `frontend/e2e/organization-admin.spec.ts`: after UI approval feedback, query **real Backend** for `Payment.status=APPROVED` and `Order.status=PAID`. Continue existing real pickup confirmation and `RECEIVED` state proof. No weakened authorization or price/payment checks.
- `frontend/e2e/staff-operational.spec.ts`: specific Staff navigation readiness.
- `frontend/e2e/storefront-tracking-navigation.spec.ts`: specific Platform Admin session-aware tracking readiness and history.
- `frontend/e2e/route-viewport-matrix.spec.ts`: page-main heading readiness and narrow Guest placeholder check. **No UI layout changes yet**; those belong to Phase 5.

No backend source changes were made **in Phase 4**. Previously uncommitted Phase 1–3 and historical audit changes remain intact.

#### 3. Verified test results, without retries

| Target | Actual observed outcome |
|---|---|
| Original 3 read-only target flows before edits | **3/3 PASS, 0 retries** |
| Staff Navigation after readiness correction (`--repeat-each=2`) | **2/2 PASS**, 0 retries |
| Platform Admin Tracking after readiness correction (`--repeat-each=2`) | **2/2 PASS**, 0 retries |
| Guest Matrix after narrow loading-heading fix (`--repeat-each=2`) | **2/2 PASS**, 0 retries. Both runs exercised 6 guest pages × 11 viewports = **66 measurements/run**; `failedMeasurements=0`, `diagnosticEvents=0`. |
| Organization Admin Order cancellation → real Payment approval → real Pickup work | **1/1 PASS**, 0 retries, **11.2s**, with added authoritative `APPROVED` and `PAID` verification and preexisting `RECEIVED` check |
| Frontend full `npm test` | **299/299 PASS**, 80 test files |
| Frontend TypeScript `npx tsc --noEmit` | **PASS** |
| `git diff --check` | **PASS** |

The initial post-edit guest combined run yielded 4 PASS / 2 FAIL because our overly broad temporary Thai-language matcher rejected an entirely valid Login title. This was corrected; **final guest run passed 2/2**. Do not hide this diagnostic history or count the failed transient edit as an application defect.

Test runner log locations are temporary on BDXA Mac, not user-download URLs:
- `/tmp/unistore-phase4-baseline.log`
- `/tmp/unistore-phase4-regression.log` (contains the trial assertion mistake)
- `/tmp/unistore-phase4-guest-fixed.log` and `/tmp/unistore-phase4-guest-fixed/`
- `/tmp/unistore-phase4-payment-flow.log` and `/tmp/unistore-phase4-payment-flow/`

#### 4. Outstanding matters and safe handoff

- Guest Matrix still recorded **six nested-overflow observations** on desktop Login/Register at widths 1280, 1440 and 1920. Its measured clipping failures remain zero; **do not declare layout fixed**. Review visually/accessibility in Phase 5, together with home mobile discovery and the Audit table 1024px.
- The successful Payment/Pickup E2E creates new **synthetic, LocalStack-only** registered users and organization/order/payment/pickup records; those historical/audit fixtures are **not deleted** by this phase. One canceled Order follows the app's business soft-cancel path. Do not equate test PASS with removal of all test fixture records.
- Real AWS, HTTPS, S3 file privacy, Lambda/SQS, backups and production readiness: still **NOT RUN / NOT CERTIFIED**, see `tests/reports/aws-live-validation-checklist.md`.
- The local **67 distinct-case** E2E clean-regression goal is scheduled for Phase 7. The four formerly flaky cases have been retested in isolation only, and reproducibility under a full large suite must be validated there.

**Phase 4 targeted acceptance: PASS.** All four historical flaky topics have 0-retry successful targeted Browser evidence and corrected Payment feedback semantics. **Next phase: Phase 5 — Mobile Store Discovery & Nested Overflow.** No Commit/Push/Deploy.

---

<a id="record-05-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Local Audit Remediation Phase 5: Mobile Store Discovery & Nested Overflow

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 5
- **Status:** COMPLETED for local mobile shopping discovery, auth artwork containment and Audit filter/grid accessibility. Remaining Phase 6–8 and live AWS security/performance remain unverified.
- **Environment:** Existing localhost Docker Compose / LocalStack on the user's BDXA Mac, real Chromium via Playwright; **no AWS account, Deploy, Git Commit/Push, Docker reset or deletion of historical LocalStack records**.

#### 1. Baseline from real Browser (before edits)

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

#### 2. Changes made, with owned files

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
- `frontend/e2e/mobile-storefront-and-auth.spec.ts` (**new**, read-only tests)
  - Verify Mobile storefront at 320/360/390/430px, early Store/Directory y-positions, full-page clipping, a visible real Store, search no-results and clearing filters.
  - Verify Tablet/Desktop 768/1440px hero/guide/store-card composition and no clipping.
  - Verify Login/Register at 320/390/1280/1440/1920px, including no nested illustration overflow and visible inputs.
  - Verify authenticated read-only Audit at 1024px: **two filter-grid columns without overflow**, horizontal table frame remains `tabIndex=0` and scrolls with ArrowRight.

#### 3. Verified real Browser and Frontend Regression

| Check | Result |
|---|---|
| New targeted `e2e/mobile-storefront-and-auth.spec.ts` | **4/4 PASS**, no retries, 23.3s initial browser run |
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

#### 4. Safety, boundaries and remaining work

- Source/config diff of **this Phase** is confined to the 3 listed Frontend CSS module files plus the newly added E2E spec and this report. Older pending changes to `../../WEB_QUALITY_AUDIT.md`, Backend/Frontend files from Phases 1–4 and `tests/reports/aws-live-validation-checklist.md` remain intact.
- The new Phase 5 E2E specs are **read-only**; the existing `organization-b-audit` matrix may create and business-cancel its own synthetic LocalStack Order as part of its pre-existing fixture. Do not claim that soft-cancel deletes historical records. No production data or remote payment is involved.
- This is Chromium emulation at specific viewport sizes, **not** certification on physical iPhone/Android/Safari VoiceOver/TalkBack. It confirms key flows/geometry and keyboard behavior but not full WCAG 2.2 AA conformance.
- Mobile repositioning places the **non-interactive** purchase guide after the catalog **visually**, while DOM reading sequence remains based on source markup; assess actual screen-reader narrative and consider a future semantic-reordering improvement if needed before accessibility certification.
- No wholesale Frontend redesign, account/login logic change, API change, AWS deployment, CloudFormation update or cloud security claim.
- **Phase 6 next:** offline AWS readiness hardening under the original Learner Lab constraints, no account access or live writes. **Phase 7:** full local combined Chromium suite including new Phase 5 tests, contract/security and report updates; the original “67” historical count is expected to change because Phase 3 split inventory into five tests and Phase 5 added four new tests.
- `tests/reports/aws-live-validation-checklist.md`: every live AWS check still **NOT RUN**. Production security/backup/restore/rollback and HTTPS real-user use remain **NO-GO / NOT CERTIFIED**.

**Phase 5 local acceptance: PASS.** Do not start Phase 6 or Commit/Push unless separately requested.

---

<a id="record-06-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Local Audit Remediation Phase 6: Offline AWS Readiness Hardening

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 6
- **Status:** **COMPLETED — OFFLINE preparation only**. Real AWS deployment, recovery, security validation, cost/IAM proof and production certification remain **NOT RUN / NO-GO**.
- **Environment:** BDXA Mac workspace `UniStore_Hub`; disposable local filesystem/mock AWS CLI test fixtures. The actual `aws` CLI command was **NOT INSTALLED** on the host during this Phase.
- **Safety boundary:** No real AWS CLI call, AWS credentials/session, CloudFormation create/update/delete, S3 sync, IAM modification, data backup/restore, Docker reset, Git Commit or Push was performed. All old user changes from Phases 1–5 and `../../WEB_QUALITY_AUDIT.md` preserved.

#### 1. Canonical baseline and source decisions

Consulted `SPEC.md`, `AGENTS.md`, `scripts/AGENT.md`, `docs/architecture/AWS_ARCHITECTURE.md`, `docs/specs/infrastructure/SPEC.md`, `docs/deployment/DEPLOYMENT_SPEC.md`, `infrastructure/template.yaml`, `scripts/lib/common.sh` and `scripts/lib/stack-outputs.sh`.

Preserved **region `us-east-1`**, stack `unistore-hub-dev`, stage `dev`, existing `LabRole`, `aws cloudformation package/deploy`, static Next.js S3 Website hosted on **HTTP** for Learner Lab Demo, eight required stack outputs, Lambda/SQS/DynamoDB/CloudWatch topology, `JWTSecret` NoEcho parameter and canonical Frontend `aws s3 sync --delete`. **No** CloudFront, Cognito, Secrets Manager/SSM, custom IAM role, IAM modification, CloudFormation template modification, backup service or unrelated AWS resource was introduced.

AWS CLI **v2** officially supports CloudFormation deploy parameter overrides through a `file://` JSON file; reference: `https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html`. Local mock acceptance of this syntax does **not** prove behavior with an installed/live AWS CLI version.

#### 2. Secret exposure remediation (local scripts)

Original `scripts/deploy-infra.sh` expanded `JWT_SECRET` directly into the process argument `JWTSecret=<value>` even though `set +x` hid shell tracing. This could disclose values to process-argument inspection.

**Change:** `scripts/deploy-infra.sh` now:
1. Creates a randomly named temporary directory with restrictive `umask 077`.
2. Uses built-in Node.js JSON.stringify to write a **mode 0600** CloudFormation parameter file inside that private directory, preserving special characters in JWT values.
3. Passes `--parameter-overrides file://<private-json-path>` to AWS CLI; the JWT plaintext is not present in AWS CLI argv. Uses `env -u JWT_SECRET` for the CloudFormation **deploy child** so that particular AWS CLI process does not inherit JWT_SECRET as an environment variable.
4. Retains the existing `trap cleanup EXIT` to delete the temporary directory on success or failure; does not log the secret or change the real application's JWT contract.
5. Keeps NoEcho and the documented environment-based secret supply: no AWS Secrets Manager/SSM dependency introduced.

**Limitations:** Initial invoking shell and Node parameter writer still receive the secret via environment as specified by the project contract. A privileged same-host observer or Lambda configuration API may access secrets despite NoEcho; actual policy/process protection and rotation need a live approved AWS assessment.

**Evidence:** Mock AWS CLI **success** and **forced CloudFormation failure** both verify mode 600, parameter content and path-only argv; temporary directory absent after exit; no synthetic secret in logs or captured CLI argv. No actual AWS CLI was installed/executed.

#### 3. Frontend static release snapshot and rollback preparation

Original `scripts/deploy-frontend.sh` ran `aws s3 sync frontend/out s3://FrontendBucketName --delete`, which is non-atomic and without recovery artifacts could remove previous static files without a rollback source.

**Changes:**
- `scripts/deploy-frontend.sh` now reads the current S3 Website into a **private local snapshot** before invoking the unchanged canonical `--delete` upload. A failed snapshot stops the upload rather than risking an unbacked write.
- Snapshot location `scripts/.releases/frontend.<random>/`, with `previous/`, `previous-manifest.json`, `candidate-manifest.json`, `frontend-bucket.txt` and `stack-name.txt`. Root has private umask and is excluded from Git through `scripts/.gitignore`.
- `scripts/lib/frontend-release-manifest.cjs` computes/checks sorted relative file paths, byte size and **SHA-256** for previous/candidate files; rejects symlinks, unsupported entries and self-inclusion.
- `scripts/FRONTEND_RECOVERY.md` documents offline SHA verification and a **separately approved** manual, real-AWS recovery rehearsal. It does **not** contain an automatic live rollback command.

**Mock acceptance:** previous release copied before upload; manifests verify; tampered snapshot is detected; failure copying old bucket prevents upload. A **filesystem-only** rehearsal reconstructs the old release under a separate disposable destination and passes hash verification.

**Important residual risk:** private snapshots live only on the operator machine, not a durable remote backup; no S3 Versioning or immutable archive was added. Initial empty buckets have no previous release. A partially completed real S3 sync, concurrent upload, expired Lab session, wrong target bucket, interrupted machine, and actual recovery RTO remain **NOT PROVEN**. In particular, snapshot safety is not a substitute for checking exact CloudFormation outputs and separately approving any future `s3 sync --delete` rollback.

#### 4. AWS data recovery decisions captured without changing infrastructure

Created `tests/reports/aws-data-recovery-runbook.md`:
- `AppTable`: DynamoDB PAY_PER_REQUEST with GSI1 but **PITR not configured** in source.
- `FilesBucket`: private S3 AES256 with defined Public Access Block, but **Versioning not configured**.
- Bucket/table deletion retention protections are **not defined** in the baseline template.
- All application data restore steps must use **isolated, traceably owned synthetic** resources after explicit authorization; never restore over the existing `AppTable` or user-owned File keys during rehearsal.
- **RPO, RTO, retention, IAM capability and budget are open owner decisions.** No silent versioning/PITR/Retain template edits, and `npm run destroy` is not a recovery mechanism.

Appended a dated offline evidence ledger to `tests/reports/aws-live-validation-checklist.md`. All **AWS-001…AWS-009**, AWS-SEC/REL/DATA/OPS/E2E/PERF live gates remain `NOT RUN`.

#### 5. Real locally executed offline checks

| Check | Observed result |
|---|---|
| `node --test scripts/tests/deployment-hardening.test.cjs` | **6/6 PASS**, 0 fail — fake AWS CLI only, including malicious/special JWT fixture, cleanup failure path, snapshot and local restore |
| `bash -n scripts/deploy-infra.sh scripts/deploy-frontend.sh` | **PASS** |
| `bash scripts/check-tooling.sh` | **50/50 PASS** |
| `cd tests && npm run test:infrastructure` | **19/19 PASS**, static/template semantic validation |
| `cd tests && npm run test:contract` | **196 PASS / 2 TODO**, 0 fail (do not mark TODOs passed) |
| `cd tests && npm run test:security` | **16/16 PASS** |
| `git diff --check` | **PASS**, 0 whitespace errors |
| Actual `aws --version` command | **Unavailable/COMMAND_NOT_FOUND** — live CLI syntax/network/role/permissions **NOT TESTED** |

Source changes confined to `scripts/deploy-infra.sh`, `scripts/deploy-frontend.sh`, new `scripts/lib/frontend-release-manifest.cjs`, new `scripts/tests/deployment-hardening.test.cjs`, new `scripts/.gitignore`, new `scripts/FRONTEND_RECOVERY.md` and two owned Cross-system Test reports/updates: this document, `tests/reports/aws-data-recovery-runbook.md`, `tests/reports/aws-live-validation-checklist.md`. No CloudFormation or application code edited in this Phase.

#### 6. Remaining gates and next phase

- **AWS CLI v2 + Learner Lab:** obtain explicit permission, verify real identity/region/budget, inspect CloudFormation change set, and confirm the installed CLI supports file-based parameters and the temporary secret file has no process/log leak in practice. No real deployment here.
- **Private S3:** real unsigned download denial and authorized presigned GET/PUT validation are critical and still NOT RUN (LocalStack is not reliable for anonymous access proof).
- **Frontend rollback:** intentionally requires manual approval on a disposable staging bucket; test recovery after partial S3 sync and prove RTO without touching customer data.
- **Data:** implement or formally accept changes to backup/PITR/S3 Versioning/retention only after authorizing budget and architecture implications; rehearse isolated restores.
- **IAM, logs, SQS, HTTP frontend:** unchanged AWS-only or architecture-decision gates; a successful local mock does not make real-user production secure. The HTTP S3 Website is **DEMO ONLY**.
- **Phase 7 next:** full local E2E, unit/contract/security/deployment offline regression and append updated count/result to `../../WEB_QUALITY_AUDIT.md`; expected distinct-case count differs from historical 67 because Inventory was split and Phase 5 added tests.
- **Phase 8:** final source diff, application contract/security and no hidden resource side effects; no commit/push/deploy by default.

**Phase 6 offline acceptance:** **PASS for code-level preparation and mock tests; NOT CERTIFIED for live AWS/recovery.** Next phase only on separate user instruction.

---

<a id="record-07-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Phase 7: Full Local Regression & Audit Update

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace:** `UniStore_Hub` / BDXA remediation plan Phase 7
- **Status:** **LOCAL PLAYWRIGHT ACCEPTANCE PASS (75/75)**; separate opt-in Cross-System E2E has **5 TODO/BLOCKED**. Real AWS verification remains **NOT RUN** and real-user production is **NO-GO / NOT CERTIFIED**.
- **Execution:** Existing Docker Compose Dev + LocalStack on loopback, Chromium Playwright, 1 worker, **0 retries**. No Commit, Push, AWS Deploy, database reset, broad cleanup or deletion of unidentified historical orders.

#### 1. Preflight / scope

- Before testing: `backend`, `frontend`, `localstack` healthy; Worker up; Compose Seed/Bootstrap exited 0 as expected.
- Git working tree already contained uncommitted Phase 1–6 changes; preserved all previous edits and the AWS checklist.
- Playwright enumeration: **75 tests across 17 `frontend/e2e/*.spec.ts` files**. Historical 2026-10-16 §21 baseline was 67 distinct cases (61 first-attempt PASS, four FLAKY on retry, two FAIL). Counts differ because Phase 3 split Inventory into five tests and Phase 5 added four new responsive checks.
- Target remained canonical `http://localhost:3000`, `http://localhost:4000/api/v1` and local LocalStack; no non-local mutation flags were set.

#### 2. Complete Chromium browser regression

Executed:
```bash
cd frontend
node node_modules/@playwright/test/cli.js test \
  --workers=1 --retries=0 --reporter=list,json \
  --output=/tmp/unistore-phase7-full/results
```

JSON reporter saved to `/tmp/unistore-phase7-full/run.json` by `PLAYWRIGHT_JSON_OUTPUT_FILE`. Process output at `/tmp/unistore-phase7-full/run.log`. These are **temporary paths on the BDXA Mac**, not user-downloadable sandbox files.

| Measure | Verified result |
|---|---:|
| Specs covered | **17/17** |
| Expected cases | **75** |
| First-attempt PASS | **75** |
| Fail / Unexpected | **0** |
| Retried / Flaky | **0** |
| Skipped | **0** |
| Runner exit | **0** |
| Duration | **430,743 ms ≈ 7.18 min** |

Per-file counts (all passed): Auth Journeys 10; Cross-Role Golden 1; Customer Commerce 5; Harness 2; Interaction Inventory 5; Phase 5 Mobile Layout 4; Mobile Payment Queue 5; Organization Admin 5; Platform Admin 3; Resilience/A11y 6; Responsive Interactions 5; Role Security Boundaries 2; Role/Viewport Matrix 9; Staff Operations 5; Large Storefront Directory 1; Storefront Media/A11y 2; Storefront Tracking 5.

**Previously red/flaky focus points:** Platform Admin page/Users navigation, the 28-route Inventory, Organization Admin approval success feedback and Backend persisted Payment=APPROVED/Order=PAID, Staff navigation and Payment review, Platform Tracking authenticated link, Guest Matrix and nested-overflow regression — all passed within the combined suite with no automatic retries. The Golden Chain exercised synthetic cross-role Order / Payment rejection-resubmission / Pickup / Notification / Audit. These are local data and simulated slip interactions, not real monetary settlement or real warehouse pickup.

##### Viewport matrix

Nine groups across 11 viewport pairs yielded:
- Guest: 66 measurements
- Customer: 66
- Staff: 55
- Organization A: 77
- Organization B Operations: 55
- Organization B Audit: 11
- Platform Summary: 11
- Platform Organizations: 11
- Platform Users: 11

**Total: 363 measurements**, with **0 clipped measurements, 0 nested-overflow observations and 0 unexpected browser diagnostics**. The Customer group recorded **one anticipated** Payment-detail 404 console diagnostic before a slip exists; the test explicitly classified it as expected and passed. Automated axe mobile/desktop checks are not proof of full WCAG or physical-device/screen-reader coverage.

#### 3. Inventory and cleanup evidence after the full run

- `frontend/test-results/interaction-inventory.json` refreshed successfully.
- `canonicalUserFacingRouteCount=28`, `snapshotCount=33`, **28 unique normalized route paths**, zero snapshots with zero controls.
- Matching run journal `runId=0d7ce225-d770-4629-af39-aee7b740b37b` reports `cleanupStatus=verified-cancelled`.
- All **8 inventory-owned journal records** currently found in `frontend/test-results/` report `verified-cancelled`.
- Read-only LocalStack DynamoDB query limited to the seed Demo Customer and 2026-10-16 Orders: **13 records: 10 CANCELLED, 3 PENDING_PAYMENT**. Phase 1 baseline before this remediation had **3 pending** records in the same scope. No additional pending seed Customer Orders were left by the Inventory suite; the 3 historical pending records remain **unattributed and untouched**.
- Business soft-cancellation does not physically erase test Orders, and other E2E scenarios intentionally leave synthetic records/audit history. Do not claim an entirely empty or restored Dev dataset.

#### 4. Unit, contract, security, infrastructure and offline deployment checks

| Test command | Actual result |
|---|---|
| `cd backend && npm test` | **297/297 PASS** in **two isolated reruns**; 0 fails |
| `cd frontend && npm test` | **299/299 PASS**, 80 files |
| `cd frontend && npm run lint` | **PASS** |
| `cd frontend && npx tsc --noEmit` | **PASS** |
| `cd tests && npm run test:contract` | **196 PASS / 2 TODO**, 0 FAIL |
| `cd tests && npm run test:security` | **16/16 PASS** |
| `cd tests && npm run test:integration` | **36/36 PASS** |
| `cd tests && npm run test:infrastructure` | **19/19 PASS** |
| `cd tests && npm run test:frontend` | **33/33 PASS**, including a real local static export build/route reload check |
| `cd tests && npm run test:smoke` | **12 PASS / 12 TODO**, 0 FAIL; AWS smoke deliberately NOT enabled |
| `cd tests && npm run test:e2e` | **0 PASS / 5 TODO**, 0 FAIL (opt-in environmental prerequisites not supplied; not executed) |
| `node --test scripts/tests/deployment-hardening.test.cjs` | **6/6 PASS**, fake AWS CLI and local filesystem only |

**Transparency about Backend instability:** The first Backend npm test invocation was launched concurrently with six other suites and **exited 1**; its initial fail details were not saved in a complete named artifact. Two subsequent serialized isolated Backend reruns each passed 297/297 with exits 0. This suggests resource contention but **does not prove a root cause or erase the initial result**. It is retained as an intermittent concurrency-quality follow-up for Phase 8 and future CI worker-budget settings. Parallel load was avoided during stateful browser E2E.

**Opt-in Cross-System E2E exclusions:** The five tests in `tests/e2e/` require explicit local E2E run variables (`E2E_API_BASE_URL`, unique `E2E_RUN_ID`, relevant synthetic platform/recipient token, local queue) and default to `TODO / BLOCKED`. They were enumerated but not executed as mutating flows; no PASS is claimed. The **75 passed Playwright cases are a separate, actually executed full Browser E2E suite**, not a substitution that changes the status of these five tests. The smoke suite also includes 12 documented TODO/deferred checks. Do not flatten TODO into green.

#### 5. Changes and AWS-only release gate

- This Phase did **not** change application code, CloudFormation, deployment scripts or the test suite under test. It wrote this report, appended an accurately dated §22 summary to `../../WEB_QUALITY_AUDIT.md` and clarified local-vs-AWS status in the existing AWS validation handoff.
- Temporary logs/JSON, snapshots/traces and generated static `frontend/out` remain on the BDXA Mac and are not committed. Leave existing LocalStack and Docker Compose available for Phase 8 final review.
- **Live AWS still NOT RUN**: AWS Academy access, IAM effective permission, JWT rotation on real Lambda, HTTPS production frontend architecture, S3 private-object anonymous GET, real SQS/CloudWatch delivery, release restore, DynamoDB PITR/S3 Files backup restore, Lambda/API Gateway performance, credits and production rollback.
- `scripts/tests/deployment-hardening.test.cjs` PASS is **offline mock evidence**, not a live AWS deploy.
- Manual accessibility and physical device checks are deferred; full GDPR/WCAG or other compliance claims are not made.
- **Next planned Phase 8:** final source/diff and security/reliability review; assess every outstanding TODO, initial concurrent Backend failure, completeness of AWS handoff, unexpected data mutation and release gates. Do not commit, push, deploy or purge old fixture data without separate instruction.

**Phase 7 local Playwright acceptance: PASS (75/75). Whole-project cross-system optional tests and live AWS readiness are NOT fully certified.**

---

<a id="record-08-local-audit-remediation-2026-10-16"></a>

## Local Audit Remediation 2026 10 16

### UniStore Hub — Phase 8: Final Diff, Security & Reliability Review

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace:** `UniStore_Hub`
- **Review outcome:** **PASS for the approved local/offline remediation scope**. Real AWS and real-user production readiness: **NOT CERTIFIED / NO-GO**.
- **Changes:** All Phases 1–7 source/test/docs reviewed, plus targeted Phase 8 remediation below. No Commit, Push, live AWS command, Deployment, Compose reset, destructive LocalStack cleanup, or removal of unknown Orders.

#### 1. Scope reviewed and original guardrails

Compared all tracked Git differences and new files against the master/shared/system specifications and established Phase 1–7 reports. Reviewed Backend BatchGet and platform RBAC, Payment approval/rejection state, role-aware E2E test readiness and Inventory cleanup, mobile responsive behavior, AWS Learner Lab deployment scripts, temporary JWT handling, Frontend snapshots, and AWS-only handoff.

All historical `../../WEB_QUALITY_AUDIT.md` Sections 1–22 remain preserved. `infrastructure/template.yaml` and the architectural Region `us-east-1`, Stack `unistore-hub-dev`, LabRole/S3 Website demo/SQS/CloudFormation outputs are unchanged. No new production service or custom IAM role was introduced.

#### 2. Confirmed and corrected Phase 8 findings

##### F8-01 — P2: Post-commit Payment readback could suppress required session invalidation

**Files:** `frontend/src/modules/payments/organization-payments-view.tsx` and its `*.test.tsx`.

Phase 4 correctly separated a successfully committed Payment approve/reject from a later, possibly failed refresh of Order/Payment details. However the post-commit nested `catch` handled **every** readback error as merely stale details. If the second request returned a definitive `TOKEN_INVALID`/`TOKEN_EXPIRED` error, it would not run the existing `authSession.logout()` security/session path.

**Fix:** Both approve/reject post-commit readback catch blocks now invoke `isDefinitiveSessionFailure(error)` and logout/return when appropriate. Other readback failures still preserve a truthful successful-mutation notice with guidance to reload details. Neither error branch re-submits approve/reject or rewrites the committed Backend state.

**Evidence:** Two new unit cases for Token-expired post-approval/rejection. The Payment view unit suite **10/10 PASS** and full Frontend unit suite **301/301 PASS** across 80 files. Targeted real-browser Organization Admin Order Cancellation→Payment Approval→Pickup Flow **1/1 PASS** with `--workers=1 --retries=0`, including persisted Payment `APPROVED` and Order `PAID` verification already asserted by the E2E.

##### F8-02 — P2: JWT secret was unnecessarily inherited by deployment subprocesses

**Files:** `scripts/deploy-all.sh`, `scripts/deploy-infra.sh`, `scripts/deploy-frontend.sh` and `scripts/tests/deployment-hardening.test.cjs`.

The Phase 6 private JSON file eliminated JWT values from CloudFormation deploy **arguments**, but an exported `JWT_SECRET` could still be inherited by unrelated Backend `npm`, AWS identity/package/validate commands, and Frontend build/S3 commands. In addition, a Shell-local `JWT_SECRET` that had **not been exported** passed the Bash preflight but was absent from the Node child writing the CloudFormation JSON parameter file.

**Fix:**
- `deploy-all.sh`: retain the Bash-local secret but revoke export before identity and Backend build; pass the value **only** to the separate `deploy-infra.sh` subprocess for infrastructure configuration.
- `deploy-infra.sh`: immediately revoke `JWT_SECRET` export after validation, so all AWS CLI commands cannot inherit it; pass it explicitly to only the Node child writing the mode-600 private JSON parameter file; keep `env -u JWT_SECRET` on the actual CloudFormation deploy subprocess as defense in depth.
- `deploy-frontend.sh`: `unset JWT_SECRET` because the static Next.js Frontend and S3 Website upload do not use it. The frontend deploy continues to produce an independently validated SHA-256 previous-release snapshot before the canonical `s3 sync --delete`.
- Mock test now checks **every** mock AWS subprocess for an inherited `JWT_SECRET`, covers non-exported Bash secret handling and the canonical `deploy-all` split into Build/Infra/Frontend subprocesses. Fake CLI and fake subprocesses operate only on disposable `/tmp` copies, never a real account.

**Evidence:** Deployment Mock **8/8 PASS**, including successful/failing secret-file cleanup, read-only previous release snapshot + hashing/restore, failure preventing upload, special characters and private file permissions. Shell Syntax PASS; Tooling contract **50/50 PASS**; Infrastructure Static **19/19 PASS**. No actual AWS CLI was invoked.

**Residual risk:** The invocation process and the designated Node file writer must temporarily possess JWT values in Bash memory/environment per the existing contract. There is **no** claim of protection from privileged same-host inspection or CloudFormation/Lambda configuration disclosure. Real IAM, CLI, secret rotation and audit logs remain AWS-only validations.

#### 3. Regression results actually observed

| Suite | Latest proven result |
|---|---|
| Phase 7 **full Chromium 17 specs** before Phase 8 edits | **75/75 PASS**, zero retries, zero unexpected, zero skipped, ~7.2 minutes |
| Phase 8 **targeted Payment/Pickup Chromium**, after fixes | **1/1 PASS**, zero retries |
| Full Frontend Vitest, after Phase 8 edits | **301/301 PASS**, 80 files |
| Backend Unit, Phase 8 isolated | **297/297 PASS** |
| Security tenant boundary tests | **16/16 PASS** |
| Infrastructure/static architecture checks | **19/19 PASS** |
| Deployment offline fake AWS/restore tests, after Phase 8 edits | **8/8 PASS** |
| `bash scripts/check-tooling.sh` | **50/50 PASS** |
| Frontend TypeScript `npx tsc --noEmit` | **PASS** |
| Frontend ESLint `npm run lint` | **PASS** |
| `bash -n scripts/deploy-all.sh scripts/deploy-infra.sh scripts/deploy-frontend.sh` | **PASS** |
| `git diff --check` | **PASS** |

**Scope qualification:** The complete 75-case Chromium suite was **not** repeated after Phase 8's narrow Payment/Deployment fixes. The affected Payment E2E was repeated successfully, the entire Frontend unit suite was repeated, and Deployment Mock/Static/Security tests ran against the final edits. **Do not report 75/75 as a second Phase 8 full-run result.**

#### 4. Diff/security and cleanup integrity

- Scoped source changes: Backend `dynamodb.js`, `platform-admin.service.js`, `user.repository.js`; frontend Platform, Payment, Storefront layout, Auth/Audit responsive modules; E2E/Unit test-owned files; Deployment/Tooling scripts, plus dated reports/AWS checklist. No changed CloudFormation template, real AWS resources, application API contract schema or new runtime package dependencies.
- Backend `BatchGet` keeps table scope, maximum 100 unique User keys, bounded unprocessed-key retries, order reconstruction and **fail-closed missing profile** semantics. Persisted role and tenant checks remain authoritative. There is no new Scan of the database or exposure of passwordHash in public DTOs.
- Payment approve/reject remains one Backend mutation followed by readback; no duplicate writes, unauthorized cross-tenant access or synthetic real-money operations were introduced.
- `Inventory` keeps exactly one **journal-owned** disposable Order per browser run, uses an independent cleanup context and verifies `CANCELLED` before publishing the complete 28-path/33-snapshot artifact. Its eight existing ownership journals were all verified-cancelled in Phase 7. A hard power-off may interrupt teardown and requires journal-guided recovery. Business soft-cancellation preserves historic audit records intentionally.
- The user-owned LocalStack data and **three unattributed pre-existing pending Demo Customer Orders** remain unmodified; no blanket fixture purge performed. Other successful synthetic E2E scenarios may leave owned data for Dev audit.
- No local temporary `scripts/.deploy-infra.*` secret directories or `scripts/.releases/*` snapshots remained after the fake/mock tests; those tests use disposable folders. No Git commit/push or intentional changes to Docker container state.

#### 5. Non-blocking deferred items / production release gates

The following are **not** signed off as PASS by this local/offline Phase 8 review:

1. **AWS live tests ALL NOT RUN**: real Learner Lab identity/IAM, file-based CloudFormation override behavior with AWS CLI v2, real anonymous Files S3 privacy and presigned URL isolation, HTTPS architecture for real users, real Lambda/API Gateway/Worker/SQS/CloudWatch, cost and p95 performance, rollback, production backups/PITR/S3 Versioning, actual restore and measured RPO/RTO. S3 Static Website HTTP is classroom **DEMO ONLY**.
2. **Separate environment-gated Cross-System E2E:** **5 TODO / NOT EXECUTED**; Local Smoke **12 TODO**; Contract **2 TODO**. These do not disappear because the 75 Playwright cases passed.
3. **Concurrency quality:** One Backend test invocation in Phase 7 exited 1 when launched simultaneously with several other suites; two isolated Phase 7 runs and this Phase 8 isolated run all passed 297/297. The precise initial failure was not preserved/root-caused. Do not certify arbitrary CI parallel workload.
4. **Device and accessibility:** Physical iOS/Safari, Android, VoiceOver/TalkBack, actual screen-reader reading sequence vs CSS mobile visual order and full WCAG verification remain manual follow-up. Automated viewport/axe coverage is not a substitute.
5. **Resilience:** Frontend snapshot is operator-local, not immutable/durable remote backup; real interrupted-S3-upload rollback must be rehearsed after approval. Inventory teardown is robust against a test timeout but not an OS crash without manual journal recovery.

All AWS-only items and approvals remain documented in `tests/reports/aws-live-validation-checklist.md`, `tests/reports/aws-data-recovery-runbook.md`, and `scripts/FRONTEND_RECOVERY.md`.

**Phase 8 review conclusion: PASS for local/offline remediation readiness; NOT CERTIFIED for actual AWS or production.** No further phase is pending in this particular BDXA plan. Do not Commit, Push, Deploy, reset Compose, or delete historical data unless instructed separately.
