# Website QA, UX/UI, Layout & Visual Quality Audit Report

> **Application:** UniStore Hub — Multi-Tenant Campus Commerce
> **Audit date:** 2026-10-16 (Asia/Bangkok)
> **Location:** Root of the BDXA workspace `UniStore_Hub`
> **Mode:** READ-ONLY application audit; **NO implementation, application edit, data reset, Git commit, or deployment**.
> **Target:** Local Docker Compose Development / LocalStack, Next.js at `http://localhost:3000`, API at `http://localhost:4000/api/v1`.
> **Status:** **PARTIALLY COMPLETED**. Most discovered routes have responsive geometry sampling, but CRUD/real payment/production IAM/S3, complete human workflows and accessibility AT coverage remain NOT TESTED/BLOCKED. This report is a fresh audit after commit `1a11f76`, not a resurrection of the deleted historical audit.

## 1. Executive Summary

UniStore Hub เป็นระบบร้านค้าหลายหน่วยงาน (Platform Admin, Organization Admin, Staff, Customer, Guest) สำหรับร้านค้า/สินค้า/แคมเปญพรีออเดอร์ → Order → ตรวจหลักฐาน Payment → Production/Pickup. สถาปัตยกรรมที่อ่านได้จาก `SPEC.md`: Next.js Static Export, Express/Lambda, DynamoDB, S3, SQS และ AWS Learner Lab. **การตรวจครั้งนี้เกิดบน Local Dev เท่านั้น ไม่ได้แตะ AWS จริง**.

### Key findings

| ID | Severity | Evidence-based observation | Impact / status |
|---|---|---|---|
| **BUG-001** | **P2**, local-origin specific | เปิด `http://127.0.0.1:3000/` แล้วผ่าน 8–9 วินาที UI ยัง “กำลังตรวจสอบบัญชี/กำลังโหลดร้านค้า”, Store links = 0; Console แจ้ง Next.js HMR WebSocket handshake failures. เปิด `http://localhost:3000/` แสดงร้านได้และโหลดเสร็จ ~1.9 วินาทีในการวัดตัวอย่าง | Environment-origin/Dev-host consistency defect **confirmed**, สาเหตุเชิงเทคนิคยัง INVESTIGATE. ไม่อ้างว่า Production URL เสีย |
| **UX-001 / LAYOUT-003** | **P2**, Local Demo data | Landing แสดง 245 ร้าน / 287 หน่วยงาน และรายการจำนวนมากใช้ชื่อ `E2E Organization`, `Reject E2E`, `Tenant Org B` ฯลฯ | Demo/test record ปะปนในผลลัพธ์ ทำให้หา Store ที่ต้องการยาก; **ไม่ใช่ข้อพิสูจน์ Production data leakage** |
| **PERF-001 / LAYOUT-004** | **P2 INVESTIGATE** | Organization Orders Route ไม่พบ `main` ภายใน 4 วินาทีที่ 375, 820, 1440px ใน 3/11 การวัดแรก; เปิดซ้ำรอจนหัวข้อ “คำสั่งซื้อของหน่วยงาน” ขึ้นใช้ ~3,852ms หนึ่งครั้ง | Loading/readiness เป็นช่วงสั้นที่วัดได้; **ยังไม่ใช่ยืนยันว่าหน้าใช้งานไม่ได้** |
| **LAYOUT-001 / UI-001** | P3 | Sidebar Organization Admin ที่ 1440px แสดง UUID หน่วยงานยาวหลายบรรทัดใน block สรุปหน่วยงาน | ใช้พื้นที่เหนือ Navigation โดยไม่ช่วยทำงาน; ชื่อหน่วยงานควรมาก่อน ID เทคนิค |
| **LAYOUT-002** | P3, design refinement | หน้า Dashboard Organization Admin ที่ 390×844: Hero ขนาดใหญ่ประมาณ y129–445, KPI แรก y469–652, KPI ลำดับถัดไปเริ่มใกล้ y677 | งาน/ตัวเลขรองต้องเลื่อนลงหลายช่วง; ต้องรักษา KPI งานค้างที่ขึ้นก่อนแล้ว |
| **ASSET-001** | P3 **subjective / investigate**, not a broken image | Store Campaign Card ใช้ abstract purple/yellow geometry เป็นภาพปกใน Seed Demo | ใช้ได้ใน Demo แต่ภาพสินค้า/กิจกรรมจริงช่วยสื่อความหมายได้ดีกว่า; ไม่พิสูจน์ AI provenance และ **ไม่แนะนำเปลี่ยน Assets โดยไม่มีไฟล์จริง** |

**Positive evidence:** Login validation แสดงทั้ง summary และ field errors; Guest Search zero-results/clear → รายการร้านกลับมา, เข้า Store → Browser Back/Forward ถูกต้อง; 7 unauthorized-route probes ถูกปฏิเสธตามบทบาท; Order Detail/Payment/Pickup ทั้ง 4 route-family ที่ใช้ Order เดิมแสดงหัวข้อ/Controls ครบ 11 viewports; ใน geometry captures ที่สำเร็จทั้งหมด **ไม่พบ document horizontal overflow**.

### Coverage snapshot

- **28 canonical Next.js pages** discovered directly from `frontend/src/app/**/page.tsx`.
- **29 role/route combinations × 11 mandatory viewport pairs = 319 planned geometry observations**; recorded **316**, remaining **3 timed out** (Organization Admin Orders at the dimensions above). **316/319 = 99.1% viewport *sampling***, **NOT** functional workflow coverage.
- 272 generic route observations, 44 extra existing-Order detail/payment/pickup observations. Generic sampling occurred shortly after DOM content and many screens still displayed Loading, so geometry-only results are **not equal to completed-state validation**. Later targeted screenshots and ready-state tests cover representative pages.
- **8 axe-core automated audits**, 4 Guest routes × 390/1440: **0 reported WCAG-tag violations**, **1 incomplete/manual-review result per scan**. Does not certify WCAG 2.2 AA.
- Guest functional spot checks: Search no-match; reset filters; open Store; Back + Forward; Login empty-submit validation; Login/Register form presence. Role access controls: **7/7 expected access denial**.
- Existing historical Phase 7 evidence on this workspace recorded 75/75 Chromium E2E PASS; **that suite was NOT rerun as part of this read-only audit** because its test fixtures mutate LocalStack and normal Playwright outputs write inside protected workspace. It is background evidence, not included in the current execution count.
- **Production readiness:** NOT CERTIFIED. Real AWS IAM, S3 privacy, HTTPS real-user path, SQS, rollback and backups remain outside this local audit.

