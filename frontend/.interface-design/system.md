# UniStore Hub Interface System

## Status

Canonical visual authority for **Skill-Driven UniStore Hub UX/UI Redesign v2**.

Approved direction: **Campus Commerce Workbench v2**

This document is the single visual authority for the frontend. It reconciles the existing UniStore Hub product model with verified `ui-ux-pro-max` search results and the local `interface-design`, `design-review`, `redesign`, `frontend-design`, and `a11y-audit` skills.

Do not maintain an old theme or a second generated design system in parallel. All pages must consume the same semantic token source in `src/app/globals.css`.

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

The visual identity comes from composition, state hierarchy, Thai typography, rhythm, and a **task ledger** pattern. It must not depend on gradients, glassmorphism, random shadows, oversized rounded cards, decorative animation, or repeated accent strips.

## Signature: task ledger

The signature is a **content arrangement**, not a decorative border treatment.

A proper task ledger contains:

1. authoritative current state
2. plain-language meaning
3. minimum identifying references
4. one clear next valid action when an action exists
5. secondary metadata/history after the action context

The task ledger may use a quiet neutral rule, status icon, badge, or local surface shift to anchor attention. A colored left-edge rail is not required and must not be repeated across ordinary rows/cards.

Use this pattern only for the primary transaction or work context. Queue rows, notices, selected items, and generic cards should use their own semantic patterns instead of copying the signature.

## Design dials

A verified `ui-ux-pro-max --design-system` search for `thai campus marketplace preorder operations` returned variance 6/10, motion 3/10, and density 7/10.

The product adapts that calibration into:

- visual variance: **6/10** — enough compositional variation to avoid template repetition
- motion: **3/10** — subtle feedback only
- customer density: **5/10** — browsable, comfortable, content-led
- operational density: **8/10** — compact and scan-first without shrinking touch targets

Customer and operational density intentionally diverge while using the same tokens and component language.

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

## Skill evidence and decisions

Verified `ui-ux-pro-max` searches are design evidence, not project authority. The complete audit record is in `ux-ui-audit.md`.

### Adopted

- **Noto Sans Thai** as the primary family. The typography search ranked it as the strongest Thai-modern/readable match.
- **Minimalist / Swiss clarity**: strong grid, hierarchy, restrained surfaces, limited accent use, low effect cost.
- **Motion 3/10**: direct interaction/state feedback rather than decorative choreography.
- **Visible focus, focus-not-obscured, touch-friendly controls, submit feedback, inline errors, and contextual async status messaging.**
- **Next.js internal navigation guidance** where compatible with the static-export architecture.

### Adapted

- **Density 7/10** becomes customer 5/10 and operations 8/10.
- **Marketplace/e-commerce patterns** become campus-specific discovery, preorder, payment-review, production, and pickup compositions rather than generic cart/review patterns.
- **Commerce icon guidance** becomes one shared project-local vector style used only when an icon improves comprehension.
- **Minimalism** does not mean zero radius, pure black/white, or identical page layouts.

### Rejected by default

- **Hero + Testimonials + CTA** as a system pattern. UniStore Hub has no verified testimonial/social-proof source; do not fabricate one.
- **Generic purple + green marketplace palette** as an automatic replacement.
- **Green + orange e-commerce palette** as an automatic replacement.
- **GSAP / scroll-reveal choreography** without a task-specific reason.
- **Server/runtime recommendations** that conflict with static export, backend API authority, or pre-signed/direct-S3 flows.

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

Final identity direction: **deep campus teal**.

The verified color searches surfaced marketplace purple/green, e-commerce green/orange, education teal, and trust teal candidates. The product keeps the existing darker teal family because it is more specific to the established UniStore Hub direction, works across storefront and operations, and avoids turning success green into the primary brand signal.

Canonical identity tokens remain:

- `--campus: #0F6A64`
- `--campus-hover: #0A5752`
- `--campus-soft: #E1F0ED`
- `--campus-strong: #083E3B`

Dark-mode identity remains a lighter teal family derived from the same hue.

Use campus teal for identity, primary action, selection, active navigation, and current scope. Do not use it as a decorative wash. Success/warning/danger/info remain semantically separate and must not be recolored to match brand for aesthetics.

### Semantic states

Use only when meaning exists:

- success
- warning
- danger
- info

State must always include text/semantics. Color is reinforcement, never the only signal.

## Contrast policy

The foundation palette keeps common text/state pairings above normal-text AA contrast in both light and dark themes.

