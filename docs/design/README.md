# UniStore Hub — Full UX/UI Redesign

This directory is the design and test brief for rebuilding the **entire** frontend experience across all roles. The baseline is commit `9007ec3`.

| File | Use |
| --- | --- |
| [FOUNDATION_IMPLEMENTATION.md](FOUNDATION_IMPLEMENTATION.md) | Shared brand, role-aware navigation and browser evidence (Foundation complete) |
| [STOREFRONT_IMPLEMENTATION.md](STOREFRONT_IMPLEMENTATION.md) | New marketplace homepage, browser directory fixtures and remaining integration limits |
| [COMMERCE_DETAILS_IMPLEMENTATION.md](COMMERCE_DETAILS_IMPLEMENTATION.md) | Store, product, campaign detail UX and guarded browser checks |
| [ACCOUNT_ENTRY_IMPLEMENTATION.md](ACCOUNT_ENTRY_IMPLEMENTATION.md) | Login, registration, return-to-intent and role-aware organization entry |
| [CUSTOMER_JOURNEY_IMPLEMENTATION.md](CUSTOMER_JOURNEY_IMPLEMENTATION.md) | Customer order, payment, pickup and notification UX evidence with bounded browser tests |
| [STAFF_OPERATIONS_IMPLEMENTATION.md](STAFF_OPERATIONS_IMPLEMENTATION.md) | Staff order, payment review and pickup queues, dialogs and bounded browser checks |
| [ORGANIZATION_MANAGEMENT_IMPLEMENTATION.md](ORGANIZATION_MANAGEMENT_IMPLEMENTATION.md) | Organization selection, dashboard, settings and member-management browser QA |
| [COMMERCE_MANAGEMENT_IMPLEMENTATION.md](COMMERCE_MANAGEMENT_IMPLEMENTATION.md) | Store, product/variant/image and campaign workflow redesign with safe browser evidence |
| [OPERATIONS_REPORTING_IMPLEMENTATION.md](OPERATIONS_REPORTING_IMPLEMENTATION.md) | Production quantity report and read-only audit log UX, with guarded browser evidence |
| [PLATFORM_GOVERNANCE_IMPLEMENTATION.md](PLATFORM_GOVERNANCE_IMPLEMENTATION.md) | Platform overview, organization lifecycle approvals and read-only user directory with bounded browser evidence |
| [DESIGN_QUALITY_IMPLEMENTATION.md](DESIGN_QUALITY_IMPLEMENTATION.md) | Cross-role responsive, accessibility, motion and sampled state verification with remaining limits |
| [CROSS_ROLE_REGRESSION_IMPLEMENTATION.md](CROSS_ROLE_REGRESSION_IMPLEMENTATION.md) | Chromium/Firefox/WebKit end-to-end regression, asset provenance and open dependency security findings |
| [FINAL_DIFF_REVIEW.md](FINAL_DIFF_REVIEW.md) | Full uncommitted UX/UI change review with explicit unresolved security blockers and handoff |
| [BRACES_PATCH_TECHNICAL_REVIEW.md](BRACES_PATCH_TECHNICAL_REVIEW.md) | Source-level review, 672-case compatibility comparison, vendored archive checks and open approval conditions |
| [BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md](BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md) | Hardens development-only braces against shallow combinatorial explosion while preserving ordinary glob compatibility |
| [SECURITY_AUDIT_GATE_IMPLEMENTATION.md](SECURITY_AUDIT_GATE_IMPLEMENTATION.md) | Fail-closed audit review gate: zero runtime findings, known dev-only advisory and explicit manual security approval |
| [SECURITY_PATCH_ACCEPTANCE_PACKET.md](SECURITY_PATCH_ACCEPTANCE_PACKET.md) | Security-owner decision packet for locally patched braces, reviewed SHA evidence, residual advisory and signoff criteria |
| [RUNTIME_DEPENDENCY_ISOLATION.md](RUNTIME_DEPENDENCY_ISOLATION.md) | Repeatable dev-only dependency and Static Export isolation checks with six fail-closed tests |
| [DEPENDENCY_SECURITY_REMEDIATION.md](DEPENDENCY_SECURITY_REMEDIATION.md) | Patched Next/Vitest toolchain, zero production npm audit findings and documented upstream-unpatched ESLint advisory |
| [REDESIGN_BRIEF.md](REDESIGN_BRIEF.md) | Product story, visual direction, role-specific information architecture and usability rules |
| [ROUTE_ROLE_STATE_MATRIX.md](ROUTE_ROLE_STATE_MATRIX.md) | Human-readable map of all 28 routes and key actions |
| [ROUTE_ROLE_STATE_MATRIX.json](ROUTE_ROLE_STATE_MATRIX.json) | Machine-readable route × role × viewport × state evidence tracker; all new UI initially NOT_TESTED |
| [generate-route-role-matrix.py](generate-route-role-matrix.py) | Deterministic source-baseline generator; review the manifest before regenerating so measured redesign results are not overwritten |
| [ASSET_AND_MOTION_POLICY.md](ASSET_AND_MOTION_POLICY.md) | MotionSite inspiration, copyright/licensing, icon consistency and performance rules |
| [ASSET_MANIFEST.json](ASSET_MANIFEST.json) | Local third-party asset provenance; empty until actual downloads are performed |

## Actual discovery screenshots

Three **uncommitted/ignored** baseline PNGs are stored under `frontend/quality-audit/.evidence/redesign-discovery/`:

- `public-home-desktop-before.png` — local public landing, 1440×900
- `public-home-mobile-before.png` — local public landing, 390×844
- `login-loading-desktop-before.png` — local account-checking state, 1440×900

These show only the **loading** condition in the isolated browser. Do not present them as a populated public product catalog or as representative views of Staff/Organization/Platform roles.

## Quality workflow

Finish design phases with **real browser interaction** in an authorized role and capture the actual screen. Before calling a view complete, check the user goal, current role, hierarchy, navigation, primary action, modal, error/empty/loading, keyboard and breakpoint behavior. Add scoped observations to the matrix. Not yet seen = `NOT_TESTED`; photo/route screenshot does not prove that an API mutation succeeded.

This redesign does **not** authorize changing backend/APIs/RBAC/data, committing, pushing or deploying without separate request.
