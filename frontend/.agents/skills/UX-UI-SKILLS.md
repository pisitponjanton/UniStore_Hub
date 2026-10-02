# UniStore Hub UX/UI Skills

This project keeps UX/UI agent skills as vendored Markdown under `.agents/skills/`.

## Installed

### Existing project skill

- `interface-design/SKILL.md`
  - Product-interface craft, hierarchy, tokens, states, responsive behavior, accessibility, and design-system consistency.
  - UniStore Hub decisions remain in `.interface-design/system.md`.

### Added for UX/UI redesign

- `ui-ux-pro-max/SKILL.md`
  - Source: `nextlevelbuilder/ui-ux-pro-max-skill`
  - Purpose: design intelligence for style selection, interaction, accessibility, responsive layout, typography, color, forms, navigation, charts, and stack-aware UI guidance.
  - Supporting Markdown vendored locally:
    - `references/quick-reference.md`
    - `references/pro-rules.md`
  - Markdown-only install: upstream searchable CSV data and Python search scripts are intentionally not vendored. Use the local Markdown references directly and do not claim a database/search result unless the full upstream bundle is installed later.

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
2. Use `ui-ux-pro-max` as the modern design-intelligence reference for style fit, interaction, responsive, typography, accessibility, navigation, and polish.
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

## Markdown-only installation note

The requested install is Markdown-only. Upstream executable verification/search scripts and searchable data catalogs are not vendored here.

If an upstream skill refers to a script or searchable database that is not present, do not fabricate a measured or searched result. Use the vendored Markdown references plus available project/browser/test tooling, or report that the item requires the full upstream bundle.

The upstream `redesign` skill also mentions `apply-aesthetic`. UniStore Hub already has a reviewed local visual direction in `.interface-design/system.md`; use that and the existing `interface-design` skill as the project visual-direction authority unless a future task explicitly installs or approves another aesthetic skill.
