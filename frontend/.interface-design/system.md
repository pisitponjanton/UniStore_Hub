# UniStore Hub Interface System

## Status

Canonical visual authority for **UniStore Playful Campus Commerce Redesign v3**.

Approved direction: **Playful Campus Commerce v3**.

This file is the single visual authority for the frontend. Research evidence lives in `.interface-design/visual-reference-brief.md` and `ux-ui-audit.md`. When research notes and this file differ, **this file wins**.

All implementation must use one semantic token source in `src/app/globals.css` and shared primitives. Do not create a parallel theme, page-local token framework, or second component language.

## Product model

UniStore Hub has four expression levels inside one product:

1. **Marketplace discovery** — customers browse organizations, stores, campaigns, and products.
2. **Customer transactions** — customers place orders, pay, track state, and present pickup information.
3. **Organization operations** — Staff and Organization Admin users process queues and manage catalog/configuration.
4. **Platform governance** — Platform Admin users approve/suspend organizations and inspect platform-level state.

These modes must feel related but not visually identical.

## North star

**A contemporary campus marketplace with the visual confidence of consumer commerce and the task clarity of modern operations software.**

The interface should feel current, playful but trustworthy, premium but approachable, Thai-first, product-led on customer surfaces, and task-led on operational surfaces.

It must not return to a flat legacy-admin appearance or a generic dashboard template.

## Expression spectrum

| Surface | Expression | Density | Visual behavior |
| --- | ---: | ---: | --- |
| Landing / discovery | 9/10 | 4/10 | vibrant blocks, bento, dimensional media |
| Store / product browsing | 8/10 | 5/10 | image-first commerce cards |
| Product detail | 7/10 | 5/10 | premium media stage + purchase hierarchy |
| Login / register | 7/10 | 4/10 | branded environment + calm form |
| Order creation | 6/10 | 6/10 | branded but stable task frame |
| Order/payment/pickup | 5–6/10 | 6/10 | state + next action first |
| Org select/dashboard/settings | 5/10 | 7/10 | grouped surfaces + selective bento |
| Catalog/staff/campaign management | 4–5/10 | 8/10 | compact modern workspaces |
| Orders/payments/pickups queues | 3–4/10 | 8/10 | dense task-first resource lists |
| Audit / platform users | 2–3/10 | 8/10 | restrained read-only data |
| Platform governance | 3–4/10 | 8/10 | authority and pending work first |

Motion target: **3/10**.

## Core visual signatures

### Ambient commerce canvas

Customer pages use a soft visual environment instead of a flat document.

Allowed:
- warm off-white foundations,
- pale lavender / sky / mint environment fields,
- large colored section blocks,
- occasional dark-indigo premium sections,
- controlled gradients behind hero/media zones.

Do not wrap every section in a bordered card.

### Block + bento rhythm

Bento creates hierarchy; it is not a mandatory template.

Wide-screen examples:
- compact tile: 1×1,
- feature tile: 2×1,
- media tile: 1×2,
- visual anchor: 2×2.

Customer discovery may use irregular spans. Operational pages should preserve predictable reading order.

### Soft dimensional media

Use soft 3D/clay-inspired objects, product cutouts, abstract commerce/campus objects, soft cast shadows, and simple material lighting.

Default implementation priority:
1. optimized static WebP/PNG/SVG,
2. CSS layering,
3. interactive 3D only when a concrete product need justifies it.

### Product-first commerce cards

Where real media exists, hierarchy is:
1. media,
2. identity,
3. authoritative price/state,
4. concise metadata,
5. primary next action.

### Rounded but structured geometry

Use visibly larger radii than v2, but vary them by role. Controls must remain ergonomic and should not become pill-shaped by default.

### Purposeful soft depth

Depth communicates elevation, overlap, selected/focused hierarchy, overlay priority, and premium media framing. Do not shadow every operational row.

### Low-chrome navigation

Navigation should be quieter than product/media content. Customer navigation is light and compact; operational navigation is predictable and scope-aware.

### Strong Thai hierarchy

Use type scale, weight, line length, spacing, and color to create character. Do not introduce a Latin-only display family that causes Thai fallback mismatch.

## Color system

The final semantic palette defined here must be implemented in `src/app/globals.css` during the foundation phase.

### Light foundation