## 2. Application Inventory

These are 28 discovered route files; a query-sensitive route family must have the required identifiers supplied. "Sampled" means browser layout was sampled, **not every action tested**.

| Route(s) | Archetype / key task | Roles | This audit |
|---|---|---|---|
| `/` | Storefront directory, search, store discovery | Guest, all users | Screen sampled 11 viewports, guest interactions tested |
| `/login/`, `/register/` | Authentication, signup & validation | Guest | 11 viewports each, empty login validation, no account creation |
| `/stores/view/` | Store detail, campaigns/products | Guest, Customer | 11 viewports, ready screenshot & click-through |
| `/campaigns/view/` | Campaign details/open period | Guest, Customer | 11 geometry samples, loaded-state tasks not exhaustive |
| `/products/view/` | Product variants/price/details | Guest, Customer | 11 geometry samples, loaded-state tasks not exhaustive |
| `/orders/new/` | Customer order creation | Customer | 11 geometry samples; submit **NOT TESTED** |
| `/my/orders/` | Order list and tracking | Customer | 11 sampled, read-only existing Order navigation |
| `/my/order/` | Specific Order detail | Customer | 11 ready-state samples using existing Order |
| `/my/payment/` | Payment/slip UI | Customer | 11 ready-state samples, **upload/submit NOT TESTED** |
| `/my/pickup/` | Pickup availability/status | Customer | 11 ready-state samples, not completing Pickup |
| `/notifications/` | Notification list | Customer | 11 samples, read/unread mutation NOT TESTED |
| `/org/select/` | Organization selection | Staff, Org Admin | 22 samples across two roles |
| `/org/dashboard/` | Organization overview / KPIs | Org Admin | 11 geometry samples + desktop/mobile ready screenshots |
| `/org/settings/` | Organization config | Org Admin | 11 samples, Save NOT TESTED |
| `/org/staff/` | Staff/permissions | Org Admin | 11 samples, CRUD NOT TESTED |
| `/org/stores/` | Store management | Org Admin | 11 samples, CRUD NOT TESTED |
| `/org/products/` | Product/variant management | Org Admin | 11 samples, CRUD NOT TESTED |
| `/org/campaigns/` | Campaign management | Org Admin | 11 samples, CRUD NOT TESTED |
| `/org/orders/` | Order operations | Staff, Org Admin | 11 staff + 8/11 org captures; 3 short wait timeouts |
| `/org/orders/view/` | Order detail/operations | Org Admin | 11 ready-state samples with existing Order; mutations NOT TESTED |
| `/org/payments/` | Manual payment verification queue | Staff | 11 samples; approvals/rejections NOT TESTED |
| `/org/pickups/` | Pickup queue | Staff | 11 samples, fulfillment action NOT TESTED |
| `/org/production/` | Campaign production summary | Org Admin | 11 samples |
| `/org/audit/` | Audit log | Org Admin | 11 samples, ready-state/loading differences observed |
| `/platform/summary/` | Platform KPIs | Platform Admin | 11 samples |
| `/platform/organizations/` | Organization review | Platform Admin | 11 samples; approve/reject NOT TESTED |
| `/platform/users/` | User management | Platform Admin | 11 samples; changes NOT TESTED |

**Architecture and role validation:** code/document inventory reconciled against actual localhost routes; no access to live AWS, third-party bank payment, real customer fixtures or physical device.

## 3. Functional Test Coverage

Status vocabulary: `PASS`, `FAIL`, `BLOCKED`, `NOT TESTED`, `NOT APPLICABLE`. One row can represent an observed scenario family, **not every subcase or path**.

| ID | Route | Feature | Role | Executed scenario | Result |
|---|---|---|---|---|---|
| F-01 | `/` | Store search | Guest | Search nonexistent term → no matching links + empty state | PASS |
| F-02 | `/` | Reset search | Guest | Reset filter → Store links restored (16 currently on rendered view) | PASS |
| F-03 | `/` → `/stores/view/` | Navigation | Guest | Click real “เข้าร้าน” link → local Seed Store opens | PASS |
| F-04 | Home↔Store | History | Guest | Back and Forward (rechecked with URL wait) | PASS |
| F-05 | `/login/` | Input validation | Guest | Empty submit → summary + email/password inline errors | PASS |
| F-06 | `/login/`, `/register/` | Form structure | Guest | Visible forms: Login 2 inputs, Register 3 inputs | PASS |
| F-07 | `/platform/users/`, `/my/orders/`, `/org/dashboard/` | Auth gate | Guest | Three restricted routes request Login | PASS (3/3) |
| F-08 | `/platform/users/`, `/org/settings/` | RBAC | Customer | Both routes deny access | PASS (2/2) |
| F-09 | `/platform/summary/` | RBAC | Staff | Platform route denies access | PASS (1/1) |
| F-10 | `/platform/users/` | RBAC | Org Admin | Platform route denies access | PASS (1/1) |
| F-11 | `/org/orders/` | Authorized route | Org Admin | Existing Org Orders opens after waiting ~3.85s in one sample | PASS |
| F-12 | `/my/order/`, `/my/payment/`, `/my/pickup/` | Existing Order pages | Customer | Three route families × 11 viewports, loaded headings, controls | PASS (read-only) |
| F-13 | `/org/orders/view/` | Existing Order detail | Org Admin | 11 viewports, heading and action elements | PASS (read-only) |
| F-14 | `http://127.0.0.1:3000/` | Alternate local origin | Guest | 8–9 seconds at loading state, zero Store links; HMR errors | **FAIL** (environment-specific) |
| F-15 | `/register/`, Checkout, Payment, Org CRUD | Persisting data | Authorized roles | Account creation, actual orders/slips/refunds/changes | **NOT TESTED** (read-only safety) |
| F-16 | Notifications / SQS | Delivery/read state | Customer/Staff | End-to-end asynchronous event | **NOT TESTED** (would mutate data / infrastructure) |
| F-17 | AWS public URL / private Files S3 | Cloud deployment and privacy | all | Real cloud access, presigned GET/PUT, HTTPS, IAM, rollback | **BLOCKED** (no authorized AWS session) |

