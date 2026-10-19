# UniStore Hub — Product-First Experience Redesign

Status: **Design discovery / baseline completed**. Implementation of the new UI begins in the next workspace phase. Do not treat this document as visual sign-off or proof that every protected role page was visited.

## Product truth

**UniStore Hub = university stores + product pre-orders + payment proof review + production tracking + campus pickup**, operated in one multi-tenant application for faculties, student clubs and campus units. Ground truth: `SPEC.md`, `frontend/src/app/**/page.tsx`, `frontend/src/modules/auth/navigation.ts` and the canonical frontend action coverage source.

The website must explain itself immediately. People should be able to recognize three things without scrolling: (1) browse campus stores and products; (2) choose an open pre-order campaign and place an order; (3) sign in to track payment and pickup. Authorized staff/admins can switch into task workspaces. Do not introduce a marketplace checkout, carts, shipping promises, payment gateway or capabilities absent from the backend.

## What the discovery actually covered

- **Source-verified:** 28 current app routes, source role mapping, shared navigation and shells, key states and 207 route + 50 shared-shell source action families (257 total). Details: `ROUTE_ROLE_STATE_MATRIX.json`.
- **Browser-observed:** real local `http://127.0.0.1:3000/` at 1440×900 and 390×844, the `/login/` landing while the session was checking, and `https://motionsites.ai/` as design reference. The public screen was observed with API/account-loading placeholders; this is not a verified populated storefront.
- **Not yet visually verified:** all protected role pages, all populated/empty combinations, modal states and responsive variants. Every route starts `NOT_TESTED` for this *new redesign* regardless of existing historical QA evidence. Screens must be visited and documented in subsequent implementation phases.

## Key UX problems observed

1. **The product promise is buried.** Current desktop first fold uses a huge dark generic rectangle, a title 'เลือกซื้อจากร้านในมหาวิทยาลัย' and copy about organizations. Nothing above the fold anchors the value in genuine products or open pre-order listings. At 390px the hero/search consumes nearly all first-screen vertical space.
2. **Account loading competes with shopping.** The top navigation and secondary hero action are replaced by 'กำลังตรวจสอบบัญชี', delaying understanding of order tracking and role entry. Public shopping must remain legible and actionable during auth hydration.
3. **Generic workspace language obscures action priority.** In source, platform summary emphasizes technical scope, the organization dashboard leads with filters and aggregates, and navigation mixes shopper links with privileged work links. Relevant work should be prioritized by role and status rather than all available destinations.
4. **Multiple look-and-feel conventions remain.** Public header, customer shell, organization shell and platform paths have separate compositions, leading to inconsistent position/scale of headers, cards, buttons and error states.
5. **Directory/workflow separation is weak.** Current organization and staff pages display important controls, but need consistently distinct browse/filter vs detail vs decision/review states; unclear UI copy must be rewritten in user terms, not DTO/API terms.
6. **Empty, loading and permission states require contextual routes back.** Do not turn backend network failure into an empty marketplace, and do not imply unavailable actions are permitted.

The above are a source + selected visual review; not a statistical usability study. Confirm findings with real user/role sessions before claims of measured usability improvement.

## Design direction — Campus Editorial × Operations Desk

One identifiable UniStore brand, **two interface rhythms**:

**Customer-facing commerce:** editorial layout, real product/store imagery, clear prices and campaign dates, human short copy, prominent product discovery, narrow secondary search/filter; no empty marketing hero occupying the whole fold. Reuse real uploaded product imagery and legitimate store descriptions; for stores with no image show a typographic no-photo treatment instead of fabricated product images.

**Staff, Organization Admin and Platform Admin:** a calm readable workspace. Strong orientation (role/organization/current task), single prioritized action per page, meaningful tables and list rows, status chips with text not color alone, clear decision/confirmation dialogs, quick scoped search and filter feedback. Keep the staff 'Orders → Verify payment → Pickup' mental model visible. Admin catalogs and settings are management screens, not marketing landing pages.

**Visual DNA:** bold but restrained typography; warm neutral public canvas, dark-ink high-contrast headlines, confident *single* brand accent and an intentional editorial accent for actions. Neutral operational canvas with consistent icon set. Avoid ubiquitous purple gradients, fake glass dashboards, neon or oversized shadow cards. Reserve full-bleed editorial elements for public promotional pages and real photos; operational screens should remain dense and scan-friendly.

**Motion:** 160–240ms interaction state changes, lightweight staggered content reveals where genuinely useful, subtle actionable hover/focus, no scroll-jacking, no background canvas on dense task views; `prefers-reduced-motion` disables transforms and looping animation. No layout shifts from font loading or images.