- canvas: `#F7F5FF`
- surface: `#FFFFFF`
- raised: `#FCFBFF`
- muted: `#F1EEF8`
- inset: `#ECE8F5`
- strong neutral: `#E4DEEE`
- line: `#D8D0E8`
- ink: `#1F1B2D`
- ink-secondary: `#5B5668`
- ink-tertiary: `#736D7F`

### Brand identity

- brand: `#6D3AE0`
- brand-hover: `#5930C3`
- brand-strong: `#3B1B78`
- brand-soft: `#EEE7FF`
- brand-soft-strong: `#DED2FF`
- on-brand: `#FFFFFF`

Purple/indigo represents UniStore identity, not semantic success.

Measured reference contrast:
- brand / white: **6.30:1**
- brand-hover / white: **7.97:1**
- ink / canvas: **15.53:1**
- secondary ink / canvas: **6.54:1**

### Expressive support families

These are visual accents, not semantic states.

- lavender: `#EDE7FF`
- sky: `#DFF3FF`
- sky-strong: `#73C8F2`
- mint: `#DFF7EC`
- teal-soft: `#DDF4F1`
- coral: `#FFE2D6`
- coral-strong: `#E66A3D`
- yellow: `#FFF1BA`

Use for hero/media backdrops, category blocks, campaign features, illustration stages, and discovery bento composition.

### Semantic states

- success: `#16794A`
- success-soft: `#E4F5EB`
- warning: `#8A4B00`
- warning-soft: `#FFF0CF`
- danger: `#B7353D`
- danger-soft: `#FDE8EA`
- info: `#1769AA`
- info-soft: `#E4F2FF`

Measured text-on-soft contrast:
- success: **4.80:1**
- warning: **6.03:1**
- danger: **4.99:1**
- info: **5.07:1**

State always includes text/semantics. Color is reinforcement only.

### Dark mode

- canvas: `#151220`
- surface: `#1B1727`
- raised: `#211C30`
- muted: `#282239`
- inset: `#100D18`
- line: `#3C3450`
- ink: `#F5F1FF`
- ink-secondary: `#C8C1D8`
- ink-tertiary: `#A39BAD`
- brand: `#B39CFF`
- brand-hover: `#C2B0FF`
- on-brand: `#17101F`
- success: `#73D8A4`
- success-soft: `#173527`
- warning: `#F7C15B`
- warning-soft: `#3A2A12`
- danger: `#FF9AA0`
- danger-soft: `#442026`
- info: `#8CCBFF`
- info-soft: `#17304A`
Measured reference contrast:
- dark ink / canvas: **16.60:1**
- dark secondary / canvas: **10.60:1**
- dark brand / on-brand: **8.06:1**

Dark mode preserves hierarchy; it does not literally invert every pastel.

## Gradient policy

Gradients are allowed as **major visual-zone treatments**, not generic component backgrounds.

Recommended families:

- hero: `linear-gradient(135deg, #6D3AE0 0%, #8B6EF5 48%, #73C8F2 100%)`
- soft ambient: `linear-gradient(135deg, #F4EDFF 0%, #EAF7FF 52%, #EAF8F0 100%)`
- warm discovery: `linear-gradient(135deg, #FFF1BA 0%, #FFE2D6 52%, #EDE7FF 100%)`
- dark premium: `linear-gradient(135deg, #21143F 0%, #352064 55%, #19344D 100%)`

Allowed:
- marketplace hero,
- large campaign/category feature,
- illustration stage,
- ambient section transition,
- premium dark field,
- media placeholder.

Avoid on fields, tables, queue rows, routine badges, error states, and ordinary operational surfaces.

## Typography

Primary family: `Noto Sans Thai`

Fallback: `"Leelawadee UI", Tahoma, sans-serif`

Technical identifiers may use monospace only when genuinely machine/reference-oriented.

### Weight
- 400 body,
- 500 labels/navigation/controls,
- 600 card and section titles,
- 700 major display/total/brand moments.

### Desktop scale
- caption: 12/18,
- body small: 14/21,
- body: 16/25,
- comfortable body: 17/27,
- card title: 20/28,
- section title: 28/36,
- operational page title: 32/40,
- customer display: 52/60,
- large hero: 60/68 when layout permits.

### Mobile scale
- caption: 12–13px,
- body small: 14px,
- body: 16px,
- card title: 18px,
- section title: 24–28px,
- page title: 28–32px,
- display: 36–42px.

