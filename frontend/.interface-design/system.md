# UniStore Hub Interface System

## Direction

UniStore Hub is a university commerce and operations product used by students, staff, organization administrators, and platform administrators. The interface should feel calm, dependable, compact, and operational rather than promotional.

The visual metaphor is a campus service counter combined with a stock/order ledger: clear labels, visible state, practical controls, and restrained hierarchy.

The redesign must make structure follow the user's task. Browsing, approving a payment, confirming a pickup, managing inventory, and platform administration should share one visual system without being forced into the same page composition.

## Product domain exploration

### Domain

- campus organization stores
- pre-order campaigns
- order ledgers
- payment review
- production batches
- pickup counters
- staff operations
- audit history

### Color world

Colors come from physical university administration and store operations:

- off-white paper
- graphite ink
- cool gray counters
- deep campus blue-green signage
- muted green approval stamps
- amber review/waiting markers
- restrained red rejection/cancellation marks

### Signature

Use the **ledger marker** for important operational context, not as decoration alone.

The complete pattern is:

1. compact ledger marker
2. current task or state
3. the minimum reference metadata needed to identify the work item
4. the next available action

A screen does not need the marker on every section. Reserve it for the primary page/task context so it remains meaningful.

### Defaults rejected

- generic bright SaaS blue everywhere -> use one restrained campus blue-green accent and reserve semantic colors for status
- dashboard made of identical floating cards -> prioritize actionable information, then supporting totals/status distribution
- oversized rounded controls -> use compact controls and a measured radius scale suitable for operational work
- decorative uppercase eyebrow on every page -> show a context label only when it conveys information
- every data block as the same bordered card -> choose list, row, panel, inset summary, or open layout according to the task
- decorative arrow suffixes on links -> action copy should communicate the destination or action without template chrome

## Intent

Primary humans are students ordering goods and staff/admin users processing orders, payments, production, pickups, and organization data.

Primary actions must be obvious within five seconds. Staff/admin views should support repeated operational use with low cognitive load. Customer views may breathe slightly more but still belong to the same system.

Every substantial screen should answer in this order:

1. Where am I?
2. What is the current state or task?
3. What do I need to do next?
4. What supporting data do I need?
5. What secondary actions are available?

## Hierarchy

Use hierarchy differently for operational and expressive/customer contexts.

### Operational views

- primary page heading: 28px / 600 via `--text-heading`
- section title: 22px / 600 via `--text-title`
- small title / row title: 18px / 600 via `--text-title-sm`
- body: 14px / 400-500 via `--text-body`
- compact supporting text: 13px via `--text-body-sm`
- caption/meta: 12px / 500 via `--text-caption`
- dynamic numbers use tabular figures
- routine admin pages should not use brochure-scale 3rem headings

### Customer/public views

- `--text-display` may be used for a true hero/focal moment
- display typography must not be repeated on every section
- real store/campaign/product content should lead before decorative marketing copy

### General hierarchy rules

- one focal action or state per view
- weight, tone, position, and space should establish hierarchy before borders or color
- status and next action should outrank secondary metadata on transactional screens
- avoid treating all metrics, cards, and actions as equal

## Palette

Canonical semantic tokens are defined in `src/app/globals.css`.

- canvas: warm-cool neutral off-white
- primary surfaces: white/light neutral
- primary text: graphite
- accent: campus blue-green
- semantic colors: success, warning, danger, info only when meaning is present

Do not introduce arbitrary hex colors in feature components when a semantic token exists.

Semantic state colors must communicate real product state and must not be used as decoration.

## Depth

Depth strategy: **surface-color shifts plus whisper borders**.

- no decorative gradients
- no dramatic drop shadows
- page canvas -> surface -> raised/muted/inset surfaces
- inputs are inset relative to surrounding surfaces
- borders are low contrast and only clarify structure
- avoid wrapping every section in a bordered card
- use open space and surface shifts to group content before adding more outlines

## Surfaces

Light mode is the default direction. Dark mode is supported through the same semantic tokens.

Surface order:

1. `--canvas`
2. `--surface`
3. `--surface-raised`
4. `--surface-muted`
5. `--surface-inset`

Do not create feature-specific surface hues unless they convey status.

Selected rows/items may use the existing campus/semantic palette, but selection must remain distinguishable without relying on color alone.

## Typography

Typeface: Noto Sans Thai, bundled locally through Fontsource.

Reasons:

- strong Thai and Latin coverage
- clear at compact data-table sizes
- neutral enough for operational UI without looking like browser-default typography

Weights:

- 400 body
- 500 labels/actions
- 600 headings/key values
- 700 only for a small number of genuinely dominant totals/metrics

Technical identifiers may use `--font-technical` when machine-readable distinction improves scanning. Do not use monospace as decorative UI chrome.

User-facing labels should be plain Thai/English content appropriate to the task. Avoid uppercase English eyebrow labels that do not add meaning.

## Spacing

Base unit: 4px.

Preferred rhythm:

- micro: 4-8px
- control internal: 8-12px
- component: 12-20px
- section: 24-32px
- major page separation: 40-64px