**Accessibility:** WCAG 2.2 AA target; color contrast at least 4.5:1 for small text, visible keyboard focus, touch targets around 44px, sensible reading order, form labels and error summary focus, dialog initial/return focus, role/status communicated in words and aria-live feedback.

## One sentence per role

| Audience | What they need to recognize | Primary next action |
| --- | --- | --- |
| Guest | 'สินค้าและร้านภายในมหาวิทยาลัย สั่งพรีออเดอร์ได้' | ค้นหาร้าน / ดูสินค้าที่เปิดขาย |
| Customer | 'ฉันสั่งอะไรไว้ ชำระแล้วหรือยัง และรับเมื่อไร' | สั่งซื้อ / ติดตามคำสั่งซื้อ |
| Staff | 'งานใดต้องทำก่อนตอนนี้' | ตรวจรายการชำระเงิน / รับสินค้า |
| Organization Admin | 'ร้าน คำสั่งซื้อ และหน่วยงานของฉันเป็นอย่างไร' | เปิดงานที่ค้าง / จัดการสินค้า-แคมเปญ |
| Platform Admin | 'มีหน่วยงานหรือบัญชีใดรอการตัดสินใจหรือผิดปกติ' | ตรวจหน่วยงานรออนุมัติ / ตรวจบัญชี |

## Navigation blueprint

- Public/Customer: brand; **เลือกร้าน/สินค้า**, **คำสั่งซื้อของฉัน** (login-gated with safe returnTo), notifications when authenticated; one explicit login/account control; no protected management links for guests.
- Staff: **งานคำสั่งซื้อ**, **ตรวจการชำระเงิน**, **ส่งมอบสินค้า** within a clearly labeled organization. Mobile navigation should expose these three high-frequency destinations, not bury them under a generic menu.
- Organization Admin: 4 groups, ordered by tasks: **ภาพรวม**, **ร้านค้าและพรีออเดอร์** (stores/products/campaigns), **จัดการงาน** (orders/payment/production/pickup), **ทีมและการตั้งค่า** (staff/settings/audit). Show organization switcher with name and role; not just 'หน่วยงานที่เลือก'.
- Platform Admin: **ภาพรวมระบบ / คำขอหน่วยงาน / ผู้ใช้**, separate elevated admin identity and no mistaken inheritance of organization power.
- Multiple roles: show a **work area switcher** with explicit user intent (`ซื้อสินค้า`, `จัดการหน่วยงาน`, `ดูแลแพลตฟอร์ม`) only for granted roles. Never alter existing permissions/client contracts as part of navigation redesign.

## Default page anatomy

1. Identify role, active organization and correct breadcrumb/section.
2. Title in everyday Thai, one-line explanation of what can be done and why.
3. One primary CTA matched to actual permitted next action, secondary tasks nearby.
4. If it's an operational page: actionable work queue, warnings and deadline/status indicators before nonurgent metrics.
5. Search/filter control with explicit loaded result count, applied filters and clear-reset action.
6. Item list/table containing human label, useful context, timestamp/amount/status and one clear row action.
7. Well-positioned details and modal with clear cancel/confirm, pending/conflict/error and recovery.
8. Responsive layout that never horizontally overflows or hides an important action.

## Screen / state acceptance contract

For all 28 routes and **only authorized role combinations**, inspect and verify: initial load, loaded, empty, validation errors, network/403/401, conflicting mutations, success, cancel, retry, dialog open/close/focus, mobile and desktop, keyboard and reduced motion. Use `ROUTE_ROLE_STATE_MATRIX.json` to track coverage. The matrix starts with `NOT_TESTED`, because completion means actual re-rendered and operated new UI, not old snapshots.

## References studied

- MotionSites: https://motionsites.ai/ — editorial hierarchy, confident hero and deliberate imagery.
- MotionSites sections: https://motionsites.ai/sections — dashboard, feature sections, responsive blocks, commerce patterns; derive ideas rather than copying.
- MotionSites design principle: https://motionsites.ai/motionsite — motion must have typography/structure and restraint.
- Licensed icons: https://lucide.dev/license (ISC / subset Feather MIT).
- Real photo sourcing only when appropriate: https://unsplash.com/license (verify asset-specific rights/trademarks and avoid using stock as fake product proof).

See `ASSET_AND_MOTION_POLICY.md` before adding local asset files.

## Workstream order

Foundation / navigation → Public commerce home → Store/Product/Campaign detail → Auth → Customer journey → Staff operations → Org management → Catalog and campaigns → Production/Audit → Platform governance → exhaustive scoped responsive/accessibility and E2E checks → mandatory final diff review. Each implementation phase must inspect the real updated website and report PASS / BLOCKED / NOT_TESTED without silently promoting incomplete tests.

**Baseline commit:** `9007ec3` (clean at discovery start). **No UI code changed during discovery. No Commit/Push/Deploy authorized.**