Use responsive `clamp()` where useful.

## Spacing

Base unit: **4px**

Canonical scale:
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120`

Customer:
- section gap 64–96px desktop,
- card gap 16–24px,
- hero padding 40–72px.

Operations:
- section gap 24–40px,
- row gap 8–12px,
- control groups 8–16px,
- compact card padding 16–20px.

## Radius

Canonical:
- xs: 8px,
- sm: 12px,
- control: 14px,
- card: 20px,
- feature: 28px,
- hero: 32px,
- pill: 999px only for chip/status/category semantics.

Typical use:
- button/field: 12–14px,
- routine card/panel: 20px,
- feature/media card: 24–28px,
- hero/environment block: 28–32px.

## Borders

Borders are structural helpers, not the main visual language.

Use for inputs, tabular separation when needed, selected/active emphasis, dense operational boundaries, and overlays that need definition.

Default separation order:
1. surface color,
2. spacing,
3. elevation,
4. border only where needed.

Avoid a thin grey outline around every customer card.

## Elevation

Canonical scale:
- base: none,
- raised: `0 6px 18px rgb(43 28 77 / 10%)`,
- feature: `0 16px 40px rgb(43 28 77 / 14%)`,
- overlay: `0 28px 70px rgb(20 14 36 / 24%)`.

Use shadow to communicate hierarchy, not as decoration on every row.

## Layout widths

- prose/focused form: 720px,
- transaction narrow: 900px,
- customer default: 1280px,
- customer wide visual: 1360px,
- application default: 1240px,
- operational wide: 1440px.

Horizontal gutters:
- 320–374: 16px,
- 375–767: 20px,
- 768–1023: 24px,
- 1024+: 32–40px by archetype.

## Bento grid

Desktop: 12 columns.
Tablet: 6 columns.
Mobile: 1 column by default.

A safe 2-column mobile grid is allowed only for genuinely compact content at 375px+.

Requirements:
- no clipping,
- no fixed tile height when Thai copy can wrap,
- no decorative overflow causing page scroll,
- feature content appears before minor utility content,
- primary CTA remains reachable.

## Media and illustration

### Brand-environment assets

Examples:
- parcel,
- shopping bag,
- campus merchandise object,
- payment/pickup metaphor,
- abstract rounded geometry.

Use in landing hero, discovery bento, auth brand panel, and major empty states.

### Product/store media

Real backend media is authoritative.

Reserve aspect ratio, use object-fit intentionally, and do not recolor real product imagery for brand consistency.

### Fallback media

Use generic category-aware visual treatment. Never imply a specific nonexistent product or inventory item.

### Accessibility

Informative media has meaningful alt derived from real entity context.

Decorative media:
- empty alt or presentational,
- not focusable,
- `pointer-events: none`,
- never obscures controls/text.

### Performance

Prefer responsive WebP/PNG/SVG, explicit dimensions/aspect ratio, lazy loading below fold, and mobile-sized variants when practical.

Do not add real-time 3D runtime merely for visual polish.

### Implemented media primitives

- `BrandIllustration` is the shared lightweight clay/dimensional environment system. Supported variants are `market`, `parcel`, `product`, `payment`, `pickup`, and `notification`.
- Brand illustrations are CSS/token driven rather than copied reference art or runtime 3D. They inherit light/dark design tokens, reserve their own aspect ratio, and never fetch remote art.
- Decorative `BrandIllustration` is hidden from assistive technology and never captures pointer input. Set `decorative={false}` only with a real `label` when the illustration itself communicates information.
- `MediaFallback` combines a generic decorative illustration with visible fallback copy such as `ยังไม่มีรูปสินค้า`. It must never suggest a specific nonexistent item, seller, brand, or inventory state.
- Real backend product imagery always wins over fallback media. Listing images stay lazy-loaded; above-fold detail imagery may load normally. Existing backend URLs and object ownership rules are unchanged.
- `EmptyState.media` is optional and should be used only for major customer-facing empty states where a small visual improves orientation. Dense operational/admin empty states stay quieter unless the illustration materially helps the task.
- Page-specific hero/auth scenes should compose these shared primitives instead of duplicating bespoke decorative object CSS.

## Icons

Use one project-local vector language with `currentColor` and consistent 16/20/24px sizing.

No emoji structural controls. Icon-only controls require accessible names. Decorative icons beside visible text are hidden from assistive technology.

## Motion

Motion target: **3/10**

Tokens:
- fast: 120ms,
- standard: 180ms,
- expressive: 240ms,
- standard easing: `cubic-bezier(.2, .8, .2, 1)`.

Allowed:
- 1–3px hover lift,
- subtle image scale,
- slight press compression,
- drawer/dialog transitions,
- short reveal/fade,
- state completion feedback.

Avoid continuous floating, mouse-follow, scroll-jacking, multi-layer parallax, exaggerated bounce, and animation on dense operational rows.

Respect `prefers-reduced-motion`.

## Controls

Target heights:
- compact desktop: 36px,
- standard desktop: 40px,
- comfortable/form: 44px,
- mobile standard: 44px,
- mobile comfortable: 48px.

Controls require hover where relevant, pressed, focus-visible, disabled, pending, and an accessible name.

Adjacent touch controls should normally have at least 8px separation.

## Buttons

Primary uses brand fill. Secondary uses neutral or brand-soft surface. Destructive uses danger semantics.

One dominant primary action per local task context.

Do not use pill buttons by default. Pending actions prevent duplicate submission.

## Forms

Keep the v2 accessibility/recovery architecture:
- visible labels,
- placeholder is not label,
- semantic hint/error association,
- on-blur validation for most fields,
- clear recovery text,
- read-only differs from disabled,
- pending submit prevents duplicate action,
- password manager/paste/autofill remains available.

Failed submit:
- simple form: focus first invalid field,
- complex form: focusable error summary + linked invalid fields + inline errors.

Visual treatment:
- soft inset surface,
- clear boundary,
- brand focus ring,
- 12–14px radius.

No glassy or gradient form fields.

## Navigation

Navigation authority remains `src/modules/auth/navigation.ts`.

### Customer desktop
- compact top nav,
- brand left,
- marketplace destinations center/left,
- account/actions right,
- header visually quieter than hero/product media.

### Operational desktop
- persistent sidebar allowed,
- current organization/platform scope obvious,
- predictable grouping,
- selected state by shape + text weight, not color alone.

### Mobile
- compact top bar,
- drawer/sheet for many destinations,
- bottom navigation only when a route group genuinely has 3–5 primary destinations,
- route choice closes the menu,
- current area remains understandable with menu closed.

### Implemented shell pattern

- public/storefront navigation uses a low-chrome floating rounded header with selected destinations shown as a contained surface rather than a heavy app bar,
- authenticated organization/customer/platform areas use one persistent desktop sidebar with a raised brand block, explicit current scope, grouped navigation, and account/context actions at the bottom,
- active destinations use text weight + a filled state dot + an inset accent edge so the current page is not communicated by color alone,
- organization switching remains an explicit route action rather than a hidden context menu,
- platform scope reuses the same geometry with the semantic info accent so governance feels authoritative without becoming a separate design system,
- at 900px and below the sidebar becomes a modal drawer with scroll lock, inert background content, focus trapping, Escape close, focus return, safe-area footer spacing, and the current destination visible in the compact top bar.

### Implemented public landing pattern

- lead with one focused branded commerce hero rather than a stack of same-weight marketing sections,
- keep the purchase journey outside the hero as a compact pastel block strip,
- use actual loaded stores for the first discovery bento; never imply popularity or ranking unless backend data explicitly supports it,
- desktop discovery may use one large feature tile plus asymmetric supporting tiles, but mobile must collapse to a clear single reading order,
- keep the complete organization/store list after the expressive discovery layer so discovery never replaces authoritative navigation,
- loading states should reserve the approximate discovery footprint with shared skeletons before data arrives,
- error states should provide an in-place retry when the same safe GET operation can be repeated.

### Implemented authentication pattern

- login/register use one branded split environment: a premium dark identity panel on the left and a calm raised form surface on an ambient background on the right,
- the brand panel may use CSS-only clay/dimensional account, parcel, orb, and ticket shapes; all decorative objects are hidden from assistive technology and never imply real inventory or account state,
- login/register introductory copy remains product/task copy rather than promotional social proof,
- the account journey is visible as three compact supporting blocks on tablet/desktop and is removed on narrow mobile to keep the form close to the top of the reading order,
- the form itself remains visually quieter than the brand side: labels, native text fields, password visibility, focused error summary, server error notice, primary submit action, account switch, and return path,
- password fields retain password-manager-friendly autocomplete values (`current-password` for login and `new-password` for registration), paste remains unrestricted, and email/name autocomplete remains intact,
- no field receives automatic initial focus; failed submit moves focus only to the focusable error summary while inline errors remain associated with fields,
- authenticated entry state reuses the same form panel and shows real user identity plus only destinations permitted by existing membership/session state,
- mobile auth keeps the dimensional brand cue but removes the supporting journey blocks; all visible interactive controls remain at least 40px tall in rendered checks and primary controls follow the shared 44px+ target.

## Cards

Use role-specific card patterns.

### Commerce card
Image-led, 20–28px radius, light elevation, concise metadata, strong price/state/action hierarchy.

### Implemented store/campaign/product pattern

- store detail uses a branded commerce hero with a decorative clay shopping object plus real campaign/product counts; decorative shapes are hidden from assistive technology,
- campaign detail uses a dark premium hero only for campaign context/state, with the authoritative status panel remaining a readable surface above the decorative background,
- campaign cards use abstract dimensional visual zones but only real campaign name, status, and schedule data,
- product cards reserve a 4:3 media stage, contain real backend product imagery without recoloring/cropping it, and keep starting price + active option count visible near the action,
- product cards stay uniform within listing grids; asymmetry is reserved for discovery surfaces where it improves hierarchy instead of creating empty card height,
- product detail uses a large contain-fit media stage, starting-price/variant/campaign facts, then one purchase configuration surface,
- product media may create internal decorative visual overflow, but route containers must clip that paint overflow without turning the section into a scroll container or breaking desktop sticky media,
- campaign schedule is shown as four semantic pastel milestone blocks using the real backend dates,
- no rating, review count, popularity, stock claim, seller badge, or fabricated product imagery is introduced.

### Discovery tile
Bento-compatible, expressive color field, minimal copy, optional dimensional object.

### Transaction card
Calmer surface, status/totals first, lower decoration.

### Operational resource row/card
Compact, low/no elevation, clear state/reference/time/action alignment.

### Summary block
Only actionable or decision-useful information. No generic KPI wall.

## Lists and tables

Use table semantics only for actual tabular comparison.

Use resource-list rows when users are finding and acting on objects.

Operational priority:
1. state,
2. identifier,
3. entity/customer,
4. amount/count,
5. time,
6. next valid action.

Mobile tables use a scroll container or task-appropriate card/list alternative.

## Filters and search

Customer filters/search integrate with discovery and may be prominent when discovery is the primary task.

Operational filters stay close to data, compact, show active filters, and provide a clear reset.

Async filter changes provide one contextual result announcement, not competing live regions.

## Status and next action

Transaction/operations hierarchy:
1. authoritative state,
2. human meaning,
3. valid next action,
4. required references,
5. supporting history.

Never invent a next step unsupported by Backend state. Color is never the only status signal.

## Loading, empty, error, forbidden

Keep orientation visible.

Every state should explain:
- what is happening,
- whether the user can act,
- what to do next.

Customer empty states may use small brand illustrations. Operational empty states remain concise and task-focused.

## Page archetypes

### Marketplace landing
`low-chrome nav -> expressive hero -> discovery/search bridge -> bento/category/store/campaign discovery -> real marketplace content`

### Store / campaign listing
`identity/context -> discovery/filter -> image-led cards -> pagination/state`

### Product detail
`media stage | title/variant/state/price/action -> supporting facts -> store/campaign context`

### Authentication
`brand environment | calm form surface`

### Implemented order-creation pattern

- checkout uses a premium dark transaction header for orientation, then a calm two-column review + confirmation layout,
- the left review surface shows the real store, product image/description, selected variant, campaign state, unit price, close time, and payment deadline,
- backend product imagery stays contain-fit inside a reserved 4:3 commerce media stage; missing imagery uses the shared brand-aware placeholder treatment,
- the confirmation surface is sticky only on wide desktop and becomes normal flow below 1024px,
- estimated total is explicitly labeled as an estimate and displays the real unit-price × quantity breakdown; backend remains authoritative for the persisted total,
- quantity validation retains the focusable ErrorSummary and linked inline error; invalid quantity never calls createOrder,
- recoverable context-loading failures provide an in-place retry without changing query identifiers or API contracts,
- on narrow mobile the final confirmation action becomes a safe-area-aware sticky action area inside the form so the primary submit remains reachable,
- successful creation switches immediately to authoritative backend order status/total, next-action guidance, payment CTA where applicable, and order-detail/product links,
- no client-side discount, inventory, shipping, fee, tax, or unsupported pricing calculation is introduced.

### Implemented customer order-tracking pattern

- `/my/orders/` begins with one dark premium customer-order hero, followed by a compact bento overview for actionable count, loaded-count, and explanatory guidance,
- order rows are independent raised commerce surfaces rather than a ledger table; actionable orders receive stronger brand emphasis and an explicit continuation action without changing backend ordering,
- list rows always keep authoritative status, backend total, created/updated timestamps, order identifier, and server-derived next-action guidance visible,
- recoverable initial-load failures retry in place; pagination failure remains local to the load-more action and does not discard already loaded orders,
- `/my/order/` uses a premium order hero with backend total and last-updated time, then shared TaskStatus for the authoritative current state and next action,
- the canonical four-step journey remains payment -> confirmation -> production -> pickup; cancelled orders do not fabricate a journey,
- journey state is expressed through text, number, surface, and tone rather than color alone; current/done/upcoming semantics and `aria-current="step"` remain intact,
- recorded order items stay a dense read-only list with quantity, unit price, and recorded line total; mobile converts columns into labeled rows rather than horizontal overflow,
- subtotal/total presentation is visually prominent but never recalculated on the client,
- customer cancellation remains visible only for the existing cancellable states, requires confirmation, and refreshes authoritative order state after success or a conflict,
- a cancellation conflict keeps the last known order visible, reports the conflict, then attempts to refresh the backend state before deciding which actions remain available,
- payment/pickup shortcuts continue to derive exclusively from existing customer guidance and order status.

### Implemented payment / pickup / notification pattern

- `/my/payment/` uses the transaction hero language with the persisted backend total prominent, followed by authoritative payment state and three real payment facts,
- payment proof upload remains a single-task raised surface with accepted file types, selected-file feedback, visible multi-stage progress, announced failure/success feedback, and a mobile-safe sticky submit area,
- payment upload contract remains presign -> direct PUT without application JWT -> persist the backend-issued objectKey -> refresh authoritative order/payment state; client-generated file URLs or totals are never substituted,
- recoverable payment-context failures retry in place; an expired direct-upload URL is recovered by starting the existing submit flow again so a fresh presign is requested,
- `/my/pickup/` treats the QR/token pair as a presentation credential only: the QR is generated locally from the backend pickup token and the token remains visible/selectable as the fallback,
- QR generation failure must never hide the backend token; long token text must wrap without horizontal overflow,
- not-ready pickup state rechecks authoritative order state in place rather than requiring a full page reload, while pickup data is not requested before the order status allows it,
- customer pickup surfaces never expose a confirmation mutation; Staff/Admin confirmation remains the only authoritative receive action,
- `/notifications/` uses event cards with unread emphasis, real loaded/unread counts, filter controls, manual refresh, local mark-read feedback, and paginated continuation,
- notifications remain event signals rather than authoritative order/payment/pickup state; the UI states this explicitly and does not infer current state from an old notification,
- notification filters wrap/collapse without clipping; read/unread state is communicated with text plus visual treatment, not color alone.

### Implemented organization home / settings pattern

- `/org/select/` uses a branded operational hero with an authoritative accessible-organization count, then separates existing memberships from the create-organization task,
- accessible organizations are presented as raised workspace cards with backend organization status, membership role, description, identifier, and one explicit enter action; membership joining/filtering rules remain unchanged,
- creating an organization remains a separate sticky task on wide layouts and moves into normal flow on constrained layouts; validation retains labeled fields, blur feedback, focusable ErrorSummary, and backend-driven post-create membership refresh,
- recoverable organization-list failures retry in place without clearing authentication or changing remembered-organization semantics,
- `/org/dashboard/` uses one restrained operational hero followed by an asymmetric action board rather than a generic equal metric-card wall,
- dashboard visual priority is: pending payment reviews -> paid orders -> paid revenue -> store/product resource shortcuts -> report scope -> status breakdowns,
- all dashboard counts, revenue, campaign/order status buckets, and filter results remain backend report values; the client only formats and arranges them,
- report filters remain campaignId/storeId only, are trimmed before request, announce the applied scope, preserve a clear reset, and do not change organization authorization context,
- `/org/settings/` separates editable display fields from immutable governance facts; status, membership authority, and transaction authority are visibly outside this form's scope,
- organization settings keep only name/description editable, retain save success/error feedback and focusable validation summary, and never expose Platform Admin status controls,
- organization reference metadata uses real id/createdAt/updatedAt values and wraps safely at narrow widths,
- operational responsive collapse happens early enough for the authenticated shell: organization workspace/settings collapse by 1100px and the dashboard action/resource board by 1180px so 1024px does not produce narrow unusable columns.

### Customer transaction
`product/order summary -> authoritative state -> next action -> totals -> references/history`

### Organization dashboard
`scope -> attention/workload -> actionable grouped summaries -> supporting shortcuts`

### Operational resource page
`task header -> filters/search -> resource list/table -> selected detail/action`

### Management workspace
`scope -> entities/config -> editor/create task -> supporting state`

### Audit / read-only ledger
`scope -> filter/search -> dense read-only records -> metadata inspection`

### Platform governance
`platform scope -> pending/attention work -> organizations/actions -> read-only supporting data`

## Customer vs operations

Customer surfaces favor whitespace, imagery, color fields, concise copy, and an obvious primary CTA.

Transactions reduce decoration and prioritize state, total, and next action.

Organization operations favor dense scanability, compact filters, selected state, one primary action, destructive separation, and quieter metadata.

Platform Admin surfaces emphasize Platform scope, authority, pending decisions, and calm read-only data.

## Responsive contract

Support **320px and above**.

Mandatory review widths:
- 320,
- 375,
- 768,
- 1024,
- 1440.

Invariants:
- no unintended page horizontal overflow,
- no clipped primary action,
- no unreachable control,
- focus is not hidden under sticky/fixed UI,
- long identifiers wrap safely,
- dialogs keep title/actions reachable,
- action groups recompose instead of shrink,
- bento spans collapse intentionally,
- decorative media scales/repositions/disappears rather than covering content,
- true tables use containment or alternate mobile composition,
- mobile navigation remains discoverable,
- desktop split views become explicit list → detail flow.

Implemented responsive/motion safeguards:
- semantic layout containers and form controls use `min-width: 0` so grid/flex children can shrink instead of forcing page overflow,
- long headings/copy/labels may wrap with `overflow-wrap: anywhere` only when normal wrapping cannot contain the content,
- <=620px uses 44–48px control targets; <=360px tightens gutters/padding without shrinking interactive targets,
- coarse-pointer controls keep minimum touch height and adjacent mobile controls should retain an 8px gap where they form a control group,
- hover-only transforms are suppressed on non-hover devices; no required action or state is hover-dependent,
- true tables retain a bounded, keyboard-focusable horizontal scroll container with touch panning rather than widening the page,
- reduced motion globally collapses transition/animation duration and page-specific rules must still remove transform-based hover movement where needed.

## Accessibility baseline

Required:
- semantic HTML first,
- logical headings,
- keyboard operability,
- visible focus,
- focus not obscured,
- labels and accessible names,
- non-color-only status,
- reduced motion,
- predictable dialog focus return,
- password-manager/paste-compatible auth,
- pointer targets respected,
- alternatives for drag/swipe if introduced,
- contextual live updates rather than many live regions.
Rendered contrast must be checked after implementation because gradients/compositing can change effective contrast.

Phase 23 measured contrast anchors:
- light `ink / surface`: **16.76:1**; `ink-secondary / surface`: **7.06:1**; `ink-tertiary / surface`: **4.97:1**,
- light `brand-on / brand`: **6.30:1**; `focus / surface`: **6.30:1**; `focus / canvas`: **5.84:1**,
- dark `ink / surface`: **15.78:1**; `ink-secondary / surface`: **10.08:1**; `ink-tertiary / surface`: **6.55:1**; `focus / surface`: **7.61:1**,
- semantic pairs remain at or above 4.8:1 for success/warning/danger/info text on their soft surfaces,
- `--on-dark-tertiary` is 76% white so normal-size tertiary text remains at least **4.63:1** against the lightest `#236188` endpoint used by the canonical dark hero gradient.
Decorative media never interferes with reading/focus order.


