# UniStore Hub UX/UI Redesign v2 — Skill-Driven Baseline Audit

## 1. Purpose

This document is the Phase 1 baseline for **Skill-Driven UniStore Hub UX/UI Redesign v2**.

The frontend was already redesigned once. This pass does not start from a broken or unstructured UI. Its purpose is to re-evaluate the current implementation using the now fully installed `ui-ux-pro-max` searchable dataset together with the repository's existing design skills:

- `interface-design`
- `ui-ux-pro-max`
- `design-review`
- `redesign`
- `frontend-design`
- `a11y-audit`

This is a source/code audit, not a browser screenshot audit. Scores and visual observations remain provisional until the responsive/accessibility review phases.

No business behavior is intentionally changed in Phase 1.

---

## 2. Product and user brief

### Product domain

UniStore Hub combines two related products:

1. **Campus storefront / marketplace**
   - discover organizations, stores, campaigns, and products
   - place preorder-style orders
   - submit payment proof
   - track order state
   - receive pickup QR/token and collection status
   - read notifications

2. **Operations workbench**
   - Organization Admin and Staff manage stores, products, campaigns, orders, payments, production, pickups, staff, settings, and audit history
   - Platform Admin reviews organizations and platform users

### Primary audiences

- Thai-speaking student/customer using mobile first
- organization staff repeatedly processing queues and records
- organization admins managing configuration and lifecycle transitions
- platform admins reviewing cross-organization state

### Required feel

The interface should feel:

- Thai-readable
- trustworthy
- task-oriented
- calm but not bland
- recognizable as campus commerce
- more browsable on customer surfaces
- denser and faster on operational surfaces

It must not feel like a generic SaaS dashboard or a generic marketplace template.

---

## 3. Current implementation inventory

### Canonical routes

The current frontend contains **28 `page.tsx` routes** and all are in redesign scope.

#### Public / customer

| Route | Primary job |
| --- | --- |
| `/` | storefront / discovery entry |
| `/login/` | sign in |
| `/register/` | account creation |
| `/stores/view/` | store detail |
| `/products/view/` | product detail |
| `/campaigns/view/` | campaign detail |
| `/orders/new/` | create order |
| `/my/orders/` | order history |
| `/my/order/` | order detail |
| `/my/payment/` | payment proof and review state |
| `/my/pickup/` | pickup token/QR and pickup state |
| `/notifications/` | customer event inbox |

#### Organization / Staff

| Route | Primary job |
| --- | --- |
| `/org/select/` | choose organization context |
| `/org/dashboard/` | organization attention/workload summary |
| `/org/settings/` | organization settings |
| `/org/staff/` | membership and role management |
| `/org/stores/` | store management |
| `/org/products/` | product, variant, and image management |
| `/org/campaigns/` | campaign lifecycle management |
| `/org/orders/` | order queue |
| `/org/orders/view/` | order operational detail |
| `/org/payments/` | payment review queue |
| `/org/production/` | production workload |
| `/org/pickups/` | pickup confirmation queue |
| `/org/audit/` | read-only audit history |

#### Platform Admin

| Route | Primary job |
| --- | --- |
| `/platform/summary/` | platform attention summary |
| `/platform/organizations/` | organization review/state management |
| `/platform/users/` | platform user lookup/list |

### Shared layer

Current shared UI files include:

- `src/components/ui/button.tsx`
- `src/components/ui/fields.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/state-panel.tsx`
- `src/components/ui/operational.tsx`
- `src/components/layout/page-shell.tsx`
- `src/components/layout/application-shell.tsx`
- associated shared CSS modules and tests

The feature layer currently contains **23 module CSS files**.

### Token reality

`src/app/globals.css` already has:

- semantic surfaces
- four text hierarchy levels
- structural borders
- campus identity tokens
- semantic success/warning/danger/info tokens
- focus/selection/overlay tokens
- 4px spacing scale
- radius scale
- type scale
- Noto Sans Thai
- layout widths/gutters
- customer/operational density tokens
- control/touch target sizes
- icon sizes
- subtle overlay/shadow tokens
- motion durations/easing
- light and dark token sets

A source scan of component/module CSS found only two direct `rgb(...)` utility literals outside the global token file. This is a strong token-adherence baseline.

---

## 4. Verified UI/UX Pro Max search record

The following results were actually produced by the local tool:

`python3 .agents/skills/ui-ux-pro-max/scripts/search.py`

No database result is claimed unless listed below.

### 4.1 System-level search

Query:

`"thai campus marketplace preorder operations" --design-system --variance 6 --motion 3 --density 7 -p "UniStore Hub"`

Returned:

- variance **6/10**
- motion **3/10**
- density **7/10**
- pattern: **Hero + Testimonials + CTA**
- style: **Minimalism**
- candidate palette: purple + green marketplace palette
- typography: **Noto Sans Thai / Noto Sans Thai**
- suggested subtle scroll reveal motion
- checklist emphasizing focus, contrast, reduced motion, responsive checks

Interpretation:

- variance/motion/density are useful calibration
- Noto Sans Thai is a strong product fit
- Minimalism is compatible with the operational product
- the testimonial pattern is **not supported by UniStore Hub data** and must not be copied
- scroll-reveal/GSAP is unnecessary unless a specific customer-facing interaction benefits from it
- purple/green is a candidate, not an automatic replacement for the existing teal identity

### 4.2 Product search

Query:

`"campus marketplace preorder ecommerce" --domain product -n 4`

Returned relevant matches:

- E-commerce
- Marketplace (P2P)

Common recommendations:

- stronger commerce identity
- category/product hierarchy
- success/transaction color semantics
- sales/e-commerce information patterns

Interpretation:

The product does have e-commerce/marketplace behavior, but it is not a generic P2P marketplace. Organization/store/campaign structure and preorder lifecycle remain more important than copying marketplace conventions blindly.

### 4.3 Style search

Initial query:

`"clean trustworthy campus marketplace" --domain style`

returned **0 results**.

Per skill contract, one narrower retry was made:

`"minimalism marketplace" --domain style -n 5`

Returned:

- **Minimalism & Swiss Style**
- clean, functional, grid-based
- strong hierarchy
- subtle motion
- low performance cost
- explicit focus/contrast/reduced-motion requirements

Interpretation:

Adopt the clarity, restraint, grid discipline, and hierarchy. Do not copy the search result's literal zero-radius/black-white defaults because they conflict with the existing Thai-friendly product language and current interface system.

### 4.4 Typography search

Query:

`"thai modern readable ecommerce" --domain typography -n 4`

Top result:

- **Thai Modern**
- heading: Noto Sans Thai
- body: Noto Sans Thai
- keywords: Thai, modern, readable, clean, multilingual, accessible

Interpretation:

**Adopt.** The current font choice is independently supported by the dataset. No Latin-first font replacement is justified.

### 4.5 Color search

Query:

`"campus ecommerce trust marketplace" --domain color -n 4`

Relevant results:

- Marketplace (P2P): purple primary + green accent
- E-commerce: green primary + orange accent

Interpretation:

These are **reference candidates only**. The current deep teal-green identity is already coherent with campus commerce, transaction trust, dark mode, and semantic states. Phase 2 should compare these options rather than replacing the palette mechanically.

### 4.6 Forms and error recovery

Query:

`"mobile ecommerce checkout form validation error feedback" --domain ux -n 5`

Relevant returned guidance:

- submit feedback: loading -> success/error
- focusable error summary for failed validation
- retain inline field errors
- provide recovery actions
- avoid silent failures

Interpretation:

Adopt for order creation, auth, settings, product/campaign management, payment upload, and other long forms where multiple errors may exist.

### 4.7 Operational async state

Query:

`"dense operational dashboard queue status next action" --domain ux -n 5`

Returned relevant guidance:

- submit feedback is high severity
- asynchronous badge/count updates should announce meaningful contextual status rather than bare numbers

Interpretation:

Operational counts and queue refreshes should not create noisy competing live regions. Announce meaningful contextual updates only where an async change affects task understanding.

### 4.8 Focus / overlays

Query:

`"focus not obscured" --domain ux -n 4`

Returned:

- Focus Not Obscured (Minimum), WCAG 2.2 AA
- Focus Not Obscured (Enhanced), AAA
- visible focus states
- focus appearance guidance

Interpretation:

Adopt. Sticky navigation, mobile drawers, dialogs, action bars, and long forms must not cover the focused control. The current mobile drawer already contains focus trapping/return logic and breakpoint cleanup tests; retain this behavior during visual redesign.

### 4.9 Touch targets

Query:

`"touch target mobile navigation" --domain ux -n 4`

Returned:

- platform-specific touch target guidance
- web should follow the WCAG target-size rule rather than blindly using native platform units
- adequate spacing between adjacent touch controls
- increase target sizes for mobile layouts

Interpretation:

Keep the existing 40/44px control tokens as the product comfort baseline, while preserving WCAG minimum behavior and spacing. Do not shrink operational controls merely to increase density.

### 4.10 Commerce icon search

Query:

`"commerce order payment pickup" --domain icons -n 5`

Returned Phosphor examples including:

- credit-card
- tag
- gift
- percent
- shopping-cart

Interpretation:

The useful rule is **consistent real iconography with correct accessible context**. Not every returned icon is relevant. Gift/percent should not appear unless actual product semantics require them.

### 4.11 Next.js stack search

Query:

`"static export responsive navigation forms images" --stack nextjs`

Returned:

- use `next/link` for internal navigation
- responsive image guidance
- select rendering strategy deliberately
- use metadata API for static metadata

Interpretation:

- retain `next/link` for internal navigation
- preserve static-export architecture regardless of generic rendering recommendations
- do not convert backend pre-signed/short-lived image display flows merely to satisfy generic image guidance without checking compatibility
- do not introduce Server Actions or runtime server assumptions that conflict with the project API/static-export contract

---

## 5. Current design-review baseline

This is a **source-backed provisional score**, not a rendered browser score.

| Dimension | Weight | Baseline | Evidence / concern |
| --- | ---: | ---: | --- |
| Visual hierarchy | 20% | 7/10 | current redesign has clear task/state sections, but repeated kickers/rails/markers reduce distinctiveness |
| Consistency | 20% | 8/10 | strong shared tokens and primitives; 23 feature CSS modules still contain repeated composition patterns |
| Accessibility | 20% | 8/10 | focus, semantic states, reduced motion, dialog/drawer work are strong; full rendered contrast/target verification remains |
| Usability | 20% | 7/10 | next actions are clearer than before, but operational information still sometimes competes at similar weight |
| Responsiveness | 10% | 7/10 | responsive rules exist and drawer breakpoint regression is tested; full 320–1440 route review remains |
| Performance | 10% | 7/10 | low-effect CSS system and static export are favorable; image/perceived-loading behavior still needs runtime review |

Weighted provisional baseline: **7.4/10**.

The redesign v2 should therefore be a refinement and system correction, not a destructive rewrite.

---

## 6. Code-backed findings

### Finding A — decorative kicker language is overused

Source scan found **42** occurrences of classes such as:

- `pageKicker`
- `sectionKicker`
- `panelKicker`
- `workspaceKicker`

Many are meaningful, but some repeat information already present in the heading.

Risk:

- creates the exact "label above every heading" template rhythm warned about by `frontend-design` and the anti-slop skill
- makes unrelated screens feel generated from one shell

Direction:

