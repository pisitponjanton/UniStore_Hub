# UniStore Hub — Development Mode Specification

> Subsystem: Development Mode
> Status: PROJECT DECISION unless explicitly marked FINAL
> Goal: fast local development with production-contract parity
> Read first: SPEC.md, AGENTS.md, docs/specs/00-shared-contracts.md, docs/api/API_CONTRACT.md, docs/specs/data/SPEC.md, Frontend/Backend specs

---

## 1. Purpose

The Final source defines the Learner Lab deployment but does not define a local development environment.

This document introduces Dev Mode as a PROJECT DECISION.

Dev Mode must improve developer speed without creating a second application with different business behavior.

Canonical principle:

~~~text
same Frontend application
same Express application
same services
same repositories/contracts
same JWT/RBAC/tenant rules
same API shapes
same DynamoDB semantics
same S3 object-key semantics
same notification event semantics
+
local infrastructure adapters/configuration
~~~

---

## 2. Local Architecture

PROJECT DECISION:

~~~text
Browser
│
├── http://localhost:3000
│   Next.js Dev Server
│
└── http://localhost:4000
    Express local HTTP server
       │
       ├── LocalStack DynamoDB
       ├── LocalStack S3
       └── LocalStack SQS
                  │
                  ↓
             Local Worker Process
                  │
                  ↓
            LocalStack DynamoDB
~~~

LocalStack endpoint:

~~~text
http://localhost:4566
~~~

Docker is used only for local AWS-compatible dependencies.

Frontend and Backend application processes run locally for fast reload.

---

## 3. Why LocalStack

PROJECT DECISION

Use LocalStack for local development of:

- DynamoDB
- S3
- SQS

Reasons:

- one local AWS-compatible endpoint
- preserves AWS SDK request semantics
- supports S3 Pre-signed URL flow
- supports SQS notification flow
- avoids three unrelated fake implementations
- no production dependency on LocalStack

LocalStack is not part of the Learner Lab architecture.

---

## 4. What Dev Mode Does Not Emulate

Dev Mode does not need to locally emulate:

- API Gateway
- Lambda runtime
- CloudWatch
- Cost Explorer
- Learner Lab Budget
- LabRole
- S3 Static Website hosting

Instead:

- Next.js dev server replaces S3 website during local development
- local Express server replaces API Gateway + Lambda invocation transport
- local Worker process reuses Worker business/event code
- console/local logs replace CloudWatch viewing during local development

AWS deployment smoke tests verify the actual managed-service integration later.

---

## 5. Local Ports

PROJECT DECISION baseline:

~~~text
Frontend: 3000
Backend:  4000
LocalStack: 4566
~~~

Do not hard-code these deep inside business modules.

Expose them through development environment configuration where needed.

---

## 6. Local Environment Files

PROJECT DECISION

Suggested files:

~~~text
frontend/.env.local
backend/.env.local
.env.example or subsystem examples
~~~

Real local secret files are ignored by Git.

Example values may be committed only in clearly non-secret example files.

---

## 7. Frontend Dev Environment

Canonical local value:

~~~text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
~~~

Frontend uses the same API client as AWS mode.

JWT storage remains:

~~~text
sessionStorage
key: unistoreHub.accessToken
~~~

Do not add a dev-only auth bypass.

---

## 8. Backend Dev Environment

PROJECT DECISION example:

~~~text
NODE_ENV=development
PORT=4000
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
APP_TABLE_NAME=unistore-hub-dev-local
FILES_BUCKET_NAME=unistore-hub-files-local
NOTIFICATION_QUEUE_URL=<created by dev setup>
JWT_SECRET=dev-only-secret-change-me
JWT_EXPIRES_IN=1d
CORS_ALLOWED_ORIGINS=http://localhost:3000
~~~

Rules:

- dummy AWS credentials are only for LocalStack
- production deployment never uses these dummy credentials
- local JWT secret is for local use only
- no environment check may bypass authorization

---

## 9. AWS Client Configuration

Backend AWS client factory reads optional local endpoint configuration.

Canonical behavior:

~~~text
if AWS_ENDPOINT_URL exists
→ configure DynamoDB/S3/SQS clients to use local endpoint

otherwise
→ use normal AWS SDK resolution / Lambda environment
~~~

PROJECT DECISION:

For local S3 compatibility, use path-style addressing if required by the chosen LocalStack setup.

This option stays in infrastructure adapter configuration, not business services.

---

## 10. Local DynamoDB

Dev setup creates one table matching the production Data Spec:

~~~text
Table: unistore-hub-dev-local
Billing behavior: local equivalent
PK
SK
GSI1PK
GSI1SK
GSI1
~~~

The logical schema/access patterns must match production.

Dev Mode must not replace DynamoDB semantics with an unrelated JSON file or in-memory database for normal integration development.

Unit tests may still mock repositories.

---

## 11. Local S3

Dev setup creates:

~~~text
unistore-hub-files-local
~~~

Purpose:

- Product Images
- Payment Slips

Object keys remain exactly:

~~~text
products/{organizationId}/{productId}/{uuid}
payments/{organizationId}/{orderId}/{uuid}
~~~

Payment Slip remains logically private.

Pre-signed URLs must still be requested through Backend and then used directly from Browser.

---

## 12. Local S3 CORS

Local Files bucket allows the Frontend dev origin:

~~~text
http://localhost:3000
~~~

Methods must match production file flow:

~~~text
GET
PUT
HEAD
~~~

CORS does not bypass Backend authorization for URL issuance.

---

## 13. Local SQS

Dev setup creates a Standard Queue for notifications.

PROJECT DECISION name:

~~~text
unistore-hub-notifications-local
~~~

Backend publishes the same versioned SQS message defined by Data Spec.

Do not use a local-only event schema.

---

## 14. Local Worker

PROJECT DECISION

Run Worker as a local Node.js process that long-polls the local SQS queue and passes records to the same event-processing logic used by src/worker.js.

Desired separation:

~~~text
SQS polling adapter
→ shared worker event processor
→ Notification repository
~~~

This enables fast local execution without requiring Lambda emulation.

Production still uses SQS EventSourceMapping → Worker Lambda.

---

## 15. Worker Parity

Local Worker must preserve:

- event validation
- eventId idempotency
- notification type mapping
- recipient ownership
- DynamoDB Notification shape
- failure semantics

A local Worker must not directly call Frontend or skip the queue.

---

## 16. Dev Commands

PROJECT DECISION target commands:

~~~bash
npm run dev:setup
npm run dev
npm run dev:seed
npm run dev:reset
npm run dev:down
~~~

Root package.json is Integration-owned.

Individual subsystem commands may exist, but these root aliases are the intended developer interface.

---

## 17. npm run dev:setup

Responsibilities:

~~~text
verify Docker
→ start LocalStack
→ wait until LocalStack is healthy
→ create DynamoDB table
→ create Files S3 bucket
→ apply S3 CORS
→ create SQS queue
→ write/display non-secret local resource values
~~~

Must be idempotent.

Running setup twice must not destroy existing local data.

---

## 18. npm run dev

Starts concurrently:

~~~text
Frontend Next.js dev server
Backend local Express server
Local Notification Worker
~~~

LocalStack should already be running or dev may call/setup it according to final root script implementation.

PROJECT DECISION:

Prefer one developer command after initial setup.

Exact process runner (shell, concurrently, npm-run-all, etc.) is implementation choice and must not affect application contracts.

---

## 19. npm run dev:seed

Seeds deterministic local/demo data.

Minimum seed intent:

- Platform Admin with `User.platformRole = PLATFORM_ADMIN`
- at least one normal Customer with `platformRole = null`
- one Organization
- Organization Admin membership
- Staff membership
- Store
- Product + Variant
- Campaign suitable for local testing

PROJECT DECISION:

Seed values must be clearly local/demo credentials and documented in dev-only material.

Never reuse production secrets.

---

## 20. npm run dev:reset

Destructive local-only command.

Expected flow:

~~~text
confirm/local-only guard
→ clear local DynamoDB table
→ clear local Files bucket
→ purge/recreate local SQS queue if needed
→ re-run dev setup
→ optionally re-run seed according to command definition
~~~

Must refuse to target a non-local endpoint.

---

## 21. Local Safety Guard

Any destructive Dev script must verify:

~~~text
AWS_ENDPOINT_URL points to localhost / LocalStack
~~~

before deleting/resetting resources.

If not local:

~~~text
abort
~~~

Dev reset must never delete Learner Lab resources.

---

## 22. npm run dev:down

Stops local dependency containers/processes.

PROJECT DECISION:

Stopping Dev Mode should not erase local data by default.

A separate reset/clean option handles destructive cleanup.

---

## 23. Local Authentication Parity

Dev Mode uses the same:

- registration
- login
- password hashing
- JWT signing/verifying
- GET /me
- Organization membership
- RBAC
- tenant checks

Forbidden:

~~~text
DEV_USER_ID bypass
skipAuth=true
accept any token
hard-coded admin middleware
~~~

Tests may mock auth units, but normal Dev Mode must execute real application auth logic.

---

## 24. Local API Parity

Frontend local API contract:

~~~text
http://localhost:4000/api/v1
~~~

Production:

~~~text
https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/api/v1
~~~

Only the base URL changes.

Routes, methods, payloads, statuses and errors remain identical.

---

## 25. Health Parity

Local health:

~~~text
GET http://localhost:4000/health
~~~

must return the same response shape as AWS:

~~~json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
~~~

---

## 26. File Flow Parity

Local:

~~~text
Browser
→ Local Backend
→ authorize
→ LocalStack S3 Pre-signed URL
→ Browser ↔ LocalStack S3
~~~

AWS:

~~~text
Browser
→ API Gateway / Lambda
→ authorize
→ AWS S3 Pre-signed URL
→ Browser ↔ AWS S3
~~~

Business code sees the same object-key contract.

---

## 27. Notification Flow Parity

Local:

~~~text
Business Service
→ LocalStack SQS
→ Local Worker
→ LocalStack DynamoDB
~~~

AWS:

~~~text
Business Lambda
→ AWS SQS
→ Worker Lambda
→ DynamoDB
~~~

Event payload and Notification data are identical.

---

## 28. Data Parity Rules

Dev Mode must match:

- UUID v4 IDs
- ISO 8601 UTC timestamps
- integer satang money
- role tokens
- Campaign/Order statuses
- Payment statuses
- Pickup statuses
- Platform Admin `User.platformRole`
- Pickup token format
- upload size/MIME limits
- PK/SK/GSI1 access patterns
- CampaignOrderLink behavior
- OrderItem snapshots

Do not simplify local data shape in ways that hide production bugs.

---

## 29. CORS Local Contract

Local Backend allowed origin:

~~~text
http://localhost:3000
~~~

Local S3 CORS also allows:

~~~text
http://localhost:3000
~~~

Production origin remains the Frontend S3 WebsiteURL.

Do not ship localhost wildcard origins as the only production CORS policy.

---

## 30. Dev Logging

Local Backend/Worker logs to terminal.

Use the same structured log conventions where practical.

Sensitive fields remain forbidden:

- password
- passwordHash
- JWT
- AWS secret
- full Pre-signed URL
- Payment Slip binary

Development does not justify logging secrets.

---

## 31. Seed Contract

Seed code belongs under Backend scripts because it uses domain/data contracts.

Target source path already includes:

~~~text
backend/scripts/seed-platform-admin.js
~~~

Additional local seed script(s) may be introduced as PROJECT DECISION.

Seeds must use repository/service-compatible data shapes rather than directly inventing fields that disagree with Data Spec.

---

## 32. Test Data Isolation

PROJECT DECISION:

Automated tests should use isolated identifiers/prefixes or a dedicated local test table/bucket/queue where practical.

Do not rely on a developer's manual local data for deterministic tests.

Exact testing isolation belongs to Testing Spec.

---

## 33. Docker Scope

Docker is a Dev Mode dependency, not the production runtime.

PROJECT DECISION target:

~~~text
docker compose
→ LocalStack only
~~~

Frontend/Backend remain normal host Node processes by default for fast hot reload.

An optional all-container dev profile may be added later only if it preserves the same contracts.

---

## 34. LocalStack Versioning

PROJECT DECISION:

Pin a known LocalStack image version/tag in the eventual dev configuration rather than relying permanently on latest.

Reason:

- reproducible team development
- fewer environment differences

Exact version is chosen during implementation and documented in the dev configuration.

---

## 35. No Fake Success Paths

Dev Mode must not:

- auto-approve Payments
- auto-confirm Pickups
- skip reject reason
- allow OPEN → PRODUCING
- bypass Organization status/membership
- use public Payment Slip storage
- write Notifications directly from payment service without SQS

unless a dedicated test explicitly stubs the dependency at unit-test level.

Normal local manual testing follows real business flow.

---

## 36. Dev Readiness Check

A developer should be able to:

~~~text
npm run dev:setup
npm run dev:seed
npm run dev
~~~

then verify:

1. Frontend opens at localhost:3000
2. Backend health succeeds at localhost:4000/health
3. Register/Login works
4. seeded Organization/Product/Campaign can be read
5. Order can be created
6. Payment Slip uploads through Pre-signed LocalStack S3 URL
7. Payment review can publish notification event
8. Local Worker writes Notification
9. Pickup flow uses same status rules

---

## 37. Dev Reset Verification

After npm run dev:reset:

- local AWS endpoint remains localhost
- local table exists
- local bucket exists
- local queue exists
- prior local records/files are removed according to reset semantics
- no AWS Learner Lab resource was touched

---

## 38. Dev Mode Acceptance Criteria

- [ ] Dev Mode is clearly marked as PROJECT DECISION
- [ ] Frontend runs on localhost:3000
- [ ] Backend runs same Express app on localhost:4000
- [ ] LocalStack provides DynamoDB/S3/SQS
- [ ] same Data Spec is used locally
- [ ] same API Contract is used locally
- [ ] same JWT/RBAC/tenant rules run locally
- [ ] same S3 object-key paths are used
- [ ] Payment Slip remains private in logical access flow
- [ ] same SQS event payload is used
- [ ] local Worker uses shared event-processing logic
- [ ] dev:setup is idempotent
- [ ] dev:reset has a localhost safety guard
- [ ] dev:down is non-destructive by default
- [ ] dev:seed creates useful deterministic demo data
- [ ] no auth/business bypass is introduced
- [ ] no production application code depends on LocalStack
- [ ] AWS deployment still uses normal managed AWS endpoints/LabRole

---

## 39. Remaining Dev Decisions

Implementation may still choose, while preserving this contract:

- exact pinned LocalStack version
- exact Docker Compose filename/location
- exact concurrent-process runner
- exact local test-resource naming
- exact local seed credentials
- whether dev:reset automatically reseeds

These are local workflow choices and must not alter production contracts.