**Actual functional coverage percentage:** **NOT COMPUTABLE** because the total number of applicable interactive scenarios was not exhaustively enumerated and many write paths were intentionally unexecuted. The 316/319 count belongs **only** to viewport geometry sampling, not CRUD or E2E functional pass rate.

## 4. Functional Bugs

### BUG-001 — Local `127.0.0.1` origin leaves storefront loading

- **Severity:** P2; Scope: Local Dev / alternate host; **Confirmed**. Browser: Playwright Chromium Headless, 390×844; additionally BDXA Browser.
- **Route:** `http://127.0.0.1:3000/`; comparison `http://localhost:3000/`.
- **Steps:** 1) Open fresh Chromium context. 2) Navigate to 127.0.0.1:3000/. 3) Wait 8–9 seconds. 4) Inspect Store results, account header, Console. 5) Repeat with localhost in fresh context.
- **Actual:** 127 remains “กำลังตรวจสอบบัญชี” and “กำลังโหลดร้านค้า”, zero visible Store links; Browser Console repeats `WebSocket ... /_next/hmr ... ERR_INVALID_HTTP_RESPONSE`. localhost shows Store content and login/register links; a controlled localhost readiness sample observed Home ready in 1,931ms.
- **Expected:** Either the documented supported Dev host should fully hydrate, or alternate host should show a clear canonical redirect/unsupported-host explanation rather than indefinite loading.
- **Impact:** Local QA users opening via 127 cannot use the Storefront reliably.
- **Investigation / fix direction:** Compare public environment API URL, cross-origin and allowed dev-host settings, HMR/proxy handling, hydration/network timing, and expected canonical origin. **Do not assume HMR alone causes data failure**; instrument exact request/re-render events and confirm the actual root cause.
- **Acceptance criteria:** 127 and localhost either both show header/Store content within the established readiness budget without unexpected Console failures, **or** 127 immediately redirects/communicates unsupported origin. No secret/CORS weakening, no production origin changes solely for a Dev-only bug.

Other route-load observations are tracked under **PERF-001 / LAYOUT-004 as INVESTIGATE**, not falsely classified as a confirmed broken workflow.

## 5. Responsive Test Matrix

Mandatory viewports: `320×568`, `360×800`, `375×667`, `390×844`, `430×932`, `768×1024`, `820×1180`, `1024×768`, `1280×800`, `1440×900`, `1920×1080`.

All 11 pairs were attempted for each of 29 role/route combinations. `G` = geometry recorded; `T` = short-timeout capture not completed; many `G` observations were **initial loading-state captures** (see last column), not end-to-end route success.

| Role / route family | 320 | 360 | 375 | 390 | 430 | 768 | 820 | 1024 | 1280 | 1440 | 1920 | Caution |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Guest: 6 routes (Home/Login/Register/Store/Campaign/Product) | 6G | 6G | 6G | 6G | 6G | 6G | 6G | 6G | 6G | 6G | 6G | 44 of 66 sampled before Loading settled |
| Customer: My Orders/Notifications/Checkout (3) | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 11 of 33 showed Loading text |
| Staff: Select/Orders/Payments/Pickups (4) | 4G | 4G | 4G | 4G | 4G | 4G | 4G | 4G | 4G | 4G | 4G | 20 of 44 Loading |
| Org Admin: Dashboard/Settings/Staff/Stores/Products/Campaigns/Production/Audit/Orders (9) | 9G | 9G | 8G+1T | 9G | 9G | 9G | 8G+1T | 9G | 9G | 8G+1T | 9G | `/org/orders/` missing `main` within 4s three times |
| Platform Admin: Summary/Organizations/Users (3) | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 28 of 33 early Loading |
| Customer Order Detail/Payment/Pickup (3) | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | 3G | Existing Order, headings and controls confirmed |
| Org Admin Order Detail (1) | G | G | G | G | G | G | G | G | G | G | G | Existing Order, heading and controls confirmed |
| **Total** | **29G** | **29G** | **28G+1T** | **29G** | **29G** | **29G** | **28G+1T** | **29G** | **29G** | **28G+1T** | **29G** | **316G / 3T / 319 attempts** |

**Geometry results on recorded snapshots:** document horizontal overflow `>2px` = **0/316**; unexpected unscrollable nested overflow by heuristic = **0/272** generic samples; loaded ready-state Order detail observations `>2px` = **0/44**; broken `<img>` naturalWidth=0 in generic captures = **0**. The viewport check is browser emulation, not physical mobile/touch-keyboard validation. **134 of the 272 generic route samples still contained the Thai Loading marker**, and 70 had no `main h1` at capture time. Treat those as state-coverage limits, not automatically accessibility defects.

## 6. Responsive Issues

**RESP-001 — P2 INVESTIGATE:** Three 4-second `/org/orders/` main-content readiness timeouts at 375/820/1440px. Same route later displayed “คำสั่งซื้อของหน่วยงาน” after ~3,852ms. Repeat under controlled warm/cold loads, measure API and hydration completion before judging viewport layout. Acceptance: consistent ready state with heading, proper skeleton and no silent hang at all 11 sizes.

**No confirmed horizontal-overflow defects** in 316 recorded viewport observations. The existing focusable Audit horizontal table is an intentional interaction pattern and should not be flattened without evidence. Physical mobile keyboard, orientation, touch target accuracy and assistive-technology behavior are NOT TESTED.

## 7. UX & User Flow Problems

### UX-001 — E2E/demo records dominate public Store discovery
- **Priority:** P2 for a shared demo/QA environment; **not proven in Production**.
- **Evidence:** Loaded `/` displayed “245 ร้าน” / “287 หน่วยงาน”, including obvious `Reject E2E Organization`, `E2E Organization` and `Tenant Org B` records. First page mixes meaningful demo Store with disposable automation names.
- **Impact:** Users cannot easily determine which listings are real/official. Search and pagination are functional but the information is not trustworthy as a curated campus storefront.
- **Recommendation:** Keep real account/order ownership intact; add clearly scoped local fixture/test records and an opt-in QA-only directory filter or separate demo dataset. Do **not** blanket-delete historical LocalStack Orders or silently hide production tenants. Show “demo/test” badge for intentionally public test listings if shared QA data must remain.
- **Acceptance:** A new shopper can identify the university's actual active Store without reading dozens of `E2E` fixtures; QA records remain accessible to authorized testers and no existing tenant data is lost.