- keep only kickers that communicate scope/state/context not already obvious from the heading
- remove decorative or redundant labels
- vary hierarchy by page archetype rather than repeating kicker -> heading -> description everywhere

Severity: **Major**

### Finding B — ledger/edge-marker idea has spread beyond its intended role

The canonical system defines a ledger rail as a signature state/task device. Source inspection shows many `::before` row/status markers and several explicit left-edge treatments.

Risk:

- the signature loses meaning when applied to many rows, cards, alerts, and contexts
- repeated colored/edge strips can read as an AI-generated callout pattern

Direction:

- retain the **concept** of authoritative state anchoring
- restrict it to the primary state/task context
- use selection, row density, typography, and semantic status components elsewhere instead of repeated edge strips

Severity: **Major**

### Finding C — text arrows/checkmarks are being used as icon-like UI chrome

Source scan found **6** occurrences of symbols such as `→` and `✓` in TSX.

Risk:

- inconsistent rendering and visual weight
- anti-template guidance explicitly discourages arrows appended for style
- completion marks should use a consistent icon or semantic marker when iconography is warranted

Direction:

- remove decorative arrows from auth entry links
- replace icon-like check glyphs with a shared accessible visual primitive or a CSS/SVG marker if it materially improves comprehension
- do not add an icon dependency unless shared use justifies it

Severity: **Minor / consistency**

### Finding D — current typography is already the strongest verified match

Current frontend uses Noto Sans Thai. The verified typography search independently ranked Noto Sans Thai first for Thai modern/readable UI.

Direction:

- keep Noto Sans Thai
- improve hierarchy through size, weight, measure, and spacing rather than changing font
- preserve machine/reference monospace only for genuine IDs/tokens

Severity: **Adopt / no corrective change required**

### Finding E — generic marketplace color output should not replace the current identity automatically

The skill suggests purple/green for Marketplace and green/orange for E-commerce. The current system uses deep teal-green with restrained semantic colors.

Risk of blind adoption:

- turns UniStore Hub into a generic marketplace visual
- forces large cross-theme rework without a product-specific reason
- may blur semantic green usage if brand and success are too close

Direction for Phase 2:

Compare three candidates:

1. current teal identity refined
2. purple trust primary + transaction green accent
3. green commerce primary + restrained warm accent

Choose based on:

- Thai readability
- light/dark contrast
- distinction between brand and semantic success
- customer/operations cohesion
- product specificity
- actual component state behavior

Severity: **Design decision required**

### Finding F — generic testimonial/social-proof pattern is unsupported

The design-system search returned Hero + Testimonials + CTA.

There is no current project source establishing verified testimonials, ratings, or public social proof.

Direction:

- reject testimonials/fake reviews
- storefront landing should lead with real organizations/stores/campaigns/products and actual availability
- any trust signal must come from real system state, not invented marketing content

Severity: **Must reject**

### Finding G — customer and operations density should diverge more deliberately

The current system already has customer/operational density tokens, but many page structures still share similar header/panel language.

Direction:

- customer: more browseable content rhythm, product/store identity, larger reading landmarks
- operations: tighter rows, compact task headers, filters subordinate to work, explicit state and next action

Severity: **Major**

### Finding H — form recovery can be improved beyond inline errors

Existing fields have labels/hints/errors and file fields are shared. The verified UX search adds a stronger pattern for multi-error forms:

- top-level focusable error summary after failed submit
- links/focus to invalid fields
- inline errors remain in place
- clear recovery action

Direction:

Introduce the summary only where multiple independently invalid fields make it useful. Do not add it to simple one-field forms.

Severity: **Major for complex forms**

### Finding I — async status messaging should be contextual, not noisy

Several screens contain counts, refresh actions, and queue state. The verified UX guidance warns against announcing bare changing numbers or making every badge a live region.

Direction:

- one meaningful status message per async operation
- avoid multiple competing `aria-live` regions
- announce what changed, not just a number

Severity: **Major accessibility/usability refinement**

### Finding J — Next.js recommendations must stay subordinate to static export and upload contracts

The skill's Next.js dataset recommends modern navigation/image/rendering practices.

Project constraints require:

- static export
- query-param identifiers
- backend API authority
- backend-issued pre-signed S3 uploads
- short-lived/backend-issued image URLs where applicable

Direction:

Use stack guidance where compatible, but reject any recommendation that introduces server runtime assumptions or changes direct-upload/auth behavior.

Severity: **Contract guardrail**

---

## 7. Prioritized redesign brief

### P0 — protect contracts and accessibility while changing visuals

1. Preserve route/API/auth/tenant/lifecycle/payment/pickup/static-export/direct-S3 behavior.
2. Preserve keyboard/focus/dialog/drawer correctness.
3. Maintain visible text/semantic status in addition to color.
4. Keep Noto Sans Thai and mobile-readable form text.
5. Do not invent testimonials, ratings, social proof, permissions, or state.

### P1 — correct the design language

1. Reduce decorative kicker repetition.
2. Restrict ledger/edge marker treatment to authoritative task/state context.
3. Replace symbol-as-icon chrome with a consistent semantic visual approach.
4. Make storefront composition more commerce-specific without becoming a generic marketplace.
5. Make operational surfaces more task-first and compact without shrinking targets.
6. Reconcile palette from product evidence instead of adopting search output mechanically.

### P2 — improve shared interaction patterns

1. Add reusable complex-form error-summary behavior where appropriate.
2. Standardize contextual async/live feedback.
3. Refine filters, queue rows, selected-detail states, notices, status blocks, and destructive action hierarchy.
4. Confirm responsive media and image behavior without breaking short-lived URL/static-export constraints.

### P3 — route-specific composition

Apply distinct archetypes instead of one repeated shell:

- discovery index
- commerce detail
- customer transaction
- operational queue
- management workspace
- read-only ledger
- attention summary

Each route should use the same material system but a composition appropriate to its task.

---

## 8. Adopt / adapt / reject matrix for Phase 2

| Skill recommendation | Decision going into Phase 2 | Reason |
| --- | --- | --- |
| Noto Sans Thai | **Adopt** | verified top Thai-readable match and already installed |
| Minimalism / Swiss clarity | **Adapt** | use hierarchy/grid/restraint, not literal zero-radius black/white defaults |
| Variance 6/10 | **Adapt** | useful anti-template target, but operations remain more restrained |
| Motion 3/10 | **Adopt** | fits task-oriented product and reduced-motion goals |
| Density 7/10 | **Adapt** | customer lower, operations higher |
| Marketplace purple + green | **Evaluate** | candidate only; current teal may remain more product-specific |
| E-commerce green + orange | **Evaluate** | candidate only; risk of semantic collisions |
| Hero + Testimonials + CTA | **Reject as system pattern** | testimonials/social proof are unsupported; operational routes must not use marketing heroes |
| subtle scroll reveal / GSAP | **Reject by default** | no task value sufficient to justify new motion dependency |
| Phosphor commerce icons | **Adapt** | use consistent icon semantics only where needed; no dependency required unless reuse justifies it |
| focusable error summary | **Adopt selectively** | useful for complex forms, unnecessary for trivial forms |
| contextual live badge updates | **Adopt** | improves async queue/status clarity without noisy announcements |
| touch-friendly controls | **Adopt** | matches current 40/44px baseline |
| Next Link for internal nav | **Adopt / preserve** | already aligned |
| generic Next image/rendering advice | **Adapt** | must respect static export and short-lived/pre-signed URL constraints |

---

## 9. Phase 2 handoff

Phase 2 should update **only the canonical design direction** in `.interface-design/system.md`.

It should not create a second design system.

The Phase 2 decision must explicitly settle:

1. final identity palette
2. how the ledger/state signature survives without becoming a repeated edge-strip pattern
3. where kickers are allowed and where they are removed
4. shared icon strategy
5. customer vs operational density and page archetypes
6. motion policy
7. complex form error-summary policy
8. contextual live-region policy
9. image/media guidance compatible with static export and backend URLs

After that document is coherent, Phase 3 can safely change global tokens/foundations.


---

## 10. Phase 19 accessibility and anti-template audit

This pass re-ran the local `a11y-audit`, `design-review`, `frontend-design`, and verified `ui-ux-pro-max` guidance against the redesigned frontend. It is a project verification pass, not a formal accessibility certification.

### Verified guidance used

Focused `ui-ux-pro-max` searches returned the following relevant requirements:

- WCAG 2.2 focus-not-obscured behavior for sticky/fixed UI
- visible focus on every operable control
- native control semantics and meaningful accessible names
- focusable error summaries after failed complex-form submission
- contextual live status messaging instead of competing live regions
- 4.5:1 normal-text contrast and 3:1 non-text/focus-state targets where applicable
- no color-only state communication
- accessible authentication compatible with password managers and copy/paste
- responsive text reflow without clipping

### P0/P1 fixes made in this pass

1. **Shared field focus appearance** — the field-specific focus outline used a 32% translucent focus mix. It was replaced with a full `var(--focus)` 2px outline and 2px offset so the shared field treatment no longer weakens the global focus indicator.
2. **Editable-control boundary contrast** — the light `--control-line` opacity moved from 48% to 52%. Against `--surface-inset`, the measured composed boundary is **3.31:1**.
3. **Mobile drawer scrim semantics** — the close scrim no longer hides a button from the accessibility tree. It retains an accessible name and stays out of the normal Tab sequence; keyboard users retain the explicit close button and Escape behavior.
4. **Authentication reading order** — login/register no longer auto-focus the first field on page load, allowing heading/context content to remain first in the normal reading and focus sequence. Autocomplete remains `email`, `current-password`, `name`, and `new-password` as appropriate.
5. **Disabled password-toggle token** — replaced an undefined `--ink-disabled` reference with the defined `--ink-muted` semantic token.
6. **Notification spoken label** — removed the remaining em-dash-style generated copy and now states the notification read state explicitly.

### Measured contrast samples after fixes

| Pair | Measured ratio |
| --- | ---: |
| light ink / canvas | 15.40:1 |
| light secondary / canvas | 7.11:1 |
| light tertiary / canvas | 5.81:1 |
| light campus-on / campus | 6.43:1 |
| light focus / surface | 6.02:1 |
| light danger / danger-soft | 4.70:1 |
| light control-line / inset control surface | 3.31:1 |
| dark ink / canvas | 16.95:1 |
| dark secondary / canvas | 11.75:1 |
| dark tertiary / canvas | 7.41:1 |
| dark campus-on / campus | 9.93:1 |
| dark focus / surface | 10.53:1 |
| dark danger / danger-soft | 6.58:1 |

### Rendered browser audit

A temporary Chrome/CDP audit checked the public entry/discovery routes at **320px** in both light and dark color schemes:

- `/`
- `/login/`
- `/register/`
- `/stores/view/`
- `/products/view/`
- `/campaigns/view/`
- `/orders/new/`

The rendered pass reported no page-level horizontal overflow, normal-text contrast failures, non-inline interactive targets below 24px, unnamed visible native controls, or heading-level skips on those rendered states. Protected operational routes remain covered by source/component tests because their full populated states require authenticated backend data.

### Anti-template / consistency scan

Post-pass source scan:

- decorative kicker classes: **0**
- decorative arrow/check/emoji UI glyphs: **0**
- gradients: **0**
- backdrop-filter glass effects: **0**
- hardcoded component/module CSS colors outside `globals.css`: **0**
- em/en dash UI copy occurrences: **0**
- focusable elements hidden with `aria-hidden` in the scanned source pattern: **0**
- undefined CSS variables: only `--info-line`, which is intentionally used with `var(--info-line, var(--line))` fallback

### Post-redesign design-review score

| Dimension | Weight | Score | Evidence |
| --- | ---: | ---: | --- |
| Visual hierarchy | 20% | 9/10 | customer and operational archetypes now diverge intentionally; state and next action are consistently prioritized |
| Consistency | 20% | 9/10 | one token authority, shared primitives, no page-local hardcoded color system, repeated decorative kickers/rails removed |
| Accessibility | 20% | 9/10 | labels, focus, error recovery, live status, target sizing, reduced motion, light/dark contrast checks, drawer/dialog behavior |
| Usability | 20% | 9/10 | task-first queues, explicit authoritative state, safer confirmations, contextual recovery and filters |
| Responsiveness | 10% | 9/10 | 320px+ composition, mobile action stacking, sticky-panel release, prior multi-width overflow audit plus Phase 19 rendered checks |
| Performance | 10% | 8/10 | static export, low-effect CSS, no heavy motion/icon dependency; backend short-lived image URLs intentionally remain plain `img` where required |

Weighted post-redesign review: **8.9/10**.

### Remaining non-blocking verification boundary

No unresolved blocking accessibility/design finding was found in this phase. A formal WCAG conformance claim would still require dedicated manual screen-reader/assistive-technology testing of authenticated populated workflows, which is outside this source/component verification pass.

---

## V3 Phase 6 — global foundations

The Playful Campus Commerce v3 direction is now centralized in `src/app/globals.css` as the implementation token authority.

Implemented foundation groups:

- light/dark semantic surfaces and text hierarchy,
- purple/indigo brand tokens with temporary `--campus-*` compatibility aliases,
- expressive lavender/sky/mint/teal/coral/yellow accent families kept separate from semantic status colors,
- success/warning/danger/info tokens and focus/selection treatments,
- controlled hero/ambient/warm/product/operations gradient tokens,
- canonical spacing, radii, content widths, customer/transaction/operations density values,
- raised/feature/overlay/action/media elevation tokens,
- 120/180/240ms motion tokens with reduced-motion behavior retained,
- responsive media, bento, ambient-canvas, gradient, and elevation utility hooks,
- 320px+ gutter/control sizing with 44px mobile minimum targets.

The three Phase 5 prototypes were migrated off temporary scoped v3 variables and page-local color values. Current CSS source scan reports **0 hardcoded color declarations outside `globals.css`**, **0 scoped `--v3-*` variables**, **0 old teal identity hex values**, and **0 undefined CSS custom properties**.

Contrast reference checks remained above 4.5:1 for the tested normal-text light pairs and above 7:1 for the tested dark semantic pairs. Browser/CDP checks for `/`, `/login/`, and `/register/` in both light and dark modes at 320, 375, 768, 1024, and 1440px found no page-level horizontal overflow.

Verification: **76 test files / 252 tests passed**, ESLint passed after temporary audit tooling was removed, Next.js production build generated **30/30 static pages**, and `git diff --check` passed.

---

## V3 Phase 7 — shared UI primitives

The shared primitive layer now carries the v3 visual language instead of relying on route-specific styling.

Updated shared patterns:

- **Button** — purple primary action, brand-soft secondary action, restrained quiet/destructive variants, small tactile hover/press feedback, pending/busy behavior retained.
- **Fields** — larger v3 control radius, softer inset treatment, stronger focus ring, explicit invalid/read-only/disabled treatments, file-selector button aligned with the brand system.
- **ErrorSummary** — rounded semantic surface, focus recovery retained, linked field errors retained, visible danger marker without relying on color alone for the message.
- **Badge/status chip** — semantic soft surfaces, visible dot + text, stronger pill geometry while preserving status wording.
- **Card** — default/muted/flat plus reusable `raised` and `feature` surfaces for later customer and operational route phases.
- **Dialog** — larger rounded modal surface, stronger overlay hierarchy, mobile-safe viewport sizing, existing Radix focus/escape/return-focus behavior retained.
- **Table** — modern rounded frame, selected-row brand treatment, compact density and horizontal-scroll semantics retained.
- **StatePanel** — modern loading/empty/error/unauthorized/forbidden surfaces; loading now exposes `aria-busy=true` in addition to polite atomic status semantics.
- **Operational helpers** — `FilterToolbar`, `Notice`, `TaskStatus`, and `ActionBar` now use v3 grouped surfaces while remaining compact and task-first.
- **MediaShell / Skeleton** — new shared media and loading primitives with explicit contain/cover behavior, tone variants, decorative hiding support, reserved aspect ratio, and skeleton visuals kept out of the accessibility tree.

Source consistency checks found all CSS-module classes referenced by the shared components, **0 hardcoded color declarations outside `globals.css`**, and **0 scoped `--v3-*` variables**.

A browser/CDP smoke pass on `/login/`, `/org/orders/`, and `/platform/users/` at 320, 375, 768, and 1024px found no page-level horizontal overflow. The small inline “สมัครสมาชิก” text link remains an auth-composition concern rather than a shared-primitive regression and is intentionally deferred to the dedicated authentication redesign phase.

Verification: targeted shared-UI tests **5 files / 16 tests passed**; full suite **77 files / 255 tests passed**; ESLint passed with no warnings after the test fixture cleanup; Next.js production build generated **30/30 static pages**; `git diff --check` passed.

---

## V3 Phase 8 — global shell and navigation

Navigation implementation now follows the v3 low-chrome shell direction while leaving route authority in `src/modules/auth/navigation.ts` unchanged.

### Verified evidence

- Re-opened canonical references **R1** and **R4**; both returned `HTTP 200 image/jpeg` before the navigation pass.
- `ui-ux-pro-max` search `responsive navigation ecommerce customer header mobile drawer active state account actions` returned guidance for visible active state, mobile-first composition, preserved deep linking/history, touch-friendly targets, and semantic compact labels.
- `ui-ux-pro-max` search `sidebar operational dashboard navigation scope switching active state mobile drawer` reinforced visible active state, sticky navigation that does not obscure content, immediate pressed feedback, mobile-first behavior, and complete keyboard navigation.

### Implemented shell behavior

- Public storefront uses a compact floating rounded navigation surface rather than a full-width legacy app bar.
- Customer/storefront brand and account destinations remain low-chrome so hero/product content keeps visual priority.
- Authenticated organization/customer/platform areas keep one navigation model but now use raised v3 sidebar surfaces, an explicit current-scope chip, grouped destinations, a contextual workspace panel, and a calmer account/action footer.
- Active destinations combine stronger text weight, filled state dot, surface change, and an inset accent edge; state is therefore not communicated by color alone.
- Platform scope reuses the same geometry with the semantic info accent instead of introducing a separate platform theme.
- Organization switching remains the existing explicit `/org/select/` action; query-string organization context and permission behavior were not changed.
- At 900px and below the authenticated sidebar remains a modal drawer with body scroll lock, inert main content, focus trapping, Escape close, focus return, route-close behavior, safe-area footer spacing, and visible current-area context.
- Motion is limited to short hover/press/drawer transitions and remains disabled by the existing reduced-motion rule.

### Responsive verification

A Chrome/CDP pass on public storefront surfaces checked light and dark schemes at 320, 375, 768, 1024, and 1440px during the phase and reported no page-level horizontal overflow. A final 320/375/1440 check confirmed the storefront brand target is at least 44px high, mobile login/register actions are 44px high, and document scroll width equals viewport width.

Authenticated shell rendering requires a live authenticated backend state, so drawer/focus behavior remains verified through the existing component tests rather than fabricated browser state.

Verification: targeted navigation tests **3 files / 19 tests passed**; full suite **77 files / 255 tests passed**; ESLint passed; Next.js production build generated **30/30 static pages**; hardcoded CSS colors outside `globals.css` remain **0**; scoped `--v3-*` variables remain **0**; `git diff --check` passed.

---

## V3 Phase 9 — landing and marketplace discovery

The public landing now implements the v3 discovery hierarchy using only authoritative organization/store data returned by the existing storefront service.

### Verified evidence

- Re-opened canonical references **R1**, **R2**, and **R5**; all returned `HTTP 200 image/jpeg` before implementation.
- `ui-ux-pro-max` product search for marketplace landing / bento / clay discovery returned **Vibrant & Block-based**, **Bento Box Grid**, marketplace/e-commerce feature-rich showcase, and claymorphism as relevant candidates.
- `ui-ux-pro-max` UX search reinforced helpful empty states, no page-level horizontal scroll, mobile-first collapse, deep linking, and breakpoint testing.

### Implemented landing structure

- Retained the dark branded commerce hero and CSS-only dimensional parcel/orb/tag composition, but separated the three-step journey from the hero so the hero remains visually focused and substantially shorter on small screens.
- Reworked the three-step journey into an independent pastel block strip using sky/mint/coral surfaces and real product-flow copy.
- Added a real-data **เริ่มสำรวจ** discovery bento generated from the first loaded active stores; no ranking, rating, review count, seller badge, or fabricated commerce metric was introduced.
- The discovery bento uses one large feature tile plus asymmetric supporting tiles on desktop, collapses to a lead tile + two-column layout on tablet, and becomes one column on narrow mobile.
- Organization sections remain below as the complete source list, preserving all existing store links and organization descriptions.
- Loading now reserves visual marketplace space with skeleton blocks before the shared loading state, reducing perceived layout jump.
- Error recovery now provides an in-place **ลองโหลดอีกครั้ง** action without changing the storefront API contract.
- Empty state behavior remains explicit and helpful when no active stores exist.

### Responsive/browser verification

A Chrome/CDP loaded-state audit used browser-level fetch stubs only for test data and checked light/dark rendering at **320 / 375 / 768 / 1024 / 1440**. At every size document scroll width equaled viewport width and no unintended off-viewport element was detected. The bento rendered as four real-store cards and collapsed as designed. Moving the journey strip outside the hero reduced the measured mobile hero height from roughly 1126–1327px during the first pass to roughly 770–872px while preserving the same content.

Verification: landing targeted tests **2/2 passed**, including retry recovery; full suite **77 files / 256 tests passed**; ESLint passed; Next.js production build generated **30/30 static pages**; hardcoded CSS colors outside `globals.css` remain **0**; scoped `--v3-*` variables remain **0**; `git diff --check` passed.

---

## V3 Phase 10 — store, campaign, and product discovery

The storefront detail layer now applies the v3 commerce language to `/stores/view/`, `/campaigns/view/`, and `/products/view/` while leaving storefront endpoints, query identifiers, active-variant filtering, campaign state, auth/session handling, and order-entry URL generation unchanged.

### Verified evidence

- Re-opened canonical references **R2**, **R3**, and **R4**; all returned `HTTP 200 image/jpeg` before implementation.
- `ui-ux-pro-max` product search supported image-first e-commerce hierarchy, vibrant/block-based commerce, bento as an optional secondary pattern, and category/brand color support.
- UX search reinforced deliberate image aspect ratios, clear price/action hierarchy, responsive cards, and non-overflowing mobile layouts.
- Style search returned Bento Box Grid and 3D/Hyperrealism among the relevant directions; heavy WebGL/interactive 3D and continuous animation were rejected because the product requirement does not justify their performance/accessibility cost.

