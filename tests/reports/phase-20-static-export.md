# Phase 20 — Static Export Verification

## Contract basis

The Frontend and Testing specs require the production Next.js build to use:

```js
{
  output: "export",
  trailingSlash: true
}
```

Runtime database IDs are unknown at build time. Runtime entities therefore use static route pages plus query parameters, not arbitrary dynamic route segments that require build-time `generateStaticParams()`.

Canonical examples include:

- `/stores/view/?organizationId=<id>&storeId=<id>`
- `/products/view/?organizationId=<id>&productId=<id>`
- `/campaigns/view/?organizationId=<id>&campaignId=<id>`
- `/my/order/?orderId=<id>`
- `/org/orders/view/?organizationId=<id>&orderId=<id>`

The build contract is:

```text
npm ci
→ npm test
→ npm run build
→ frontend/out
→ aws s3 sync
→ S3 Static Website
```

`frontend/package-lock.json` is required for deterministic `npm ci`.

Static-export verification must cover:

- build success
- `frontend/out` existence
- exported route directories containing `index.html`
- canonical trailing-slash direct refresh behavior under S3 Website semantics
- arbitrary runtime query IDs without build-time ID enumeration/live API dependency

## Test IDs

Current source/output checks:

- STATIC-001 — `package.json`
- STATIC-002 — `package-lock.json`
- STATIC-003 — Next config with `output: "export"` and `trailingSlash: true`
- STATIC-004 — no dynamic `[id]` App Router entity pages once page files exist
- STATIC-005 — representative canonical query-parameter route pages exist
- STATIC-006 — `frontend/out` exists as a directory

Build/serving checks:

- STATIC-007 through STATIC-010

## Current implementation observation

At phase start, `frontend/` contains the directory skeleton but only `AGENT.md` as an actual file. There is no package manifest, lockfile, Next config, App Router page implementation, or static build output.

Testing therefore preserves missing static-export prerequisites as real Frontend-owned failures and does not mark build/refresh behavior as passing until a real static export exists.

## Latest execution

Command:

```bash
node --test frontend/static-export.test.mjs
```

Result:

- STATIC-001 — FAIL: `frontend/package.json` is missing.
- STATIC-002 — FAIL: `frontend/package-lock.json` is missing.
- STATIC-003 — FAIL: no Next.js config exists, so `output: "export"` and `trailingSlash: true` cannot be verified.
- STATIC-004 — FAIL: no App Router `page.*` files exist, so the static-route/no-dynamic-[id] requirement is not implemented yet.
- STATIC-005 — FAIL: representative canonical query-parameter route pages are missing.
- STATIC-006 — FAIL: `frontend/out` does not exist.
- STATIC-007..010 — TODO/BLOCKED pending a real Frontend package/build and generated static output.

Focused summary: 10 tests total — 0 pass, 6 fail, 4 todo.

The six failures are genuine Frontend-owned static-export baseline gaps. Build, exported `index.html` layout, S3 Website direct-refresh semantics, and arbitrary runtime query-ID refresh remain blocked and are not counted as passing.