Phase 19 measured the core text, semantic-state, focus, and editable-control boundary pairs and ran rendered light/dark checks on the public entry flows at 320px. The shared field focus ring now uses the full focus token, and the light editable-control boundary is calibrated above 3:1 against the inset control surface.

This is project-level accessibility verification, not a claim of formal WCAG certification. Manual assistive-technology testing remains appropriate before a production accessibility certification.

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

## Kicker / eyebrow policy

Small labels above headings are allowed only when they add information that the heading does not already contain, for example:

- active scope or authority boundary
- lifecycle/state context
- queue category
- selected entity type when the title alone is ambiguous

Do not add `pageKicker`, `sectionKicker`, `panelKicker`, or similar labels as decorative rhythm. A page should not automatically follow `kicker -> heading -> description` in every section.

Prefer a direct heading, status badge, breadcrumb/back context, or compact metadata row when that communicates the information more clearly.

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
- simple forms focus the first invalid field after failed submit
- complex multi-field forms use a focusable error summary at the top of the form, link/associate each summary item with its field where practical, and retain inline field errors
- do not move focus on every blur; move it after failed submit when recovery context is needed
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

For asynchronous changes:

- announce meaningful contextual status, not a bare changing number
- prefer one status/live message for the operation
- do not turn every badge/count into its own live region
- do not move focus merely because background data refreshed
- move focus only when user-triggered validation/navigation requires recovery context

Permission/access states may explain why access is unavailable, but must not claim frontend visibility as security authority.

## Motion

Motion target is **3/10**.

Tokens remain intentionally short:

- fast: 120ms
- standard: 180ms
- slow: 260ms

Allowed uses:

- hover/press feedback
- menu/dialog open/close
- state disclosure
- action completion feedback
- one-off customer-facing spatial transition only when it explains where content moved

Avoid by default:

- GSAP or another motion dependency solely for polish
- page-load choreography on operational screens
- repeated stagger animations
- scroll-reveal systems
- decorative parallax
- animation of layout dimensions when transform/opacity or no animation communicates the state better

Respect `prefers-reduced-motion` globally and render the stable final state immediately for non-essential motion.

## Icons

Use one project-local vector icon language.

The `ui-ux-pro-max` commerce search surfaced Phosphor examples, but the project does not need a new icon dependency merely to satisfy that recommendation. Prefer a small shared set of inline SVG primitives using `currentColor`, consistent stroke weight, and the existing 16 / 20 / 24px size tokens. If a future feature justifies an icon package, choose one family and migrate deliberately rather than mixing sets.

Rules:

- no emoji as structural controls
- do not use text arrows/checkmarks as decorative icon chrome when a semantic text label is sufficient
- a completion/check marker is allowed when it communicates real state and has an accessible textual equivalent
- icon-only controls require an accessible name
- decorative icon beside visible text is hidden from assistive technology
- meaningful standalone icons need a text alternative
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

Phase 19 completed the project accessibility and anti-template audit. Maintain these rules in later regression/review phases; formal accessibility certification would still require dedicated assistive-technology/manual conformance testing.

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

## Media / image policy

Image guidance must remain compatible with static export and backend-issued URLs.

- use responsive containers and reserve image space to avoid layout shift
- use semantic `alt` text for meaningful product/store media
- decorative imagery uses empty alt text
- do not rewrite short-lived/backend-issued image URL behavior solely to satisfy generic Next.js image guidance
- direct upload remains backend presign -> direct PUT -> persist backend-issued key
- loading/error placeholders should preserve layout and explain recoverable failure where useful

## Shared implementation rule

There is one design system.

Future phases should rebuild shared primitives first, then compose route-specific UX from them.

Page-specific CSS is allowed for composition. It should not recreate generic controls, state semantics, dialog behavior, buttons, fields, badges, filters, or repeated workbench patterns without a documented reason.


## v2 decision checklist

Phase 2 is complete only when implementation follows these decisions:

- identity stays deep campus teal rather than generic marketplace purple
- Noto Sans Thai remains the primary family
- task ledger is a state/action composition, not a repeated colored left border
- decorative kickers are removed; informational scope/state labels remain
- customer density 5/10 and operational density 8/10
- motion remains 3/10 with no default scroll-reveal/GSAP system
- complex forms may use a focusable error summary while retaining inline errors
- async queue/count updates use contextual live messaging sparingly
- icons use one shared vector language; no decorative arrows/emoji
- no testimonials, fake ratings, or fabricated social proof
- static-export/API/auth/direct-upload contracts override generic stack advice

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