## Z-index

- base: 0,
- content overlap: 10,
- sticky: 20,
- navigation: 40,
- overlay/backdrop: 50,
- dialog: 60,
- toast: 80,
- skip link: 100.

Decorative media normally stays below interactive content.

## Project contract guardrails

Visual redesign must not change:
- API routes,
- DTO meanings,
- role names,
- membership/tenant authority,
- Backend-authoritative authentication/authorization,
- Platform Admin authority from persisted `user.platformRole`,
- 403 handling semantics,
- query-parameter entity routing,
- static export,
- Campaign lifecycle,
- Order lifecycle/cancellation rules,
- Payment review authority,
- Pickup authority,
- customer pickup presentation-only behavior,
- direct S3 presign -> direct PUT without JWT -> persist Backend-issued key,
- integer-satang price semantics,
- opaque cursors,
- notification events as signals rather than current-resource authority.

`organizationId` in query/navigation remains context only, never authorization proof.

## Shared implementation rule

There is one design system.

Shared primitives own buttons, fields, notices, badges, dialogs, error summaries, table/resource patterns, state treatments, loading/empty/error states, common media shells, and focus behavior.

Page-specific CSS is for composition, not recreating generic controls or semantics.

## Explicit anti-patterns

Reject:
- flat grey legacy-admin appearance,
- thin grey outline around every block,
- automatic equal-card rows,
- decorative eyebrow/kicker on every section,
- giant operational hero headings,
- one radius everywhere,
- one shadow everywhere,
- gradient on every component,
- full-page glassmorphism,
- random category colors,
- ornamental 3D on every screen,
- exact copying of source references,
- fake ratings/reviews/sales/user counts/social proof,
- invented product imagery,
- hover-only essential controls,
- mouse-follow,
- continuous parallax,
- scroll-jacking,
- inaccessible drag-only interaction,
- shrinking touch targets for compactness,
- hiding state/action clarity for aesthetics,
- playful bento that breaks operational scan order,
- illustration blocks above urgent queues,
- meaningless KPI walls.

