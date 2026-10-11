# Real-browser QA harness

This directory is the frontend-local Playwright harness for the Full Frontend Real-User UX/UI & E2E Audit.

## Default local target

The harness defaults to the canonical Compose Dev Mode stack:

- Frontend: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`

Override only when explicitly testing another disposable integration environment:

- `E2E_FRONTEND_BASE_URL`
- `E2E_API_BASE_URL`
- `E2E_LOCAL_SEED_PASSWORD`
- `E2E_ORGANIZATION_ID`
- `E2E_TARGET_ENV=integration`
- `E2E_ALLOW_NON_LOCAL_MUTATIONS=true`

The suite performs real mutations: registration, Organization creation/approval/suspension, Orders, Payments, Campaign lifecycle changes, Pickup confirmation, and notification updates. Playwright therefore refuses any non-loopback target unless both non-local safety flags are explicitly set. **Production targets are not supported.**

Non-local integration targets must expose the same deterministic seed-role emails used by the local harness, with the password and Organization ID supplied explicitly through environment variables.

## Commands

- `npm run test:e2e` — Chromium real-browser suite
- `npm run test:e2e:headed` — headed Chromium run
- `npm run test:e2e:ui` — Playwright UI mode

### Cross-browser verification (opt-in)

Firefox and WebKit are intentionally **not enabled by default** so ordinary CI/local
E2E continues to run only Chromium. From `frontend/`:

```bash
npx playwright install firefox webkit
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/route-viewport-matrix.spec.ts --project=firefox
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/route-viewport-matrix.spec.ts --project=webkit
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/responsive-interactions.spec.ts --project=firefox
E2E_ENABLE_CROSS_BROWSER=1 npx playwright test e2e/responsive-interactions.spec.ts --project=webkit
```

The role-aware matrix checks 28 unique routes / 33 route-role surfaces at 11 viewport
pairs per browser. Very large Audit and Platform Users tables have intentionally
**sampled** axe accessibility checks; the entire table is not an audited manual
screen-reader experience. Browser-specific navigation cancellation diagnostics
(`NS_BINDING_ABORTED`, `cancelled`) are recorded and categorized as aborted
GETs on local API/static assets, not general network failure.

For WebKit on macOS, `Option+Tab` is used to reach buttons in keyboard tab-order
when the browser uses text-input-only Tab navigation. This is a test adaptation
to macOS/WebKit keyboard preferences, not evidence that real Safari preferences
were manually verified.

**Playwright WebKit is not an actual Safari.app manual session**; no real iOS,
Android, VoiceOver, TalkBack, Firefox desktop UI, touch-screen or screenshot
pixel-by-pixel review is implied. Follow the Phase 2 report in `tests/reports`
for outstanding manual checks.

Failure evidence is stored under ignored `test-results/` and `playwright-report/`.

The harness captures console errors, uncaught page errors, failed requests, and HTTP 4xx/5xx responses. Tests decide which failures are expected for explicit negative scenarios.


## Execution model

The integration suite is intentionally serialized with one Playwright worker.

The browser tests share deterministic local seed accounts and a stateful LocalStack backend. Running role/journey files concurrently can mutate the same Customer/Organization data at the same time and create false failures that do not represent real user behavior. Serial execution keeps evidence deterministic while the audit is in progress.

Individual suites can still be run directly during a phase to keep feedback fast.
