# UniStore Hub Interface System

## Status

Canonical visual authority for the full frontend redesign.

Working direction: **Campus Commerce Workbench**

This document replaces the previous visual direction. Do not maintain an old theme in parallel. All pages must consume the same semantic token source in `src/app/globals.css`.

## Product model

UniStore Hub has two related modes inside one product:

1. **Campus storefront** — students/customers discover organizations, stores, campaigns, products, place orders, pay, track, and collect.
2. **Operations workbench** — Staff, Organization Admin, and Platform Admin users repeatedly inspect state, process queues, manage configuration, and perform high-impact actions.

These modes should feel related but not visually identical.

Customer surfaces may be more spacious and content-led. Operational surfaces must be compact, fast to scan, and action-oriented.

## Core product character

The interface should feel:

- modern
- calm
- precise
- dependable
- campus-specific without decorative university clichés
- operational without looking like a generic SaaS dashboard

The visual identity comes from composition, state hierarchy, typography, rhythm, and the **ledger rail**. It must not depend on gradients, glassmorphism, random shadows, oversized rounded cards, or decorative animation.

## Signature: ledger rail

The signature device is a restrained vertical/edge marker attached to the primary task or authoritative state.

A proper ledger rail contains:

1. current task/state
2. plain-language meaning
3. minimum identifying references
4. next valid action
5. secondary metadata after the action context

Use it for the main task/state context only. Do not add a marker to every section.

## Design dials

These are manual design intent values, not generated UI/UX Pro Max search output.

- visual variance: 5/10
- motion: 3/10
- customer density: 4/10
- operational density: 8/10

## Defaults rejected

Do not use these as the default answer:

- generic SaaS metric-card walls
- identical rounded cards for unrelated content
- decorative gradients
- arbitrary glass effects
- giant operational page headings
- uppercase eyebrow labels used only as decoration
- arrow glyphs appended to links for style
- monospace text as aesthetic chrome
- multiple competing primary buttons
- motion without a user/task reason
- hidden permissions masquerading as authorization
- desktop layouts simply compressed into mobile

## Color system

The canonical palette is semantic and lives in `src/app/globals.css`.

### Neutral surfaces

Light:

- canvas `#F4F6F3`
- surface `#FFFFFF`
- raised `#FBFCFA`
- muted `#EDF1ED`
- inset `#E7ECE8`
- strong neutral `#DFE6E1`

Dark:

- canvas `#0D1413`
- surface `#121B19`
- raised `#17221F`
- muted `#1C2926`
- inset `#0A1110`
- strong neutral `#253530`

### Identity

Campus accent is deep teal-green:

- `--campus`
- `--campus-hover`
- `--campus-soft`
- `--campus-strong`

Use the campus accent for identity, focus of action, selection, and active navigation. Do not use it as a decorative wash.

### Semantic states

Use only when meaning exists:

- success
- warning
- danger
- info

State must always include text/semantics. Color is reinforcement, never the only signal.

## Contrast policy

The foundation palette was selected to keep common text/state pairings above normal-text AA contrast in both light and dark themes.

Do not claim full WCAG conformance until browser/runtime contrast and composed-state checks are completed in the accessibility phase.

Editable control boundaries must remain visually distinguishable from adjacent surfaces.

## Typography

Primary family:

`Noto Sans Thai`

Fallback:

`"Leelawadee UI", Tahoma, sans-serif`

Technical values may use the dedicated monospace token only when the value is genuinely machine/reference oriented.

### Type roles

Desktop foundation:

- caption: 12px
- body small: 13px
- body: 15px
- comfortable body: 16px
- row/small title: 18px
- section title: 22px
- operational page heading: 28px
- customer display: 44px

Small mobile:

- caption: 13px
- body small: 14px
- body: 16px
- title: 18–21px
- page heading: 26px
- display: 34px

The mobile type increase is deliberate to preserve readability and avoid tiny inherited form text.

### Weight

- 400 body
- 500 controls/labels
- 600 headings/key state/value
- 700 only for genuinely dominant totals or identity moments

Avoid using type weight everywhere as a substitute for hierarchy.

## Spacing

