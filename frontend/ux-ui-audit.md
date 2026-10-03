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
