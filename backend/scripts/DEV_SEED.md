# UniStore Hub Local Dev Seed

This file documents **local/demo-only** seed credentials. They are not production secrets and must never be reused outside local development.

Run from `backend/`:

```bash
npm run dev:seed
```

The command requires a local/LocalStack `AWS_ENDPOINT_URL` and an `APP_TABLE_NAME`. It refuses to run with `NODE_ENV=production` or a non-local AWS endpoint.

## Demo users

All demo users use this local-only password:

```text
unistore-local-demo-only
```

| Role | Email |
|---|---|
| Platform Admin | `platform-admin@local.unistore.test` |
| Customer | `customer@local.unistore.test` |
| Organization Admin | `org-admin@local.unistore.test` |
| Staff | `staff@local.unistore.test` |

The seed is deterministic and writes fixed IDs for one active Organization, Store, Product, Product Variant, and an OPEN Campaign suitable for local/E2E flows.

Re-running the command intentionally converges the same fixed demo records instead of creating duplicates.

The seed command does not print passwords or password hashes.
