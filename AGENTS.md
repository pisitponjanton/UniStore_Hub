# UniStore Hub — Agent Working Agreement

> **Purpose:** Parallel-agent implementation rules and ownership boundaries  
> **Applies to:** Frontend, Backend, Infrastructure, Deployment/Tooling, Testing and Integration agents  
> **Read with:** `SPEC.md` and `docs/specs/00-shared-contracts.md`  
> **Status:** PROJECT DECISION for implementation coordination

---

## 1. Why This File Exists

UniStore Hub is intentionally split so multiple agents can work in parallel.

The goal is to allow independent implementation without:

- redefining shared behavior
- changing another subsystem's files
- introducing incompatible API/data contracts
- creating hidden architecture changes
- causing unnecessary merge conflicts
- making local development behave differently from the AWS deployment

This file defines **how agents work**, not the business rules themselves.

Business and architecture truth remains in:

```text
SPEC.md
docs/specs/00-shared-contracts.md
docs/architecture/AWS_ARCHITECTURE.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
```

---

## 2. Required Read Order

Every implementation agent must read documents in this order.

### 2.1 All Agents

1. `SPEC.md`
2. `docs/specs/00-shared-contracts.md`
3. The specification for the agent's own subsystem

### 2.2 Additional Required Reads by Agent

#### Frontend Agent

Read:

```text
SPEC.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/frontend/SPEC.md
```

Read `docs/architecture/AWS_ARCHITECTURE.md` only when working on:

- API connectivity
- Pre-signed URL file flow
- deployment-sensitive behavior

Frontend Agent does not need to read Backend implementation details.

#### Backend Agent

Read:

```text
SPEC.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
docs/specs/backend/SPEC.md
```

Also read:

```text
docs/architecture/AWS_ARCHITECTURE.md
```

for S3 / SQS / Lambda / DynamoDB boundaries.

#### Infrastructure Agent

Read:

```text
SPEC.md
docs/specs/00-shared-contracts.md
docs/architecture/AWS_ARCHITECTURE.md
docs/specs/data/SPEC.md
docs/specs/infrastructure/SPEC.md
docs/deployment/DEPLOYMENT_SPEC.md
```

Infrastructure Agent does not define API business behavior.

#### Deployment / Tooling Agent

Read:

```text
SPEC.md
docs/architecture/AWS_ARCHITECTURE.md
docs/specs/infrastructure/SPEC.md
docs/deployment/DEPLOYMENT_SPEC.md
```

When commands depend on application outputs, also read the relevant shared/API contract.

#### Testing Agent

Read:

```text
SPEC.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
docs/specs/testing/SPEC.md
```

Testing Agent may inspect all implementation directories but should not redesign them.

#### Root / Integration Agent

The agent operating from the repository root is the **global checker and integration coordinator**.

It must read all specification documents and may inspect **every project directory**:

```text
frontend/**
backend/**
infrastructure/**
scripts/**
tests/**
docs/**
root shared files
```

Its default job is to **check, compare, verify, and report** across all owned areas rather than implement subsystem work itself.

Root / Integration Agent is responsible for:

- checking every subsystem against `SPEC.md` and the canonical shared contracts
- checking that each directory follows its local `AGENT.md`
- checking code ownership boundaries and detecting cross-directory edits
- contract reconciliation
- root shared files
- cross-subsystem integration
- API ↔ Frontend ↔ Backend compatibility
- Backend ↔ Data ↔ Infrastructure compatibility
- Deployment ↔ Infrastructure ↔ application output compatibility
- Testing coverage and FR-01..FR-15 traceability
- final compatibility checks
- merge conflict resolution
- detecting security, tenant-isolation, architecture, and scope drift
- ensuring no subsystem silently changed shared behavior

### Root Checker Write Boundary

By default, the Root / Integration Agent may write only root/shared Integration-owned files.

Subsystem directories are **read/inspect/check by default**, not general-purpose write targets.

