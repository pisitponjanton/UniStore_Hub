# UniStore Hub Interface System

## Status

Canonical visual authority for **KMITL Vibrant Institutional Commerce v5 — Light**.

This replaces the Playful Campus Commerce v3 direction. Product behavior, roles, API contracts, status tokens, authorization, and static-export constraints do not change.

## North star

UniStore Hub should feel like a dependable university service with the energy of student life: Thai-first, quick to operate, youthful without becoming childish. Customer discovery may be more expressive, while operational pages retain a restrained version of the same system.

The interface prioritizes:

1. current context,
2. current status,
3. next required action,
4. supporting detail and history.

The application is light-theme only. It does not switch palettes from the operating-system or browser color preference. KMITL Orange is the brand/action color, not a large page background.

## Product modes

| Mode | Primary users | UX emphasis |
| --- | --- | --- |
| Discover and buy | Customer | find a store/campaign, understand availability, order confidently |
| Track and collect | Customer | status, payment action, pickup evidence |
| Process work | Staff | compact queues, safe transitions, exception visibility |
| Manage an organization | Organization Admin | configuration, people, catalog, campaigns, oversight |
| Govern the platform | Platform Admin | approvals, suspension, cross-organization visibility |

Role visibility improves orientation only. Backend authorization remains authoritative.

## Signature pattern: workflow reference

Transactional and operational surfaces should expose a compact reference area containing the entity identity, authoritative state, relevant organization/store context, and the next valid action. It should read like a clear service record, not a decorative dashboard card.

Use this signature in page headers, task status panels, order/payment/pickup summaries, and audit-oriented views. Do not invent status or action semantics.

## Customer signature: campus noticeboard

Customer discovery uses an asymmetric noticeboard rhythm: one strong KMITL Orange edge, numbered steps, warm paper-like surfaces, and a single commerce illustration. The purpose is to make the service recognizable and inviting to students without filling every container with color.

## Visual direction

- **Depth:** neutral borders and surface shifts. Shadows are reserved for overlays and one focal customer illustration.
- **Color:** white and neutral-gray surfaces with KMITL Orange as the single brand accent; semantic colors remain reserved for meaning.
- **Geometry:** 6px controls, 10px cards/panels, 12px large dialogs. Pills only for compact status semantics.
- **Density:** comfortable for customers; compact-but-readable for staff/admin work.
- **Motion:** low in operations; customer discovery cards may use a 2px hover lift with reduced-motion fallback.
- **Imagery:** real product media first. One restrained commerce illustration and a two-tone hero field may support discovery; repeated decorative objects and ornamental gradients are retired.

## Color system

Light — based on the provided KMITL identity guide:

- KMITL Orange / primary `#E35205` (Pantone 166 C; RGB 227, 82, 5)
- black / primary ink `#000000`
- official secondary gray `#666666`
- white `#FFFFFF`
- canvas `#F7F7F7`
- surface `#FFFFFF`
- raised `#FFFFFF`
- muted `#FAFAFA`
- inset `#F1F1F1`
- strong neutral `#E8E8E8`
- line `#D9D9D9`
- secondary ink `#4D4D4D`
- muted ink `#767676`
- brand hover `#C94700`
- accessible brand text `#9B3200`
- brand soft `#FFF0E8`
- focus `#B84000`
- primary action `#B84000`
- primary action hover `#963100`
- primary action foreground `#FFFFFF`

KMITL Orange `#E35205` remains the visual brand accent. High-emphasis controls use the deeper action orange `#B84000` with white text; this preserves the orange identity while meeting the normal-text contrast target.

The former automatic dark palette is retired. Native controls declare `color-scheme: only light`, and `prefers-color-scheme` must not replace the application palette.

Semantic families remain success, warning, danger, and info. State meaning must never rely on color alone.

Compatibility accent and gradient tokens may remain while older route CSS is migrated, but they must resolve to neutral or single-hue surfaces. New code must not introduce decorative gradients.

## Typography

Primary family: `Noto Sans Thai`, then `Leelawadee UI`, Tahoma, sans-serif.

- caption: 12/18
- small body: 14/21
- body: 16/25
- card title: 18/26
- section title: 24/32
- page title: 30/38 desktop, 26/34 mobile
- customer display: at most 40/48

Weights: 400 body, 500 navigation/labels, 600 headings/actions, 700 only for a major total or critical title. Headings balance; body copy wraps naturally. Technical references use the existing monospace token and tabular numbers.

## Spacing and layout

Base unit: 4px. Canonical scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.

- standard page gutter: 20–32px desktop, 16px small mobile
- operational section gap: 24–32px
- customer section gap: 40–64px
- standard card padding: 16–20px
- control height: 40px desktop, at least 44px for touch contexts
- content widths and responsive breakpoints remain defined by global tokens

