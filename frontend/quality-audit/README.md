# UniStore Hub — Frontend Quality Assurance

This is the **entry point** for frontend UX/UI test coverage and evidence. Reports are grouped by feature and failure mode; current tests are named after observed behavior, not work milestones.

The historical frontend remediation was completed **for scoped non-destructive QA only**. The original exhaustive sign-off is **not** complete: 257 source Action IDs each have at least one narrowly scoped direct PASS, but **0/257 full declared-state matrices** are certified. Real Backend mutations, cross-tab upload idempotency, physical devices/screen readers and visual approval remain separate release risks. Do not silently convert `NOT_TESTED` outcomes to PASS.

## Documents by topic

| Topic | Document |
| --- | --- |
| Final scoped QA outcome and outstanding release risks | [Frontend QA sign-off](frontend-qa-signoff.md) |
| Final source review and regression evidence | [Final diff review](FINAL_DIFF_REVIEW_20261018.md) |
| Responsive/a11y/route regression overview | [UX regression overview](ux-regression-overview.md) |
| Inventory, fixtures and baseline shared/customer/admin journeys | [QA foundations](ux-audit-foundation.md) |
| Customer orders, checkout, pickup and notifications | [Customer journeys](customer-journey-verification.md) |
| Navigation, authentication and public detail routes | [Navigation and authentication](navigation-and-auth-verification.md) |
| Staff and organization administration | [Organization operations](organization-operations-verification.md) |
| Payment review and Pickup confirmation | [Payment and pickup](payment-and-pickup-verification.md) |
| Product image upload, pending ACK and stale readback recovery | [Product image reliability](product-image-reliability-verification.md) |
| Accessible dialogs, filter flows and focused regressions | [Accessibility and regression](accessibility-and-regression-verification.md) |
| Old report/test path resolution after consolidation | [Migration map](artifact-migration-map.json) |

[Canonical quality requirements](../../WEB_QUALITY_AUDIT.md) are separate from observed evidence. Cross-system/historical verification is under [tests/reports](../../tests/reports/README.md).

## Where the automated evidence lives

- `coverage-baseline.json`: canonical generated list of **28 routes, 207 route actions and 50 shared-shell action IDs**.
- `../e2e/quality-audit/generate-baseline.mjs`: deterministic parser/verification tool.
- `../e2e/quality-audit/fixture-guard.ts`: local-only target verification, seed-ID protection and explicit owned-fixture journal.
- `../e2e/quality-audit/scenario-catalog.ts`: declared role/state scenarios; declaration is **not** execution.
- `../e2e/quality-audit/result-ledger.ts`: action-specific browser outcome accounting with evidence.
- `../e2e/quality-audit/*.spec.ts`: independent behavior-focused browser tests. See the [test guide](../e2e/quality-audit/README.md).
- `.evidence/`: ignored on-disk screenshots/outcomes from previous runs; not committed by default.

## Recheck (from frontend/)

```sh
node e2e/quality-audit/generate-baseline.mjs --verify
npm test
npx tsc --noEmit
npm run lint
npm run build
npx playwright test e2e/quality-audit/ --list --project=chromium
```

A local Docker Compose stack and authorized test fixtures are needed for actual browser execution. Do **not** point automated writes at production or mutate seeded records. The safe UXQA harness intercepts browser business writes, but other E2E suites in the repository may exercise real disposable integration fixtures: review their safety guards before running.

The historical source-to-destination mapping deliberately retains old path labels **inside JSON metadata only** for traceability. No active QA test or report **filename** uses milestone numbering.