### UX-002 — Organization UUID shown as primary sidebar metadata
- **Priority:** P3; see LAYOUT-001.
- **Evidence:** `/org/dashboard/` at 1440 screenshot: full UUID wraps across multiple lines in the pale Organization card at sidebar top.
- **Expected:** Friendly Organization name/status first, and technical identifier only on demand (copy-ID/admin detail).
- **Acceptance:** No multi-line UUID noise in daily operations and identifier remains retrievable for debugging/Support.

**KEEP / verified good UX patterns:** Store search zero-match + reset; visible Back to Store on Login; required-field errors; authorized vs unauthorized state distinction; approval/pickup operational separation; Guest/Customer/Staff/Org/Platform role-specific route guards. Do not redesign correctly separated transaction stages.

## 8. Visual Design Issues

### UI-001 — Technical sidebar string competes with navigation
- **Objective observation**, P3, `/org/dashboard/` and shared Organization shell, 1440px: raw UUID creates awkward multi-line text and visual competition with role navigation.
- **Action:** REFINE Organization summary card typography; show friendly name + status, place ID under collapsible “รายละเอียดเทคนิค” or Copy control. Recheck 390/1440.

### UI-002 — Repeated pastel/gradient hero/card style
- **Subjective design assessment**, P3, especially Organization Dashboard and Storefront: gradient hero, soft shadow, rounded KPI cards repeat as primary styling. This is coherent and readable, **not evidence of AI generation**; however dense operations screens could use slightly tighter vertical hierarchy.
- **Action:** REFINE spacing and action prominence, not wholesale redesign. Do not discard brand purple/blue gradient or meaningful status colors.

## 8A. AI-Looking UI, Asset Quality & Free Replacement Research

**Assets/families actually visually inspected:** (1) Brand/logo treatment on Guest and Org shell; (2) Store Campaign abstract banner/placeholder; (3) Auth Hero treatment; (4) Dashboard gradient, geometric backgrounds, small navigation icons. Screens observed at 390 and 1440, plus geometry/DOM checks at 11 sizes. `frontend/public/` contained **0 local files** in this workspace snapshot; much of the visible imagery is CSS/inline vector/placeholder rather than product photography. `<img>` load-error heuristic did not find broken loaded tags; it **cannot certify CSS backgrounds or external assets**.

**Provenance classification:** `UNKNOWN` for all graphics without creator/source provenance. No trustworthy evidence that any image was AI-generated. This section judges usefulness and rendering only, not authorship.

| Asset ID | Route / Component | Observed issue | Origin | Quality vs style | Action | Free source/license | Priority |
|---|---|---|---|---|---|---|---|
| **ASSET-001** | `/stores/view/`, Campaign image of “Local Demo Campaign” | Abstract purple circle + pale yellow rounded shape is sharp and correctly cropped but conveys no campaign/product semantics in a seeded demo | UNKNOWN | **Subjective contextual-fit question**, not malformed/blurred media | **INVESTIGATE**: whether it is an intended fallback when no merchant image exists; keep for empty state, use actual merchant-uploaded media if available | No replacement justified/verified; avoid inventing stock imagery or a license | P3 |
| — | Auth/Header brand SVG & gradients | Legible at 390px, no observed stroke clipping | UNKNOWN | No actionable defect confirmed | **KEEP** | Not required | — |
| — | Dashboard icon/card graphics | Consistent system shapes; no verified distortion | UNKNOWN | No actionable defect confirmed | **KEEP** | Not required | — |

**Verified free replacement candidates: 0.** No confirmed malformed or broken image currently warrants third-party replacement. Using a generic Pexels/illustration download for real goods could misrepresent products and requires a real media source and license validation. The replacement search protocol is **not triggered** by a mere aesthetic preference. If the team later chooses a replacement, source/license/attribution must be verified for the specific asset first.

Acceptance: source imagery must be crisp at actual device pixel ratio, with correct `object-fit`/crop, accessible alt text where informative, coherent brand palette, no false product representation, and unchanged Store/Checkout behavior.

## 8B. Layout Quality, Template-Like UI & Reference-Based Layout Audit

### 8B.1 Route-family layout inventory and KEEP/REFINE decisions