If the root checker finds a problem inside a subsystem, it should report the finding to the owning agent. It may edit that subsystem only when the user explicitly requests the root agent to perform the fix, or when an explicit Integration handoff authorizes a minimal cross-system compatibility fix.


## 3. Source of Truth Hierarchy

If implementation intent conflicts, use this order:

1. Final System & Deployment Specification
2. Attached AWS System Architecture
3. `SPEC.md`
4. `docs/specs/00-shared-contracts.md`
5. `docs/api/API_CONTRACT.md`
6. `docs/specs/data/SPEC.md`
7. The current subsystem's `SPEC.md`
8. Prototype / wireframe for UX intent only

An agent must not override a higher-level contract from a lower-level file.

If a conflict is discovered:

1. stop the conflicting implementation
2. document the conflict
3. escalate to Integration ownership
4. update the canonical contract first
5. resume implementation only after the contract is resolved

---

## 4. Primary Code Ownership

Implementation ownership is directory-based.

| Agent | Primary write ownership |
|---|---|
| Frontend Agent | `frontend/**` |
| Backend Agent | `backend/**` |
| Infrastructure Agent | `infrastructure/**` |
| Deployment / Tooling Agent | `scripts/**` |
| Integration Agent | root shared files + cross-subsystem reconciliation |
| Testing Agent | `tests/**` for cross-system tests; subsystem-local tests stay with subsystem owners |

### 4.1 Frontend Agent

May write:

```text
frontend/**
```

Must not directly edit:

```text
backend/**
infrastructure/**
scripts/**
```

unless explicitly acting under Integration ownership.

### 4.2 Backend Agent

May write:

```text
backend/**
```

Must not directly edit:

```text
frontend/**
infrastructure/**
scripts/**
```

### 4.3 Infrastructure Agent

May write:

```text
infrastructure/**
```

Must not directly edit:

```text
frontend/**
backend/**
scripts/**
```

### 4.4 Deployment / Tooling Agent

May write:

```text
scripts/**
```

Root `package.json` is a shared file and is not owned exclusively by this agent.

Changes to root scripts require Integration ownership or an approved handoff.

### 4.5 Testing Agent

May write cross-system suites under:

```text
tests/**
```

Must not directly edit:

```text
frontend/**
backend/**
infrastructure/**
scripts/**
```

for test implementation unless an Integration handoff explicitly assigns a cross-subsystem fix.

Frontend/Backend unit tests inside their owned directories remain the responsibility of those subsystem agents.

### 4.6 Data Design

There is no independent implementation agent that owns both Backend and Infrastructure for Data.

`docs/specs/data/SPEC.md` is a **shared design contract**.

Implementation split:

- Backend Agent implements repositories / mappings / application access patterns.
- Infrastructure Agent implements DynamoDB table / index resources.
- Integration Agent verifies that both match the same Data Spec.

This avoids one Data Agent editing both `backend/**` and `infrastructure/**` in parallel.

---

## 5. Shared File Ownership

The following are shared / integration-controlled files:

```text
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
```

Subsystem agents may propose changes to these files but should not silently change them while implementing their own subsystem.

### 5.1 Allowed Exception

During the specification-building phase before parallel implementation begins, the planning/integration workflow may create or update these shared files directly.

After the contract lock gate, shared changes are integration-impacting.

---

## 6. Contract Lock Gate

Parallel implementation must not begin until these files exist and have been reviewed:

```text
SPEC.md
AGENTS.md
docs/architecture/AWS_ARCHITECTURE.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
```

Once locked:

```text
Frontend Agent       ┐
Backend Agent        ├─ can start in parallel
Infrastructure Agent ┘
```

Deployment / Tooling can proceed when Infrastructure output names and repository commands are stable.

Testing can begin contract tests as soon as API/Data/Shared contracts are locked, before all implementation is complete.

---

## 7. Shared Contract Change Protocol

A change is **shared-contract-impacting** when it modifies any of the following:

