# Frontend Agent Rules

## Ownership

This agent has **write access only inside**:

```text
frontend/**
```

The agent may create, edit, move, rename, format, or delete files only under `frontend/`.

Everything outside `frontend/**` is **READ-ONLY**.

That includes:

```text
backend/**
infrastructure/**
scripts/**
tests/**
docs/**
SPEC.md
AGENTS.md
README.md
package.json
.gitignore
```

If a required change belongs outside `frontend/**`, do not make the change. Report the dependency/change request for Integration ownership.

## Required Reading

Read before implementation:

1. `../SPEC.md`
2. `../AGENTS.md`
3. `../docs/specs/00-shared-contracts.md`
4. `../docs/api/API_CONTRACT.md`
5. `../docs/specs/frontend/SPEC.md`

For any user-facing UI/UX work, also read:

6. `.agents/skills/interface-design/SKILL.md`
7. `.agents/skills/ui-ux-pro-max/SKILL.md`
8. `.interface-design/system.md` when it exists

Then load the task-specific UX/UI skill when applicable:

- UI structure, style selection, responsive/interaction guidance, typography/color, or stack-specific UI decisions → `.agents/skills/ui-ux-pro-max/SKILL.md` and its local search tool
- UI/UX audit or heuristic review → `.agents/skills/design-review/SKILL.md`
- redesign/polish of an existing working screen or flow → `.agents/skills/redesign/SKILL.md`
- visual-direction work or reducing generic/template-like UI → `.agents/skills/frontend-design/SKILL.md`
- accessibility review or post-redesign QA → `.agents/skills/a11y-audit/SKILL.md`

Each skill may reference additional supporting Markdown under its own directory. Read those dependencies only when that skill requires them; do not make every supporting file global required reading.

Read `../docs/architecture/AWS_ARCHITECTURE.md` only when working on API connectivity, Pre-signed URL flow, or deployment-sensitive behavior.

## Local Inspection Report

After the required canonical reading above, read:

```text
frontend-report.md
```

when the file exists. This is the Frontend Agent's local inspection/handoff report for current findings and planned follow-up context. It is gitignored and is not a canonical source of truth. Verify each finding against the current Frontend working tree before planning or implementing, and defer to the canonical project docs/contracts on any conflict.

## UI / UX Skills

The Frontend Agent uses project-local vendored UX/UI skills under:

```text
.agents/skills/
```

Available UX/UI skills:

- `interface-design/SKILL.md` — primary product-interface craft, hierarchy, tokens, states, responsive behavior, and design-system consistency
- `ui-ux-pro-max/SKILL.md` — searchable design intelligence for style/product fit, color, typography, UX patterns, icons, motion, charts, and stack-specific guidance
- `design-review/SKILL.md` — audit/heuristic review before redesign
- `redesign/SKILL.md` — audit-first redesign of existing working UI while preserving behavior
- `frontend-design/SKILL.md` — visual direction, typography, composition, and reducing generic/template-like design
- `a11y-audit/SKILL.md` — WCAG/ARIA accessibility review and post-redesign QA

Reference index:

```text
.agents/skills/UX-UI-SKILLS.md
```

### UI / UX Workflow

For substantial redesign work, use this sequence unless the task clearly needs only one step:

```text
interface-design + .interface-design/system.md
→ ui-ux-pro-max search/design guidance
→ design-review
→ redesign
→ frontend-design
→ a11y-audit
```

Use the sequence as guidance, not as permission to change unrelated UI or behavior.

Before modifying UI, inspect the current screen/flow and existing shared components first. Reuse the project's existing components, tokens, CSS conventions, and accessibility patterns instead of introducing parallel systems.

For Staff, Organization Admin, and Platform Admin surfaces, keep the direction operational: clear hierarchy, low cognitive load, compact-but-readable data views, obvious primary actions, strong state visibility, and restrained color/depth.

Customer-facing surfaces may be more expressive, but must still feel like the same UniStore Hub system.

### Design-system Authority

`.interface-design/system.md` is the local visual-direction authority once present and reviewed.

Do not create a second design system, theme, token vocabulary, or component family unless the task explicitly requires a reviewed replacement.

When a UX/UI skill recommends something that conflicts with the current system, treat it as a proposal to evaluate, not an automatic override.

### Contract Authority

UX/UI skills are guidance only.

They must not override or invent:

- API routes or request/response shapes
- roles, permissions, membership rules, or tenant authorization
- business rules or state transitions
- authoritative price/payment/pickup behavior
- static-export routing constraints
- shared status/error tokens
- security requirements
- deployment/environment contracts

If a skill recommendation conflicts with canonical project docs/contracts, the canonical project docs/contracts win.

Do not change business behavior merely to make a redesign easier.

### UI/UX Pro Max Local Tooling

The `ui-ux-pro-max` skill is installed with its searchable local dataset and Python scripts under:

```text
.agents/skills/ui-ux-pro-max/
├── data/
├── references/
└── scripts/
```

For substantial visual-direction work, run the local `--design-system` search before implementation. For targeted concerns, use one explicit `--domain` or `--stack` query as described in the skill. Run from the `frontend` workspace root, for example:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "campus commerce operational dashboard" --design-system -p "UniStore Hub"
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "keyboard focus modal" --domain ux
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "responsive forms navigation" --stack nextjs
```

Use search results as design evidence, not as authority over project contracts. Never fabricate a search result; if a query returns no relevant result, retry once as instructed by the skill and then fall back to documented project guidance.

## Responsibilities

Implement the Frontend contract under `frontend/**`, including:

- Next.js + TypeScript
- Static Export
- routes/pages
- feature modules
- forms and client-side validation
- API client integration
- JWT session UX
- role-aware UI visibility
- loading / success / empty / error / unauthorized / forbidden states
- Product Image and Payment Slip upload UX
- Notification UX
- responsive presentation

Backend remains authoritative for auth, tenant rules, ownership, price calculation, status transitions, Payment approval, and Pickup validation.

## Testing

Frontend-local tests belong under `frontend/**` and may be changed by this agent.

Cross-system tests under `../tests/**` are read-only for this agent unless Integration explicitly hands them over.

For non-trivial UX/UI changes, verification should include the relevant local tests plus visual/responsive/accessibility checks supported by the available tooling.

## Shared Contract Rule

Do not silently change API routes, request/response shapes, role/status tokens, tenant rules, file paths, or shared data semantics.

If the Frontend contract conflicts with a shared contract, stop the affected work and report the conflict to Integration.
