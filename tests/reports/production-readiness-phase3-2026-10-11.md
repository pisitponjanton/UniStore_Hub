# UniStore Hub — Production Readiness Phase 3: Performance & Scalability

- Date: **2026-10-11 (Asia/Bangkok)**
- Workspace: `UniStore_Hub`
- Workspace Plan: **Production Readiness & Quality Assurance — Phase 3**
Environment: **local macOS / Docker Compose / LocalStack**, Next.js 16.3.7 development server, Express backend. **No real AWS performance, native-device field CWV or production deployment was tested.**

## Summary and performance decision

**PHASE 3 LOCAL PERFORMANCE OPTIMIZATION: VERIFIED. PRODUCTION PERFORMANCE SIGN-OFF: PENDING.**

A real network baseline identified an **N+1 public Landing API fanout**: frontend fetched the Organization list (2 paginated requests) followed by **264 per-organization Store requests** for a local populated dataset of 264 ACTIVE Organizations. The frontend originally made **266 HTTP requests** before the complete directory appeared (React development-mode repeated effects can produce different request counts in other builds).

An additive public aggregate `GET /api/v1/storefront/directory` endpoint now resolves the same public Organization/Store DTOs with bounded **12-way** DynamoDB Store-query concurrency, without repeating the Organization get-by-ID for each active record. The frontend uses that one endpoint, and **falls back to the existing Organization/Store cursor endpoints only on HTTP 404**, preserving compatibility with an older Backend. All old public API paths remain available; `docs/api/API_CONTRACT.md` was updated with an explicit **PROJECT DECISION** and the current aggregate response's scaling limit. Business logic, tenant authorization and public visibility invariants remain unchanged.

### Actual before/after measurement — populated local fixture

**Method:** fresh Chromium browser context; visit `http://localhost:3000/`, measure time to visible, completed directory result summary; observe outgoing `/api/v1/storefront/` requests; 3 serial runs per version. Browser cache/context reset between runs; hardware and development server contention are not controlled. Do not treat this as an internet/P95 SLO.

| Metric | Before change | After change | Meaning |
| --- | --- | --- | --- |
| Storefront HTTP requests per Landing visit | **266** | **2** | ~**99.25% fewer** requests during development-mode render |
| Time to directory results, run #1 | 2,220 ms | 1,665 ms | Real Chromium elapsed wall-clock |
| Time to directory results, run #2 | 1,983 ms | 1,885 ms | Real Chromium elapsed wall-clock |
| Time to directory results, run #3 | 1,964 ms | 1,459 ms | Real Chromium elapsed wall-clock |
| 3-run mean | **2,056 ms** | **1,670 ms** | ~**19% lower** in this local test; not statistically significant |
| 3-run median | **1,983 ms** | **1,665 ms** | ~16% lower |
| Root API response payload bytes, headers summed | 151,767 bytes | 145,139 bytes | Compression/content delivery may vary by environment |
| Directory result identity | 264 active organizations, 225 stores, 39 without stores | **Identical** | Strict equality across all returned public fields |

**Exact compatibility audit:** Node fetch re-ran all existing public Organization and per-Organization Store list routes and `assert.deepEqual` compared their resulting nested DTOs with the aggregate endpoint. **264 Organizations / 225 Stores / 39 empty Organizations matched exactly** in content and order; no unknown private fields were introduced. The new aggregate route requires **no JWT**, just like existing public Storefront routes.

### Actual local aggregate API latency and payload

12 sequential `GET http://127.0.0.1:4000/api/v1/storefront/directory` fetches, including body consumption. Observed round-trip durations (ms):

`644, 487, 630, 747, 506, 508, 510, 590, 490, 845, 487, 461`

- Median/P50: **508 ms**
- Nearest-rank P95: **845 ms** (12 samples; equivalent to observed maximum; **not** an SLO-quality percentile)
- JSON response: **145,139 bytes**
- Results: 264 Organizations, 225 Stores, 39 without visible Stores
- No external load-generator, CPU/memory saturation or production-concurrency capacity test was performed.

### Synthetic large-dataset browser validation — NOT a backend load test

Executable: `frontend/e2e/storefront-large-directory.spec.ts`. This test intercepts only the aggregate Storefront directory response and supplies in-memory synthetic data: **1,200 ACTIVE Organizations**, **2,200 Stores**, 100 Organizations with no Stores, for **2,300 searchable entries**. It verifies the first/last Store, complete-search correctness, a search matching the final Store, empty-organization filter, page-bounded DOM, responsive overflow and request count. No LocalStack database records are inserted for this stress case.

| Viewport | Observed time to result | Total searchable entries | Rendered DOM elements | Store links rendered |
| --- | --- | --- | --- | --- |
| 390px (mobile) | **458–647 ms** across two standalone local runs | 2,300 | 249 | 16, including 4 featured |
| 1440px (desktop) | **463–554 ms** across two standalone local runs | 2,300 | 249 | 16, including 4 featured |

Functional stress/browser test **PASSED**. These timings use a mocked response and **do not** establish DynamoDB latency for a real 1,200-Organization deployment. A separate backend unit test with 90 synthetic Organizations verified **at most 12** simultaneous Store data queries and stable result order.

