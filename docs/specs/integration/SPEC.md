# UniStore Hub — Integration Specification

> Subsystem: Integration / Handoff
> Purpose: Dependency graph, parallel-agent gates and final system compatibility
> Integration ownership: shared/root reconciliation
> Read first: SPEC.md, AGENTS.md and all canonical shared subsystem contracts

---

## 1. Purpose

This document defines how independently implemented Frontend, Backend, Infrastructure and Deployment work is combined without contract drift.

The system is intentionally designed for parallel work.

Integration must preserve:

- shared roles/statuses
- API routes/payloads
- Data key/access patterns
- environment variable names
- CloudFormation output names
- file-flow semantics
- notification-event semantics
- tenant/security invariants
- Learner Lab architecture

---

## 2. Contract Dependency Graph

~~~text
Final Source / AWS Diagram
          ↓
       SPEC.md
          ↓
docs/specs/00-shared-contracts.md
       ↙             ↘
API_CONTRACT       Data SPEC
    ↓                 ↓
Frontend SPEC     Backend SPEC
                      ↓
               Infrastructure SPEC
                      ↓
               Deployment SPEC

Dev SPEC
→ depends on Frontend + Backend + API + Data contracts

Testing SPEC
→ validates all contracts

Integration SPEC
→ coordinates final compatibility
~~~

No subsystem spec may override a higher-level contract.

---

## 3. Parallel Implementation Gate

Parallel application implementation begins only after these are locked:

~~~text
SPEC.md
AGENTS.md
docs/architecture/AWS_ARCHITECTURE.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
~~~

Then:

~~~text
Frontend Agent       ┐
Backend Agent        ├─ parallel
Infrastructure Agent ┘
~~~

Deployment/Tooling can begin once Infrastructure output names/build artifact contracts are stable.

Testing can begin contract/unit work before implementation is complete.

---

## 4. Ownership During Parallel Work

Frontend Agent:

