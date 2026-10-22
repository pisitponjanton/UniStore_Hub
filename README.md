# UniStore Hub

University storefront and order-operations application. This repository contains the application, local development tooling, infrastructure definitions and tests. The source of product requirements is [SPEC.md](SPEC.md); contributor ownership/rules are in [AGENTS.md](AGENTS.md).

**Contributor requirement:** Read the [artifact naming policy](docs/ARTIFACT_NAMING_AND_CONSOLIDATION.md). Tests, docs, reports and screenshots are consolidated by subject, never named after an implementation milestone. Run `npm run check:artifact-names` before handoff or commit.

## Where to work

| Area | Purpose |
| --- | --- |
| [frontend/](frontend/) | Next.js UI, components, customer/staff/administrator features |
| [backend/](backend/) | API, persistence and domain invariants |
| [tests/](tests/) | Contract, integration, security and cross-system verification |
| [tests/reports/](tests/reports/) | Verification reports and historical test evidence |
| [infrastructure/](infrastructure/) | Deployment configuration and infrastructure code |
| [scripts/](scripts/) | Local development, QA and deployment helpers |
| [docs/](docs/) | Architecture and supporting documentation |

## Run locally

Requires Node.js 22+ and the project's documented Docker prerequisites. Start with `npm run dev:setup` for local setup, `npm run dev` to start, and `npm run dev:down` to stop. See the scripts and [docker-compose.dev.yml](docker-compose.dev.yml) before changing services or persistent data; **do not run `dev:reset` on data you need to keep**.

Frontend-only checks from `frontend/`:

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
npx playwright test e2e/quality-audit/ --project=chromium
```

The browser suite targets a local environment and needs the appropriate local services/fixtures. Some other E2E suites exercise real seeded integrations; read their guardrails before running them. See [Quality QA guide](frontend/quality-audit/README.md) and [Browser QA guide](frontend/e2e/quality-audit/README.md).

## QA status and production safety

The scoped frontend UX/UI remediation and code review are complete. That **does not** mean all actions/states, backend mutation flows, accessibility devices or production readiness are certified. Read [WEB_QUALITY_AUDIT.md](WEB_QUALITY_AUDIT.md), [frontend QA sign-off](frontend/quality-audit/frontend-qa-signoff.md), and [final diff review](frontend/quality-audit/FINAL_DIFF_REVIEW_20261018.md) for results, untested cases and release-level risks.

QA tests are named after the **behavior/feature**, not historical implementation milestones. Supporting historical evidence is consolidated by subject, with a [migration map](frontend/quality-audit/artifact-migration-map.json) for resolving prior references. Do not change API, tenant, order or payment contracts as part of UI cleanup without separate review.