### Lighthouse / Core Web Vitals **local dev laboratory result**

Executed **Lighthouse 13.5.0** against `http://localhost:3000/` with headless Chrome (one run, Lighthouse simulated network/CPU throttling, **Next.js development server**, not optimized served static export).

| Laboratory audit | Measured result |
| --- | --- |
| Performance score | **69/100** |
| Accessibility (automated Lighthouse) | **100/100** |
| SEO | **100/100** |
| First Contentful Paint (FCP) | **1.4 s** |
| Largest Contentful Paint (LCP) | **9.2 s** |
| Total Blocking Time (TBT) | **246 ms** |
| Cumulative Layout Shift (CLS) | **0.013** |
| Speed Index | **3.8 s** |
| Root document response | **84 ms** |
| Total network byte weight | **~1,070 KiB** |
| Interaction to Next Paint (INP) | **NOT MEASURED**, requires interaction/field-data methodology |

The observed **9.2 s lab LCP is a performance risk**, not a passing production Web Vital. The LCP element was the Landing hero `h1`; the audit also flagged render-blocking development CSS. The measured Lighthouse score must **not** be presented as production performance. A representative **optimized static build served from real/representative staging** with appropriate CORS and actual client connectivity must be benchmarked separately before any release Go decision. Chrome UX Report (CrUX) / real-user INP are unavailable locally. Production Web Vitals targets to validate in staging: LCP ≤ 2.5 s, CLS ≤ 0.1 and INP ≤ 200 ms at the 75th percentile.

### Static-export/bundle footprint

`frontend: npm run build` succeeded with **30 prerendered static routes**. Directory sizes observed locally: `frontend/out` **3.2 MB**, `frontend/.next/static` **1.8 MB**. The 1.0 GB `.next` work directory includes local **build/dev cache**, **not** deploy output and not a static-site bundle; no cleanup was performed.

## Tests and contract evidence

| Verification | Final observed status |
| --- | --- |
| Backend Storefront service/HTTP tests including public DTO/ACTIVE filtering and concurrency | **17/17 PASS** |
| Full Backend unit tests / canonical route manifest | **290/290 PASS** |
| Frontend Storefront service tests including 404 fallback and server-error behavior | **8/8 PASS** |
| Full Frontend Vitest | **294/294 PASS** |
| LocalStorefront large browser dataset + public navigation tracking | **6/6 Playwright PASS** |
| Post-build Chromium Guest matrix | **1/1 group PASS**, 6 routes × 11 viewport pairs |
| Post-build WebKit large-directory stress | **1/1 PASS**, 2,300 search entries at mobile/desktop |
| Cross-system Frontend/Static contract | **33/33 PASS** |
| Contract | **196 PASS / 2 TODO / 0 FAIL** |
| Integration | **36/36 PASS** |
| Security | **14/14 PASS** |
| ESLint / TypeScript / Backend syntax check | **PASS** (177 backend JavaScript files) |
| Next.js static production build | **PASS**, 30 routes |
| `git diff --check` | **PASS** |

One Backend full-suite run first failed because its exact direct-route manifest expected the **old** public endpoints. The manifest was updated to include only the newly documented `GET /directory` route; it then passed **290/290**. Likewise the Frontend cross-system evidence harness was updated to reference the renamed performance-aware storefront test, then passed **33/33**.

## Scaling risk, release gates and operational constraints

1. **Unbounded aggregate size:** The new route still visits each ACTIVE Organization's Store partition and emits all public Directory records. It bounds concurrency at 12 but is **not** a paginated/indexed backend search; at 10,000+ Organizations, JSON size, Lambda duration, DynamoDB RCUs and API Gateway payload limits can become blockers. Next revision for true large-scale load should specify server-side indexed search, cursor pagination, optional caching and load-test thresholds as a coordinated API Contract change. Do not mask this limitation.
2. **Client search semantics preserved:** Every ACTIVE Store and empty Organization remains searchable by Thai/English names across the full fetched directory before the frontend's 12-entry display pagination. Backend does not leak PENDING/SUSPENDED Organizations, INACTIVE Stores or internal fields. No client-provided tenant scope grants access.
3. **Deployment compatibility:** Backend can deploy first; newer Frontend uses aggregate when present. If Frontend is temporarily newer, a 404 from older Backend triggers the unchanged legacy cursor path. All non-404 failures propagate rather than silently claiming an empty directory.
4. **Lighthouse / actual Web Vitals remain open:** Dev LCP 9.2 s is a measured concern; optimized-production hosting, network, real browser/device data and INP need independent verification. No claim of passing production performance thresholds is made.
5. **No AWS activity / no commit:** All tests and mutations stayed in local Docker Compose + persistent LocalStack or in-memory Playwright fixtures. No AWS resource, secrets, staging, production, push/deploy or global database reset was touched. The existing uncommitted Phase 1/2 changes were retained.
6. **Phase 4 next:** Inspect AWS Learner Lab staging, IAM, S3 private file behavior, Lambda, DynamoDB/SQS, observability and rollback **via local read-only/dry-run validation only**, not live deployment or AWS inspection without explicit user authorization.
