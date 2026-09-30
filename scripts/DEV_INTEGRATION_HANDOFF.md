# UniStore Hub Dev Mode — Integration Handoff

## Scripts-owned Dev Mode surface

The canonical Dev Mode implementation under `scripts/**` is:

- `scripts/dev-setup.sh`
- `scripts/dev.sh`
- `scripts/dev-seed.sh`
- `scripts/dev-reset.sh`
- `scripts/dev-down.sh`
- `scripts/dev-outputs.sh`
- `scripts/check-dev-tooling.sh`
- `scripts/lib/dev-common.sh`
- `scripts/dev/compose.yaml`

Production deployment scripts remain separate and were not refactored for local use.

## Root / Integration wiring

The current working tree contains the required root aliases:

```text
dev:setup -> bash scripts/dev-setup.sh
dev       -> bash scripts/dev.sh
dev:seed  -> bash scripts/dev-seed.sh
dev:reset -> bash scripts/dev-reset.sh
dev:down  -> bash scripts/dev-down.sh
```

The root `package.json` remains Root / Integration-owned.

At final Scripts verification time the root package is present but still uncommitted, so the owning agent must include it in its own commit.

## Backend dependencies

The repository now provides both required Backend-owned Dev Mode commands:

```text
worker:dev -> node src/local-worker.js
dev:seed   -> node scripts/dev-seed.js
```

with:

```text
backend/src/local-worker.js
backend/scripts/dev-seed.js
```

These files are outside Scripts ownership and are not part of the Scripts commit.

At final Scripts verification time the Backend worker/seed dependencies are present and no longer show as uncommitted in the shared working tree.

## Local infrastructure contract

Canonical local values are:

```text
Frontend:        http://localhost:3000
Backend:         http://localhost:4000
API:             http://localhost:4000/api/v1
Health:          http://localhost:4000/health
LocalStack:      http://localhost:4566
Region:          us-east-1
DynamoDB table:  unistore-hub-dev-local
Files bucket:    unistore-hub-files-local
Queue:           unistore-hub-notifications-local
```

`dev:setup` ensures DynamoDB, S3+CORS, and SQS idempotently.

The existing DynamoDB table is validated against the canonical Dev/Data contract before setup succeeds:

- PK = `PK` HASH
- SK = `SK` RANGE
- GSI = `GSI1`
- GSI1PK = HASH
- GSI1SK = RANGE
- projection = ALL
- billing mode = PAY_PER_REQUEST

A pre-existing incompatible table causes setup to fail instead of silently accepting schema drift.

## Local environment isolation

Dev Mode does not inherit host production-like credentials/configuration into local application processes.

When `dev_export_environment` runs it forces:

```text
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
NODE_ENV=development
PORT=4000
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=us-east-1
```

The local JWT secret comes from `DEV_JWT_SECRET` when explicitly supplied, otherwise from the documented dev-only default.

A generic host `JWT_SECRET` is not inherited into Dev Mode.

This prevents accidentally passing real host AWS credentials, production `NODE_ENV`, or an unrelated JWT signing secret into LocalStack development processes.

## Local outputs

`dev-outputs.sh` and `scripts/dev/.state/outputs.env` expose non-secret `DEV_*`, `TEST_*`, and `E2E_*` endpoint/resource values.

JWTs, passwords, AWS secrets, and tokens are intentionally excluded.

The output handoff includes the resolved LocalStack SQS queue URL so Tests/E2E do not need to guess it.

## Seed

`dev:seed` delegates to the Backend deterministic seed command.

Verified current Backend seed result:

```text
15 deterministic items
Platform Admin
Customer
Organization Admin
Staff
Organization
Store
Product / Variant
Campaign
```

Shell tooling does not construct domain entities itself.

## Worker

`dev.sh` delegates local queue consumption to Backend `worker:dev`.

Scripts does not duplicate SQS event-processing, Notification persistence, or idempotency logic.

## Reset safety

`dev:reset` is local-only and destructive.

Before any destructive action it requires the exact canonical resource names and one of these exact endpoints:

```text
http://localhost:4566
http://127.0.0.1:4566
http://[::1]:4566
```

A production AWS endpoint or lookalike hostname such as `localhost.example.com` is rejected.

The reset targets only:

- canonical local DynamoDB table
- canonical local Files bucket
- canonical local Notification queue

It never invokes CloudFormation or production `destroy.sh`.

If a managed `scripts/dev.sh` runner is active, `dev:reset` stops that app/worker runner before mutating DynamoDB/S3/SQS so the Worker cannot race the reset.

## Down behavior

`dev:down` stops the managed application runner when present and pauses LocalStack instead of deleting state.

The LocalStack 3.8.1 runtime in the current development environment did not preserve S3/SQS state reliably across a normal container stop/start despite the bind-mounted state directory. Using pause/unpause preserves DynamoDB, S3, and SQS state and keeps `dev:down` non-destructive.

`dev:setup` automatically resumes a paused LocalStack container.

## Port preflight

`dev.sh` verifies ports 3000 and 4000 before starting application processes.

On the current machine, port 4000 is occupied by an unrelated Docker container:

```text
navaq-backend-dev
host 4000 -> container 4000
```

Scripts tooling intentionally does not stop or modify that unrelated workspace.

Therefore the current machine must free port 4000 before a full UniStore Hub `npm run dev` session can stay running.

The command fails clearly before launching child application processes:

```text
Backend port 4000 is already in use.
```

This is a local environment conflict, not a missing UniStore Hub repository dependency.

## Verification results

Scripts-owned checks:

```text
bash scripts/check-dev-tooling.sh
89 / 89 passed
```

Production deployment baseline:

```text
bash scripts/check-tooling.sh
50 / 50 passed
```

Root Dev Mode smoke suite:

```text
9 passed
0 failed
6 TODO
```

Verified root commands:

```text
npm run dev:setup -> passed
npm run dev:seed -> passed
npm run dev:reset -- --yes --seed -> passed
npm run dev:reset with a non-local AWS endpoint -> correctly refused
npm run dev -> correctly refused because host port 4000 is occupied
```

The remaining TODO items are Testing/Backend integration qualification points, not missing Scripts lifecycle commands.

Current observed blockers outside Scripts ownership include:

- host port 4000 is occupied by another local Docker project
- Backend-issued LocalStack Payment Slip pre-signed PUT currently returns HTTP 400 due invalid `x-amz-checksum-crc32`

## Remaining handoff work

Root / Integration owner:

- commit the root `package.json` command surface
- preserve the exact canonical aliases

Backend owner:

- keep `worker:dev`, `dev:seed`, `src/local-worker.js`, and `scripts/dev-seed.js` compatible with Scripts tooling
- investigate the current LocalStack Payment Slip pre-signed PUT checksum qualification failure in the Backend/S3 adapter path

Testing owner:

- continue converting the remaining Dev Mode TODO qualification cases to real local flows
- run canonical Backend-dependent flows once host port 4000 is available
- consume values from `scripts/dev-outputs.sh` / `scripts/dev/.state/outputs.env`

Scripts owner:

- no production deployment refactor is required
- preserve the strict local reset guard and non-destructive down behavior
- keep local process environment isolated from host AWS credentials and generic production JWT/NODE_ENV values