| Route / page family | Archetype + primary task | Roles | Viewports/states actually inspected | Layout / genericity risk | Reference | LAYOUT issue | Action |
|---|---|---|---|---|---|---|---|
| `/` | Search/results & storefront | Guest | 11 sampled; 390 loaded screenshot, search empty/reset, 1440 source sampling | Search-first credible; demo data noise | R1 Etsy, R2 Eventbrite | LAYOUT-003 | **REFINE** test-data presentation |
| `/login/`, `/register/` | Authentication | Guest | 11; 390 full form, blank submission, 1440 axe | Clear single task with labels/errors; genericity LOW | R1 (navigation only; no matched login inspected) | — | **KEEP** |
| `/stores/view/`, `/campaigns/view/`, `/products/view/` | Store/Product detail | Guest, Customer | 11 geometry; 390 loaded Store screenshot, detail text; campaign/product Loading in quick matrix | Store information visible; contextual asset issue only | R1 Etsy market (limited) | ASSET-001 | **KEEP / INVESTIGATE** |
| `/orders/new/` | Checkout wizard/form | Customer | 11 early samples; no submit | Submit interaction NOT TESTED | R1/R3 as domain analogies only | — | **INVESTIGATE** |
| `/my/orders/`, `/my/order/` | List/detail status | Customer | 11; real existing Order detail fully loaded | Status-first; no documented geometry defect | R3 Shopify official order docs | — | **KEEP** |
| `/my/payment/`, `/my/pickup/` | Payment/Pickup status detail | Customer | 11 ready-state samples of existing Order; no upload/claim | Appropriate task-separated routes | R3 Shopify, R4 Stripe | — | **KEEP** |
| `/notifications/` | Inbox | Customer | 11 early samples | No complete interaction evaluation | R4 Stripe search analogy limited | — | **INVESTIGATE** |
| `/org/select/` | Organization picker | Staff/Admin | 11 each, 22 total | Role selection fits workflow | R3 Shopify settings concept | — | **KEEP** |
| `/org/dashboard/` | KPI + operation navigation | Org Admin | 11 samples; 1440 and 390 fully loaded screenshots | Brand-coherent, hero consumes mobile attention, medium template-like risk | R3 Shopify/R5 Square docs | LAYOUT-001/002 | **REFINE** |
| `/org/settings/`, `/org/staff/` | Settings, permissions | Org Admin | 11 each, no save/write | Full forms visible in samples; no confirmed geometry break | R5 Square official docs | LAYOUT-001 (shared shell) | **KEEP shell / REFINE ID** |
| `/org/stores/`, `/org/products/`, `/org/campaigns/` | Inventory CRUD lists | Org Admin | 11 each, no write | No confirmed clipping; data-entry quality NOT TESTED | R5 Square inventory | — | **KEEP / INVESTIGATE CRUD** |
| `/org/orders/`, `/org/orders/view/` | Order table + detail | Staff/Admin | 11 Staff + 8 Org quick captures, 11 ready detail | Org Orders sometimes slow to show main | R3 Shopify order filters | LAYOUT-004 | **INVESTIGATE** |
| `/org/payments/`, `/org/pickups/` | Operational queues | Staff | 11 each, no mutate | Separated by staff task, sensible | R3 Shopify, R4 Stripe | — | **KEEP** |
| `/org/production/`, `/org/audit/` | Summary + log/table | Org Admin | 11 each, Audit quick load some without h1 | Long table/filters no recorded overflow; loaded Audit state not comprehensively verified | R3/R5 docs | LAYOUT-004 for loading strategy | **KEEP / INVESTIGATE** |
| `/platform/summary/`, `/platform/organizations/`, `/platform/users/` | Platform KPIs, list/approval | Platform Admin | 11 each; many early loading captures | Shared shell structured, no proven layout break | R3/R4/R5 operational analogies | LAYOUT-004 | **KEEP / INVESTIGATE ready-state** |

**Overall visual system:** Purple → blue palette, light cards and soft shadows form a consistent brand. Desktop sidebar clarifies staff/admin tasks; mobile collapses into header/menu. Status cards are functional. Risk of **generic/template-like layout: MEDIUM** because of repeated large gradient hero blocks and pastel KPI card presentation even on dense operational screens. This is a **subjective product-design risk, not AI authorship detection**. Tasks should take priority over decoration; no need to replace conventional tables, tabs or cards simply because they are familiar.

### 8B.2 Prioritized implementable layout issues

| Layout ID | Actual vs expected | Reference pattern / evidence | User impact | Priority | Action and concrete acceptance |
|---|---|---|---|---|---|
| **LAYOUT-001** | Organization sidebar shows a wrapped full technical UUID; users need Organization name/status + navigation. At 1440, the metadata block spans multiple lines | R5 Square inventory docs use contextual item/location identification; not an actual private Dashboard screenshot | Reduces navigation scanability | P3 | **REFINE (small):** Organization name + role/status first, technical ID behind copy/control; same at 390/mobile drawer; preserve ID access for Support |
| **LAYOUT-002** | At 390, Organization Dashboard Hero takes y≈129–445; first KPI below, next KPI appears near bottom y≈677 | R3 Shopify task-first order views, R5 Square inventory docs; **concept from official docs, not asserted pixel-level layout equality** | Relevant data requires more scrolling than on desktop | P3 | **REFINE (small/medium):** shorten header/role banner on mobile, show outstanding Payment count immediately, preserve all secondary KPIs below; test 320/390/768/1440 |
| **LAYOUT-003** | Storefront directory displays 245 Stores and 287 Organization entries with many E2E names | R1 Etsy search/product relevance; R2 Eventbrite category/location filters | Search results less credible | P2 **local demo** | **REFINE (medium):** environment-aware QA fixture visibility or clearly mark QA listings; retain search/filter/pagination and do not suppress legitimate tenant results |
| **LAYOUT-004** | Some async-list routes lack visible `main h1` while data loads, and Org Orders timed out at 4s in 3 viewports | R3 Shopify persistent order navigation/filter framework (official docs); R4 Stripe search status conventions | Potential wait/feedback uncertainty | P2 **INVESTIGATE** | **REFINE only if reproduced:** stable page header and accessible loading status from initial render, then hydrated table. Instrument cold/warm/API p95, test all 11 viewports; avoid counting early loading capture as a fail |

**Desktop/mobile section guidance for implementing agent:**
- Landing: Brand/navigation → compact search/primary store-discovery controls → first featured real Store → searchable results & pagination → optional explanatory how-it-works content; on desktop preserve multi-card featured arrangement if relevant and effective.
- Org Dashboard: Mobile header/role compact → Payment queue KPI/CTA → Order/Pickup KPI → Store/Product quick actions → filters/reporting; desktop preserve sidebar + broad KPI grid. Avoid hiding financial status information.
- Admin order/payment lists: Retain persistent title/status + filters, then rows/actions; prefer visible skeleton or `role=status` during async load. Table scroll must be keyboard reachable.

### 8B.3 Reference-based product fit & score rubric

Only rate inspected major families, rather than inventing values for unseen interaction states. Ratings are **qualitative (1–10)**, NOT WCAG or performance certification.

| Family | Task-first IA | Visual hierarchy | Geometry | Density | Component purpose | Brand | Consistency | Responsive | Interaction | Reference maturity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Storefront/Home (390 loaded) | 8 | 8 | 8 | 7 | 8 | 8 | 8 | 8 | 8 | 7 |
| Auth (390 forms/validation) | 9 | 8 | 9 | 8 | 9 | 8 | 8 | 8 | 8 | NOT TESTED (like-for-like reference login not verified) |
| Store detail (390 loaded) | 8 | 8 | 8 | 7 | 8 | 8 | 8 | 8 | 7 | 6 (reference page access limited) |
| Org Dashboard (390+1440 loaded) | 8 | 8 | 8 | 6 | 8 | 8 | 8 | 7 | NOT TESTED (write actions) | 7 (docs-only) |
| Other administrative lists | NOT TESTED beyond sampled hierarchy | NOT TESTED | 8 (observed width only) | NOT TESTED | NOT TESTED | 8 (shared shell) | 8 (shared shell) | 8 (geometry) | NOT TESTED | NOT TESTED |

