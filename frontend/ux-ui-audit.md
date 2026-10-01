# UniStore Hub Frontend UX/UI Audit

Status: Phase 1 audit baseline  
Scope: current `frontend/**` only  
Method: static code/design-system inspection using the vendored `interface-design`, `design-review`, `redesign`, and `frontend-design` guidance. This phase did not change product UI behavior.

> This is a code-backed audit baseline, not a screenshot-based visual certification. Runtime visual checks and accessibility verification remain required in later phases.

## Product intent

Primary users:

- students/customers browsing products, ordering, paying, tracking, and collecting items
- Staff repeatedly processing orders, payments, and pickups
- Organization Admin users managing operational data and configuration
- Platform Admin users managing platform-level organizations/users

Target feel:

- calm
- dependable
- operational
- compact but readable
- easy to scan
- visually specific to a university commerce/operations product rather than a generic SaaS dashboard

Existing visual authority remains `.interface-design/system.md`.

## Existing strengths to preserve

- One semantic token source already exists in `src/app/globals.css`.
- Noto Sans Thai is appropriate for Thai + Latin operational interfaces.
- Existing spacing follows a 4px-based scale.
- Existing surfaces mostly use semantic variables instead of feature-specific hex values.
- Global focus-visible behavior exists.
- Reduced-motion handling exists globally.
- Shared Button, Field, Badge, Card, Dialog, Table, and state components already provide a good consolidation point.
- Most layouts already include responsive breakpoints.
- Tables use tabular numeric presentation.
- High-impact flows already preserve Backend authority.
- Application shell already supports role-aware navigation and Organization context.
- Current static-export/query-parameter route model does not need redesign changes.

## Design-review baseline

The following is a provisional code-inspection score. It is not a rendered screenshot score and does not claim measured contrast.

| Dimension | Weight | Score | Audit note |
| --- | ---: | ---: | --- |
| Visual hierarchy | 20% | 5.5/10 | Page shells are consistent, but many views use the same large heading + card/grid recipe regardless of task importance. |
| Consistency | 20% | 6.5/10 | Tokens/components exist, but page-level CSS repeats near-identical structures and some undeclared token names appear. |
| Accessibility | 20% | 7/10 | Good focus/reduced-motion/semantic baseline, but runtime keyboard/contrast/target-size verification is still needed. |
| Usability | 20% | 5.5/10 | Functional states exist, but operational screens expose too many equally weighted panels/actions and require extra scanning. |
| Responsiveness | 10% | 6.5/10 | Breakpoints are present, but mobile navigation becomes a horizontally scrolling grouped menu and dense admin filters/actions remain heavy. |
| Performance | 10% | 7/10 | No obvious redesign-specific performance issue from static inspection; runtime perceived-loading behavior still needs later validation. |

Provisional weighted baseline: **6.3 / 10**

Interpretation: functional and coherent enough to operate, but below the desired design/craft bar because hierarchy, page differentiation, navigation, density, and interaction patterns are too generic and repetitive.

## Main diagnosis

The current frontend is not failing because it lacks CSS or shared components. It is failing primarily because the same safe layout vocabulary is reused almost everywhere:

```text
large heading
+ English eyebrow
+ explanatory paragraph
+ bordered panel/card
+ repeated equal-weight cards
+ flex/grid action row
```

That makes very different tasks—browsing, approving a payment, confirming a pickup, reading notifications, managing staff, and platform administration—feel visually equivalent.

This weakens recognition, task priority, and product identity.

The redesign should therefore avoid a cosmetic repaint. The main work is to make **structure follow the user task**.

---

# Prioritized findings

