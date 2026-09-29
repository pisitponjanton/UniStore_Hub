# Source Cross-check Findings

## Phase 12 Resolution Status

**RESOLVED — all Phase 10 findings were addressed before final diff review.**

Resolution summary:

- FINDING-01 → Production Summary normalized to Organization Admin
- FINDING-02 → Platform Admin authority persisted as `User.platformRole = PLATFORM_ADMIN | null`
- FINDING-03 → Order child partitions hardened to `ORG#{organizationId}#ORDER#{orderId}`
- FINDING-04 → Backend module files use source-prefixed naming such as `order.routes.js`
- FINDING-05 → duplicate Shared Contract tail removed
- FINDING-06 → source Implementation Phases 1–10 preserved as functional reference; parallel scheduling marked PROJECT DECISION

Additional Phase 11 gaps were also resolved in the canonical specs.

> Temporary verification artifact for Phase 10.  
> Basis: Final System & Deployment Specification + attached AWS architecture diagram.  
> Resolution target: Phase 12 — Fix source mismatches and contract gaps.

## Cross-check Result

Core architecture, FR-01..FR-15, repository paths, CloudFormation resource families, deployment flow, Learner Lab region/role constraints, Static Export, JWT, DynamoDB, S3 Pre-signed flow, SQS Worker flow, CloudWatch and Definition of Done are represented in the rebuilt specs.

The historical mismatches/gaps below required correction before final review and are retained for traceability. Their resolutions are summarized above.

### FINDING-01 — Production Summary permission mismatch

Final source assigns Production Summary to **Organization Admin**.

Current specs expose Production Summary to **Staff / Organization Admin** in API and Frontend route contracts.

Required resolution:

- normalize Production Summary to Organization Admin, or
- if broader Staff access is intentionally desired, mark it explicitly as a PROJECT DECISION and update Shared/API/Frontend/Backend/Tests consistently.

For source alignment, prefer Organization Admin.

### FINDING-02 — Platform Admin authorization source missing

Final source defines Platform Admin capabilities and includes a platform-admin seed script in the target repository.

Current contracts name PLATFORM_ADMIN but do not define where the authority is persisted/resolved.

Current User fields do not include a platform role/capability field.

Required resolution:

- introduce an explicit PROJECT DECISION for Platform Admin persistence, e.g. an optional User-level platformRole/capability,
- update GET /me DTO,
- update Backend Platform Admin policy,
- update Frontend navigation contract,
- update seed and tests.

### FINDING-03 — Tenant rule vs child key strategy

Final source states:

- every Organization-owned resource has organizationId
- tenant resources must not be queried by resourceId alone

The source key examples also show:

~~~text
ORDER#{orderId} / PAYMENT#{paymentId}
ORDER#{orderId} / PICKUP
~~~

Current Data Spec similarly uses ORDER#{orderId} partitions for OrderItem/Payment/Pickup.

This leaves the strict tenant-query rule ambiguous.

Required resolution:

- explicitly document a PROJECT DECISION that reconciles the source tension,
- preferably use tenant-qualified child partitions or another tenant-scoped access pattern,
- update access-pattern matrix and Backend repository contract consistently.

Do not leave the contradiction implicit.

### FINDING-04 — Backend module filename pattern differs from source example

Final source gives the concrete example:

~~~text
modules/orders/
├── order.routes.js
├── order.controller.js
├── order.service.js
├── order.repository.js
├── order.validator.js
├── order.policy.js
├── order.mapper.js
├── order.constants.js
└── index.js
~~~

Current Backend Spec generalizes this to routes.js, controller.js, service.js, etc.

Required resolution:

- preserve the source naming convention in the Backend Spec, or
- explicitly mark the generalized naming as PROJECT DECISION.

For source alignment, prefer the source-prefixed naming convention.

### FINDING-05 — Shared contract duplicate tail

docs/specs/00-shared-contracts.md contains duplicated resolved-decision lines after the Open Decisions Register.

Required resolution:

- remove duplicated lines,
- leave one canonical register.

### FINDING-06 — Source implementation phases are silently replaced

Final source contains 10 sequential implementation phases.

The rebuilt specification intentionally introduces a parallel-agent implementation model, but the relationship is not explicitly documented.

Required resolution:

- add a short note that the source's 10 implementation phases remain a functional/reference sequence,
- mark the parallel execution model as PROJECT DECISION,
- clarify that parallel ownership changes execution order, not source requirements or business flow.

## Items Checked and Aligned

- Final Learner Lab override: S3 Static Website / Express JWT / SQS Worker / Learner Lab Budget / LabRole
- Region: us-east-1
- FR-01 through FR-15
- Frontend source modules and required UI states
- Backend layer model and module set
- Core business flow
- Campaign source lifecycle and OPEN → PRODUCING prohibition
- Order status names and snapshot fields
- Payment privacy / reject reason / audit + notification event rule
- Paid-order Production Summary rule
- Pickup duplicate protection and receivedBy/receivedAt
- File paths and direct Pre-signed S3 flow
- Notification events and non-blocking failure invariant
- Single DynamoDB application-table baseline
- /api/v1 convention and /health
- target repository directories
- required CloudFormation resource families
- expected stack outputs
- one-command deployment sequence
- Learner Lab avoid-list and 7-day log-retention recommendation
- Definition of Done