Base unit: 4px.

Canonical scale:

- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64
- 80

Use larger spacing to separate changes in task/section hierarchy, not to make empty layouts feel premium.

Customer screens may use more section breathing room. Operational screens should use compact vertical rhythm and tighter related groups.

## Radius

- 6px small controls
- 10px routine fields/buttons
- 14px bounded panels/dialog surfaces
- 20px only for exceptional outer shells
- pill only for status/category/chip semantics

Do not make all containers equally rounded.

## Depth and surfaces

Depth order:

1. canvas
2. surface
3. raised
4. muted
5. inset
6. strong neutral boundary

Default depth strategy:

- surface-color shifts
- low-contrast borders
- tiny shadow only where separation would otherwise be unclear
- larger overlay shadow only for dialogs/sheets

Avoid stacking card-on-card-on-card layouts.

## Layout

Canonical widths:

- reading: 720px
- narrow: 900px
- default application: 1240px
- wide operational ceiling: 1440px

Default horizontal gutter:

- responsive desktop: 20–36px
- small mobile: 16px

Desktop operational sidebar target:

- 264px

Page compositions may exceed the default content width only when a dense table/queue genuinely benefits from it.

## Responsive contract

Target from **320px and above**.

Mandatory review widths later:

- 320
- 375
- 768
- 1024
- 1440

Required invariants:

- no avoidable page-level horizontal overflow
- no clipped primary action
- no unreachable control
- no focused field hidden behind sticky/fixed UI
- dialogs keep title/action controls accessible while long body scrolls
- long IDs/tokens wrap safely
- action groups recompose instead of shrinking unreadably
- desktop split views become an explicit list -> detail sequence on mobile
- tables use containment or a task-appropriate alternate composition
- small-screen navigation remains discoverable

## Customer vs operational density

### Customer

- more whitespace
- clearer content landmarks
- product/store/campaign identity can lead
- 16px-class reading on small screens
- primary CTA is easy to locate
- transaction status remains explicit

### Staff / Organization Admin

- compact task header
- dense rows/tables where useful
- filters subordinate to work results
- consistent status/reference alignment
- selected item obvious
- one primary action
- destructive actions separated
- secondary metadata quieter

### Platform Admin

Use the same workbench grammar, but surface **platform scope** clearly so platform authority is never confused with organization membership.

## Page archetypes

Do not apply one page template to all routes.

### Marketplace index

For storefront landing/discovery.

`identity/context -> grouped discovery -> store entry`

### Commerce detail

For store/product/campaign.

`identity -> availability/state -> core commerce content -> action`

### Customer transaction

For order/payment/pickup.

`journey/current state -> next action -> transaction detail -> references/history`

### Operational queue

Desktop:

`task header -> compact filters -> queue/list | selected detail + action rail`

Mobile:

`task header -> active filters -> queue -> explicit detail context`

### Management workspace

For staff/stores/products/campaigns/settings.

`context -> entities/config -> edit/create task -> supporting state`

### Read-only ledger

For audit and read-heavy platform surfaces.

`scope -> compact filter/search -> dense records -> inspect metadata`

### Attention summary

For organization/platform dashboards.

`needs attention -> active workload -> supporting totals`

No equal-weight metric wall.

## Controls

Target sizing:

- compact visual control: 36px
- standard: 40px
- comfortable/form: 44px
- small-screen standard controls become 44px
- small-screen comfortable controls become 48px

Interactive controls need:

- hover where relevant
- active/pressed
- focus-visible
- disabled
- pending/loading
- semantic accessible name

Primary interaction may never depend on hover alone.

Buttons should show immediate press feedback without moving surrounding layout.

## Forms

Rules:

- visible label per field
- placeholder is not a label
- hint/error is connected semantically
- errors explain cause and recovery
- pending submit disables repeat action
- first invalid field or error summary receives focus after failed submit
- read-only state differs from disabled
- grouped fields use meaningful visual/semantic grouping
- password manager/paste/autofill must remain available
- complex options use progressive disclosure only when behavior permits

On small screens, input text must not become tiny enough to trigger iOS zoom.

## Navigation