| # | Severity | Category | Location | Finding | Recommendation | Nielsen |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Major | Hierarchy | Most authenticated pages | Many views use nearly identical page headers, large 2–3rem titles, divider, cards, and panels regardless of the user's task. | Create a shared but flexible page-header/task-header pattern with compact operational variants and stronger primary-action/state emphasis. | H8 |
| 2 | Major | Usability | Orders / Payments / Pickups | Dense operational screens give filters, list rows, detail panes, metadata, statuses, and actions similar visual weight. The eye must search for the next action. | Introduce task-specific hierarchy: queue/list first, selected work item second, authoritative status + next action clearly grouped. | H6, H8 |
| 3 | Major | Navigation | Application shell mobile/tablet | At <=900px the sidebar turns into horizontally scrolling grouped navigation. This preserves all links but creates discovery and orientation friction as menu count grows. | Replace horizontal multi-group navigation with a deliberate compact mobile navigation pattern while preserving role visibility and active route. | H3, H6 |
| 4 | Major | Consistency | Page-level CSS modules | Header, main container, state wrapper, filter panel, card/list, metadata grid, error/notice, and responsive action rules are reimplemented in many modules. | Consolidate repeated operational patterns into shared layout/UI primitives or reusable CSS patterns before page-specific redesign. | H4 |
| 5 | Major | Product identity | Storefront/Auth/Admin pages | English eyebrows such as “University storefront”, “Browse”, “Account access”, “Create account”, and operational English labels behave like generic template chrome rather than user information. | Remove decorative eyebrows unless they carry real context; prefer concise Thai context labels or task/state metadata. | H2, H8 |
| 6 | Major | Visual craft | Storefront | Store cards, hero composition, uppercase eyebrow, and arrow suffix follow common generated-landing-page patterns. | Rebuild storefront hierarchy around real university storefront content: organization identity, active campaigns/products, availability, and clear browse action. | H2, H8 |
| 7 | Major | Dashboard | Organization + Platform summary | Metrics use repeated identical cards, a common generic SaaS pattern. All values receive similar emphasis even when operational importance differs. | Replace equal-card grids with prioritized summary groups: urgent work, actionable counts, then supporting totals/status distribution. | H1, H8 |
| 8 | Major | Forms/filters | Organization operational modules | Filters are often displayed as full bordered panels even when they are secondary to the working queue. On mobile, controls stack into tall screens before results. | Create compact filter toolbar/disclosure pattern, preserve active-filter visibility, and keep the work list closer to the top. | H6, H8 |
| 9 | Major | Actions | Admin operational pages | Multiple action groups are plain flex rows; destructive, primary, secondary, download, and navigation actions can compete. | Standardize action hierarchy: one primary task action, secondary utilities, destructive actions separated/confirmed, responsive sticky/near-content placement where appropriate. | H5, H8 |
| 10 | Major | Status clarity | Orders / Payment / Pickup / Notifications | Status is represented, but page structure often treats status as one metadata item among many rather than the main decision context. | Add a consistent operational status header/rail that communicates “current state → what happens next → action available now”. | H1, H2 |
| 11 | Major | Customer journey | Order tracking / Payment / Pickup | Customer pages are implemented as separate functional screens but need stronger continuity across order → payment → review → production → pickup. | Add consistent journey/next-step presentation driven only by existing Backend statuses; do not invent transitions. | H1, H6 |
| 12 | Major | Responsive UX | Admin list/detail layouts | Desktop split panes correctly collapse to one column, but selected detail can move far below the list and action context can be lost. | On smaller screens, make list→detail navigation/state more explicit and keep selected item/action context obvious. | H3, H6 |
| 13 | Minor | Token integrity | Dashboard / Platform Admin CSS | CSS uses token names such as `--text-body-sm` and `--radius-pill` that are not declared in the inspected global token source. Invalid variable use can silently fall back to inherited/default behavior. | Either map usage to existing canonical tokens or deliberately add reviewed canonical tokens in the single token source. | H4 |
| 14 | Minor | Typography | Many operational modules | Large `clamp(2rem, 4vw, 3rem+)` page titles consume excessive space for repeated admin tasks and compete with content. | Keep expressive scale for customer/public moments; use the documented 28px operational page heading for recurring admin work. | H8 |
| 15 | Minor | Typography | Technical IDs/tokens | Several screens use monospace for IDs/tokens. This is valid for scannability, but it appears in multiple surfaces without a shared “technical value” pattern. | Create one reusable technical-value style and reserve monospace for actual machine/reference values. | H4 |
| 16 | Minor | Component consistency | Notifications filters | Notification filter buttons are locally implemented while shared button/control primitives exist. | Introduce/reuse a segmented filter/toggle-group pattern so focus, active, hover, and responsive behavior are consistent. | H4 |
| 17 | Minor | Empty/loading hierarchy | Multiple modules | Full-page state wrappers often replace the entire page context, so users may lose orientation during load/empty/error states. | Keep page/task context visible where useful and place async state inside the content region. | H1, H3 |
| 18 | Minor | Content design | Several screens | Some user-facing descriptions explain architecture/Backend authority directly, which is accurate but not always the clearest user language. | Keep contract truth internally; rewrite visible copy around what users can do/expect, retaining technical detail only where needed. | H2 |
| 19 | Enhancement | Efficiency | High-frequency staff flows | Operational pages do not yet expose stronger power-user scanning/selection patterns. | After core redesign is stable, evaluate keyboard-friendly row selection, sticky task actions, and denser queue modes without changing business logic. | H7 |
| 20 | Enhancement | Identity | Whole product | The current “ledger marker” exists but appears mostly as a decorative vertical accent; it does not yet shape the operational interaction model. | Extend the ledger concept into status/task grouping, selected-row context, and key metadata so it becomes functional rather than ornamental. | H2, H8 |

