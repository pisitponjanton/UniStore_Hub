# Accessibility Audit — UniStore Hub Frontend

Scope: redesigned frontend surfaces through Phase 16, reviewed against the installed WCAG 2.2 / ARIA guidance in `.agents/skills/a11y-audit`.

This is a source-level and automated-test audit. The project does not contain `scripts/measure_render.mjs` or `scripts/verify_states.mjs`, and this workspace session does not provide a browser/screen-reader harness. Therefore this report does **not** claim a complete rendered WCAG certification. Contrast figures below are measurements of the exact design-token color pairs using the WCAG relative-luminance formula.

## Findings

| Criterion | Priority | Result | Evidence / fix |
| --- | --- | --- | --- |
| 1.1.1 Non-text Content | P0 | Pass | All three rendered `<img>` usages have text alternatives: product-list imagery is intentionally decorative inside a named product link (`alt=""`), product detail uses the product name, and Pickup QR uses a descriptive alt. |
| 1.3.1 Info and Relationships | P0 | Pass after fix | Shared fields use explicit `label htmlFor` + `id`; the two raw file inputs also have visible labels and `aria-describedby`. Generic summary/filter/action containers that carried `aria-label` now expose `role="group"` so the accessible name has a defined role. |
| 1.4.1 Use of Color | P0 | Pass | Operational status uses text labels/badges in addition to semantic color. Selected operational items retain textual selected/current context rather than relying only on surface color. |
| 1.4.3 Contrast (Minimum) | P0 | Pass for measured canonical token pairs | Light text on `--surface`: ink 16.55:1, secondary 8.17:1, tertiary 4.74:1, campus 7.14:1. Dark: ink 15.09:1, secondary 9.96:1, tertiary 6.09:1, campus 7.79:1. Semantic text/background pairs measured between 4.70:1 and 6.23:1. Full rendered-state measurement remains unverified because the required render scripts are absent. |
| 1.4.10 Reflow | P0 | Pass by source/build review | Phase 16 removed malformed mobile CSS, verified 320px-oriented compact gutters, table horizontal containment, and no forced `100vw` / hidden horizontal overflow patterns. |
| 1.4.11 Non-text Contrast | P0 | Fixed | Editable controls previously used low-contrast `--line`. Added canonical `--control-line`: light alpha 0.52 and dark alpha 0.37. Measured against relevant surface/canvas/inset backgrounds: light minimum 3.32:1, dark minimum 3.19:1. Hover boundaries use `--ink-secondary` instead of dropping back to `--line-strong`. |
| 2.1.1 Keyboard | P0 | Pass for reviewed patterns | Actions use native buttons/links/inputs. No clickable `div/span/li/article` handlers were found. Dialogs use Radix Dialog keyboard/focus behavior. |
| 2.1.2 No Keyboard Trap | P0 | Fixed / pass | Mobile application navigation is a disclosure. Escape now closes it and explicitly returns focus to the menu trigger; targeted test covers the behavior. Radix Dialog provides modal focus trapping and Escape handling. |
| 2.4.1 Bypass Blocks | P0 | Pass after fix | Authenticated shell exposes “ข้ามไปยังเนื้อหาหลัก” targeting `#main-content`; the target is programmatically focusable and now retains a visible `:focus-visible` indicator. |
| 2.4.2 Page Titled | P0 | Pass | Public, customer, Organization, and Platform routes export descriptive page metadata; root has the UniStore Hub title. |
| 2.4.7 Focus Visible | P0 | Pass for canonical focus token | Global keyboard focus is a 2px outline. Measured `--focus` contrast: light 5.58:1 on surface / 5.19:1 on canvas; dark 8.80:1 on surface / 9.34:1 on canvas. The skip destination no longer suppresses focus-visible styling. |
| 2.4.11 Focus Not Obscured | P0 | Fixed | Added scroll clearance for sticky public/mobile headers with `scroll-padding-top` plus focusable-element `scroll-margin`; mobile clearance increases at ≤900px. |
| 2.5.3 Label in Name | P0 | Pass | Reviewed buttons/links keep visible action text in their accessible names; icon-only dialog close buttons provide explicit Thai `aria-label`. |
| 2.5.8 Target Size | P0 | Pass for shared controls | Shared control heights are 36/40/44px, routine product controls use 40px minimum, and form controls use 44px. Inline text links rely on the WCAG inline-target exception. |
| 3.1.1 Language of Page | P0 | Pass | Root document uses `<html lang="th">`. |
| 3.3.1 Error Identification | P0 | Pass | Shared field errors are textual, linked through `aria-describedby`, marked `aria-invalid`, and announced with `role="alert"`; flow-level errors use alert notices. |
| 3.3.2 Labels or Instructions | P0 | Pass | Shared form controls require visible labels; upload controls include visible labels and hints. |
| 3.3.8 Accessible Authentication | P0 | Pass | Login/register use standard text/password fields with `email`, `current-password`, `new-password`, and `name` autocomplete values. No CAPTCHA, paste prevention, or `autocomplete="off"` pattern was found. |
| 4.1.2 Name, Role, Value | P0 | Pass after fix | Native controls are preferred; named generic groupings now expose `role="group"`. Active application navigation uses `aria-current="page"`; filter toggles use `aria-pressed`. |
| 4.1.3 Status Messages | P0 | Pass | Loading uses `role="status"`; success/feedback uses status live regions; field and flow errors use `role="alert"`. |

## Motion

The global `prefers-reduced-motion: reduce` rule shortens transitions/animations to effectively immediate feedback and limits animation iteration to one. No auto-rotating carousel, flashing content, or motion-only action was found.

## Verification performed

- Source scan for raw inputs, images, custom click handlers, ARIA/live-region usage, page titles, auth barriers, focus suppression, and motion.
- Targeted accessibility/interaction tests including application-shell Escape focus return and skip target.
- WCAG relative-luminance measurements for canonical text, semantic-status, focus, and editable-control boundary tokens in light and dark themes.
- ESLint, full Vitest suite, production static-export build, CSS brace check, and `git diff --check`.

## Remaining manual verification

A real-browser pass should still verify 200% zoom/text-spacing overrides, actual focus scrolling under every sticky header, Windows forced-colors/high-contrast mode, and VoiceOver/NVDA announcements. Rendered contrast should be rerun if the project later adds the `measure_render.mjs` / `verify_states.mjs` scripts required by the installed audit skill.