Navigation authority remains in `src/modules/auth/navigation.ts`.

Design may change presentation, but not destination authority.

### Desktop

- operational contexts may use persistent sidebar
- scope/context appears above task groups
- active destination is visible by shape/marker/weight, not color alone
- customer, organization, and platform groups remain distinct

### Mobile

- compact top bar + deliberate menu/drawer/sheet
- current page/area remains visible with menu closed
- no horizontal scrolling taxonomy
- route choice closes menu
- Escape support remains where applicable
- deep operational detail retains back/queue context

## Lists and tables

Operational lists prioritize scanning.

Rows should align:

- state
- primary identifier
- customer/entity reference
- amount/count
- time
- next work

Selected state must remain visible without relying on color alone.

Use table semantics for actual tabular relationships. Use list/row patterns when row composition needs richer action/status structure.

## Filters

Filters are secondary unless the page is explicitly a search tool.

Preferred behavior:

- compact filter toolbar
- active filters remain visible
- clear/reset action easy to find
- results remain close to the top
- mobile can use grouping/disclosure when needed
- filter controls do not consume more visual weight than the work queue

## Status and next action

For transaction/operational screens:

1. authoritative state
2. human-readable meaning
3. valid next action
4. required identifying metadata
5. supporting/history actions

Never invent a next step not supported by Backend state.

## Loading, empty, error, forbidden

Keep orientation visible where possible.

A state message should answer:

- what is happening
- whether the user can act
- what to do next

Errors should not be vague.

Permission/access states may explain why access is unavailable, but must not claim frontend visibility as security authority.

## Motion

Motion is restrained.

Tokens:

- fast: 120ms
- standard: 180ms
- slow: 260ms

Allowed uses:

- hover/press feedback
- menu/dialog open/close
- state disclosure
- action completion feedback

Avoid:

- page-load choreography on operational screens
- repeated stagger animations
- scroll effects
- decorative parallax

Respect `prefers-reduced-motion` globally.

## Icons

Use one vector icon family/style if icons are introduced.

Rules:

- no emoji as structural controls
- consistent size tokens: 16 / 20 / 24px
- consistent stroke/fill language at the same hierarchy level
- icon-only controls require accessible name
- decorative icon beside visible text is hidden from assistive technology
- do not add icons where text is clearer

## Z-index

Canonical layers:

- base: 0
- sticky: 20
- navigation: 40
- overlay: 50
- dialog: 60
- toast: 80
- skip link: 100

Do not invent arbitrary z-index values per feature without a documented need.

## Accessibility baseline

Required throughout implementation:

- semantic HTML first
- logical heading hierarchy
- keyboard operability
- visible focus
- labels for controls
- meaningful accessible names
- status not color-only
- focus not obscured
- reduced motion
- predictable dialog focus return
- drag/swipe alternatives if those patterns are ever added
- authentication remains password-manager/paste compatible
- minimum pointer target requirements respected

Full accessibility certification remains a later phase.

## Project contract guardrails

Visual redesign must not change:

- API routes
- DTO meanings
- role names
- membership authority
- tenant rules
- Platform Admin authority from persisted `user.platformRole`
- Backend-authoritative authentication/authorization
- 403 handling semantics
- query-parameter entity routing
- static export
- Campaign lifecycle
- Order lifecycle/cancellation rules
- Payment review authority
- Pickup authority
- customer pickup presentation-only behavior
- direct S3 presign -> direct PUT without JWT -> persist Backend-issued key
- integer-satang price semantics
- opaque cursors
- notification events as signals rather than current-resource authority

## Shared implementation rule

There is one design system.

Future phases should rebuild shared primitives first, then compose route-specific UX from them.

Page-specific CSS is allowed for composition. It should not recreate generic controls, state semantics, dialog behavior, buttons, fields, badges, filters, or repeated workbench patterns without a documented reason.

## Implementation sequence

1. foundation tokens and this system document
2. shared primitives
3. application shell/navigation
4. storefront/public
5. auth
6. customer transaction flows
7. organization management
8. organization operations
9. platform admin
10. responsive/interactions
11. accessibility/design-quality audit
12. regression/static-export verification
13. final diff review