### Implemented surfaces

- **Store detail:** converted the plain divider hero into a rounded ambient commerce hero with a CSS-only shopping-bag/orb/ticket illustration and retained only real campaign/product counts.
- **Campaign detail:** moved campaign context into a premium dark hero while keeping the current authoritative status/guidance inside a readable raised panel.
- **Campaign cards:** added dimensional visual stages, stronger status/name hierarchy, schedule rows, soft elevation, and tactile hover/press feedback without adding any invented campaign content.
- **Campaign schedule:** converted the four backend dates into distinct pastel milestone blocks while preserving the exact source values and labels.
- **Product cards:** now use a 4:3 image-first stage, `object-fit: contain` for backend imagery, branded placeholder treatment, visible starting price, active variant count, and clearer action treatment.
- **Product listing grid:** kept cards uniform rather than forcing a bento span pattern that created excessive empty vertical space. Bento remains reserved for marketplace discovery where it improves scanning.
- **Product detail:** retained the Phase 5 image-first purchase composition and strengthened its relationship to the new listing cards. Real image, starting price, option count, campaign count, selectors, estimate, campaign status, and order/login CTA remain in the existing behavior flow.

### Responsive finding and fix

The first loaded-state browser pass exposed decorative scrollable paint overflow inside the rounded product-detail composition at 320, 375, and 768px. The content itself fit, but the section's visual overflow increased the document scroll width. The product-detail container now uses `overflow-x: clip`, which clips only horizontal paint overflow and does not create the scroll container behavior associated with `overflow: hidden`; desktop product media remains computed as `position: sticky` at 1024 and 1440px.

A final loaded-state Chrome/CDP audit used browser-only storefront API stubs and checked all three routes in light and dark schemes at **320 / 375 / 768 / 1024 / 1440**. Every route finished with document scroll width equal to viewport width and no unintended off-viewport element. Product media collapsed to static positioning below the desktop breakpoint and remained sticky on desktop.

Verification: storefront targeted tests **3 files / 12 tests passed** before the full pass; full suite **77 files / 256 tests passed**; ESLint passed; Next.js production build generated **30/30 static pages**; source scan reports **0 hardcoded CSS colors outside `globals.css`**, **0 scoped `--v3-*` variables**, and `git diff --check` passed.

---

## V3 Phase 11 — authentication experience

Login and registration now use the v3 branded split-entry composition while preserving the existing authentication, session restoration, validation, navigation, and return-path contracts.

### Verified evidence

- Re-opened canonical references **R1**, **R4**, and **R5**; all returned `HTTP 200 image/jpeg` before implementation.
- `ui-ux-pro-max` product search returned **E-commerce → Vibrant & Block-based** and **Password Manager → Minimalism & Swiss Style + Accessible & Ethical**. The implementation combines expressive brand framing with a deliberately calm credential form.
- Authentication UX search returned **Focusable Error Summary**, **Password Visibility**, **Accessible Authentication (Minimum)**, **Error Messages**, and **Error Placement**. Existing password-manager/paste-friendly behavior, show/hide controls, focusable error summaries, and inline field errors were retained.
- Style search returned **Tactile Digital / Deformable UI**, **Claymorphism**, **Aurora UI**, and **Vibrant & Block-based** as relevant visual directions. Continuous aurora animation, spring libraries, parallax, and heavy neumorphism were rejected; the auth page uses static CSS-only dimensional forms and shared tokens instead.

### Implemented auth composition

- Replaced the flat half-page layout with a rounded premium dark brand panel and an ambient account panel containing one raised form surface.
- Added CSS-only decorative account card, parcel, orb, ticket, and refreshed UniStore mark. All new visual objects are `aria-hidden` and do not imply inventory, ratings, testimonials, or account state.
- Added a compact visible product-purpose label and kept the real account journey copy for ordering, tracking, and pickup.
- On narrow mobile the three journey blocks are removed while the smaller dimensional visual remains, keeping the credential form closer to the initial viewport.
- Login/register forms keep their exact field labels, validation helpers, auth service calls, session establishment, return URL handling, server-error notices, and account switching links.
- Password visibility controls now receive stronger v3 tactile treatment while retaining `aria-controls`, `aria-pressed`, pending disable state, and native button semantics.
- Authenticated entry state uses the same new form card, but still derives organization access only from existing active memberships and shows the existing customer/notification/organization destinations.

### Rendered verification

Chrome/CDP checked `/login/` and `/register/` in light and dark schemes at **320 / 375 / 768 / 1024 / 1440**. Every run had document scroll width equal to viewport width and no unintended off-screen element. Email autocomplete remained `email`; login password remained `current-password`; registration password remained `new-password`; password inputs remained `type=password` initially. The supporting journey is intentionally hidden at 320/375 and visible from 768 upward. No visible link/button/input in the rendered auth entry fell below 40px high.

Targeted auth regression: **5 files / 30 tests passed** covering form validation, password reveal/autocomplete, auth entry state, session behavior, and access navigation. ESLint passed before the final regression pass.

---

## V3 Phase 12 — order creation

The `/orders/new/` flow now uses the v3 customer-transaction visual language while preserving the existing query contract, selected variant/campaign context, create-order payload, backend-authoritative pricing, auth failure behavior, and lifecycle rules.

### Verified evidence

- Re-opened canonical references **R1**, **R2**, and **R4**; all returned `HTTP 200 image/jpeg` before implementation.
- `ui-ux-pro-max` research for checkout/order creation reinforced product-context visibility, clear quantity/variant review, explicit totals, mobile primary-action reachability, validation recovery, and restrained purchase panels.
- Style research again returned vibrant/block-based and tactile/3D directions; interactive WebGL product preview, continuous aurora motion, and spring-animation dependencies were rejected as unnecessary for this transaction task.

### Implemented checkout composition

- Replaced the flat checkout heading with a premium dark transaction header containing the existing three semantic order steps.
- Rebuilt the review area as a raised commerce surface with a 4:3 contain-fit backend product image, real store name, product description, selected variant, campaign state, unit price, close time, and payment deadline.
- Converted campaign and review facts into grouped branded/pastel surfaces without adding any new commerce facts that the backend does not provide.
- Rebuilt the quantity/estimate form as a raised confirmation surface. Wide desktop keeps it sticky; 1024px and below it returns to normal document flow.
- Estimated total remains client-side presentation only. The UI now shows the actual unit price × parsed quantity breakdown and still states that the server re-validates product and price before persisting the order.
- Narrow mobile uses a safe-area-aware sticky submit area inside the form. Rendered button and quantity field were 48px high at 320/375 and 44px at larger breakpoints.
- Recoverable product/campaign context load errors now expose an in-place **ลองโหลดอีกครั้ง** action; invalid/missing/not-found links still retain their existing safe fallback states.
- Success state now uses the same v3 dimensional language while immediately switching to the authoritative backend order total, order status guidance, order ID, payment action when required, and existing order/product links.

### Contract checks

- Create request remains identifiers + quantity only: `campaignId`, `productId`, `variantId`, and integer quantity. No client total is sent.
- Invalid quantity still focuses the shared ErrorSummary and prevents `createOrder` from being called.
- `CAMPAIGN_NOT_OPEN` still blocks creation and shows the existing authoritative recovery message.
- Only definitive session failure still triggers logout; ordinary backend failures do not clear the session.

### Rendered verification

A Chrome/CDP loaded-state audit used browser-only session/storefront stubs and checked light/dark rendering at **320 / 375 / 768 / 1024 / 1440**. Every pass had document scroll width equal to viewport width with no unintended off-screen element. The quantity input and submit control remained 44–48px high. The confirmation panel was computed `position: sticky` on 1440px and normal flow through 1024px and below. A dedicated 320px check confirmed the mobile action group itself is `position: sticky; bottom: 0`.

Verification: order-create targeted tests **3/3 passed**, including validation, authoritative payload/total, and in-place retry; full suite **77 files / 257 tests passed**; ESLint passed; Next.js production build generated **30/30 static pages**; source scan reports **0 hardcoded CSS colors outside `globals.css`**, **0 scoped `--v3-*` variables**, and `git diff --check` passed.

---

## V3 Phase 13 — customer order tracking

The customer order-history and order-detail surfaces now use the v3 transaction language while preserving backend-authoritative status, totals, timestamps, cancellation rules, payment/pickup routing, pagination, and session behavior.

### Verified evidence

- Re-opened canonical references **R1**, **R3**, and **R4**; all returned `HTTP 200 image/jpeg` before implementation.
- `ui-ux-pro-max` product search for customer order tracking returned **E-commerce → Vibrant & Block-based** plus timeline/status-oriented patterns. The customer surface adopts expressive grouping while keeping transaction state restrained and legible.
- `ui-ux-pro-max` UX search reinforced mobile-first layouts, touch-friendly targets, explicit confirmation messages, and confirmation dialogs for destructive actions. The existing cancellation confirmation flow was retained and regression-tested.

### Implemented order-history surface

- Replaced the flat list header with a premium dark customer-order hero and retained the real **เลือกสินค้าเพิ่ม** destination.
- Reworked the loaded summary into three bento-like surfaces: actionable count, explanatory guidance, and loaded-item count. No fabricated order metric was introduced.
- Replaced ledger rows with rounded raised order cards while preserving server-provided ordering, status badge, order ID, backend total, created/updated timestamps, and guidance text.
- Orders with a real customer action use stronger brand emphasis and **ดำเนินการต่อ**; non-actionable orders remain visually quieter and use **ดูรายละเอียด**.
- Initial list failure now offers in-place retry. Load-more failure remains scoped to pagination and already-loaded orders remain visible.

### Implemented order-detail surface

- Rebuilt the order hero as a premium dark status context with the real order ID, backend total, and backend `updatedAt` time.
- The shared `TaskStatus` remains the single current-state/next-action surface. Payment and pickup CTAs still derive only from `getCustomerOrderGuidance`.
- Reworked the canonical four-step journey into four dimensional pastel milestone cards. `done`, `current`, and `upcoming` still come only from `getOrderJourneySteps`; the current step retains `aria-current=step` and a text state label.
- Reworked order metadata into grouped surfaces and item rows into a rounded read-only commerce list. Mobile switches the item columns into explicitly labeled rows instead of horizontal scrolling.
- Reworked subtotal/total presentation into a high-emphasis branded summary using only persisted backend values.
- Related payment/pickup links and destructive cancellation remain separated. Cancellation still uses the existing confirmation dialog and is shown only for `PENDING_PAYMENT` / `PAYMENT_REJECTED`.
- Recoverable detail-load failure now retries in place.

### Cancellation recovery verification

A new regression covers the existing conflict path: if cancellation returns a backend conflict, the UI reports that state changed, re-fetches the order, updates to the latest authoritative status, and removes the cancellation action when the refreshed status no longer allows it. No lifecycle rule was added or inferred by the frontend.

### Rendered verification

Chrome/CDP used browser-only authenticated API stubs for `/my/orders/` and `/my/order/?orderId=order-1` and checked light/dark rendering at **320 / 375 / 768 / 1024 / 1440**. Every run had document scroll width equal to viewport width and no unintended off-screen element. Order cards collapse to one column on narrow mobile; the detail journey renders four single-column milestones at 320/375, two columns at tablet widths, and four columns on desktop. Visible route actions on mobile remained at touch-friendly sizes.

