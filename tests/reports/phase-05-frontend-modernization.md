# Phase 5 — Frontend Stale TODO Conversion

## Goal

Replace stale Frontend interaction/static-export blockers with executable cross-system checks against the current Frontend without copying the Frontend subsystem's 190 unit/component tests into `tests/**`.

## Implementation approach

Added:

- `helpers/frontend-suite-evidence.mjs`

The helper:

- runs targeted existing Frontend Vitest files using the same Node executable as the cross-system runner
- uses verbose Frontend test output as executable evidence for specific UX/contract behavior
- can assert source wiring where a cross-system boundary is structural
- caches each targeted Frontend suite inside the current test process
- removes inherited `NODE_TEST_CONTEXT` from nested runners
- builds a copied Frontend tree under `tests/.tmp/frontend-static-build` using Next.js `--webpack`, so production Frontend source is not modified by static-export qualification

The temporary build reuses the installed Frontend dependency tree through a Testing-owned symlink and is ignored by `tests/.gitignore`.

## Converted interaction TODOs

All 21 stale TODOs in:

- `frontend/frontend-interaction.test.mjs`

are now executable.

Coverage now requires real current Frontend evidence for:

- public Storefront + authenticated Order creation
- Login/Register wiring and stable API-error feedback
- session restore/logout
- 401 vs 403 behavior
- shared loading/empty/error/unauthorized/forbidden states
- invalid runtime query handling
- Customer own-Order list/detail/cancel
- authoritative Order create payload
- Customer own-Payment rejection reason/resubmission
- Product Image / Payment Slip direct pre-sign → S3 PUT flows
- Payment Slip MIME/10 MiB client validation
- Production Admin-only UX and Backend-owned totals
- Pickup confirm refresh + duplicate-conflict behavior
- Notification read/unread flow
- Customer/Staff/Organization Admin/Platform Admin navigation
- membership-scoped organization navigation
- no-fake-row empty state wiring

## Converted static-export TODOs

All 4 stale TODOs in:

- `frontend/static-export.test.mjs`

are now executable.

The suite now verifies:

- current Frontend static-export Vitest contract
- a real production Next.js static build in Testing-owned temporary copy
- canonical exported route directories contain `index.html`
- direct trailing-slash refresh works through an S3 Website-style directory-index server
- arbitrary runtime query IDs resolve through static route files
- runtime entity pages do not depend on `generateStaticParams`

The first temp-build attempt using Turbopack correctly exposed a Testing harness issue: Turbopack rejects a `node_modules` symlink that points outside its filesystem root. The harness was corrected to use Next.js `--webpack` for the isolated copy. Production Frontend configuration was not changed.

## Verification

Executed under:

```text
Node v24.2.0
```

Result:

```text
npm run test:frontend

33 tests
33 pass
0 fail
0 todo
```

## TODO reduction

Before Phase 5:

```text
50 explicit TODO markers
```

After Phase 5:

```text
25 explicit TODO markers
```

Remaining markers are only in:

```text
8 e2e/tenant-notification-flow.test.mjs
5 smoke/dev-mode-b.test.mjs
3 smoke/dev-mode-a.test.mjs
3 e2e/payment-rejection-flow.test.mjs
3 e2e/core-flow.test.mjs
2 contract/file-security.contract.test.mjs
1 smoke/aws-deployment.test.mjs
```

These are Dev/E2E/AWS/live-file blockers or historical E2E readiness guards. They were intentionally not bypassed in this phase.

## Scope integrity

No production Frontend file was edited by this phase.

The repository currently contains concurrent changes outside `tests/**` in Backend/Scripts and a previously generated `frontend/next-env.d.ts` modification. Those are outside Testing ownership and were not modified by this phase.

## Result

Phase 5 Frontend modernization is complete. Cross-system Frontend/static-export tests no longer claim the application/build is absent and now produce executable evidence.