**Fix-vs-preserve:** Keep the tenant-based sidebar, shared brand colors, existing transaction separation, focusable Audit table and search/filter controls. No evidence demands a full redesign. Implement only specific defects, with screenshots and regression checks before/after, including session and tenant RBAC.

## 9. External Website Research

Publicly verified references and explicit evidence levels. **No private Shopify/Stripe/Square admin interface was accessed.** Shopify public help article was also inspected with the remote browser. Dynamic Etsy browsing was blocked in the remote browser, so page-content comparison relies on public web result only.

| Ref | Current archetype | Reference website + exact URL | Verified evidence level | Comparable pattern / what to adapt and *not* copy |
|---|---|---|---|---|
| **R1** | Storefront search/catalog | **Etsy** marketplace page: https://www.etsy.com/market/handmade_gifts | **LIMITED/UNVERIFIED interactive**: public listing content retrieved from web; remote live browser navigation failed; mobile visual not verified | Clear item/category filtering and relevance sorting; UniStore's tenant-first store directory is more suitable for campus units, so **keep tenant scope**, borrow clarity of curated results, not Etsy brand/images |
| **R2** | Store/Campaign discovery | **Eventbrite** location-based discovery https://www.eventbrite.com/d/thailand/digital/ | **LIMITED/UNVERIFIED interactive**: live public text/index verified; mobile state not inspected | Prominent filters and location/category alignment; UniStore's small campus focus should use fewer filters than event marketplace; do not copy event cards wholesale |
| **R3** | Org Orders/Payment/Pickup | **Shopify Help Center — Filtering orders** https://help.shopify.com/en/manual/fulfillment/managing-orders/viewing-orders/filtering-orders | **LIVE PUBLIC HELP ARTICLE INSPECTED via BDXA; official docs only**, not private admin view | Clearly documented saved order views and status filtering; compare functional *principle*, not visual geometry of inaccessible admin UI |
| **R4** | Platform users/payments search | **Stripe Docs — Dashboard search** https://docs.stripe.com/dashboard/search | **OFFICIAL DOCS**, not Stripe logged-in UI; mobile not verified | Search objects/structured terms/filter group; UniStore's multi-role boundaries are more explicit for staff, preserve RBAC and avoid overwhelming operator with global search without need |
| **R5** | Organization products/inventory | **Square Support — Adjust inventory levels** https://squareup.com/help/us/en/article/8331-set-up-inventory-tracking | **OFFICIAL DOCS**, not Square private dashboard; mobile not verified | Variation-level inventory actions and keyboard-friendly Manage Stock modal; compare against UniStore variant/status operations, but do not assume Square features apply to pre-order workflows |

**Coverage:** 5 distinct relevant production providers/public references, 1 directly opened official Help page in remote browser, 4 published pages/articles verified via web text, **0 verified private production dashboards**, **0 verified competitor mobile screenshots**. The Protocol goal of two directly inspected comparable screens per archetype was **not fully met**; that gap is transparent. No unverified reference is presented as a pixel-perfect model.

## 10. Accessibility & Performance

**Accessibility method:** axe-core in real Chromium on `/`, `/login/`, `/register/`, `/stores/view/` at 390×844 and 1440×900, using WCAG 2 A/AA, WCAG 2.1 AA and WCAG 2.2 AA tags. **8 scans, 0 reported violations, 8 scan results each with 1 “incomplete” check** needing manual assessment. Missing `main h1` in generic geometry during early Loading is not proof of a semantic failure after load. Keyboard interaction for Audit table was previously exercised in Phase 5; **not rerun in this read-only audit**. No physical iOS, Android, VoiceOver, TalkBack or motor/touch target certification.

**Performance observations (single local Chromium samples; not p95 benchmarks):**
- `localhost` Home `domcontentloaded` ≈93ms, first real Store link ready ≈1,931ms in a targeted sample at 390px.
- `localhost` Store Detail `domcontentloaded` ≈76ms, first seeded Store heading ≈194ms in that particular sample.
- Login `domcontentloaded` ≈51ms, form ≈143ms sample.
- Organization Orders first h1-ready check ≈3,852ms in one sample, and three 4s missing-`main` matrix timeouts. Not enough to extrapolate production backend p95 or average across users.
- `127.0.0.1` alternative origin: 8–9s still loading, repeated HMR handshake errors, no Store links. See BUG-001.
- DevTools `N` bubble in screenshots comes from **Next.js Development UI** and should not be labeled a product design defect or expected production artifact.

**PERF-001** (P2 INVESTIGATE): Log route/navigation transition timing, account session initialization, API status/duration and React loading-to-ready milestones for Org Orders/Audit/Platform Organizations. Compare cold/warm and 1/3/5 concurrent users using non-mutating load; do not “fix” timing by raising timeout alone. Acceptance: stable title/loading state and measured readiness target agreed by the project owner, no missing content and no cross-tenant content flash.

## 11. Design Quality Scorecard

Subjective inspection values for sampled local UI, **not complete compliance scores**:

| Dimension | Indicative score / 10 | Rationale and limitation |
|---|---:|---|
| Visual Design | 8 | Consistent purple/blue, deliberate type scale; many gradient hero/card repeats |
| Layout Quality & Information Hierarchy | 7 | Primary task visible; Dashboard mobile hero and technical UUID add avoidable clutter |
| Product Identity / Brand Coherence | 8 | Cross-route identity stable; Store demo imagery generic but sharp |
| Reference-Based Layout Maturity | 6 | Suitable task structures; reference coverage includes docs and no private admin |
| UX / Usability | 7 | Functional Guest discovery; QA fixture names dilute real Store results |
| Responsive Design | 8 | 316 geometry captures with no horizontal overflow, but 3 timeouts and loaded-state gaps |
| Component Consistency | 8 | Auth/shell/cards visually coherent |
| Accessibility | 7 *provisional* | 8 axe checks zero violations, all 8 have incomplete manual items; AT not tested |
| Navigation | 8 | Guest Store/Back/Forward and 7 restricted routes behaved as expected |
| Interaction Quality | 7 *partial* | Validations/search pass; CRUD and real payment not run |
| Production Readiness | 3 *provisional local gate only* | Actual AWS/HTTPS privacy/backups NOT RUN; **NOT** a verified production security assessment |

