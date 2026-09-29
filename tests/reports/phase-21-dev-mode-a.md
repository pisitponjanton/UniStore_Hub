# Phase 21 — Dev Mode Smoke Set A

## Source-backed scope

This phase covers the first four mandatory Dev Mode smoke requirements.

### DEV-001 Local dependency setup

The intended developer interface is root-level:

```bash
npm run dev:setup
npm run dev
npm run dev:seed
npm run dev:reset
npm run dev:down
```

`dev:setup` must:

```text
verify Docker
→ start LocalStack
→ wait until healthy
→ create DynamoDB table unistore-hub-dev-local
→ create Files bucket unistore-hub-files-local
→ apply S3 CORS
→ create SQS queue
→ expose non-secret local resource values
```

It must be idempotent and must not destroy existing local data when run twice.

### DEV-002 Health

`GET http://localhost:4000/health` must succeed through the local Express entrypoint.

### DEV-003 Frontend

The same Frontend application must load from `http://localhost:3000`.

### DEV-004 Auth parity

Real local Register/Login/JWT/`GET /me` must work against normal local persistence. There must be no dev-only authentication bypass.

## Test mapping

- `DEV-001` — root command surface plus blocked real LocalStack resource/idempotency check
- `DEV-002` — starts/reuses the repository local Backend and calls exact localhost:4000 health endpoint
- `DEV-003` — starts/reuses the Frontend dev server at localhost:3000
- `DEV-004` — blocked real LocalStack-backed auth parity scenario

## Current implementation observation

- Backend has `backend/src/local.js` and a `dev` script.
- No root `package.json` exists, so the required root Dev Mode command interface is absent.
- No Dev Mode setup/reset scripts are currently present.
- Frontend still has no `package.json` or executable application.
- Real LocalStack-backed auth cannot be claimed until the local table/setup path exists.

Testing does not substitute mocked repository auth for DEV-004 because the Dev Mode contract explicitly requires production-contract parity.

## Latest execution

Command:

```bash
node --test smoke/dev-mode-a.test.mjs
```

Result:

- DEV-001 command surface — FAIL: repository root `package.json` is absent, so the required root `dev:setup/dev/dev:seed/dev:reset/dev:down` interface does not exist.
- DEV-001 real setup/resource/idempotency check — TODO/BLOCKED until Integration provides the root setup command.
- DEV-002 — TODO/BLOCKED by the local environment: port 4000 is currently occupied by Docker (`com.docke`, PID 4417) and `/health` on that listener returns 404 rather than the UniStore Hub health contract. The test was corrected so this port collision is not misreported as a Backend implementation failure.
- DEV-003 — FAIL: `frontend/package.json` is absent, so a Frontend dev server cannot be started at localhost:3000.
- DEV-004 — TODO/BLOCKED until DEV-001 provides real LocalStack persistence; mocked repository auth is intentionally not accepted as Dev Mode parity.

Focused summary after fixing the Testing harness port-collision classification: 5 tests total — 0 pass, 2 fail, 3 todo.

The two failures are real project-owned readiness gaps. The three TODO results are blocked dependencies/environment conditions and are not counted as passing.
