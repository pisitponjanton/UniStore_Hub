# UniStore Hub Full Frontend Redesign Audit

Status: Phase 1 complete — source-backed redesign baseline
Scope: all canonical routes and shared frontend UI under `frontend/**`
Method: static source/design-system audit using `interface-design`, `ui-ux-pro-max`, `design-review`, `redesign`, and `frontend-design`.

> This phase defines the redesign direction. It does not claim screenshot/browser certification. Runtime responsive, visual, and accessibility verification remains for later phases.

## 1. Product model

UniStore Hub is two related experiences inside one product:

- **Campus storefront** for students/customers browsing organizations, stores, campaigns, products, ordering, paying, tracking, and collecting.
- **Operations workbench** for Staff, Organization Admin, and Platform Admin users repeatedly processing queues, reviewing state, changing configuration, and completing high-impact actions.

The redesign must make these feel related without forcing them into the same page template.

## 2. Canonical route inventory

### Public / customer

| Route | Current responsibility | Redesign composition |
| --- | --- | --- |
| `/` | storefront landing | campus marketplace index: organization/store discovery first, concise product identity second |
| `/login/` | login | focused account entry with clear return destination and low-friction recovery |
| `/register/` | account creation | same account system as login, with progressive form hierarchy |
| `/stores/view/` | store detail | store identity + active campaigns/products + availability-led browsing |
| `/products/view/` | public product detail | product-first composition, variant/availability/price hierarchy, campaign entry |
| `/campaigns/view/` | public campaign detail | campaign status/timing + offered products + clear order eligibility |
| `/orders/new/` | create order | guided order workspace: selection -> quantity -> authoritative review -> submit |
| `/my/orders/` | customer order history | lifecycle-oriented order list with state and next action visible at row level |
| `/my/order/` | customer order detail | order journey/status first, items and references second, next action obvious |
| `/my/payment/` | submit/resubmit payment proof | payment task page with review state, rejection recovery, and upload action |
| `/my/pickup/` | pickup token/QR and state | pickup pass: readiness, token/QR, what to bring/do, received state |
| `/notifications/` | customer notifications | event inbox with readable grouping, unread state, and destination context |

### Organization / staff

| Route | Current responsibility | Redesign composition |
| --- | --- | --- |
| `/org/select/` | organization context selection | organization switcher with role/context clarity, not dashboard chrome |
| `/org/dashboard/` | organization summary | action-led operational overview: urgent work first, totals second |
| `/org/settings/` | organization configuration | compact settings form with read/edit distinction and safe save feedback |
| `/org/staff/` | membership management | staff roster/workbench with role/status hierarchy and guarded admin actions |
| `/org/stores/` | store management | store list + editing context; avoid equal-weight promotional cards |
| `/org/products/` | product/variant/image management | inventory-style product workspace with product identity, variants, images, state |
| `/org/campaigns/` | campaign planning/lifecycle | lifecycle board/list with dates, state, next transition, and destructive separation |
| `/org/orders/` | order queue | dense queue with active filters, status, customer/campaign refs, next work |
| `/org/orders/view/` | order operational detail | authoritative order state + item detail + allowed actions/history |
| `/org/payments/` | payment review queue | review queue + selected payment evidence/detail + approve/reject task rail |
| `/org/production/` | production summary | production workload grouped by campaign/product/variant with actionable status |
| `/org/pickups/` | pickup confirmation queue | token/order verification + selected pickup + one safe confirm action |
| `/org/audit/` | audit history | read-only event ledger with compact filters and inspectable metadata |

### Platform Admin

| Route | Current responsibility | Redesign composition |
| --- | --- | --- |
| `/platform/summary/` | platform overview | platform health/attention summary; actionable counts outrank generic metrics |
| `/platform/organizations/` | organization administration | organization review/state workbench with clear platform scope |
| `/platform/users/` | platform user lookup/list | read-oriented user table/list with platform role/status clarity |

**Coverage:** all 28 current `page.tsx` routes are included in the redesign plan.

## 3. Shared implementation inventory

Current shared layer:

- `src/app/globals.css` — semantic color/spacing/type/layout/motion tokens
- `src/components/ui/*` — Button, Fields, Badge, Card, Table, Dialog, StatePanel
- `src/components/ui/operational.tsx` — ActionBar, FilterToolbar, Notice, TaskStatus
- `src/components/layout/*` — PageShell/PageHeader patterns and ApplicationShell
- `src/modules/auth/navigation.ts` — role-aware navigation source
- 25 feature CSS modules — substantial page-level visual duplication remains

This is a useful implementation foundation, but it is **not a visual constraint** for the full redesign. Shared semantics can be retained while composition and styling are rebuilt.

## 4. Code-backed baseline review

This score is provisional because it is based on source inspection, not rendered screenshots.