Canonical layout tokens:

- `--page-gutter: 24px`
- `--page-gutter-compact: 16px`
- `--page-block-start: 32px`
- `--page-block-end: 64px`
- `--content-reading: 720px`
- `--content-narrow: 860px`
- `--content-max: 1180px`

Admin screens should be compact-but-readable. Customer storefront screens can use wider section spacing but must keep the same token scale.

Filter controls on operational pages should not consume more visual space than the work results unless filtering is itself the primary task.

## Radius

- small controls: 6px via `--radius-sm`
- fields/buttons/cards: 10px via `--radius-md`
- larger panels/dialogs: 14px via `--radius-lg`
- exceptional large shells: 20px via `--radius-xl`
- pill: `--radius-pill`, reserved for badges/status/role chips where pill grouping carries meaning

## Controls

Canonical control heights:

- compact control: 36px via `--control-height-sm`
- standard control: 40px via `--control-height`
- comfortable/form control: 44px via `--control-height-lg`
- editable control boundaries use `--control-line`; keep this boundary at WCAG 2.2 non-text contrast level in both light and dark themes

Interaction rules:
- minimum interactive target: 40px for routine product controls; use 44px where space permits
- visually compact controls may need a larger hit area
- every control needs hover, active, focus-visible, disabled, and pending treatment
- forms require visible labels
- status must never be conveyed by color alone
- high-impact actions require confirmation
- one primary action should visually lead each task area
- destructive actions must remain visually separated from routine primary actions

## Operational status pattern

For Orders, Payments, Campaign lifecycle, Production, Pickups, Organization approval, and similar workflows:

1. current authoritative state
2. concise human-readable meaning
3. next available action, if any
4. supporting timestamps/reference metadata
5. secondary/history actions

Do not invent a next step that Backend state does not support.

Semantic color reinforces the status but the status text/label remains required.

## Lists, queues, and detail views

Staff/admin work is queue-oriented.

- list/queue rows should optimize scanning rather than look like promotional cards
- selected state must be obvious
- critical status/reference/amount information should align consistently across rows
- selected detail should make the next action visually obvious
- filters are secondary controls unless the page is specifically a search/filter task
- on smaller screens, list -> detail context must remain understandable after the split layout collapses

## Shared implementation primitives

Use the shared components before adding page-local equivalents:

- `PageShell` / `PageHeader` / `PageStack` for canonical page framing; use `PageHeader variant="customer"` only for genuine customer-facing hero moments
- `Button` for primary, secondary, quiet, and dangerous actions; pending state must remain disabled and explicit
- `TextField`, `TextareaField`, and `SelectField` for labeled form controls with hint/error wiring
- `Badge` for short status/category labels where text remains present
- `Card` for bounded groups only; choose default, muted, flat, or compact treatment according to hierarchy rather than using cards everywhere
- `Table` for data-dense desktop-friendly information; selected rows must expose semantic selection as well as visual selection
- `FilterToolbar` for secondary filtering controls so filters do not visually outrank work results
- `ActionBar` for related actions without inventing toolbar keyboard semantics
- `Notice` for contextual information, success, warning, or error messaging
- `TaskStatus` for the ledger-marker operational pattern: current state, human meaning, supporting metadata, then next action
- `LoadingState`, `EmptyState`, `ErrorState`, `UnauthorizedState`, and `ForbiddenState` for consistent asynchronous/access states
- `Dialog` / `ConfirmDialog` for focused modal work and high-impact confirmation; header and footer remain visible while long body content scrolls

Page-specific CSS may compose these primitives, but should not reimplement the same interaction/state pattern without a documented reason.

## Motion

- 120ms fast feedback
- 180ms standard UI transitions
- ease-out curve: `cubic-bezier(0.23, 1, 0.32, 1)`
- animate transform/opacity only where practical
- repeated staff operations should use little or no decorative motion
- respect `prefers-reduced-motion`

## Responsive behavior

- desktop admin layout may use a ~248px sidebar
- data tables must use horizontal containment or mobile-safe alternate presentation
- primary actions must remain reachable at mobile widths
- do not use fixed-width page content that overflows 320px
- content maximum width is 1180px unless a dense operational screen has a documented reason to exceed it
- mobile navigation must preserve discoverability and active context; a long horizontally scrolling set of navigation groups is not the target end state
- collapsed list/detail screens must retain clear selected-item and back/context behavior

## Accessibility baseline

- semantic HTML first
- keyboard-accessible actions
- visible focus ring
- form labels
- non-color status cues
- dialogs must trap and return focus
- meaningful button/link text
- minimum WCAG 2.2 target-size requirements must be met
- focus must not be obscured by sticky/fixed UI
- authentication must not add avoidable cognitive barriers
- contrast values must be measured before claiming WCAG conformance

## Implementation order

For the current redesign:

1. tokens and foundation
2. application shell/navigation
3. shared primitives/patterns
4. task-specific customer and operational pages
5. responsive consistency
6. accessibility verification
7. regression/static-export verification

Do not redesign page-by-page by cloning one new template. Shared system decisions should be established first, then each flow should use the composition appropriate to its task.