Targeted tracking regression: **3 files / 11 tests passed**, covering list priority/pagination, initial retry, authoritative detail state, lifecycle steps, detail retry, cancellation confirmation/success, and conflict refresh. Final regression for this phase: **77 files / 260 tests passed**, ESLint passed, and Next.js production build generated **30/30 static pages**.

---

## V3 Phase 14 — payment, pickup, and notifications

Customer payment proof, pickup credentials, and notification-center surfaces now use the v3 transaction language while preserving direct-upload, backend-authoritative state, pickup authority, pagination, filter, and session contracts.

### Verified evidence

- Re-opened canonical references **R1**, **R3**, **R4**, and **R5**; all returned `HTTP 200 image/jpeg` before implementation.
- `ui-ux-pro-max` file-upload research returned **Progress Indicators**, **Inline Validation**, **Focusable Error Summary**, **Content Jumping**, **Alt Text**, and **announced Error Messages**. The one-field payment-proof task keeps field-level validation/focus, stable progress containers, explicit live/status feedback, and meaningful file controls.
- Pickup research returned **Submit Feedback**, **Contextual Live Badge Updates**, **Long Token Wrapping**, **Mobile First**, and touch guidance. The token uses `overflow-wrap:anywhere`; QR generation has a textual loading/error fallback and never removes the backend token.
- Notification research reinforced readable line length/container width, semantic article structure, filter-chip reflow, and avoiding horizontal scroll. Notification rows remain semantic articles and filters wrap/collapse at narrow widths.
- Style research returned vibrant/block-based, tactile digital, soft UI evolution, and bento-grid directions. Continuous aurora motion, heavy glass, and spring dependencies were rejected; these transaction surfaces use static shared gradients, pastel grouped surfaces, and restrained CSS transitions.

### Payment proof

- Rebuilt the page around a premium transaction hero with the real backend order total, authoritative `TaskStatus`, and three grouped facts for total, proof state, and last update.
- The upload task is now a raised focused surface with stronger selected-file/no-file treatment and a four-stage progress layout: presign, direct upload, backend submission, authoritative refresh.
- Existing file validation remains JPEG/PNG/WebP up to 10 MiB. Missing proof still returns focus to the file field.
- Initial recoverable load failure now retries in place.
- Mobile keeps the primary proof-submit action reachable through a safe-area-aware sticky action region.
- Contract regression confirms **fresh presign -> direct PUT -> backend-issued objectKey -> authoritative refresh** remains unchanged. Direct upload continues outside the authenticated API client and no client total is submitted.

### Pickup credential

- Rebuilt the ready-state credential into two clear dimensional surfaces: a high-contrast QR paper card and a separate token fallback card.
- The backend token remains selectable and visible whether local QR generation succeeds or fails.
- The not-ready action now re-fetches the latest order state in place. It still does not request a Pickup until `canViewCustomerPickup` permits it.
- The received state keeps QR/token visible only as reference and retains backend timestamps/status.
- No customer confirmation mutation was added; this remains display/presentation only.

### Notification center

- Rebuilt the page header as a premium event hero and the summary into real loaded/unread bento blocks plus an authority explanation.
- Notification rows are now raised event cards; unread events get stronger brand emphasis while read state still has explicit text.
- Existing all/unread/read filters, refresh, mark-read, feedback, pagination cursor behavior, and authority note remain intact.
- The mark-read action was normalized to the shared large control height after rendered audit found the previous small variant measured 36px above mobile widths.

### Rendered verification

Chrome/CDP used browser-only authenticated API stubs for `/my/payment/?orderId=order-1`, `/my/pickup/?orderId=order-2`, and `/notifications/` in light/dark schemes at **320 / 375 / 768 / 1024 / 1440**. Every run finished with document scroll width equal to viewport width and no unintended off-screen element. Payment file control stayed 58–62px high with the exact `image/jpeg,image/png,image/webp` accept contract. Pickup QR scaled from 224px at 320 to 300px where space allowed and the token remained visible at every width. Notification route controls had no rendered target below 40px after the mark-read adjustment.

Targeted regression: **7 files / 31 tests passed**, including payment direct-upload contract, payment initial retry, pickup in-place status refresh, pickup load retry, QR failure token fallback, notification filters/mark-read/refresh/pagination, and helper rules. Final regression for this phase: **77 files / 263 tests passed**, ESLint passed, and Next.js production build generated **30/30 static pages**.

---

## V3 Phase 15 — organization home and settings

Organization selection, dashboard, and settings now share the v3 operational language while preserving membership, role, report, update, and Platform Admin authority contracts.

### Verified evidence

- Re-opened canonical references **R1**, **R3**, and **R4**; all returned `HTTP 200 image/jpeg` before implementation.
- `ui-ux-pro-max` style research returned **Bento Box Grid**, **Shopify Polaris**, and **Soft UI Evolution** as useful operational directions. The implementation adopts modular grouping, restrained commerce-admin hierarchy, shared semantic state, soft depth, and visible focus rather than consumer-level decorative density.
- Operational-dashboard UX research reinforced avoiding horizontal scroll, testing 320/375/768/1024/1440, mobile-first collapse, and responsive alternatives for dense structures.
- Organization-settings UX research returned **Submit Feedback**, **Form Labels**, **Inline Validation**, **Focusable Error Summary**, **Contextual Live Badge Updates**, and stable async layout guidance. Existing labeled fields, blur validation, focusable summary, save feedback, and status presentation were preserved.
- Workspace-selector UX research reinforced native control semantics, no hover-only action, contextual live updates, and avoiding horizontal overflow.

### Organization selection

- Rebuilt the selector around a premium-but-restrained operations hero with the real accessible-organization count.
- Accessible memberships are now raised workspace cards with status, membership role, description, organization id, and one explicit enter action.
- The create-organization form is visually separated as a focused workspace task. It stays sticky only on wide layouts and returns to normal flow at 1100px and below.
- Existing membership filtering remains authoritative: an organization still appears only when `joinAccessibleOrganizations` finds the matching active membership.
- Existing `rememberActiveOrganizationId` validation and role-based landing destination are unchanged.
- Recoverable initial organization loading now provides an in-place retry.

### Organization dashboard

- Replaced the flat dashboard header with a restrained operational hero while keeping the Organization Admin scope explicit.
- Reworked the main report into an asymmetric action board instead of an equal metric-card wall. Pending payment review is the first task surface, paid-order count is secondary, and paid revenue receives the wider supporting surface.
- Stores, products, and report-scope context form a quieter second-level resource strip rather than competing with task priority.
- Report filters remain exactly `campaignId` and `storeId`, are trimmed before request, announce the applied scope, and retain the existing whole-organization reset.
- Campaign and order status breakdowns remain compact operational surfaces with links to the existing management routes.
- Recoverable initial dashboard failure now retries in place.

### Organization settings

- Rebuilt settings around the same operational hero and real organization status, then grouped organization id / createdAt / updatedAt into compact reference surfaces.
- Editable name/description now live in one raised editing surface. Existing labeled controls, blur validation, focusable ErrorSummary, save success/error feedback, dirty-state disablement, and update payload remain unchanged.
- Governance facts are visually separated from the form: organization status is controlled by Platform Admin, membership roles are managed through membership operations, and transaction data is not editable here.
- Recoverable initial settings load failure now retries in place.

### Rendered verification

Chrome/CDP used browser-only authenticated Organization Admin stubs for `/org/select/`, `/org/dashboard/?organizationId=org-1`, and `/org/settings/?organizationId=org-1` in light/dark schemes at **320 / 375 / 768 / 1024 / 1440**. Every run had document scroll width equal to viewport width, no unintended off-screen element, and no visible route control below 40px. After review, operational collapse thresholds were widened: at 1024px organization cards render at about 699px rather than the earlier narrow 338px column, and dashboard task cards render as two ~343px cards plus a full-width revenue card instead of three cramped 175–301px columns.

Targeted regression: **6 files / 16 tests passed**, including membership-backed organization selection, role routing, organization/create validation, settings editable-field contract, settings validation, dashboard baseline report values, campaign/store filter contract, and all three new in-place retry paths. Final regression for this phase: **77 files / 266 tests passed**, ESLint passed, and Next.js production build generated **30/30 static pages**.

---

## V3 Phase 16 — catalog and staff operations

Staff, store, product, variant, and product-image management now use the v3 operational commerce language while preserving membership guards, store/product status behavior, product/variant payloads, direct-upload flow, and backend-authoritative permissions.

### Verified evidence

- `ui-ux-pro-max` design-system search for catalog/product/staff/image management returned a low-complexity operational direction with fast 150–200ms interaction feedback, strong focus/contrast requirements, and restrained decoration. The generic feature-showcase pattern and Latin editorial typography were rejected because they conflict with the existing operational task and Thai-first v3 system.
- Targeted UX search reinforced explicit selected/active state, semantic status badges, native interactive controls, and direct semantic state changes rather than animation-dependent correctness.
- Next.js search reinforced responsive image containment. Server Actions were rejected because UniStore remains a static-export frontend using the documented REST API contract.
- The canonical v3 design authority remains `.interface-design/system.md`: operations stay compact and scan-first, while catalog media can be more visual where real backend imagery exists.

### Staff and store operations

- Staff management now uses a restrained branded operational hero, compact real-count summary surfaces, rounded membership work cards, and a visually distinct sticky add-member task.
- Existing final-active-admin protection, inactive-member guard, role confirmation, removal confirmation, focusable validation summary, and `authSession.restore()` behavior are unchanged.
- Store management now uses the same v3 operational family with real status counts, compact raised store cards, a stronger selected/editing state, and a dedicated editing surface that is visually distinct from the create task.
- Store open/close behavior, confirmation wording, fresh-detail load before edit, editable fields, and update payload remain unchanged.

### Product, variant, and image management

- Product rows are now image-first: real backend `imageUrl` is shown in a reserved media frame, with a non-informative initial fallback when no image exists. Short-lived backend image URLs remain display-only and are lazy-decoded.
- Product create/filter/edit/deactivate behavior remains unchanged. Selected products receive a stronger editing state without turning selection into authorization.
- The product editor now uses one elevated catalog workspace for basic data, current image management, and variants; variants use compact rounded rows with a clear editing state and price hierarchy.
- Product image management now shows the current authoritative image (or an explicit no-image state) before file selection. The direct upload contract remains backend presign → direct PUT → persist backend-issued `objectKey` → authoritative product refresh.
- Existing focusable ErrorSummary behavior, field-level validation, semantic status badges, confirmation dialogs, and mobile full-width action recovery are preserved.

### Verification

Targeted regression for this phase: **5 files / 18 tests passed** covering staff, stores, products, variants, and product-image upload. ESLint passes with **0 warnings/errors** after documenting the short-lived backend image URLs at both new `<img>` sites. Next.js production build succeeds and generates **30/30 static pages**; `git diff --check` also passes. Responsive CSS explicitly collapses create/edit side panels and row actions at 980/1000/760/640/620/380 breakpoints; rendered multi-viewport verification remains scheduled for the dedicated cross-product responsive phase.

---

## V3 Phase 17 — campaign operations

Campaign planning and lifecycle management now use the v3 operational workflow language while preserving the explicit backend lifecycle, planning-date semantics, conflict recovery, and confirmation requirements.

### Verified evidence

