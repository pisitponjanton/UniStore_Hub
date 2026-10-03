# UniStore Hub UX/UI Skills

This project keeps UX/UI agent skills locally under `.agents/skills/`. Most are Markdown guidance; `ui-ux-pro-max` also includes its searchable datasets and Python tooling.

## Installed

### Existing project skill

- `interface-design/SKILL.md`
  - Product-interface craft, hierarchy, tokens, states, responsive behavior, accessibility, and design-system consistency.
  - UniStore Hub decisions remain in `.interface-design/system.md`.

### Added for UX/UI redesign

- `ui-ux-pro-max/SKILL.md`
  - Source: `nextlevelbuilder/ui-ux-pro-max-skill`
  - Vendored upstream revision: `09170eec67eefd46a7ae85de61b40c194020f997`
  - Purpose: design intelligence for style selection, interaction, accessibility, responsive layout, typography, color, forms, navigation, charts, and stack-aware UI guidance.
  - Full local bundle installed:
    - `data/` — searchable product, style, color, typography, UX, icon, motion, chart, React, and stack datasets
    - `scripts/search.py` — domain, stack, and design-system search
    - `scripts/validate_data.py` for local dataset validation
    - `references/quick-reference.md`
    - `references/pro-rules.md`
    - `LICENSE` — upstream MIT license
  - Run from the frontend workspace root with `python3 .agents/skills/ui-ux-pro-max/scripts/search.py ...`.

- `design-review/SKILL.md`
  - Source: `plugin87/ux-ui-agent-skills`
  - Purpose: heuristic/design audit before redesign.
  - Supporting Markdown vendored locally:
    - `workflows/design-review.md`
    - `accessibility/wcag-checklist.md`
    - `taste/design-taste.md`

- `redesign/SKILL.md`
  - Source: `plugin87/ux-ui-agent-skills`
  - Purpose: audit-first redesign of an existing working product without changing behavior.
  - Supporting Markdown vendored locally:
    - `workflows/redesign-audit.md`
    - `taste/design-taste.md`
    - `.claude/rules/tokens-and-color.md`

- `frontend-design/SKILL.md`
  - Source: `anthropics/skills`
  - Purpose: distinctive visual direction and avoiding generic/template-like frontend design.

- `a11y-audit/SKILL.md`
  - Source: `plugin87/ux-ui-agent-skills`
  - Purpose: WCAG 2.2 / ARIA accessibility review after redesign.
  - Supporting Markdown vendored locally:
    - `accessibility/wcag-checklist.md`
    - `accessibility/aria-patterns.md`
    - `taste/motion-choreography.md`

## Recommended order for UniStore Hub

1. Read `interface-design/SKILL.md` and `.interface-design/system.md` for the project authority and current visual direction.
2. Use `ui-ux-pro-max` as the modern design-intelligence reference and run its local search/design-system tool for style fit, interaction, responsive, typography, accessibility, navigation, and stack guidance when relevant.
3. Use `design-review` to identify usability and visual-hierarchy problems in the current implementation.
4. Use `redesign` to plan and apply improvements without changing routes, API contracts, permissions, or business behavior.
5. Use `frontend-design` to improve visual distinctiveness where the interface still feels generic or templated.
6. Use `a11y-audit` after changes to verify keyboard, focus, semantics, contrast, target sizes, and reduced-motion behavior.

## Project authority

These skills are guidance only. They must not override:

- `AGENT.md`
- shared contracts/specifications
- API contracts
- existing authorization/tenant rules
- static-export routing constraints
- `.interface-design/system.md`

If a design recommendation conflicts with a project contract, the project contract wins.

## Full ui-ux-pro-max installation note

`ui-ux-pro-max` now includes its upstream searchable datasets and Python tooling locally. Search output may be used only when the command was actually executed successfully; do not fabricate or paraphrase a database result that was not returned.

The local skill path has been adapted from the upstream Claude-plugin path to this repository's `.agents/skills/ui-ux-pro-max/` layout. Project contracts and `.interface-design/system.md` still remain authoritative over any recommendation returned by the search tool.

The upstream `redesign` skill also mentions `apply-aesthetic`. UniStore Hub already has a reviewed local visual direction in `.interface-design/system.md`; use that and the existing `interface-design` skill as the project visual-direction authority unless a future task explicitly installs or approves another aesthetic skill.
