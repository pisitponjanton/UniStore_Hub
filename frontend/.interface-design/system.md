# UniStore Hub Interface System

## Direction

UniStore Hub is a university commerce and operations product used by students, staff, organization administrators, and platform administrators. The interface should feel calm, dependable, compact, and operational rather than promotional.

The visual metaphor is a campus service counter combined with a stock/order ledger: clear labels, visible state, practical controls, and restrained hierarchy.

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

Use a "ledger marker" pattern for important operational context: a compact accent marker beside the page title/status area, paired with concise metadata. It should help screens feel like one operational system without turning every section into a decorative card.

### Defaults rejected

- generic bright SaaS blue everywhere -> use one restrained campus blue-green accent and reserve semantic colors for status
- dashboard made of identical floating cards -> use hierarchy, grouped data, and surface shifts according to task importance
- oversized rounded controls -> use compact controls and a measured radius scale suitable for operational work

## Intent

Primary humans are students ordering goods and staff/admin users processing orders, payments, production, pickups, and organization data.

Primary actions must be obvious within five seconds. Staff/admin views should support repeated operational use with low cognitive load. Customer views may breathe slightly more but still belong to the same system.

## Hierarchy

- one focal action or state per view
- primary page heading: 28px / 600
- section title: 22px / 600
- small title: 18px / 600
- body: 14px / 400-500
- caption/meta: 12px / 500
- dynamic numbers use tabular figures
- hierarchy relies on weight, text tone, and spacing before borders or color

## Palette

Canonical semantic tokens are defined in `src/app/globals.css`.

- canvas: warm-cool neutral off-white
- primary surfaces: white/light neutral
- primary text: graphite
- accent: campus blue-green
- semantic colors: success, warning, danger, info only when meaning is present

Do not introduce arbitrary hex colors in feature components when a semantic token exists.

## Depth

Depth strategy: surface-color shifts plus whisper borders.

- no decorative gradients
- no dramatic drop shadows
- page canvas -> surface -> raised/muted/inset surfaces
- inputs are inset relative to surrounding surfaces
- borders are low contrast and only clarify structure

## Surfaces

Light mode is the default direction. Dark mode is supported through the same semantic tokens.

Surface order:

1. `--canvas`
2. `--surface`
3. `--surface-raised`
4. `--surface-muted`
5. `--surface-inset`

Do not create feature-specific surface hues unless they convey status.

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

## Spacing

Base unit: 4px.

Preferred rhythm:

- micro: 4-8px
- control internal: 8-12px
- component: 12-20px
- section: 24-32px
- major page separation: 40-64px

Admin screens should be compact-but-readable. Customer storefront screens can use wider section spacing but must keep the same token scale.

## Radius

- small controls: 6px
- fields/buttons/cards: 10px
- larger panels/dialogs: 14px
- exceptional large shells: 20px

Avoid pill shapes except status chips/tags where the shape carries grouping meaning.

## Controls

- minimum interactive target: 40px; use 44px where space permits
- every control needs hover, active, focus-visible, disabled, and pending treatment
- forms require visible labels
- status must never be conveyed by color alone
- high-impact actions require confirmation

## Motion

- 120ms fast feedback
- 180ms standard UI transitions
- ease-out curve: `cubic-bezier(0.23, 1, 0.32, 1)`
- animate transform/opacity only where practical
- respect `prefers-reduced-motion`

## Responsive behavior

- desktop admin layout may use a ~248px sidebar
- data tables must use horizontal containment or mobile-safe alternate presentation
- primary actions must remain reachable at mobile widths
- do not use fixed-width page content that overflows 320px
- content maximum width is 1180px unless a dense operational screen has a documented reason to exceed it

## Accessibility baseline

- semantic HTML first
- keyboard-accessible actions
- visible focus ring
- form labels
- non-color status cues
- dialogs must trap and return focus when dialog primitives are introduced
- meaningful button/link text