---

# Banned-default / generic-design check

## Present or partially present

### Repeated SaaS-card kit

Observed in:

- dashboard metric cards
- Platform Admin metrics
- Organization cards
- order cards
- payment cards
- pickup cards
- storefront store cards

The issue is not that cards are forbidden. The issue is that card treatment has become the default answer for unrelated information types.

### Oversized heading pattern

Many operational screens use:

```css
font-size: clamp(2rem, 4vw, 3rem)
```

or larger.

For repeated admin work this creates brochure-like spacing rather than a compact workbench.

### Decorative uppercase eyebrow labels

Repeated pattern:

```css
text-transform: uppercase;
letter-spacing: 0.05em;
```

Used for labels such as:

- University storefront
- Browse
- Notifications
- Platform/Admin page categories
- Auth framing

These are strong template tells and often do not add task information.

### Arrow-decoration links

The storefront store action appends a decorative `→`, another template pattern called out by the installed frontend-design guidance.

### Equal-weight metric cards

Dashboard and platform summaries use repeated metric-card grids. The redesign should differentiate actionable metrics from supporting totals.

## Existing defaults already avoided

- no decorative gradients in the core system
- no excessive shadow system
- no rainbow accent palette
- no random per-page bright colors
- no uncontrolled giant radius everywhere
- no loss of focus-visible baseline
- no animation-heavy interaction system

---

# Nielsen heuristic summary

## H1 — Visibility of system status

Baseline is structurally good because loading/error/status states exist.

Main issue: current **business status does not consistently dominate the page at the moment a user must decide what to do next**.

High-priority targets:

- payment review
- pickup confirmation
- order tracking
- campaign lifecycle
- organization/platform approval or suspension

## H2 — Match between system and real world

Technical correctness is strong, but some visible copy talks about Backend/API authority instead of the user's task.

Redesign visible language around:

- “รอตรวจสอบการชำระเงิน”
- “ต้องส่งหลักฐานใหม่”
- “พร้อมรับสินค้า”
- “ยืนยันการรับสินค้า”

while still deriving those messages from existing statuses.

## H3 — User control and freedom

Dialogs and navigation exist, but mobile navigation and list/detail transitions need clearer escape/back context.