- Re-opened canonical references **R3** and **R4** from the workspace before implementation; both still returned **HTTP 200 image/jpeg**. The phase adapts R3's connected rounded-block hierarchy and R4's calm pastel productivity grouping without turning the lifecycle workbench into a playful customer bento.
- `ui-ux-pro-max` campaign-workflow search returned **Soft UI Evolution** with subtle depth, focus visibility, contrast, and reduced-motion requirements. The unrelated testimonial/marketing pattern, pink wedding palette, and script typography were explicitly rejected.
- Lifecycle UX search reinforced confirmation dialogs, submit feedback, contextual live updates, and semantic state correctness independent of animation.
- Scheduling UX search reinforced visible labels, mobile-first collapse, and no horizontal overflow. Planning timestamps remain planning data only; no date now triggers or predicts a backend state transition.

### Campaign list and planning

- Rebuilt the campaign header, real loaded-state summary, and three-part sales-flow context into restrained rounded operational surfaces using the existing v3 palette.
- Campaign rows are now independent task cards with a clear selected state, current status, real store/open/close planning metadata, and a visible **ขั้นตอนถัดไป** derived directly from `lifecycleActionsForStatus`.
- Terminal campaign rows show only their terminal outcome (`เสร็จสิ้นแล้ว` / `ยกเลิกแล้ว`) instead of inventing another step.
- Filters remain the existing `storeId` + `status` query contract and continue to announce one contextual result message.
- The create-campaign panel remains a separate sticky task on wide layouts; its four datetime fields are grouped as a planning surface and still serialize through the existing campaign form helper.

### Detail and lifecycle workbench

- Selected campaign detail is now an elevated workflow workspace with stronger campaign identity, a clear draft-vs-read-only split, and four pastel schedule blocks using only backend planning timestamps.
- Draft editing still allows only store, name, and planning timestamps. The focusable ErrorSummary, field errors, dirty-state save protection, and `INVALID_STATUS_TRANSITION` refresh path remain unchanged.
- The six-stage lifecycle rail is now a set of connected compact workflow blocks. Done/current/upcoming states remain expressed with text plus surface/tone; current step retains `aria-current=step`.
- Current authoritative state and next valid non-destructive action are promoted above the rail. Destructive cancellation remains separate and all lifecycle changes still require the existing ConfirmDialog.
- Transition conflicts still surface the backend reason and refresh the latest Campaign DTO; no optimistic lifecycle transition or date-derived status was added.

### Verification

Targeted regression: **5 files / 19 tests passed**, including a new list-level assertion that the visible next action comes from the source-defined lifecycle mapping. ESLint passes with **0 warnings/errors**. Next.js production build succeeds and generates **30/30 static pages**; `git diff --check` passes. Responsive rules collapse the operations/create layout by 1040px, workflow rail to 3 columns by 980px, and all lifecycle/action/schedule surfaces to one column on narrow mobile. Rendered all-route multi-viewport checks remain scheduled for the dedicated responsive/audit phases.

---

## V3 Phase 18 — orders and payment review

Organization order queues, order detail, and the payment-review workbench now prioritize real operational work while preserving the documented order/payment API contracts, role authority, cancellation rules, private-slip access, and backend-authoritative review results.

### Verified evidence

- Re-opened canonical references **R1** and **R4** before implementation; both still returned **HTTP 200 image/jpeg**. This phase adapts their large rounded framing, restrained depth, and calm productivity-card grouping rather than their marketing layouts.
- The `ui-ux-pro-max` operational search recommended a low-cost minimal/Swiss direction with clear hierarchy, visible focus, reduced motion, and responsive verification. The marketing hero/CTA pattern and proposed alternate font/color system were rejected in favor of the existing v3 Thai-first design authority.
- A direct `payment review approval rejection evidence workflow queue` UX query returned **0 matches**. The phase therefore records that gap explicitly and uses verified broader responsive guidance plus existing project rules instead of fabricating skill evidence.
- Broader operational queue guidance reinforced no horizontal overflow, task-appropriate card/list alternatives, touch-friendly controls, readable mobile text, and checks across common viewport widths.

### Organization order queue and detail

- `/org/orders/` now keeps the existing campaign/customer/status filters and server order while presenting loaded counts as compact v3 summary surfaces, a raised filter workspace, and independent operational order cards.
- Orders in authoritative `PAYMENT_REVIEW` state receive a visible **ต้องดำเนินการ · ตรวจหลักฐานการชำระเงิน** cue plus stronger attention treatment. This is presentation only; it does not change ordering, status, or authorization.
- Order cards retain the real customer id, campaign id, created time, backend total, and query-based detail route. Pagination still sends only the documented applied filters plus the opaque cursor.
- `/org/orders/view/` now uses a stronger operational detail hero, raised immutable order snapshots, grouped recorded line items, and a clearer backend-confirmed total surface.
- Organization Admin cancellation remains available only through the existing `canOrganizationCancelOrder` rule and ConfirmDialog. Staff still cannot access general cancellation, and conflict recovery still refreshes the latest Order DTO.

### Payment review workbench

- `/org/payments/` now uses the same v3 operational framing with pending-review emphasis, independent queue cards, and a stronger selected-payment workbench instead of a flat legacy ledger.
- Pending payments show **รอดำเนินการ · เปิดหลักฐานและตัดสินผล** without reordering backend results or exposing review actions for already decided payments.
- Selected detail promotes the authoritative order total and order status, then shows a three-step review guide: request the temporary evidence link, compare against the latest Order, then approve or reject. These are explanations of the existing workflow, not client-side state transitions.
- Private slip access remains `requestPrivateDownloadUrl` only. The temporary URL is still opened in a new tab, expires according to the backend response, and the repository does not persist or proxy the slip.
- Approval/rejection continue to use the existing backend mutations and refresh both Payment and Order after review. Rejection still requires a trimmed reason with focusable ErrorSummary + field-level error recovery.
- Filter feedback was cleaned up so one contextual live message is emitted per apply/reset operation rather than setting two messages in succession.

### Verification

Targeted regression: **7 files / 22 tests passed** covering organization order listing/detail, helper/role rules, order service, payment review UI, rejection validation, and payment service. ESLint passes with **0 warnings/errors**. The first production build exposed a malformed CSS fragment introduced during this phase; it was corrected, then the final Next.js production build passed and generated **30/30 static pages**. `git diff --check` also passes. Dedicated rendered multi-viewport and full-regression checks remain scheduled for Phases 22–24.

---

## V3 Phase 19 — production, pickup, and audit operations

Production summaries, pickup verification, and organization audit history were refreshed as dense task-first operational surfaces while retaining the existing role boundaries, backend queries, pickup confirmation semantics, token behavior, and read-only audit contract.

### Verified evidence

- Re-opened canonical references **R1** and **R4** before implementation; both still returned **HTTP 200 image/jpeg**. R4 remains the strongest match for calm operational grouping, while R1 informed restrained premium framing rather than marketing content.
- The `ui-ux-pro-max` archetype search returned a Trust & Authority marketing pattern plus a high-risk Neumorphism style. The marketing conversion structure, teal palette, Inter typography, and embossed interaction treatment were rejected because they conflict with the existing v3 Thai-first system and operational accessibility needs.
- The same search did reinforce avoiding confusing waiting states and tiny controls, plus visible focus and reduced-motion support.
- The pickup-specific UX query returned three directly useful findings: show success confirmation after actions, require confirmation for irreversible actions, and allow long identifiers/tokens to wrap without forcing horizontal overflow.
- The audit-log UX query reinforced responsive table handling, async loading feedback, no page-level horizontal overflow, and breakpoint testing. The shared Table scroll region remains the deliberate mobile fallback instead of forcing the audit table into an unreadable squeezed layout.

### Production summary

- `/org/production/` keeps the required `campaignId` query workflow, focusable ErrorSummary, URL query-context replacement, and Organization Admin-only backend contract unchanged.
- The page now uses the v3 operations canvas, a raised campaign-selection workspace, compact campaign context pill, three independent production summary blocks, and grouped product/variant production cards.
- Product and variant quantities are still rendered only from the backend `ProductionSummaryDTO`. No client-side order/payment filtering or inferred paid-state logic was introduced.
- Responsive rules keep the campaign form and variant quantity layout reachable on narrow screens while retaining technical identifiers with safe wrapping.

### Pickup verification and confirmation

- `/org/pickups/` now presents READY pickups as explicit work items with **พร้อมดำเนินการ · ตรวจ Token และยืนยันการรับสินค้า**, without reordering the backend list or manufacturing a new priority field.
- Selected Pickup detail now includes a three-step verification guide: compare Token/QR, inspect the freshly loaded related Order, and confirm only after physical handoff. The guide explains the existing workflow and does not create client-side authority.
- Pickup tokens remain selectable technical text and use safe wrapping. The selected workbench keeps the authoritative Pickup status, Order status, customer, campaign, total, timestamps, receivedBy, and receivedAt.
- Confirmation still uses the existing ConfirmDialog and `confirmOrganizationPickup` mutation. Successful confirmation refreshes both Pickup and Order. `PICKUP_ALREADY_RECEIVED` and other conflicts still refresh the latest state instead of retrying or forcing a client transition.
- RECEIVED pickups continue to expose no second confirmation action.

### Read-only audit log

- `/org/audit/` now visually communicates **อ่านอย่างเดียว** at the page heading in addition to the existing neutral notice.
- The existing actor/action/resource filters, backend ordering, opaque cursor pagination, and backend-sanitized metadata remain unchanged.
- The audit table now uses the shared compact density for faster scanning, keeps its keyboard-focusable horizontal scroll region on narrow screens, and gives action/metadata affordances stronger v3 hierarchy without adding edit/delete controls.

### Verification

Targeted regression: **9 files / 26 tests passed** across production summary, pickup verification/confirmation, audit list, helpers, and services. ESLint passes with **0 warnings/errors**. Next.js production build succeeds and generates **30/30 static pages**; `git diff --check -- frontend` passes. Full rendered viewport and complete regression sweeps remain scheduled for Phases 22–24.

---

## V3 Phase 20 — platform governance

Platform summary, organization governance, and the user directory now share the same v3 operational language while keeping Platform Admin authority rooted only in the persisted `User.platformRole` contract.

### Verified evidence

- Re-opened canonical references **R1** and **R4** before implementation; both still returned **HTTP 200 image/jpeg**. R1 informed stronger platform-scope framing, while R4 informed compact productivity grouping and calmer governance surfaces.
- The `ui-ux-pro-max` archetype search returned a Marketplace/Directory pattern and flat-design direction. The search-first marketplace structure, green palette, and Inter typography were rejected because these Platform pages are governance tools rather than discovery surfaces and the v3 system already defines Thai-first typography and brand tokens.
- The same design-system search reinforced low-cost interaction, strong contrast, visible focus, reduced motion, and avoiding text-heavy cards without hierarchy.
- The approval/suspension UX query reinforced explicit confirmation dialogs plus visible success feedback after state-changing actions. Both protections already existed and remain in place.
- The read-only directory query reinforced intentional table overflow on narrow screens, non-color-only status communication, semantic structure, bounded prose width, and avoiding page-level horizontal overflow.

### Platform summary

- `/platform/summary/` now uses a raised platform-scope header, clearer `Platform Admin` authority treatment, independent governance summary blocks, and grouped status ledgers using only `PlatformSummaryDTO` counts.
- Pending organization count remains visually emphasized only when the backend summary returns a value greater than zero; no synthetic approval metric or client-derived authority was added.
- Organization and user status totals continue to come directly from the documented summary response.