- Role token
- Status token
- Entity field used across subsystems
- API route
- HTTP method
- request/response shape
- error code
- JWT semantics
- tenant / ownership rule
- file key/path convention
- Pre-signed URL behavior
- notification event token or payload
- DynamoDB key/GSI contract
- CloudFormation output consumed by another subsystem
- environment variable consumed by another subsystem
- deployment command used by multiple subsystems

### 7.1 Required Change Process

The agent requesting the change must:

1. identify the current contract
2. explain why the change is needed
3. identify affected files/subsystems
4. update the canonical shared document first
5. mark the change as:
   - FINAL source correction
   - PROJECT DECISION
   - resolved OPEN DECISION
6. update affected subsystem specs
7. update contract/integration tests
8. obtain Integration review before dependent agents continue

### 7.2 Forbidden Pattern

Do not do this:

```text
Frontend expects field A
Backend returns field B
→ each side adds local adapters without updating API_CONTRACT
```

Correct response:

```text
Resolve the shared contract
→ update API_CONTRACT
→ update both implementations
→ update tests
```

---

## 8. Open Decision Protocol

`docs/specs/00-shared-contracts.md` contains the canonical decision register. The current MVP has no blocking OPEN DECISIONs.

An implementation agent encountering a newly introduced OPEN DECISION must not choose behavior silently.

The current MVP shared contract has resolved the previously blocking decisions. If future work introduces a new unresolved requirement, it must be registered before dependent implementation proceeds.

A future OPEN DECISION may be introduced only when the source and current PROJECT DECISIONs genuinely do not define required behavior.

Required behavior:

```text
Encounter OPEN DECISION
→ stop only the dependent implementation slice
→ document proposed decision
→ resolve in canonical contract
→ continue dependent work
```

Unrelated work can continue in parallel.

---

## 9. Architecture Change Protocol

No subsystem agent may independently add, remove or replace an AWS service.

The final Learner Lab architecture is:

```text
S3 Static Website
API Gateway
Backend Lambda / Express.js
DynamoDB
Private S3 Files
SQS
Worker Lambda
CloudWatch
Cost Explorer / Learner Lab Budget
LabRole
```

Architecture changes require Integration ownership and updates to:

```text
SPEC.md
docs/architecture/AWS_ARCHITECTURE.md
docs/specs/00-shared-contracts.md   (if behavior changes)
affected subsystem specs
affected tests
```

### 9.1 Forbidden Architecture Drift

Do not add these because they appeared in older documents:

```text
CloudFront
Cognito
SES
EC2
RDS
NAT Gateway
ALB
ECS
EKS
```

unless the project baseline is intentionally changed.

---

## 10. Frontend / Backend Boundary

Frontend owns:

- rendering
- navigation
- input collection
- client state
- loading/success/empty/error/unauthorized/forbidden UI states
- API calls
- user-friendly presentation
- role-based UI visibility for UX

Frontend does **not** own:

- authoritative role decisions
- tenant authorization
- resource ownership enforcement
- campaign/order transition validation
- payment approval rules
- pickup duplicate protection

Backend owns those authoritative checks.

Frontend must never rely on hidden UI as the only permission control.

---

## 11. Backend / Infrastructure Boundary

Backend owns:

- Express application
- authentication/business logic
- repository logic
- S3 SDK operations
- SQS publish logic
- notification worker application code
- API behavior

Infrastructure owns:

- Lambda resources/configuration
- API Gateway resource configuration
- DynamoDB table/index resource configuration
- S3 buckets/policies/CORS
- SQS resource/event source mapping
- CloudWatch log groups/retention
- environment variable injection
- CloudFormation outputs
- existing LabRole wiring

Backend must not hard-code deployment resource names when stack outputs/environment variables exist.

Infrastructure must not invent business rules.

---

## 12. Backend / Data Boundary

Data Spec defines:

- entity names
- required fields
- PK/SK patterns
- GSI purpose
- access patterns
- snapshot behavior
- tenant-safe query invariants

Backend implements those contracts through repositories.

Backend Agent may choose internal repository helper structure, but may not redefine the key contract without updating Data Spec.

Infrastructure implements the physical DynamoDB keys/index definitions defined by Data Spec.

---

## 13. Frontend / API Boundary

Frontend must treat `docs/api/API_CONTRACT.md` as authoritative for:

- route
- method
- auth requirement
- request body
- query parameters
- response body
- errors
- action semantics

Frontend must not infer endpoint names from screen names.

Backend must not expose undocumented alternate routes that Frontend then depends on.

---

## 14. File Upload Boundary

Canonical flow:

```text
Frontend
→ API request for authorized Pre-signed URL
→ Backend validates
→ Backend generates URL
→ Frontend uploads/downloads directly with S3 Files
```

Ownership:

- Frontend Agent: upload/download client UX
- Backend Agent: authorization + Pre-signed URL generation
- Infrastructure Agent: Files S3 bucket + permissions + CORS
- Testing Agent: end-to-end authorization and private-file checks

No agent may make Payment Slip public to simplify implementation.

---

## 15. Notification Boundary

Canonical flow:

```text
Backend business operation
→ SQS
→ Worker Lambda
→ DynamoDB Notification
→ Frontend reads notifications via API
```

Ownership:

- Backend Agent:
  - event publishing
  - worker application behavior
  - notification repository/API behavior
- Infrastructure Agent:
  - queue
  - event source mapping
  - worker Lambda resource
  - environment wiring
- Frontend Agent:
  - notification list/read UX
- Testing Agent:
  - async flow and non-blocking failure behavior

Notification failure must not break the core Order/Payment transaction.

---

## 16. Development Mode Boundary

Development Mode is a **PROJECT DECISION**.

The Dev Mode spec may introduce local tools or emulators, but must preserve:

- API shape
- role tokens
- JWT semantics
- RBAC behavior
- tenant isolation behavior
- business rules
- data semantics
- S3 file-flow semantics
- notification event semantics

A local development shortcut must not require production-specific code forks in business modules.

Preferred principle:

```text
same application code
+
environment-specific adapters/configuration
```

rather than:

```text
separate fake application for local mode
```

---

## 17. Environment Variable Ownership

Each environment variable must have one producer and one consumer contract.

Typical ownership:

| Variable | Producer / definition | Consumer |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Deployment/Infrastructure output integration | Frontend |
| `APP_TABLE_NAME` | Infrastructure | Backend / Worker |
| `FILES_BUCKET_NAME` | Infrastructure | Backend |
| `NOTIFICATION_QUEUE_URL` | Infrastructure | Backend |
| `JWT_SECRET` | Deployment/Infrastructure parameter | Backend |
| `JWT_EXPIRES_IN` | Deployment configuration | Backend |

Agents must not create duplicate environment variables for the same concept without updating shared/deployment contracts.

---

## 18. CloudFormation Output Ownership

Infrastructure is responsible for producing the source-defined outputs:

```text
FrontendBucketName
FrontendWebsiteURL
FilesBucketName
AppTableName
NotificationQueueURL
BackendFunctionName
WorkerFunctionName
ApiBaseURL
```

Deployment / Tooling consumes them.

Frontend/Backend should not parse CloudFormation directly as part of normal runtime behavior.

---

## 19. Root File Rules

Root-level files are high-conflict shared files.

Examples:

```text
package.json
README.md
.gitignore
SPEC.md
AGENTS.md
```

### 19.1 During Parallel Implementation

Subsystem agents should avoid editing root files.

If a root change is required:

1. provide the required change as a handoff
2. Integration Agent applies/reconciles it
3. integration tests verify it

This is especially important for root `package.json` scripts.

---

## 20. Handoff Contract

Every implementation agent should hand off work with:

### 20.1 Summary

