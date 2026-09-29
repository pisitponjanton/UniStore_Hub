# UniStore Hub Cross-System Tests

This directory is owned by the Testing Agent and follows `tests/AGENT.md`.

## Runtime

The cross-system harness is intentionally standalone and uses the Node.js built-in test runner so it does not require changes to root, frontend, backend, infrastructure, or scripts package files.

Baseline verified on:

- Node.js 24.20.0
- npm 11.19.0

The project specification targets Node.js 22+ semantics, so the test harness declares `node >=22`.

## Layout

- `contract/` — API/shared-contract verification
- `integration/` — cross-service integration verification
- `security/` — tenant/customer isolation and authorization verification
- `frontend/` — cross-system frontend interaction verification
- `smoke/` — Dev Mode and deployment smoke checks
- `e2e/` — end-to-end business flows
- `infrastructure/` — CloudFormation/AWS verification
- `helpers/` — reusable test helpers
- `fixtures/` — deterministic disposable test data
- `reports/` — traceability and handoff artifacts

Subsystem-local unit tests remain outside this directory and are owned by their respective agents.

## Commands

Run all cross-system tests:

```bash
cd tests
npm test
```

Run one layer:

```bash
npm run test:contract
npm run test:security
npm run test:e2e
```

Individual phases may add more focused files without changing production code.