### Organization governance

- `/platform/organizations/` keeps the existing presentation-only prioritization that surfaces `PENDING` organizations first while preserving each backend-returned Organization status and the same action eligibility helpers.
- PENDING rows now expose an explicit **ต้องตัดสินใจ · ตรวจข้อมูลก่อนอนุมัติหรือระงับ** cue so the next governance task is scan-friendly without inventing a new state.
- Organization metadata is grouped into compact governance cards, with the action workspace visually separated from immutable organization details.
- Approve remains available only for `PENDING`; suspend continues to use the existing `canSuspendOrganization` rule. Both still require ConfirmDialog and consume only the backend-returned `OrganizationDTO` after success.
- Transition conflicts and missing organizations still trigger the existing authoritative list refresh path. A Backend 403 continues to render the forbidden state rather than create client-side authority.

### Read-only user directory

- `/platform/users/` remains explicitly read-only. No status or `platformRole` mutation controls were introduced.
- The user directory now uses the shared compact table density with deliberate horizontal scroll on narrow screens, while preserving persisted `status`, `platformRole`, created time, updated time, identity, and email values from `UserDTO`.
- Text status labels and badges remain present in addition to color, so user/platform-role state is not communicated through color alone.

### Verification

Targeted regression: **5 files / 10 tests passed**, including coverage that PENDING organizations are surfaced first, show the new decision cue, and still expose only backend-allowed transitions. ESLint passes with **0 warnings/errors**. Next.js production build succeeds and generates **30/30 static pages**; `git diff --check -- frontend` passes. Full rendered viewport and complete regression sweeps remain scheduled for Phases 22–24.

---

## V3 Phase 21 — brand illustration and media system

The customer-facing visual layer now uses a shared lightweight brand-illustration system instead of page-specific decorative object markup, while real backend media remains authoritative anywhere actual product imagery exists.

### Verified evidence

- Re-opened canonical references **R2** and **R3** before implementation; both still returned **HTTP 200 image/jpeg**. R2 informed energetic commerce framing and R3 informed soft dimensional/clay object treatment without copying any reference artwork.
- The `ui-ux-pro-max` illustration search recommended a vibrant block-based consumer direction with clear visual hierarchy and warned against flat, text-heavy presentation. Its alternate green palette, Rubik/Nunito typography, marketing CTA repetition, and scroll-snap direction were rejected because they conflict with the established v3 token system and this phase is a media layer rather than a marketing rebuild.
- Media/accessibility research reinforced meaningful alt text for informative images, responsive image scaling, reserved aspect ratios to avoid layout shift, lazy loading below the fold, and avoiding heavyweight runtime 3D assets.
- Empty-state research reinforced pairing visual treatment with useful explanatory copy rather than replacing the message with decorative art.

### Shared media primitives

- Added `BrandIllustration` with project-local variants `market`, `parcel`, `product`, `payment`, `pickup`, and `notification`. It is rendered entirely from semantic markup + existing CSS design tokens, so no copied reference files, remote decorative assets, WebGL, Three.js, or runtime texture payloads were introduced.
- `BrandIllustration` is decorative by default and therefore hidden from assistive technology and pointer interaction. It can become informative only when `decorative={false}` is paired with a real accessible `label`.
- Added `MediaFallback`, which combines generic brand art with visible fallback text. The product variant intentionally does not depict a specific real item, seller, rating, brand, or inventory claim.
- Extended `EmptyState` with optional `media` support while retaining the existing state label, heading, description, actions, and semantics.
- Added reduced-motion protection for the media layer and kept all illustration sizing bounded by aspect-ratio containers to prevent page-level overflow or layout jumping.

### Customer-surface integration

- The storefront landing hero now composes the shared `market` illustration rather than maintaining its own parcel/orb/tag/card object system. The marketplace empty state uses the same shared visual language while preserving the existing explanatory copy.
- Authentication brand panels now compose the shared `parcel` illustration. The old page-specific clay-card/parcel/ticket CSS was removed so auth and storefront no longer maintain separate decorative object languages.
- Product cards, product detail, and order creation now use `MediaFallback variant="product"` whenever the backend returns no product image. Existing real product `imageUrl` values still take precedence and are never recolored or replaced.
- Listing product images still use meaningful product-name alt text plus `loading="lazy"`; the above-fold product-detail image remains normally decoded. No storage URL, upload, or product-data contract changed.
- Notification empty states now use the shared `notification` illustration as secondary decorative context while keeping the authoritative empty-state message visible.

### Design-system authority

- `.interface-design/system.md` now documents the implemented media primitives, their accessibility contract, real-media precedence, fallback restrictions, empty-state usage, and the rule that page-specific hero/auth scenes should compose shared primitives rather than duplicate bespoke illustration CSS.

### Verification

Targeted regression: **8 files / 28 tests passed** across shared media/state primitives, storefront landing/presenters, auth surfaces, order creation, and notifications. Added focused coverage for decorative/informative illustration semantics, visible product fallback copy, and empty-state media. ESLint passes with **0 warnings/errors**. Next.js production build succeeds and generates **30/30 static pages**; `git diff --check -- frontend` passes. Full multi-viewport/motion/a11y visual verification remains scheduled for Phases 22–23, followed by the full regression/static-export sweep in Phase 24.

---

## V3 Phase 22 — cross-product responsive and motion polish

This phase tightens shared behavior for narrow screens, coarse pointers, touch scrolling, and motion preference across customer, organization, and platform surfaces without changing API, authorization, lifecycle, upload, payment, pickup, or audit behavior.

### Research and adopted guidance

- The `ui-ux-pro-max` responsive search reinforced visible focus, reduced motion, readable mobile text, and large touch targets. Its marketing-oriented Trust & Authority page structure, alternate blue/green palette, and unrelated Syncopate/Space Mono typography were rejected because the v3 system already defines the product hierarchy and Thai-first type system.
- The mobile UX query reinforced bounded table overflow, touch-sized controls, at least 8px separation between adjacent mobile controls, `touch-action` for tap responsiveness, and avoiding gesture-only navigation.
- Motion guidance reinforced `prefers-reduced-motion`, avoiding hover-only required interactions, limiting decorative continuous motion, and preferring transform/opacity for short feedback rather than layout-changing animation.

### Shared 320px+ containment

- Global semantic layout containers (`main`, `section`, `article`, `header`, `footer`, `nav`, `aside`, `form`, `fieldset`) now opt into `min-width: 0` so grid/flex children can shrink instead of forcing page-level overflow.
- Headings, copy, list items, form labels, and definition-list content now allow emergency `overflow-wrap: anywhere` only when ordinary wrapping cannot contain long content.
- Form controls are bounded with `min-width: 0` and `max-width: 100%`, preserving existing component sizing while preventing intrinsic-width overflow.
- The existing <=620px 44–48px control scale remains authoritative; <=360px now tightens page gutters and block spacing to preserve usable content width at the 320px support floor without shrinking interactive targets.

### Touch, tables, and mobile navigation

- Coarse-pointer screens enforce the shared minimum target height for buttons, non-checkbox/radio form controls, selects, textareas, and summaries.
- Non-hover devices suppress hover lift transforms on links, buttons, button roles, article rows, and table rows so touch interactions do not leave sticky elevated states. Required actions remain click/tap driven.
- Shared table frames remain the intentional mobile overflow boundary and now explicitly use `max-width: 100%`, inertial touch scrolling, `touch-action: pan-x pan-y`, and inline overscroll containment rather than widening the page.
- The application-shell mobile drawer now resolves to `min(calc(100vw - 16px), 348px)`, guaranteeing a visible dismissible scrim edge at narrow widths while retaining its focus trap, Escape handling, inert content, and focus return behavior.
- Notification filter controls keep a three-column mobile composition but now use the standard 8px control gap.

### Customer narrow-screen refinements

- Storefront navigation keeps the existing customer actions reachable at <=420px; at <=360px the chrome tightens without hiding authenticated/unauthenticated actions.
- Product listing cards intentionally switch from the compact two-column card to a one-column image-first composition at <=360px, improving product-name/price/action space at the 320px floor.
- The storefront landing hero uses narrower outer gutters, smaller reserved media height, and a non-rotated shared illustration at <=360px so brand media does not crowd copy or actions.
- Auth pages reduce decorative visual height and panel padding at <=360px while keeping account forms, password-manager behavior, and primary actions unchanged.
- Shared card/dialog/state padding receives a final <=360px pass so content remains readable without clipping; dialogs continue to preserve reachable header/body/footer regions.

### Canonical rule updates

- `.interface-design/system.md` now records the implemented containment, 320px gutter, coarse-pointer, hover-none, table touch-scroll, and reduced-motion safeguards. Duplicate heading residue from the prior media-system edit was also cleaned up.

### Verification

Targeted regression: **14 files / 54 tests passed** across application shell, dialog/operational/state primitives, storefront header/landing/presenters, auth forms, customer order/payment/pickup/notifications, and platform organization governance. ESLint passes with **0 warnings/errors**. The first production build in this phase exposed an extra closing brace in the newly added global responsive block; it was corrected, then the final Next.js production build passed and generated **30/30 static pages**. `git diff --check -- frontend` passes. Browser-rendered contrast/viewport/a11y review remains the dedicated focus of Phase 23; full regression/static-export verification remains Phase 24.

---

## V3 Phase 23 — accessibility, performance, and visual audit

Phase 23 used the repository WCAG 2.2 checklist, ARIA patterns, motion choreography guidance, the design-review rubric, targeted unit tests, measured contrast calculations, and a real headless-Chrome render gate against the built static export. No backend/API/authorization semantics were changed.

### Audit method and evidence

- The accessibility skill requires real-render contrast/state scripts named `scripts/measure_render.mjs` and `scripts/verify_states.mjs`, but those scripts are not present in this workspace. Rather than claim results from missing tooling, this phase used a temporary Chrome DevTools Protocol harness against `frontend/out`; the harness was deleted after the audit.
- The real-render gate covered **42 cases**: `/`, `/login/`, `/register/`, `/notifications/`, `/org/dashboard/`, and `/platform/summary/` at 320, 375, 768, 1024, and 1440 px in light mode, plus dark-mode 320 px and dark + reduced-motion 1440 px checks for every route.
- Authenticated-only routes necessarily rendered their actual unauthenticated access boundary in this static-browser run; deeper authenticated task semantics remain covered by their existing component/service tests and the source-level accessibility review rather than by a fabricated session.
- The final 42-case run reported **0 page-overflow cases, 0 unnamed-focusable cases, 0 sub-24px non-exempt target cases, 0 missing-alt cases, 0 unlabeled-form-control cases, 0 duplicate-ID cases, 0 solid-background low-contrast cases, 0 heading-order jumps, 0 reduced-motion failures, and 0 top-level missing-h1 cases**.

### Fixed P0/P1 findings