Avoid card walls. Use headings, spacing, dividers, and tables/lists before introducing another container.

## Components

### Navigation

- Public navigation is a full-width restrained service bar, not a floating capsule.
- Authenticated navigation uses one scope-aware sidebar on desktop and an accessible drawer on mobile. The desktop sidebar supports an 84px compact rail, remembers the user's preference, and uses the logo as the explicit expand/collapse control.
- Navigation destinations pair a consistent outline icon with a text label. In compact mode the icon remains in a 44px target and the full label remains available to assistive technology and pointer users.
- Active destinations use a subtle brand-soft field and text weight without an orange border or inset edge. Do not use a colored underline beneath the Store navigation button.
- Navigation groups follow the user's work: customer tasks, active organization tasks, then platform tasks when permitted.
- Organization switching appears directly beneath the current workspace summary as a two-line workspace action; it must not be hidden beside logout in the account footer.
- Sidebar expansion uses a short spatial transition and disables movement under `prefers-reduced-motion`.

### Buttons

- Primary: deep action orange fill, white text, no decorative shadow.
- Secondary: white or muted surface with structural border.
- Quiet: text/surface response with a visible focus state.
- Destructive: danger semantics.
- Do not translate controls on hover. A subtle press scale is allowed.
- One dominant primary action per local task context.

### Forms

Preserve visible labels, hints/errors, error-summary focus management, password-manager compatibility, pending protection, and read-only/disabled distinction. Fields use an inset neutral surface, 6px radius, and a high-contrast focus ring.

### Cards and panels

Routine containers use 10px radius, a 1px line, and no shadow. Raised cards use a very subtle ring/shadow only when hierarchy requires it. Feature cards use the same neutral family; color is not decoration.

### Tables and queues

Use compact rows, clear column headings, tabular numbers, subtle row hover, and horizontal scrolling when necessary. Selected rows require both an edge marker and surface change.

### Status and feedback

Badges use compact rounded rectangles rather than large pills. Loading, empty, error, unauthorized, and forbidden states keep explicit Thai recovery copy and actions. Semantic tint should be light and localized.

### Media

Real product/store media is authoritative. Keep reserved aspect ratios, correct object fit, lazy loading below the fold, and meaningful alt text. Existing fallback illustrations may remain during route migration but must resolve through neutral foundation tokens and must not imply nonexistent inventory.

### Customer journey surfaces

- Discovery pages lead with organization, store, campaign, and product identity; decorative scenes must not compete with real inventory.
- Order creation presents campaign eligibility, selected variant, quantity, and total as one reviewable decision.
- Order tracking leads with current status and the next available action before historical detail.
- Payment presents the exact amount, slip requirements, upload state, and review progress in that order.
- Pickup treats the QR code and pickup token as operational credentials. They remain prominent, printable, and readable without decorative effects.
- Authentication uses a formal two-column introduction on wide screens and a single linear form on narrow screens.

## Accessibility

- WCAG AA contrast: 4.5:1 normal text, 3:1 large text and meaningful UI boundaries.
- All interactive controls retain visible `:focus-visible` treatment.
- Keyboard order follows visual order; drawers/dialogs retain focus trap, Escape close, scroll lock, inert background, and focus return.
- Touch targets are 44×44px where touch is expected; never below 40px.
- Visible text or semantics accompany status color.
- Respect reduced motion and browser zoom.
- Loading, success, empty, error, unauthorized, and forbidden states remain available.

## Explicitly rejected patterns

- pastel bento as the primary information architecture
- decorative gradients on cards, fields, queues, or headers
- multiple competing accent hues
- oversized marketing-style headings inside application workflows
- floating rounded app bars and excessive pill controls
- decorative 3D/clay imagery competing with task content
- shadow on every card or row
- KPI-card walls where an action list or summary is clearer

## Rollout

- Phase 0: direction and constraints — complete in this document.
- Phase 1: role and journey model — defined in `role-journeys.md`.
- Phase 2: information architecture — defined in `role-journeys.md`; existing route and authorization contracts are preserved.
- Phase 3: foundation — global semantic tokens, shared primitives, application shell, and storefront navigation.
- Phase 4: customer journey — discovery, authentication, product/campaign detail, order creation/tracking, payment, and pickup surfaces migrated to the formal minimal system.
- Phase 5: operational core — complete. Organization dashboard, Staff, Stores, Products, Campaigns, Orders, Payments, Production, Pickups, and Audit use a neutral operations-ledger hierarchy. Summary metrics share one quiet surface, structural borders are neutral, and orange is reserved for primary action or attention.
- Later phases: platform governance, reporting refinement, and final cross-role reconciliation.