~~~text
frontend/**
~~~

Backend Agent:

~~~text
backend/**
~~~

Infrastructure Agent:

~~~text
infrastructure/**
~~~

Deployment / Tooling Agent:

~~~text
scripts/**
~~~

Integration Agent:

- root shared files
- shared-contract reconciliation
- merge conflict resolution
- final compatibility fixes

Testing Agent:

- owns cross-system tests under `tests/**`
- may inspect every subsystem
- does not edit subsystem-local test/code paths without Integration handoff
- does not redesign subsystem contracts

---

## 5. Shared Files

Integration-controlled:

~~~text
SPEC.md
AGENTS.md
README.md
package.json
.gitignore
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
docs/architecture/AWS_ARCHITECTURE.md
docs/deployment/DEPLOYMENT_SPEC.md
docs/specs/integration/SPEC.md
~~~

Subsystem agents should propose rather than silently edit shared contracts after lock.

---

## 6. Integration Order

PROJECT DECISION

Recommended implementation/integration sequence:

~~~text
Stage 0
Lock Master / Shared / API / Data contracts

Stage 1 — Parallel
Frontend
Backend
Infrastructure

Stage 2
Deployment/Tooling wiring
Dev Mode tooling
Contract tests

Stage 3
Backend ↔ Data
Backend ↔ Infrastructure
Frontend ↔ Backend
Files flow
Notification flow

Stage 4
Core E2E
Tenant/security validation
AWS deployment smoke

Stage 5
Fix contract mismatches
Final review
~~~

This sequence does not require one subsystem to be fully complete before all others begin.

---

## 6A. Source Phase Compatibility

The Final source defines a sequential 10-phase functional reference:

~~~text
Baseline
Auth
Organization
Product / Campaign
Order / Payment
Production / Pickup
Notification / Report / Audit
AWS Infrastructure
One-command Deploy
E2E Verification
~~~

**PROJECT DECISION**

The parallel-agent plan reorganizes execution order and ownership only. Integration reports must still map delivered work back to these source milestones so the original implementation framing is not silently discarded.

---

## 7. Frontend ↔ Backend Compatibility Gate

Verify:
- every Frontend API call exists in API_CONTRACT
- Backend implements same method/path
- request body names match, including Pre-signed upload `contentType`
- response envelope matches
- error.code values match
- timestamps match ISO UTC
- money uses integer satang
- list pagination uses items + nextCursor
- role/status tokens match
- Customer Order/Payment/Pickup flows use authenticated ownership without requiring Organization membership
- Frontend never depends on Backend storage fields

No local adapter may hide a contract mismatch without updating the canonical API contract.

---

## 8. Backend ↔ Data Compatibility Gate

Verify:

- repository key builders match Data Spec
- one table
- PK/SK
- GSI1PK/GSI1SK
- CampaignOrderLink
- PickupLink for Organization pickup list/`pickupId` resolution
- Organization-owned entities contain organizationId
- OrderItem snapshot fields match
- Payment/Pickup statuses match
- late Payment lifecycle maps `OPEN approval → PAID`, `CLOSED approval → CONFIRMED`
- Notification item keys match
- Audit action tokens match
- normal request paths avoid full-table Scan

---

## 9. Backend ↔ Infrastructure Gate

Verify environment and resources:

~~~text
AppTableName
→ APP_TABLE_NAME

FilesBucketName
→ FILES_BUCKET_NAME

NotificationQueueURL
→ NOTIFICATION_QUEUE_URL

JWT parameter
→ JWT_SECRET
~~~

Deployment/CLI region is `us-east-1`. Lambda itself receives reserved `AWS_REGION` from the runtime; Infrastructure must not inject `AWS_REGION` into Lambda `Environment.Variables`.

Verify handlers:

~~~text
BackendFunction → src/lambda.handler
WorkerFunction  → src/worker.handler
~~~

Verify LabRole is used.

Backend must not hard-code resource names.

---

## 10. Frontend ↔ Infrastructure Gate

Verify:

- production Frontend builds to frontend/out
- deployment sync target is FrontendBucketName
- FrontendWebsiteURL is used as deployed site URL
- ApiBaseURL becomes NEXT_PUBLIC_API_BASE_URL + /api/v1
- API CORS allows deployed Frontend origin
- Files S3 CORS allows deployed Frontend origin
- no AWS credentials are embedded in Frontend

---

## 11. Deployment ↔ Infrastructure Gate

Deployment must consume exact output keys:

~~~text
FrontendBucketName
FrontendWebsiteURL
FilesBucketName
AppTableName
NotificationQueueURL
BackendFunctionName
WorkerFunctionName
ApiBaseURL
~~~

Deployment must not guess:

- S3 bucket names
- Lambda names
- queue URL
- API ID

CloudFormation remains the infrastructure source of truth.

---

## 11A. Build Command Handoff Gate

**PROJECT DECISION**

Deployment relies on these subsystem-owned command contracts:

```text
Frontend:
npm ci
npm test
npm run build
→ frontend/out

Backend:
npm ci
npm test
npm run check
→ scripts/build-backend.sh assembles backend/.build/lambda/
→ BackendFunction/WorkerFunction share artifact with different handlers
```

Platform Admin seed:

```text
npm run seed:platform-admin
→ backend/scripts/seed-platform-admin.js
```

Integration must verify these commands exist before Deployment Agent finalizes orchestration.

---

## 12. Dev Mode ↔ Production Gate

Verify only environment/transport changes.

Same:

- API paths
- auth/JWT
- roles
- tenant enforcement
- business rules
- data semantics
- key conventions
- file object-key conventions
- notification event schema

Different:

~~~text
AWS:
S3 Website + API Gateway/Lambda + AWS managed DynamoDB/S3/SQS

Local:
Next Dev Server + local Express + LocalStack DynamoDB/S3/SQS + local Worker
~~~

No dev-only bypass may leak into production behavior.

---

## 13. File Flow Integration

Canonical flow:

~~~text
Frontend
→ Backend Pre-signed endpoint
→ Backend authorizes
→ Backend returns URL + objectKey
→ Frontend transfers directly with S3
→ Frontend submits/persists objectKey through API
~~~

Integration verifies:

- Product path
- Payment path
- CORS
- expiry
- private Payment Slip
- tenant/ownership check
- direct browser transfer

---

## 14. Notification Integration

Canonical:

~~~text
Business Service
→ commit core transaction
→ publish SQS event
→ Worker
→ Notification item
→ GET /notifications
→ mark read
~~~

Integration verifies:

- exact event token
- exact payload schema
- recipientUserId
- idempotency
- core transaction independence from notification failure
- Frontend notification DTO compatibility

---

## 15. Core Business Integration Flow

~~~text
Register
→ Login
→ Organization
→ Staff/Member
→ Store
→ Product / Variant
→ Campaign
→ Order
→ Payment Slip
→ Payment Verification
→ Production Summary
→ Ready for Pickup
→ Pickup
→ RECEIVED
~~~

This is the primary demo path.

The post-PAID status mechanics are resolved in Shared/API contracts and this integration path must follow them exactly.

---

## 16. Integration Handoff Artifact

Each subsystem handoff provides:

- summary
- FR IDs covered
- files changed
- install/build/test/dev commands
- required environment variables
- contract changes
- known issues
- OPEN DECISION blockers
- test results

Integration Agent rejects a handoff that silently changed a shared contract.

---

## 17. Contract Change During Parallel Work

When an agent needs a shared change:

~~~text
detect gap
→ stop affected slice
→ propose canonical contract change
→ identify impacted agents
→ Integration updates/approves shared contract
→ affected specs/tests updated
→ agents resume
~~~

Unrelated work continues.

---

## 18. Breaking Change Definition

Breaking integration change includes:

- route rename
- HTTP method change
- request/response field change
- status token change
- role token change
- Data key change
- environment variable rename
- CloudFormation output rename
- notification payload change
- file path change
- auth behavior change

Breaking changes require coordinated update, not unilateral implementation.

---

## 19. Compatibility Versioning

PROJECT DECISION

MVP uses one synchronized contract version rather than independently versioned subsystem schemas.

API remains:

~~~text
/api/v1
~~~

Notification payload has its own:

~~~text
version = 1
~~~

If a breaking API version becomes necessary later, introduce it explicitly rather than silently altering v1.

---

## 20. Root package.json Integration

Root package.json is shared Integration ownership.

Target command surface:

~~~text
npm run dev:setup
npm run dev
npm run dev:seed
npm run dev:reset
npm run dev:down
npm run seed:platform-admin
npm run deploy
npm run destroy
~~~

Exact subsystem script delegation is implementation detail.

No subsystem agent should overwrite unrelated root commands.

---

## 21. Environment Matrix

| Concept | Local Dev | AWS Learner Lab |
|---|---|---|
| Frontend | localhost:3000 | S3 WebsiteURL |
| API | localhost:4000 | API Gateway |
| DynamoDB | LocalStack | AWS DynamoDB |
| Files | LocalStack S3 | private AWS S3 |
| Queue | LocalStack SQS | AWS SQS |
| Worker | local process | Lambda Worker |
| Logs | terminal | CloudWatch |
| Auth | same JWT code | same JWT code |
| Region semantic | us-east-1 | us-east-1 |

Contract semantics must remain the same.

---

## 22. Resolved Decision Gate

The previously blocking cross-system gaps are now explicit PROJECT DECISIONs and must stay synchronized across implementation:

~~~text
Campaign cancellation guard
post-PAID Order progression
Order cancellation actors/states
Pickup token format
no automatic MVP retention/TTL cleanup
Last Organization Admin protection
Dashboard metric schema
upload size/MIME limits
no project-created SQS DLQ
CloudFormation tooling artifact bucket
Platform Admin persistence
public Storefront read API
Static Export trailing-slash routing
Frontend/Backend command handoff
Testing ownership under tests/**
~~~

There are no remaining MVP-blocking OPEN DECISIONs.

If a new unresolved requirement appears, register it in Shared Contracts and stop only the dependent slice until Integration resolves it.

---

## 23. Conflict Resolution Rule

If two implementations disagree:

1. do not select whichever implementation already has more code
2. check source-of-truth hierarchy
3. check Shared/API/Data contracts
4. if source supports one side, conform implementation to source
5. if source does not support either side, record PROJECT/OPEN DECISION
6. update contract first
7. update both implementations/tests

---

## 24. Merge Conflict Rule

Directory ownership should make most conflicts rare.

For shared-file conflicts:

- Integration Agent resolves
- preserve both valid subsystem command needs
- do not discard contract changes without review
- rerun compatibility checks after resolution

Generated artifacts should not be committed if they create unnecessary merge conflicts.

---

## 25. Integration Checkpoints

### Checkpoint A — Contracts

Must exist:

- Master
- Agents
- Architecture
- Shared
- API
- Data

### Checkpoint B — Subsystem Specs

Must exist:

- Frontend
- Backend
- Infrastructure
- Dev
- Testing
- Integration
- Deployment

### Checkpoint C — Parallel Implementations

Frontend/Backend/Infrastructure build independently.

Cross-system tests are developed under `tests/**` without taking ownership of subsystem directories.

### Checkpoint D — Interface Compatibility

API/Data/env/output checks pass.

### Checkpoint E — Local System

Dev Mode core flow works.

### Checkpoint F — AWS System

npm run deploy succeeds and smoke passes.

### Checkpoint G — E2E/Security

Core flow + tenant isolation pass.

---

## 26. Requirement Completion Rule

FR-01..FR-15 are system requirements, not subsystem completion labels.

A requirement is complete only when:

~~~text
implementation exists
+
shared contracts match
+
required test passes
+
cross-subsystem dependency works
~~~

Example:

FR-08 Payment is not complete merely because Backend approve endpoint exists.

It requires:

- Frontend slip flow
- Backend review
- private Files bucket
- Pre-signed integration
- Data status
- Audit
- SQS event
- relevant tests

---

## 27. Final Core Integration Acceptance

Before demo:

- Register/Login works
- Organization access works
- Store/Product/Variant management works
- Campaign flow works for resolved transitions
- Customer creates Order
- Order snapshots correct
- Payment Slip private/direct-upload flow works
- Staff approve/reject works
- Audit is written
- Notification async flow works
- Production Summary correct
- Ready for Pickup notification works
- Pickup confirmation works once
- duplicate Pickup rejected
- tenant isolation passes
- Platform Admin basic flow works
- /health works
- static Frontend works from S3 Website
- CloudWatch receives Backend/Worker logs
- no forbidden architecture dependency exists

---

## 28. Parallel-Agent Readiness Criteria

The project is ready to hand to implementation agents when:

- [ ] Frontend Agent has Master + Shared + API + Frontend Spec
- [ ] Backend Agent has Master + Shared + API + Data + Backend + Architecture
- [ ] Infrastructure Agent has Master + Shared + Architecture + Data + Infrastructure + Deployment
- [ ] Deployment Agent has Master + Architecture + Infrastructure + Deployment
- [ ] Testing Agent has Master + Shared + API + Data + Testing
- [ ] ownership boundaries do not overlap significantly
- [ ] shared contract changes have a defined protocol
- [ ] each subsystem has acceptance criteria
- [ ] previously blocking decisions are explicitly resolved as PROJECT DECISIONs
- [ ] Testing Agent owns tests/** without overlapping subsystem code ownership
- [ ] no implementation depends on historical CloudFront/Cognito/SES architecture

---

## 29. Integration Definition of Done

Integration is complete when:

- [ ] contracts and implementations agree
- [ ] no hidden compatibility adapters mask contract drift
- [ ] required FR mappings pass
- [ ] local Dev Mode smoke passes
- [ ] AWS deployment smoke passes
- [ ] core E2E passes
- [ ] tenant/security tests pass
- [ ] Payment Slip privacy passes
- [ ] notification async flow passes
- [ ] final diff/review finds no architecture drift
- [ ] no MVP-blocking unresolved decision remains