- what was implemented
- what was intentionally not implemented
- which FR IDs are covered

### 20.2 Contract Changes

- shared contract changes: yes/no
- API contract changes: yes/no
- Data contract changes: yes/no
- Infrastructure output changes: yes/no

If yes, identify exact changes.

### 20.3 Files Changed

List files/directories changed.

### 20.4 Commands

Provide:

- install command
- build command
- test command
- dev command if applicable

### 20.5 Environment

List required environment variables.

Do not include secrets.

### 20.6 Known Issues / Open Decisions

List unresolved blockers and corresponding OPEN DECISION IDs.

### 20.7 Verification

Report tests run and results.

---

## 21. Merge Conflict Avoidance

### 21.1 Preferred Branch / Work Unit Model

Each agent works on a narrow subsystem task.

Example:

```text
agent/frontend-*
agent/backend-*
agent/infrastructure-*
agent/deployment-*
agent/testing-*
```

Exact branch naming is optional; directory ownership is mandatory.

### 21.2 Avoid Shared Generated Files

Do not commit unnecessary generated build artifacts that create cross-agent conflicts.

### 21.3 Shared Contract First

If two agents need the same new concept:

```text
define shared contract first
→ then implement independently
```

### 21.4 Do Not Fix Another Agent's Area Opportunistically

If Frontend finds a Backend issue:

- report it
- add a failing contract/integration test if appropriate
- do not patch `backend/**` from the Frontend work unit unless Integration ownership explicitly allows it

---

## 22. Testing Responsibilities by Agent

### Frontend Agent

Must verify:

- type/build checks
- route/page rendering
- required UI states
- API client mapping
- role visibility UX

### Backend Agent

Must verify:

- unit/service logic
- validators
- policies
- repository behavior
- API contract behavior
- tenant isolation
- async event publishing behavior

### Infrastructure Agent

Must verify:

- CloudFormation validation
- resource references
- outputs
- IAM/LabRole wiring
- bucket privacy
- CORS
- event source mapping
- log groups

### Deployment / Tooling Agent

Must verify:

- deployment commands
- stack output reading
- frontend build/sync
- health check
- command failure handling

### Testing Agent

Owns cross-system suites defined by `docs/specs/testing/SPEC.md`.

---

## 23. Root Integration / Global Checker Ownership

The Root / Integration Agent is the project-wide verification layer and the default checker for every directory.

It may inspect/read every project area:

```text
frontend/**
backend/**
infrastructure/**
scripts/**
tests/**
docs/**
root shared files
```

The root checker must verify:

- each subsystem follows `SPEC.md` and its subsystem spec
- each subsystem follows its local `AGENT.md`
- ownership boundaries are respected
- Frontend ↔ API ↔ Backend contracts match
- Backend ↔ Data ↔ Infrastructure contracts match
- Deployment ↔ Infrastructure ↔ application outputs match
- environment variables and CloudFormation outputs match
- tenant isolation and security invariants remain intact
- cross-system tests and E2E behavior match the reviewed contracts
- FR-01 through FR-15 remain traceable
- no subsystem silently introduces architecture or scope drift

### 23.1 Checker-First Rule

The normal root workflow is:

```text
inspect
→ compare against canonical contracts
→ run checks/tests
→ record findings
→ hand findings to the owning directory/agent
```

The root agent should not opportunistically implement subsystem work just because it can see every directory.

### 23.2 Root Write Boundary

By default, the Root / Integration Agent may write only root/shared Integration-owned files.

Child subsystem directories are **read-only to the root checker by default**.

The Root / Integration Agent may edit a child subsystem only when:

1. the user explicitly asks the root agent to perform that fix, or
2. an explicit Integration handoff authorizes a verified cross-system compatibility fix.

Any cross-directory fix must be minimal, documented, and must still obey that directory's local `AGENT.md` plus all shared contracts.

### 23.3 Final Reconciliation Ownership