## 12. Prioritized Fix Roadmap

1. **P2 — BUG-001 (Dev origin):** Reproduce 127 vs localhost with real network/console/hydration traces; fix allowed/canonical dev-host configuration without disabling CORS/session protections. E2E acceptance on both hostnames or deliberate redirect.
2. **P2 — UX-001/LAYOUT-003 (Fixture hygiene):** Separate intentionally synthetic demo tenants from user-facing Store discovery; opt-in QA visibility/badge, preserve data ownership and search behavior. No blanket cleanup of LocalStack.
3. **P2 INVESTIGATE — PERF-001/LAYOUT-004:** Measure cold/warm readiness of Org Orders/Audit/Platform screens; provide persistent accessible page title/skeleton and deterministic waits if truly absent; no arbitrary timeout inflation.
4. **P3 — LAYOUT-001/UI-001:** Shorten Organization sidebar metadata; keep copyable technical ID outside routine scan path.
5. **P3 — LAYOUT-002:** Compress Mobile Dashboard Hero before KPI/action list, preserve brand and payment-first prioritization.
6. **P3 optional — ASSET-001:** Evaluate actual user-uploaded campaign/product imagery before proposing an alternative to demo-only geometric artwork. No stock asset substitution without specific verified rights.
7. **Separate AWS Release Gate:** Execute existing `tests/reports/aws-live-validation-checklist.md` after **explicit** account/budget/permission approval; real HTTPS, S3 privacy, IAM, backup/restore, SQS, Lambda performance and rollback are distinct from local UI fixes.

## 13. AI Implementation Handoff

The implementing coding agent must **not** use this audit as blanket permission to refactor the application. Review `AGENTS.md`, `SPEC.md`, subsystem contracts and Git status, then plan tiny, independently reversible changes.

| Work package | Files/components to inspect | Implementation intent | Acceptance/regression |
|---|---|---|---|
| A: Canonical Dev origin | `frontend/next.config.*`, frontend API base/config, Docker Compose host mapping, startup/hydration and `/api/v1/storefront/directory` fetch | Ensure either both loopback hostnames work or 127 redirects with a clear message; retain strict API origin checks | Chromium 390/1440 read-only Store search after 8s both hosts, no HMR/error spam and no security relaxation |
| B: Demo Store visibility | Storefront directory API and filtering, source of E2E/seed organizations, `frontend/src/modules/storefront/` | Clearly distinguish QA tenants from public campus Store data; do not delete unknown records | Verify Store list/search/pagination with active, no-store and test Org; authorizations and seed E2E unchanged |
| C: Loading readiness | `frontend/src/modules/orders/organization-orders-view.tsx`, Org route shell and Platform list views | Stable header/skeleton and status announcements, diagnose performance bottleneck | Repeat exact 11 viewports, 1 worker/no retries, controlled 3-run ready-time distribution, no blocked tab order |
| D: Technical metadata | Shared Organization sidebar/shell components | Friendly Organization name/status as primary copy; technical ID behind accessible copy/help | 390/768/1440 visual and keyboard check; Support can still retrieve UUID |
| E: Mobile dashboard density | Dashboard hero & KPI CSS/components | Shorter responsive hero, payment attention CTA/KPI first, preserve overview and store/product actions | Screen capture 320/390/768/1440 plus actual taps/menu, no lost KPIs or actions |
| F: Visual fallback | Store Campaign banner/product media components | Only if suitable asset exists: genuine Store/Campaign image with correct crop/alt; maintain tasteful abstract fallback for no-image data | No bad aspect ratio/failed image; confirm uploaded file ownership/license and Store interaction integrity |

**Keep:** Backend authoritative role/tenant isolation, Order→manual Payment verification→Production→Pickup separation, exact API DTOs, audited Orders (no arbitrary physical deletion), responsive table scroll, and existing brand colors. Do not copy external brands, marketing illustrations or proprietary visuals.

**Minimum local regression after fixes:** Existing `frontend/e2e` suite (run only in an approved test environment with known data ownership), Backend/Frontend unit, contract/security, read-only responsive/a11y snapshots, and refreshed representative screenshots outside the project workspace. Mutating tests must respect test-order ownership and cleanup journals; never touch production users or data. AWS tests remain separate, approved tasks.

## 14. Testing Limitations

- **Read-only scope**: No Account creation, Order submission, Payment approval/rejection, slips/uploads, Pickup completion, Org/Platform CRUD, Notifications read-state mutations, backend privileged security probes or actual SQS event delivery were performed this audit.
- **Access:** Local authorized seeded roles through session initialization and API login for read-only route inspection; no end-to-end full UI login success/logout flow or MFA/CAPTCHA. No live Learner Lab account access.
- **Browser:** Chromium emulation only; no physical devices, Safari/Firefox comparative rendering, touch keyboard or screen-reader.
- **Timing:** Generic matrix sampled initial pages quickly, frequently during Loading, and should not be misread as completed-state coverage; 3/319 viewport pairs timed out. Four additional existing-Order route families were inspected in ready state.
- **Audit assets:** Embedded/CSS decorative elements have no reliable generative provenance or separate licensing attribution; no proof of AI creation. No deficient asset was confirmed to justify a third-party replacement.
- **External websites:** Five real public sources verified, but only Shopify official help page opened in the remote browser; private competitor admin dashboards and mobile behavior not visually inspected. Never claim direct dashboard parity.
- **Axe:** Automated checks returned 1 incomplete/manual result per page; no full WCAG pass claim.
- **No real AWS production readiness sign-off:** Static S3 Website remains an HTTP demo architecture per project specification. IAM effective rights, secret handling on AWS, anonymous Files S3 access, RPO/RTO, recovery and actual cloud costs are NOT RUN.
- **Existing testing history:** Previously reported Phase 7 complete 75/75 pass is context only, not a fresh Playwright run here; ordinary tests could write artifacts or change LocalStack, prohibited by the supplied read-only skill.
- **Missing benchmark standard:** No owner-provided threshold for readiness p95, user throughput, target devices or acceptable task completion time; no invented pass criteria.

