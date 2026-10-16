# UniStore Hub — Local Audit Remediation Phase 3: Inventory E2E Reliability & Safe Cleanup

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace:** `UniStore_Hub` / BDXA current plan Phase 3
- **Status:** COMPLETED — targeted local Inventory browser, artifact readiness, timeout recovery and cleanup verified.
- **Scope:** Existing localhost Docker Compose frontend/backend and LocalStack only. No AWS, no production data, no database reset, no historical-order deletion, no commit/push.

## 1. Original defect and correction

Original `frontend/e2e/interaction-inventory.spec.ts` defined one test with a hard-coded `test.setTimeout(55_000)`, serially visited 33 role-specific renderings of 28 canonical routes, waited 600ms per page, created a Customer pending Order, and attempted cancellation in `finally` with the Playwright `request` fixture. On a timeout that request context had already been disposed; historical retries failed and `frontend/test-results/interaction-inventory.json` was missing.

**Implemented only inside `frontend/e2e/interaction-inventory.spec.ts`:**

1. Split the 33 route cases into **five serial role-scoped tests**: Anonymous 6, Customer 7, Organization Admin 13, Staff 4, Platform Admin 3. Per-role budget 90s; setup has separate 60s budget, teardown has separate 90s budget. No single global 55s test. Retain full canonical route table and 28-distinct-path acceptance.
2. Create exactly **one new disposable Order for the inventory run**, not a shared historical Order. Immediately write a **unique run-owned JSON journal** under Git-ignored `frontend/test-results/interaction-inventory-owned-order-<runId>.json`, including its exact Order ID, organization, owner role, timestamp and pending cleanup state.
3. In `test.afterAll`, allocate a **new independent Playwright APIRequestContext** (30s per request, not the expired per-test `request` fixture). Cancel **only the new journal-owned Order**, re-fetch the same Order through Customer authenticated API and require persisted `status=CANCELLED`. Update the run journal to `verified-cancelled` or `failed` plus error. Keep journal if cleanup fails so recovery is attributable; do not sweep old or unidentified records.
4. Publish `frontend/test-results/interaction-inventory.json` only after full 33-snapshot completion, 28 unique URL paths and verified Order cleanup; incomplete runs do not overwrite a previous successful artifact.
5. Fix a **false-positive inventory** found during this Phase: the first split run reported 5/5 PASS yet numerous authenticated pages were snapshotted during pre-hydration (0 interactive controls). Added page `main` and semantic `main h1` visibility checks, bounded waiting for transient loading indicators, polling for **at least one visible control**, plus explicit per-page assertion. A route cannot silently pass with a zero-control snapshot. Readiness failure now mentions the route label.
6. Add opt-in `E2E_INVENTORY_FORCE_TEST_TIMEOUT_ROLE` fault-injection hook (default unset) for a local failure-path verification without changing app behavior. No new runtime dependencies.

## 2. Verified browser results and artifact quality

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

## 3. Verified cleanup, including timeout failure

- All new inventory Orders from this Phase are recorded in unique journals; all Phase-3 journal records now show **`verified-cancelled`**.
- During an intermediate test failure, the separate cleanup context's *previous* 10s login limit was exceeded; the failed journal retained the exact ID. **Recovered only that journal-owned Order**, after reading its current `PENDING_PAYMENT` state, then canceled and independently verified `CANCELLED`. No other Order was changed by recovery.
- Improved teardown APIRequestContext request budget to 30s, separate from the route test timeout.
- **Deliberate failure-path test:** locally set `E2E_INVENTORY_FORCE_TEST_TIMEOUT_ROLE=anonymous` and run only `capture anonymous`; runner intentionally **FAILED at 1-second timeout**, as expected. The `afterAll` hook **still canceled its own Order and verified `CANCELLED`** using its independent context. It did not replace the last complete `interaction-inventory.json`. This expected failure is a *teardown proof*, not an application regression. Temporary log: `/tmp/unistore-phase3-forced-timeout.log`.
- Read-only DynamoDB count after the final run for the **seed Customer and 2026-10-16 only**: 11 Orders, 8 `CANCELLED` and **3 `PENDING_PAYMENT`**. The previous Phase-1 baseline was **3 pending** in that same customer/date scope. Thus no additional pending seed-Customer Orders remain from this Phase. The 3 pre-existing pending Orders remain **unattributed and untouched**; never cancel them from a date/status heuristic.
- Cancellation is a **business soft-cancel**, not deletion of the audit record; the canceled orders remain in the Dev DB as expected. No claim of physical record cleanup or zero other test fixtures.
- Independent request contexts do not protect against a forced OS process kill or machine power failure; the per-run journal is the recovery marker for those cases. Do not claim crash-proof cleanup without an external recovery service.

## 4. Local validation, boundaries and next steps

- TypeScript `npx tsc --noEmit`: **PASS** after the test refactor.
- `git diff --check`: **PASS**.
- Docker Compose unchanged and running; no `up --build`, reset, volume deletion or AWS actions.
- Prior pending modifications from Phase 2, `WEB_QUALITY_AUDIT.md`, the Phase 1/2 reports and `tests/reports/aws-live-validation-checklist.md` are preserved, not overwritten or committed.
- This Phase added/changed only `frontend/e2e/interaction-inventory.spec.ts` plus this report; generated output/journals are in Git-ignored `frontend/test-results`. Temporary runner logs/traces under `/tmp` can be pruned later without deleting the journal that proves ownership.
- **Phase 4** is next: assess flaky payment success feedback, Staff navigation, Platform tracking and Guest matrix; preserve full authoritative state checks. **Phase 7** will run all 67 distinct cases again and append the latest result to the historical `WEB_QUALITY_AUDIT.md`.
- AWS-only test items remain `NOT RUN` in `tests/reports/aws-live-validation-checklist.md`; no production-ready claim.

**Phase 3 local acceptance:** **PASS** — full control inventory generated, 28 canonical routes verified, all snapshots contain visible controls, deliberate timed-out test successfully cleaned up its owned fixture, no new pending seed-Customer Order residue. Do not start Phase 4 until separately requested.