| WCAG / area | Severity | Finding before fix | Fix | Verified result |
| --- | --- | --- | --- | --- |
| 1.4.3 Contrast | P0 | `--on-dark-tertiary` at 68% white could drop to **4.05:1** against the lightest `#236188` hero-gradient endpoint. | Raised the token to 76% white. | Worst measured endpoint is now **4.63:1** for normal text. |
| 2.3.3 / motion preference | P1 | Chrome reported `prefers-reduced-motion: reduce` as active, but shared button/field and storefront navigation transitions still computed at 180 ms because component transition shorthands remained active after bundling. | Added final component-level reduced-motion rules with `transition: none !important`, removed hover/active transforms, and stopped decorative/loading animation where appropriate. | Final render gate reports **0 reduced-motion failure cases**. |
| 1.3.1 / 2.4.6 headings | P1 | Full-page anonymous/forbidden/loading access boundaries rendered the reusable StatePanel default `<h2>`, leaving protected-route states without an `<h1>`. | Added an opt-in `headingLevel` to state primitives; access boundaries now request level 1 while embedded states keep level 2. | Final render gate reports **0 top-level missing-h1 cases**; focused tests verify both levels. |
| Layout stability | P1 | Register at desktop split-layout widths intermittently measured CLS above the preferred 0.1 threshold (about **0.12–0.14**) while auth-session loading content was replaced by the full form. | Reserved a stable desktop `formShell` height for auth entry states at >=861 px. | Final 42-case run max CLS is **0.0489**. |

### Measured contrast anchors

- Light: `ink / surface` **16.76:1**, `ink-secondary / surface` **7.06:1**, `ink-tertiary / surface` **4.97:1**, `brand-on / brand` **6.30:1**, focus ring / surface **6.30:1**, focus ring / canvas **5.84:1**.
- Dark: `ink / surface` **15.78:1**, `ink-secondary / surface` **10.08:1**, `ink-tertiary / surface` **6.55:1**, `brand-on / brand` **8.06:1**, focus ring / surface **7.61:1**.
- Semantic soft-surface pairs measured: success **4.80:1**, warning **6.03:1**, danger **4.99:1**, info **5.07:1**.
- Gradient text that cannot be reduced to a single background color was not falsely assigned an automatic ratio; the canonical hero endpoint was measured explicitly, which is what exposed and fixed the tertiary-token issue.

### WCAG 2.2 / ARIA checks

- `lang="th"` and descriptive route titles render correctly on the sampled routes.
- Every rendered image in the sample has an `alt`; shared brand illustrations remain decorative by default and hidden from assistive technology.
- Rendered form controls have accessible names/visible labels; login/register retain `autocomplete="email"`, `current-password`, `new-password`, and `name`, with no paste blocker or cognitive CAPTCHA path.
- Focus styles remain globally visible at 3 px with measured focus-token contrast above 3:1; sticky navigation is paired with scroll padding/margins to avoid completely obscuring focused content.
- Existing dialogs retain focus trapping, Escape handling, inert background content, and focus return tests. Application-shell mobile navigation retains the same keyboard/focus behavior.
- ErrorSummary remains focusable and linked back to invalid fields; async success/error/filter states continue to use contextual `role="status"`, `aria-live`, or `role="alert"` rather than color-only signaling.
- No drag-only or swipe-only primary interaction was introduced.

### Performance and visual review

- The final local static-render sample produced no viewport overflow at 320–1440 px in the audited routes and no solid-surface contrast failures in either theme.
- Local static navigation in the final audit topped out below **100 ms** on this machine. This is useful as a regression signal only, not a production-network performance claim.
- Static export size is **3.1 MiB** across **208 files**. The largest generated static chunk observed is about **256 KiB**; no runtime 3D/WebGL bundle or downloaded decorative-reference asset was introduced.
- Product listing images stay lazy-loaded and media containers reserve aspect ratio; customer-detail imagery remains backend-authoritative. The shared illustration system is CSS/token driven, so it adds no remote decorative-image transfer.
- Some hover surfaces still change box-shadow as visual feedback, but no continuous decorative animation, parallax, scroll-jacking, or motion-required task behavior exists. Transform/opacity remain the preferred motion properties for future additions.

### Design-review score

| Dimension | Weight | Score | Rationale |
| --- | ---: | ---: | --- |
| Visual hierarchy | 20% | 8.8/10 | Customer and operational task hierarchy is consistent and state/next-action led. |
| Consistency | 20% | 9.0/10 | Shared v3 tokens, primitives, media system, shell, and status patterns are broadly reused. |
| Accessibility | 20% | 9.1/10 | P0 sampled render checks pass after contrast, reduced-motion, and heading fixes; deeper authenticated visual states still depend on component/source coverage. |
| Usability | 20% | 8.7/10 | Clear recovery, confirmation, and authority boundaries; dense admin flows remain intentionally task-first. |
| Responsiveness | 10% | 9.2/10 | 320–1440 sampled render gate has no page overflow or undersized non-exempt targets. |
| Performance | 10% | 8.5/10 | Static export is small and fast locally; backend image variants/network behavior are outside this frontend-only phase. |

Weighted review score: **8.9/10**.

### Verification

Targeted regression after fixes: **9 files / 29 tests passed** covering StatePanel semantics, dialog focus behavior, application shell, access boundaries, auth entry/forms, storefront navigation/landing, and notifications. ESLint passes with **0 warnings/errors**. Next.js production build succeeds and generates **30/30 static pages**. `git diff --check -- frontend` passes. The final real-Chrome 42-case render gate is clean on the checks listed above. Phase 24 remains the full repository regression/static-export verification sweep.

---

## V3 Phase 24 — regression and static-export verification

Phase 24 ran the final repository-wide verification gates required before diff review. No product behavior was intentionally changed in this phase; the work is verification-only.

### Data and contract validation

- `ui-ux-pro-max` data validation passed: **12 domain files, 22 stack files, and `ui-reasoning.csv` validated**.
- Targeted contract regression passed **21 files / 83 tests** across API-client behavior, session/access navigation, organization/storefront/product services, direct upload, payment review, campaign lifecycle, order helpers/services, pickup helpers/services, audit service, and platform-admin authority helpers/services.
- These tests preserve the critical redesign guardrails: backend-authoritative state, existing API paths/payloads, `User.platformRole` authority, direct-upload behavior, order/campaign lifecycle helpers, pickup token behavior, and session-failure handling.

### Full regression

- Full Vitest suite passed: **77 files / 273 tests**.
- The suite includes `src/app/static-export.test.ts`, component accessibility/interaction tests, customer transaction flows, organization operations, production/pickup/audit coverage, and platform-governance coverage.
- ESLint passed with **0 errors/warnings**.
- `git diff --check -- frontend` passed.

### Production build and static export

- `npm run build` passed on Next.js **16.3.7** with TypeScript validation and static generation **30/30 pages**.
- Explicit canonical output verification checked **28 user-facing route outputs** in `out/**/index.html`; result: **28 checked, 0 missing**.
- Verified customer routes include landing, auth, store/product/campaign discovery, checkout, order/payment/pickup tracking, and notifications.
- Verified organization outputs include select/dashboard/settings/staff/stores/products/campaigns/orders/order detail/payments/production/pickups/audit.
- Verified platform outputs include summary, organizations, and users.

### Responsive export smoke gate

- A temporary headless-Chrome/CDP audit served the generated `out` directory and visited all **28 canonical routes** at **320, 375, 768, 1024, and 1440 px**.
- Result: **140 route/viewport combinations checked, 0 page-level horizontal overflow failures, 0 clipped visible link/button failures**.
- The audit file was removed immediately after execution; no Phase 24 temp/debug artifact remains in the workspace.

### Scope and workspace integrity

- `git status --short` shows the redesign working tree confined to `frontend/**`; no files outside the frontend task scope are modified by this task.
- No temporary `.phase*` audit file remains.
- The build remains a static export and preserves the route set expected by the redesign plan.

### Phase 24 outcome

All required Phase 24 gates pass: ui-ux-pro-max validation, targeted contract regression, full test suite, lint, production build, canonical static-export output verification, multi-viewport overflow smoke checks, and diff whitespace validation. The task is ready for Phase 25 diff review; no commit has been created.

---

## V3 Phase 25 — final diff review

The final review compared the complete frontend diff against the task goal, scope, constraints, and acceptance criteria rather than reviewing only the last visual phase.

### Scope and contract review

- Working tree review covers **72 tracked modified files plus 3 intentional new frontend files**. All task changes remain under `frontend/**`.
- No backend source, API contract, shared server schema, package dependency, Next.js export configuration, service helper, DTO/type definition, or persistence layer was modified by the redesign.
- Security-sensitive diff scanning found no new Authorization/Bearer handling, direct API endpoint construction, storage credential handling, `dangerouslySetInnerHTML`, `eval`, or runtime external-reference loading.
- Query `organizationId` remains navigation/request context only. No diff promotes it into authorization proof.
- `User.platformRole` remains the Platform Admin authority. Organization membership/role resolution remains in the existing access layer.
- Payment proof and product-image uploads still use the existing backend-presign -> direct object-storage upload -> backend-issued key workflow. No upload service code changed.
- Customer pickup remains presentation-only; organization pickup confirmation remains the existing Staff/Admin mutation path. Audit remains read-only.
- Campaign/order/payment/pickup lifecycle service/helper files are unchanged; UI additions only expose state or next-action information derived from the existing source-defined helpers/DTOs.

### Review of behavior-changing UI additions

- In-place retry controls only re-run the same existing read request after recoverable load failures; they do not invent state transitions or bypass access checks.
- Product `ราคาเริ่มต้น`, variant count, campaign count, loaded summary counts, and queue-attention cues are derived only from already loaded backend DTOs and are presentation-only.
- Campaign list next-action copy calls the existing `lifecycleActionsForStatus` helper rather than recreating transition rules in the view.
- Payment and pickup review guides are explanatory UI around existing authoritative actions; confirmation/approval/rejection eligibility and mutations are unchanged.
- Storefront discovery reuses backend-returned organizations/stores and does not fabricate sellers, ratings, metrics, testimonials, or inventory claims.

### Design-system and artifact review

- `.interface-design/system.md` remains the single visual authority. `.interface-design/visual-reference-brief.md` is explicitly research evidence and states that the system file wins if they differ.
- No copy of the five canonical Pinterest images exists in the repository; runtime source code does not fetch those references.
- Review found one repeated literal operational-row shadow across eight CSS modules. It was mechanically centralized as `--shadow-row` without changing the rendered value, removing an unnecessary cross-module styling duplicate and keeping elevation under the token authority.
- A duplicated rendered-contrast sentence in the design-system document was removed during review.
- No temporary `.phase*` audit scripts, debug logging, debugger statements, runtime localhost hooks, or copied reference assets remain.

### Regression and compatibility review

- The redesign does not add a new runtime dependency or E2E framework.
- Static export, trailing-slash route shape, all **28 canonical user-facing outputs**, and the **30/30 page** production build remain intact.
- Phase 24 full regression remains the final behavior baseline: **77 test files / 273 tests passed**, with **21 contract-focused files / 83 tests** passing independently.
- Phase 23/24 browser checks cover the required responsive widths and found no page-level horizontal overflow or clipped primary visible actions.
- Accessibility review retains visible focus, labeled controls, dialog/drawer keyboard behavior, password-manager-compatible auth, focusable error recovery, non-color-only state, and reduced-motion handling.

### Final review outcome

No unresolved blocking regression, security issue, API/business-rule drift, scope violation, duplicated design authority, fabricated marketplace content, temporary artifact, or missing required verification was found after the cleanup above. The diff is ready to complete the redesign task. No commit is created because the task explicitly requires user approval before committing.