## 15. Workspace Integrity & Cleanup Verification

**Baseline:** Commit `1a11f76` (`chore: finalize local remediation and remove web quality audit`); Git working tree **clean**. Docker frontend/backend/LocalStack healthy, worker active, bootstrap/seed exited 0. `WEB_QUALITY_AUDIT.md` did **not exist** before this audit.

**Operations:** Browser interaction to existing Dev web; source/tests/config/package manifests/lockfiles/DB/Git metadata untouched. No `npm install`, migration, build, Docker restart/reset, production action, data mutation, commit or push. Script/log/test-output artifacts for this audit were placed only in **`/tmp/unistore-readonly-audit-LY6gHH`** on the BDXA Mac; temporary browser sessions were created. In-memory images were used for review; no permanent screenshots in Workspace.

**Final cleanup verification:** VERIFIED: all 15 files in the isolated /tmp/unistore-readonly-audit-LY6gHH working directory were removed, and the directory itself was deleted. The four temporary script process PIDs were not running. The Shopify Browser session returned closed=true; two older temporary browser session IDs returned BROWSER_SESSION_NOT_FOUND when queried. No screenshot files were retained in the workspace. Transient platform image cache expiry is managed by BDXA.

**Protected files unchanged:** YES — verified Git status listed only the new audit report, and git diff --name-only was empty. No tracked application or test files were changed.
**Temporary artifacts removed:** YES — all 15 known audit-owned files removed and dedicated directory no longer exists; BDXA platform-managed transient image cache retention was not directly controlled.
**Only permanent file intentionally created:** `WEB_QUALITY_AUDIT.md`.
**Final status:** PARTIALLY COMPLETED due explicit blocked/incomplete functional, accessibility, comparator and cloud coverage. Confirmed Local findings and route/viewport measurements are preserved above; no implementation attempted.
---

## 16. Post-Audit Remediation Results (2026-10-16)

**The preceding sections preserve pre-fix observations. This section records the current implementation after the user authorized changes.** All figures below are Local Dev, not production certification.

| Finding | Current outcome |
|---|---|
| BUG-001 | FIXED. Both localhost:3000 and 127.0.0.1:3000 now load Storefront links. Explicit loopback CORS and Next Dev Origin settings; unrelated external origins remain denied. |
| UX-001 / LAYOUT-003 | FIXED FOR LOCAL DEMO. Explicitly named E2E/QA/Golden/harness fixtures are hidden from default Dev directory with reversible Show QA control. Default sample: 1 store / 1 organization; toggled: 245 / 287. No database deletion; production output is unaffected by this name heuristic. |
| PERF-001 / LAYOUT-004 | LOADING UX FIXED; P95 MEASUREMENT OPEN. Route preparation and Organization Boundary now render semantic main and H1 loading state. All full-suite Browser cases passed. No claim that backend latency itself decreased. |
| LAYOUT-001 / UI-001 | FIXED. Sidebar displays the authorized real organization name and a collapsed accessible technical-ID disclosure; verified at 390 and 1440px. |
| LAYOUT-002 | FIXED. Mobile Organization Dashboard hero at 390px decreased from ~316px to 202px; Payment KPI visible sooner. Desktop layout retained. |
| ASSET-001 | FALLBACK IMPROVED. Campaign banner uses the real campaign name and opening date instead of misleading decorative geometry. Genuine photos require merchant-owned source media; no stock product photo was invented. |

### Verified tests

- **Playwright Full Chromium:** 78/78 PASS, 18 spec files, 0 fail, 0 retries, 0 skipped, exit 0; duration ~399.8 seconds. Three new Browser regressions cover Dev hosts, QA data toggle and mobile/desktop organization shell.
- **Frontend Unit 304/304 PASS** (80 files); **Backend 297/297 PASS**; **Security 16/16 PASS**.
- **API Contract 196 PASS / 2 TODO**; **Infrastructure 19/19 PASS**; **Frontend Static Export and contracts 33/33 PASS**.
- TypeScript, ESLint, and Git diff whitespace validation passed.
- CORS checks: localhost and 127 both allowed; https://untrusted.example has no Allow-Origin header.
- Inventory: 28 canonical routes, 33 snapshots and 9 owned journals marked verified-cancelled.
- Local proof: /tmp/unistore-fix-all-full/run.json, run.log, exit.txt; read-only targeted Browser tests under /tmp/unistore-audit-fixes-targeted-v3.

### Safety, caveats and remaining external work

Only local Backend/Frontend containers were recreated for the Dev Origin change; LocalStack and persistent data were not reset. No broad Order/data cleanup or AWS operation. The local fixture naming heuristic can be replaced later by explicit fixture ownership metadata. Backend p95 profiling, owner-provided real campaign imagery, live AWS IAM/S3/HTTPS/backup/restore, and physical-device/screen-reader review remain pending separate evidence. These edits are **not committed or pushed**.

**Conclusion:** The actionable local findings received implementation and a passing full regression. Outstanding external dependencies are not claimed as fixed or certified.

### Performance follow-up — non-mutating backend-log sample

- Read-only local Backend log sample (recent 45 minutes after the 78-case E2E run): Organization order-list GET **n=8**, median **1,553.2 ms**, approximate sample p95 **2,468.1 ms**; Order-detail GET **n=36**, median **31.2 ms**, approximate sample p95 **102.4 ms**. These are observed request durations, not a representative production load benchmark. Small, test-driven sample sizes and warmed/cold state can affect results.
- Static inspection confirms the list handler maps each listed Order through `loadOrderDto`, which queries the item's partition with `listItems` per Order. This creates one child Query per listed Order (an N+1 pattern), plausibly contributing to slower list requests; a causal timing breakdown has not been instrumented.
- A further Backend data-access optimization is **not silently applied** because the published OrderDTO includes complete `items[]`, filters and opaque cursors are contract-sensitive, and removing item queries or adding a DynamoDB Query limit without handling filtered/empty pages could break clients.
- Next acceptance gate if performance remains a priority: capture number of Order records and child Queries per page, benchmark before/after on identical LocalStack fixtures with filtered + multi-page cursors and cross-tenant security checks, then choose a contract-preserving bounded-query approach. Current loading-state fix and full 78-case regression remain PASS; the latency root cause remains under investigation.