Root / Integration owns final reconciliation of:

- shared contracts
- root files
- API compatibility
- Data/API compatibility
- Backend/Infrastructure resource naming
- environment variables
- CloudFormation outputs
- deployment command compatibility
- cross-system tests
- E2E flow
- final architecture compliance

---

## 24. Minimum Compatibility Gates

Before integration is considered healthy:

### Gate A — Shared Contracts

- roles match
- status tokens match
- tenant rules match
- event tokens match
- file paths match

### Gate B — API

- Frontend requests match Backend routes/methods
- request/response shapes match
- errors match documented contract

### Gate C — Data

- Backend repository keys match Data Spec
- Infrastructure indexes match Data Spec

### Gate D — AWS

- Backend environment variables match Infrastructure outputs/config
- S3/SQS/DynamoDB names are injected, not guessed

### Gate E — Deployment

- build commands work
- CloudFormation packages/deploys
- frontend receives the deployed API URL
- `GET /health` succeeds

### Gate F — Core Business Flow

```text
Register
→ Login
→ Organization
→ Store
→ Product / Variant
→ Campaign
→ Order
→ Payment
→ Production
→ Ready for Pickup
→ Pickup
```

---

## 25. Agent Stop Conditions

An agent should stop the affected slice and request contract resolution when:

- required behavior is marked OPEN DECISION
- source/spec conflict is found
- another subsystem must change its public interface
- an AWS service change appears necessary
- a security/tenant rule cannot be satisfied under the current contract
- implementation requires editing another agent's owned directory
- a shared API/data/event contract is missing

An agent should **not** stop unrelated implementation that can proceed safely.

---

## 26. Forbidden Shortcuts

Do not:

- bypass Backend authorization because Frontend hides a button
- use resource ID alone for tenant-owned data access
- make Payment Slip public
- proxy large business files through API Gateway when the architecture requires Pre-signed URL direct transfer
- replace JWT auth with Cognito
- replace SQS notification flow with SES
- introduce CloudFront into the Learner Lab baseline
- create custom IAM roles when `LabRole` is the baseline
- create a separate fake business logic path only for local development
- rename shared statuses locally
- add undocumented API routes for convenience
- duplicate root/shared config independently in multiple subsystem branches

---

## 27. Implementation Readiness

An agent is ready to start implementation only when its required read set exists.

### Source Phase Compatibility

The Final source defines Implementation Phases 1–10 as a sequential functional reference.

**PROJECT DECISION**

Parallel-agent execution does not delete or rewrite those source phases. It reorganizes work ownership so independent pieces can proceed concurrently while preserving the same functional milestones.

Integration/Testing must still be able to map completed work back to the source sequence:

```text
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
```

### Frontend Ready When

```text
SPEC.md
AGENTS.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/frontend/SPEC.md
```

exist and required OPEN DECISIONs for the assigned slice are resolved.

### Backend Ready When

```text
SPEC.md
AGENTS.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
docs/specs/backend/SPEC.md
```

exist.

### Infrastructure Ready When

```text
SPEC.md
AGENTS.md
docs/architecture/AWS_ARCHITECTURE.md
docs/specs/data/SPEC.md
docs/specs/infrastructure/SPEC.md
docs/deployment/DEPLOYMENT_SPEC.md
```

exist.

---

## 28. Final Rule

Parallelism is allowed at the **implementation layer**, not at the expense of contract consistency.

The intended working model is:

```text
Shared Contracts Locked
        ↓
┌────────────────────┬────────────────────┬────────────────────┐
│ Frontend Agent     │ Backend Agent      │ Infrastructure     │
│ frontend/**        │ backend/**         │ infrastructure/**  │
└────────────────────┴────────────────────┴────────────────────┘
        ↓                    ↓                    ↓
             Integration + Testing
                      ↓
                Deployment
```

When in doubt:

```text
Do not guess.
Check the shared contract.
Escalate the contract gap.
Then implement.
```
