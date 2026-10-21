# UniStore Hub Role Journeys and Information Architecture

## Purpose

This document is the UX contract for redesign phases 1–2. It reorganizes presentation around real user work without changing routes, permissions, API behavior, or business transitions.

## Shared orientation model

Every authenticated screen should answer four questions in this order:

1. **Where am I?** Current role/scope, organization or platform context, and page identity.
2. **What is happening?** Authoritative entity status and the most important exception.
3. **What should I do next?** One valid primary action, when one exists.
4. **What evidence do I need?** References, totals, dates, files, and history.

## Customer

**Context:** usually mobile, browsing between classes or checking an order near a payment/pickup deadline.

**Primary goals:** find a store/campaign/product; understand availability, variant, price, and timing; order confidently; submit payment evidence; track status; present pickup information; read relevant notifications.

**Primary journey:** `Storefront → Store → Campaign/Product → Order → Payment → Order status → Pickup`

**Navigation order:** storefront, my orders, notifications, then account/session actions.

**Screen priority:** product/campaign identity → availability/price → selected variant → primary action → supporting details.

## Staff

**Context:** repeated desktop/tablet work at a shop or pickup point; speed and error prevention matter more than discovery.

**Primary goals:** see work requiring attention; process order and production queues; inspect payment evidence within granted capability; verify pickup safely and avoid duplicate completion.

**Primary journey:** `Organization scope → Operational queue → Record → Valid transition → Updated queue`

**Navigation order:** active organization context, then orders, payments, production, and pickups available to the current membership.

**Screen priority:** pending count/filter → oldest or most urgent work → record state/reference → allowed action → history.

## Organization Admin

**Context:** manages one organization and may also perform operational work.

**Primary goals:** maintain organization details and staff; configure stores, products, variants, and campaigns; oversee orders, payments, production, and pickups; inspect audit evidence and exceptions.

**Primary journey:** `Organization dashboard → Configure commerce → Open campaign → Monitor operations → Audit`

**Navigation groups:**

1. Organization — overview, settings, staff.
2. Store and campaign — stores, products, campaigns.
3. Operations — orders, payments, production, pickups.
4. Audit — organization audit log.

**Screen priority:** organization scope → required decisions/exceptions → current campaign/operational state → management actions → history.

## Platform Admin

**Context:** cross-organization governance. Platform scope must be unmistakable and separated from organization operations.

**Primary goals:** review organization applications/status; approve or suspend through documented actions; inspect platform users and governance context; avoid accidental organization-scoped action while in platform scope.

**Primary journey:** `Platform overview → Pending organization → Review evidence → Govern → Verify result`

**Navigation order:** platform overview, organizations, users. Customer destinations remain available only as a separate group when appropriate.

**Screen priority:** platform scope → pending governance work → organization/user identity → allowed decision → audit context.

## Information architecture rules

- Existing URLs remain canonical; screen labels do not invent endpoint names.
- Scope and role are visible before task navigation.
- Organization switching is explicit, never hidden in an ambiguous avatar menu.
- A user with multiple roles sees separated groups, not a merged permission soup.
- The active group and active destination are communicated with shape/text plus color.
- Public/storefront navigation stays short; deep commerce context appears inside the page, not in the global bar.
- Desktop operational navigation remains persistent; mobile uses the existing accessible drawer.
- Breadcrumbs are used only when parent/child context adds recovery value; they do not duplicate global navigation.
- Notifications are a task destination, not a decorative counter-only control.

## Shared page anatomy

1. Scope/context line.
2. Page title and concise purpose.
3. Authoritative status or summary.
4. Primary and secondary actions.
5. Filters or form controls.
6. Main record/list content.
7. Supporting metadata, history, or audit evidence.

Customer discovery pages may put media before the context line when real product imagery is the primary decision input. Operational pages do not.

## State and recovery rules

- Loading reserves the expected layout and identifies what is loading.
- Empty states distinguish “no data yet” from “no results for this filter.”
- Errors state what failed, what remains safe, and the next recovery action.
- Unauthorized prompts for authentication without implying permission.
- Forbidden explains lack of access without exposing protected data.
- Successful mutations confirm the result and update or re-fetch authoritative state.
- Destructive or irreversible actions require clear entity context and confirmation according to the existing flow.

## Phase 1–2 acceptance criteria

- All four roles have explicit goals, task sequence, navigation order, and screen priority.
- Customer, organization, and platform scopes remain visually distinct without separate design systems.
- No route, role token, permission, status token, or API shape is changed.
- The model supports keyboard, mobile, loading, empty, error, unauthorized, and forbidden states.