## H4 — Consistency and standards

Semantic colors/tokens are a strength.

Largest weakness is repeated page-local reimplementation of the same structural components.

## H5 — Error prevention

High-impact flows already use controlled Backend actions.

Redesign must make dangerous/destructive actions visually separated and keep confirmation patterns consistent.

## H6 — Recognition rather than recall

Operational screens should expose selected item, active filter, current status, and next action without requiring users to remember where they came from.

## H7 — Flexibility and efficiency

Current screens are usable but conservative. High-frequency staff flows can become more efficient after hierarchy is fixed.

## H8 — Aesthetic and minimalist design

This is the largest visible redesign opportunity.

There is too much repeated wrapper/card/header structure and not enough task-specific composition.

## H9 — Error recovery

Existing inline errors and state components are good foundations.

Later phases should ensure every error answers:

1. what happened
2. whether user data/action was saved
3. what the user can do next

## H10 — Help/documentation

The product should favor contextual guidance rather than adding a large help system. Payment, pickup, and lifecycle actions need the most concise inline guidance.

---

# Target direction for implementation

## Domain

- campus organization storefront
- order ledger
- payment desk
- production queue
- pickup counter
- approval desk
- audit record

## Color world

Keep the current system:

- neutral off-white canvas
- white/light-neutral working surfaces
- graphite text
- campus blue-green for identity/action
- restrained green/amber/red/info only for real state meaning

No new decorative palette is required.

## Signature

Evolve the existing **ledger marker** into a functional pattern:

- compact task/status heading
- current state
- key reference metadata
- next action

Use it especially for operational detail/context rather than adding another decorative card.

## Hierarchy rule

Every screen must answer in this order:

1. Where am I?
2. What is the current state/task?
3. What do I need to do next?
4. What supporting data do I need?
5. What secondary actions exist?

## Public/customer direction

More breathing room is acceptable, but avoid generic marketing-page conventions.

Prioritize real content:

- organization/store identity
- active campaign/product availability
- price/variant information
- ordering status
- customer next action

## Staff/Admin direction

Treat pages as a workbench:

- compact task header
- queue/filter controls
- strong selected state
- concise metadata
- one obvious primary action
- supporting actions visually quieter
- dense but not cramped

---

# Phase mapping

## Phase 2 — shared visual foundations

Address:

- token integrity
- operational heading scale
- surface rhythm
- reusable status/task hierarchy
- shared spacing/density decisions
- remove decorative generic typography patterns from the base direction

## Phase 3 — shell/navigation

Address:

- mobile nav discoverability
- role/context visibility
- active-route clarity
- user/Organization context hierarchy

## Phase 4 — shared primitives

Address:

- action hierarchy
- filter/segmented controls
- repeated page header/task header
- repeated notice/error/state patterns
- list/detail foundations
- consistent technical-value treatment

## Phases 5–15

Apply task-specific redesign rather than cloning one generic page template.

## Phase 16

Full responsive consistency pass.

## Phase 17

Runtime-oriented accessibility review using available tooling. Do not claim contrast ratios until actually measured.

## Phase 18

Full local regression and static-export build verification.

## Phase 19

Re-score design quality and remove remaining generic patterns.

## Phase 20

Diff review for contract drift, scope drift, regressions, accessibility blockers, and accidental unrelated changes.

---

# Phase 1 conclusion

The frontend has a sound functional and token foundation. The redesign should **not** replace the architecture or create another design system.

The highest-value redesign work is:

1. fix hierarchy before decoration
2. make operational pages task-specific
3. improve shell/mobile navigation
4. consolidate repeated page-local UI patterns
5. make status + next action the focal point
6. reduce generic SaaS/AI visual tells
7. keep customer and operational surfaces recognizably part of one UniStore Hub system
8. preserve all existing Backend authority and static-export contracts

No business logic, API, authorization, or route change is required by this audit.