| Dimension | Weight | Baseline | Main reason |
| --- | ---: | ---: | --- |
| Visual hierarchy | 20% | 6/10 | hierarchy exists, but many screens still repeat heading + summary + bordered sections |
| Consistency | 20% | 7/10 | shared tokens/primitives are strong, but 25 feature CSS modules still recreate similar page structures |
| Accessibility | 20% | 7/10 | good focus/semantic/reduced-motion foundation; browser contrast, zoom, and target-size validation remains |
| Usability | 20% | 6/10 | functional state is present, but operational pages can make filters/metadata/actions compete |
| Responsiveness | 10% | 6/10 | breakpoints exist, but dense list/detail behavior and mobile text/control sizing need a dedicated redesign |
| Performance | 10% | 7/10 | no obvious source-level redesign blocker; perceived loading/layout stability still needs runtime testing |

Provisional weighted baseline: **6.5/10**.

The frontend is functionally organized, but the full redesign is justified because the current composition still reads as an incremental operational UI rather than one deliberately designed product system.

## 5. Highest-priority findings

| Severity | Finding | Full-redesign response |
| --- | --- | --- |
| Major | Public, customer, and operations pages share too much of the same safe panel/header vocabulary | establish distinct page archetypes under one token/component language |
| Major | Operational queues can give filters, summary counts, rows, detail metadata, and actions similar weight | introduce a workbench hierarchy: queue -> selected work -> authoritative state -> next action |
| Major | Current shell is one structure for several mental contexts | keep one navigation authority but redesign presentation for customer vs organization/platform work |
| Major | Customer lifecycle screens are separate pages but need stronger continuity | use one recognizable order journey/state language across order, payment, and pickup |
| Major | Metric/card grids can still read as generic SaaS | urgent/actionable summaries become primary; supporting totals become compact secondary data |
| Major | Feature CSS remains broad and repetitive | rebuild shared primitives before route work; page CSS should describe composition, not duplicate controls |
| Major | Mobile-first constraints are not strong enough for a full product redesign | make 320/375px composition a first-class design target, not a final collapse of desktop |
| Major | Global body text is currently 14px and form controls inherit it | Phase 2 must define mobile-safe typography/control sizing; avoid iOS input zoom and cramped touch layouts |
| Major | Status is present but not always the dominant decision context | transactional/operational pages get one canonical current-state + next-action pattern |
| Major | Storefront identity is still restrained enough to feel like an admin system with a hero | customer pages get a more recognizable marketplace rhythm while staying within the same system |
| Minor | Dark-mode tokens exist, but redesign quality/contrast is not browser-verified | design both themes from the same semantic tokens and test them separately later |
| Minor | Technical references appear in several local patterns | define one technical/reference value style and use only where scanning IDs/tokens benefits |
| Minor | Long forms/filters can become tall on mobile | use grouping/progressive disclosure where behavior allows it |
| Minor | Navigation is role-aware but visual hierarchy can be more adaptive | preserve exact item authority while changing grouping/presentation only |

## 6. UI/UX Pro Max rules adopted for this redesign

Because only the Markdown portion is installed, these are direct rule selections from the vendored reference, **not database-search results**.

### Critical

- semantic labels and visible focus
- keyboard order matches visual order
- status is never color-only
- form errors remain specific and connected to fields
- primary interactions do not depend on hover
- pending actions disable and communicate progress
- destructive actions use confirmation and clear spatial separation
- sticky/fixed UI must never obscure focused controls

### Layout / responsive

- mobile-first composition
- systematic breakpoint behavior, with explicit checks around 320/375, 768, 1024, and 1440 widths
- no page-level horizontal overflow on mobile
- core content precedes secondary metadata on small screens
- fixed/sticky UI reserves space for content
- no nested scroll region unless the task genuinely requires one
- predictable back/context behavior when desktop split views collapse

### Navigation

- large-screen operations may use a sidebar
- small-screen primary navigation must remain discoverable without reproducing a desktop sidebar horizontally
- active location must be explicit
- top-level and secondary navigation must not compete at the same hierarchy level
- deep pages retain a clear path back to the relevant queue/list

### Forms / feedback

- visible labels; placeholder is not a label
- error cause + recovery guidance
- first invalid field/error summary focus behavior
- read-only differs from disabled
- complex options use progressive disclosure
- success/error feedback must describe the action that just completed

## 7. New visual direction

Working direction name: **Campus Commerce Workbench**.

This is a manual design direction derived from the product domain and installed Markdown guidance. No UI/UX Pro Max search/database output is claimed.

### Product character

- modern, calm, precise
- campus-specific without relying on decorative university clichés
- customer surfaces feel browsable and welcoming
- operational surfaces feel like a fast service counter / ledger workbench
- important state is physical and legible: marker, label, reference, action
- visual identity comes from composition and rhythm, not gradients or decorative effects

### Design dials

- visual variance: **5/10** — recognizable, not eccentric
- motion: **3/10** — mostly direct state feedback
- customer density: **4/10**
- operational density: **8/10**

These dials are design intent only; they were not generated by the absent upstream search script.

### Signature interaction/visual language

Use a **ledger rail** as the signature device:

- a restrained vertical/edge marker identifies the authoritative task/state
- adjacent content shows the state in plain language
- the minimum identifying references sit directly below/beside it
- the next valid action is spatially tied to the state
- secondary metadata falls away into quieter rows/details

The rail is functional context, not a repeated decoration on every section.

## 8. Page archetypes

Do not create one template and apply it 28 times.

### A. Marketplace index
For `/`, store discovery.

Structure:
`identity/context -> discovery/list -> organization grouping -> store entry`

### B. Commerce detail
For store/product/campaign.

Structure:
`identity -> availability/status -> core content/options -> related commerce action`

### C. Customer transaction
For order/payment/pickup.

Structure:
`journey/current state -> next action -> transaction detail -> references/history`

### D. Operational queue
For orders/payments/pickups.

Desktop:
`task header -> compact filter row -> queue/list | selected detail/action rail`

Mobile:
`task header -> active filters -> queue -> explicit detail screen/context`

### E. Management workspace
For staff/stores/products/campaigns/settings.

Structure:
`context -> current entities/config -> edit/create task -> supporting state`

### F. Read-only ledger
For audit and mostly-read platform data.

Structure:
`scope -> compact filter/search -> dense readable records -> inspect metadata`

### G. Attention summary
For organization/platform dashboards.

Structure:
`needs attention -> active workload/state distribution -> supporting totals`

No equal-weight metric wall.

## 9. Customer vs operational styling contract

### Customer

- more whitespace and larger content landmarks
- stronger store/product/campaign identity
- 16px-class comfortable reading on small screens
- imagery/content may lead where real assets exist
- transaction state remains explicit and non-promotional
- primary CTA easy to find without sticky obstruction

### Staff / Admin

- compact task headers
- dense rows/tables where appropriate
- status/reference alignment optimized for scanning
- filters visually subordinate to the work
- one primary task action
- destructive action separated
- technical IDs available but not visually dominant
- fewer decorative surfaces and less motion

### Platform Admin

Same workbench grammar, with an explicit platform-scope context treatment so platform authority cannot be confused with organization membership.

## 10. Navigation direction

Preserve the exact navigation authority from `src/modules/auth/navigation.ts`.

### Desktop

- persistent workbench sidebar for authenticated operational contexts
- organization/platform scope clearly visible above task groups
- active destination uses shape/marker/weight, not color alone
- customer group remains distinct from organization/platform task groups

### Mobile

- compact top app bar + deliberate menu/drawer/sheet pattern
- current area/page remains visible when menu is closed
- no horizontally scrolling full navigation taxonomy
- menu closes on route choice and Escape where applicable
- deep operational detail retains a clear queue/back context

No permission logic changes are needed.

## 11. Responsive contract

Every route must eventually be reviewed at:

- 320px minimum
- 375px phone
- 768px tablet
- 1024px laptop/tablet landscape
- 1440px desktop

Required invariants:

- no avoidable page-level horizontal overflow
- no primary action clipped by viewport
- no dialog taller than viewport without internal body scrolling and fixed/visible controls
- no input/control rendered too small for practical touch use
- tables use containment or a task-appropriate mobile alternative
- long IDs wrap safely
- action groups wrap/recompose instead of shrinking unreadably
- list/detail desktop layouts turn into an explicit sequence on mobile
- sticky UI does not hide focused fields or bottom actions

## 12. Design-system changes reserved for Phase 2

Phase 2 must turn this direction into one canonical token system. It should specifically review:

- type scale, including mobile body/form sizing
- content widths and adaptive gutters
- surface hierarchy
- border/elevation strategy
- campus accent and semantic states
- dark-mode pairings
- one icon family/style and icon size tokens
- z-index layers
- motion tokens
- responsive breakpoints
- customer vs operational density aliases
- ledger-rail tokens/pattern
- interactive states and target sizing

`.interface-design/system.md` should be rewritten to describe that new foundation rather than preserving outdated visual assumptions.

## 13. Contract guardrails for all redesign phases

The redesign may change markup/composition for UX/accessibility, but must preserve:

- all API routes and DTO meanings
- role and membership authority
- Platform Admin from persisted `user.platformRole`
- Backend-authoritative 401/403 behavior
- query-parameter entity navigation/static-export model
- exact Campaign/Order/Payment/Pickup transitions and allowed actions
- customer pickup as presentation-only
- organization Staff/Admin pickup confirmation
- direct S3 presign -> direct PUT without JWT -> persist Backend-issued key
- integer-satang price semantics
- opaque cursors
- notification events as signals, not replacement authority for current resource state

## 14. Phase 1 exit decision

The current frontend should **not** receive another cosmetic polish pass.

The approved implementation direction is a full system redesign:

1. rebuild tokens/design foundation
2. rebuild shared primitives
3. rebuild shell/navigation
4. redesign each route according to its task archetype
5. perform product-wide responsive and accessibility review
6. run regression/static-export verification
7. add real-user browser E2E only after the new visual baseline is accepted

Phase 2 can start without changing any business contract.
