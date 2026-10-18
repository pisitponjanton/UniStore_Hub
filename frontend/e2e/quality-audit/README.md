# Browser UX Quality Tests

This directory contains focused **Playwright** specifications. Each `*.spec.ts` describes observable behavior rather than a development milestone. Separate files are intentional: they allow targeted regression runs and clear failure ownership, without one monolithic test file.

## Find a test by feature

| Feature | Specification search |
| --- | --- |
| Inventory, ledger, fixtures | `audit-*.spec.ts`, `action-coverage-ledger.spec.ts` |
| Customer / storefront / orders | `customer-*.spec.ts`, `storefront-*.spec.ts`, `public-*.spec.ts` |
| Payments and pickup | `payment-*.spec.ts`, `pickup-*.spec.ts` |
| Organization and staff | `organization-*.spec.ts`, `staff-*.spec.ts`, `store-management-*.spec.ts` |
| Products and upload safety | `product-image-*.spec.ts`, `products-*.spec.ts` |
| Platform admin | `platform-*.spec.ts` |
| Accessibility, responsive and shared UI | `*-accessibility.spec.ts`, `responsive-*.spec.ts`, `shared-*.spec.ts`, `theme-*.spec.ts` |

## Commands from frontend/

```sh
npx playwright test e2e/quality-audit/ --list --project=chromium
npx playwright test e2e/quality-audit/multi-role-modal-accessibility.spec.ts --project=chromium --reporter=line
npx playwright test e2e/quality-audit/payment-review-decision-matrix.spec.ts --project=chromium --reporter=line
```

Cross-browser checks (with installed browsers): `E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/quality-audit/multi-role-modal-accessibility.spec.ts --project=firefox`.

**Safety:** follow `fixture-guard.ts` and the local-loopback-only rules. Many tests simulate/abort POST/PATCH/PUT/DELETE for safe UI validation; that evidence does not certify real persisted business mutations. Never point a mutating test at production or reuse real/seeded records. Ignored screenshot and outcome evidence belongs in `frontend/quality-audit/.evidence/`; it is not committed by default.

The [QA index](../../quality-audit/README.md) points to the consolidated feature evidence and the `NOT_TESTED` limitations.
