# UniStore Hub — Local Audit Remediation, Phase 1: Baseline, Ownership & Reproduction

- **Date:** 2026-10-16 (Asia/Bangkok)
- **BDXA workspace plan:** `UniStore Hub — Local Audit Remediation & AWS Handoff`, Phase 1
- **Environment:** only already-running `docker-compose.dev.yml` / Next.js Dev + Express API + LocalStack on loopback
- **Outcome:** **PHASE 1 BASELINE CAPTURED**; Phase 2–7 code fixes and full clean regression are **NOT STARTED**.
- **Scope:** read-only repo, API and DynamoDB inspection; narrow browser E2E cases that only navigate/inspect. **No source code edits, no test-created orders in this Phase, no LocalStack reset/delete, no AWS calls, no commit/push.**

## 1. Canonical source and ownership review

Read and cross-checked:
- `SPEC.md`, `AGENTS.md`, `docs/specs/00-shared-contracts.md`
- `docs/specs/frontend/SPEC.md`, `docs/specs/backend/SPEC.md`, `docs/specs/data/SPEC.md`, `docs/specs/testing/SPEC.md`, `docs/specs/integration/SPEC.md`, `docs/architecture/AWS_ARCHITECTURE.md`
- `frontend/AGENT.md`, `backend/AGENT.md`
- `WEB_QUALITY_AUDIT.md` §§18–21; `tests/reports/production-readiness-phase3-2026-10-11.md` and other previous handoffs.

Ownership:
- Frontend agent: `frontend/**` (pages, loading/UX, `frontend/e2e/**` subsystem-local browser tests).
- Backend agent: `backend/**` (Platform Admin queries/authorization/repositories).
- Testing agent: `tests/**` cross-system tests and evidence, no arbitrary edits to application.
- Integration/root: shared spec/contract reconciliation, final diff and cross-subsystem compatibility.
- Infrastructure and Deployment remain limited to the approved Learner Lab architecture; live AWS validation is deferred to `tests/reports/aws-live-validation-checklist.md`.

## 2. Initial Git and Docker baseline

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

## 3. Platform Admin performance — code path and reproduction

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

## 4. Interaction Inventory hard timeout / cleanup-risk verification

`frontend/e2e/interaction-inventory.spec.ts`:
- Explicit `test.setTimeout(55_000)` overrides an attempted `--timeout=180000` command-line default.
- It visits **28 routes serially**, waits after every navigation and reads visible controls, then calls `cancelPendingOrder(request, orderId)` in `finally`.
- Prior archived full-suite and targeted rerun failed at 55s, and teardown disposed the request context before cleanup succeeded. `frontend/test-results/interaction-inventory.json` is still **absent** in the new inspection.
- **Confirmed test design weakness:** one slow serial 28-route test coupled to the same timeout-constrained Playwright request context for teardown. A failed request does not establish that every corresponding Order was left pending.
- Required in Phase 3: defensible batching or per-test budgets, record exactly owned disposable order IDs before use, robust and verified cleanup with valid context, independent state check. Do not simply extend a global timeout; do not cancel unknown historical records.

## 5. Read-only LocalStack order inventory (data safety)

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

## 6. Source ownership / corrective handoff

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

## 7. Phase decision / gates

- Phase 1 baseline, source ownership, previous full-suite failed/flaky evidence and read-only data classification: **COMPLETED**.
- Platform performance root cause: **hypothesis to validate Phase 2**; fresh narrow Platform Browser test PASSED, which emphasizes intermittent rather than consistently broken navigation.
- Inventory/test cleanup: **known blocking test-design defect**; possible remaining LocalStack Order fixtures are NOT attributable yet; **no deletion authorized**.
- No source edits, no AWS calls, no Commit/Push. Original WEB_QUALITY_AUDIT.md §§1–21 and the AWS checklist remain untouched.
- **Next authorized task:** Phase 2 — Platform Admin Loading & API Performance only. Do not start it as part of completing Phase 1.