## v2 behavior retained

v3 replaces the restrained v2 visual language, not the successful behavioral UX.

Keep:
- task/next-action clarity,
- backend-authoritative state,
- semantic timestamps,
- numeric presentation,
- complex-form error summaries,
- inline validation,
- focus recovery,
- confirmation for risky actions,
- contextual live status,
- direct-upload behavior,
- permission/scope clarity,
- responsive overflow protection,
- static-export architecture.

## Reference use rule

Before implementing a major archetype:
1. read this file,
2. re-open the relevant canonical URLs in `.interface-design/visual-reference-brief.md`,
3. run focused `ui-ux-pro-max` search when useful,
4. use the reference brief as evidence,
5. implement according to this system,
6. record reusable deviations here.

Reference emphasis:
- landing/discovery: R5 + R3 + R4,
- listing: R2 + R4,
- product detail: R2 + R1,
- auth: R1 + R4,
- transaction: R1 + R4,
- org dashboard/catalog: R4 + restrained R3,
- operations queues: material language only, task clarity first,
- platform governance: restrained R1/R4.

## Implementation sequence

1. prototype representative archetypes,
2. rebuild global foundations,
3. shared primitives,
4. shell/navigation,
5. customer discovery,
6. customer transactions,
7. organization management,
8. organization operations,
9. platform governance,
10. illustration/media system,
11. responsive/motion polish,
12. accessibility/performance/design audit,
13. regression/static-export verification,
14. final diff review.

## v3 decision checklist

Implementation is aligned only if:
- purple/indigo is the brand anchor, not success,
- customer pages use vibrant block-based commerce selectively,
- bento is selective and intentional,
- soft 3D/clay is primarily media/brand language,
- real-time 3D is not the default,
- gradients are major-zone treatments,
- Noto Sans Thai remains canonical,
- discovery is expressive,
- transactions are calmer,
- operations stay dense and task-first,
- platform governance is restrained and scope-explicit,
- semantic colors remain separate,
- accessibility behavior from v2 remains,
- no fabricated marketplace content is introduced,
- backend/API/security/static-export contracts remain unchanged.
