# UniStore Hub — Master Specification

> **Purpose:** System-wide source of truth for implementation and verification  
> **Target:** AWS Academy Learner Lab  
> **Region:** `us-east-1`  
> **Frontend:** Next.js + TypeScript (Static Export)  
> **Backend:** Node.js + Express.js on AWS Lambda  
> **Database:** Amazon DynamoDB  
> **Infrastructure as Code:** AWS CloudFormation  
> **Status:** Source-aligned master specification

---

## 1. How to Use This Specification

This file defines the **system-level contract** of UniStore Hub.

Detailed implementation contracts are intentionally split into subsystem documents so multiple agents can work in parallel without duplicating or redefining system behavior.

Future subsystem documents:

```text
docs/
├── architecture/
│   └── AWS_ARCHITECTURE.md
├── api/
│   └── API_CONTRACT.md
├── deployment/
│   └── DEPLOYMENT_SPEC.md
└── specs/
    ├── 00-shared-contracts.md
    ├── frontend/
    │   └── SPEC.md
    ├── backend/
    │   └── SPEC.md
    ├── data/
    │   └── SPEC.md
    ├── infrastructure/
    │   └── SPEC.md
    ├── dev/
    │   └── SPEC.md
    ├── testing/
    │   └── SPEC.md
    └── integration/
        └── SPEC.md
```

### 1.1 Decision Labels

- **FINAL** — directly supported by the Final System & Deployment Specification / attached AWS architecture
- **PROJECT DECISION** — additional implementation/process decision introduced for this project
- **OPEN DECISION** — not sufficiently defined by the source and must not be silently invented by an implementation agent
- **OUT OF SCOPE** — explicitly excluded from the MVP

### 1.2 Source Priority

When documents conflict, use this order:

1. Final System & Deployment Specification
2. Attached AWS System Architecture
3. This `SPEC.md`
4. `docs/specs/00-shared-contracts.md`
5. Subsystem specifications
6. Prototype / wireframe for UX intent only

Historical designs that use CloudFront, Cognito or SES must not override the Final Learner Lab architecture.

---

## 2. Project Goal

UniStore Hub is a **multi-tenant SaaS** for faculties, clubs and university units to manage product sales and pre-orders in one system.

The core flow is:

```text
Organization
→ Store
→ Product / Variant
→ Pre-order Campaign
→ Order
→ Payment Verification
→ Production Summary
→ Ready for Pickup
→ Pickup
```

The system is designed around:

- Modular architecture
- Multi-tenancy
- Stateless backend
- Serverless AWS services
- Pay-per-use infrastructure
- Backend-enforced authorization

---

## 3. Final Learner Lab Architecture

### 3.1 Final Architecture Override

The Final Learner Lab design uses:

| Previous / historical design | Final Learner Lab design |
|---|---|
| CloudFront + S3 | S3 Static Website |
| Cognito | Express.js + JWT |
| SES | In-app Notification through SQS + Worker + DynamoDB |
| AWS Budgets resource | Learner Lab Budget + Cost Explorer |
| Custom IAM role | Existing `LabRole` |

Deployment region is:

```text
us-east-1
```

### 3.2 System Architecture

```text
User / Customer / Staff / Admin
│
├── HTTP
│    ↓
│   Amazon S3
│   Next.js Static Export / Static Website
│
└── HTTPS API + JWT
     ↓
Amazon API Gateway
     ↓
AWS Lambda
Express.js
Auth + Business Logic
     │
     ├── DynamoDB
     │   Application Data
     │
     ├── Generate Pre-signed URL
     │          ↓
     │      Browser ↔ Private S3 Files
     │
     └── SQS
          ↓
       Lambda Worker
          ↓
       DynamoDB
       In-app Notification

API Gateway / Backend Lambda / SQS / Worker Lambda
          ↓
      CloudWatch

Overall AWS Usage
          ↓
AWS Cost Explorer / Learner Lab Budget
```

### 3.3 Required AWS Services

- Amazon S3 — Next.js Static Website
- Amazon API Gateway — HTTPS REST API
- AWS Lambda — Express.js Auth + Business Logic
- Amazon DynamoDB — Application Database
- Amazon S3 — Product Images / Payment Slips
- Amazon SQS — Async Notification Queue
- AWS Lambda Worker — Notification processing
- Amazon CloudWatch — Logs / Metrics
- AWS Cost Explorer + Learner Lab Budget — Cost monitoring
- Existing `LabRole` — runtime AWS permissions

### 3.4 Architecture Boundaries

**FINAL**

- Frontend static website traffic is served from S3.
- Auth and business APIs are served through HTTPS API Gateway.
- Authentication is implemented inside Backend Lambda using Express.js + JWT.
- Product Images and Payment Slips use a separate S3 file-storage path from the frontend static website.
- Backend generates Pre-signed URLs; Browser performs direct upload/download against S3.
- Backend does not need to proxy binary files through API Gateway.
- Business Lambda publishes notification events to SQS.
- Notification Worker consumes the queue and writes In-app Notifications into DynamoDB.
- Notification failure must not cause the core Order / Payment transaction to fail.
- API Gateway, Lambda, SQS and Worker observability goes to CloudWatch.
- Learner Lab deployment uses existing `LabRole`.

---

## 4. User Roles

### 4.1 Customer

- Register / Login
- View Store, Campaign and Product
- Select Product Variant
- Create Order
- Upload Payment Slip
- Track Order / Payment
- View Pickup QR / Token
- View In-app Notification

### 4.2 Staff

- View / search Orders of their Organization
- Review Payment Slip
- Approve / Reject Payment
- Confirm Pickup

### 4.3 Organization Admin

- Manage Organization / Staff
- Manage Store / Product / Variant
- Manage Campaign
- View Production Summary
- View Dashboard / Report
- View Audit Log

### 4.4 Platform Admin

- View Organizations
- Approve Organizations
- Suspend Organizations
- View Users
- View Platform Summary

---

## 5. Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | Authentication + JWT |
| FR-02 | Organization |
| FR-03 | Staff / Member |
| FR-04 | Store |
| FR-05 | Product / Variant |
| FR-06 | Pre-order Campaign |
| FR-07 | Order |
| FR-08 | Payment Slip / Verification |
| FR-09 | Production Summary |
| FR-10 | Pickup QR / Token |
| FR-11 | Dashboard / Report |
| FR-12 | Audit Log |
| FR-13 | In-app Notification |
| FR-14 | Platform Admin |
| FR-15 | Health Check |

Every subsystem specification and test specification must trace its work back to these FR IDs.

---

## 6. Core Business Rules

### 6.1 Campaign

Source-defined lifecycle:

```text
DRAFT
↓
OPEN
↓
CLOSED
↓
PRODUCING
↓
READY_FOR_PICKUP
↓
COMPLETED
```

Alternative terminal path:

```text
→ CANCELLED
```

**FINAL rule:** `OPEN → PRODUCING` is not allowed as a direct transition.

The source does not define exact cancellation source states; the Shared/API contracts resolve them explicitly as a PROJECT DECISION.

### 6.2 Order

Source-defined statuses:

```text
PENDING_PAYMENT
PAYMENT_REVIEW
PAID
PAYMENT_REJECTED
CONFIRMED
IN_PRODUCTION
READY_FOR_PICKUP
RECEIVED
CANCELLED
```

Order Items must snapshot:

```text
productName
variantName
unitPrice
quantity
totalPrice
```

This prevents historical orders from changing when Product / Variant data is edited later.

### 6.3 Payment

- Payment Slip is private.
- Customer can manage only their own Order payment flow.
- Staff / Admin can review only Orders inside their Organization.
- Reject requires a reason.
- Approve / Reject must produce Audit and Notification events.

### 6.4 Production

```text
Paid Orders
→ Order Items
→ Group Product
→ Group Variant
→ Sum Quantity
```

Production Summary uses paid orders.

### 6.5 Pickup

- Pickup uses Token / QR.
- A `RECEIVED` pickup cannot be confirmed twice.
- Successful pickup records `receivedBy` and `receivedAt`.

---

## 7. File Storage Contract

Product and payment files use a Files bucket separate from the Frontend bucket.

Canonical path patterns:

```text
products/{organizationId}/{productId}/{uuid}
payments/{organizationId}/{orderId}/{uuid}
```

Flow:

```text
Browser
→ API Gateway
→ Lambda
→ Generate Pre-signed URL
→ API Gateway
→ Browser
→ Direct Upload / Download
→ S3 Files
```

**FINAL**

- Payment Slip must always remain private.
- Backend authorizes access before issuing a Pre-signed URL.
- Browser performs the actual file transfer directly with S3.

---

## 8. Notification Contract

```text
Business Lambda
→ SQS
→ Notification Worker
→ DynamoDB
```

Source-defined notification events:

- Payment Approved
- Payment Rejected
- Ready for Pickup

**FINAL:** Notification processing failure must not make the core Order / Payment transaction fail.

---

## 9. Multi-Tenant Security

Every Organization-owned resource must carry tenant context through:

```text
organizationId
```

Every protected request must validate:

```text
Authenticated User
+
Organization Membership
+
Role
+
organizationId
+
Resource Ownership
```

Rules:

- Backend must not trust `organizationId` supplied by the client without database verification.
- Backend must not trust client-supplied Role without database verification.
- Tenant resources must not be queried by `resourceId` alone without tenant ownership validation.
- Frontend may hide actions for UX, but Backend is the authoritative permission enforcement layer.

---

## 10. Core Data Domain

Canonical entities:

```text
User
Organization
OrganizationMember
Store
Product
ProductVariant
Campaign
Order
OrderItem
Payment
Pickup
AuditLog
Notification
```

DynamoDB baseline:

- Single application table
- On-Demand capacity / `PAY_PER_REQUEST`
- Base key attributes:

```text
PK
SK
GSI1PK
GSI1SK
entityType
createdAt
updatedAt
```

Example key patterns from the source:

```text
USER#{userId} / PROFILE
ORG#{organizationId} / PROFILE
ORG#{organizationId} / MEMBER#{userId}
ORG#{organizationId} / STORE#{storeId}
ORG#{organizationId} / PRODUCT#{productId}
ORG#{organizationId} / CAMPAIGN#{campaignId}
ORG#{organizationId} / ORDER#{orderId}
ORDER#{orderId} / PAYMENT#{paymentId}
ORDER#{orderId} / PICKUP
ORG#{organizationId} / AUDIT#{createdAt}#{auditId}
USER#{userId} / NOTIFICATION#{createdAt}#{notificationId}
```

**PROJECT DECISION — tenant hardening:** the source also prohibits querying Organization-owned resources by `resourceId` alone, so the canonical Data Spec refines Order child partitions to include `organizationId`. The examples above are preserved as source examples; implementation follows `docs/specs/data/SPEC.md`.

Detailed access patterns and GSI design belong in `docs/specs/data/SPEC.md`.

---

## 11. API Baseline

API prefix:

```text
/api/v1
```

Source-defined baseline:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/me

/api/v1/organizations
/api/v1/organizations/:organizationId/members
/api/v1/organizations/:organizationId/stores
/api/v1/organizations/:organizationId/products
/api/v1/organizations/:organizationId/campaigns
/api/v1/organizations/:organizationId/orders
/api/v1/organizations/:organizationId/payments
/api/v1/organizations/:organizationId/production
/api/v1/organizations/:organizationId/pickups
/api/v1/organizations/:organizationId/reports
/api/v1/organizations/:organizationId/audit-logs

GET   /api/v1/notifications
PATCH /api/v1/notifications/:notificationId/read

GET /health
```

Standard success shape:

```json
{
  "success": true,
  "data": {}
}
```

Standard error shape:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found"
  }
}
```

Endpoint-level methods, request payloads, response payloads, permissions and error codes belong in `docs/api/API_CONTRACT.md`.

---

## 12. Subsystem Map

### 12.1 Frontend

Technology baseline:

```text
Next.js
TypeScript
output: "export"
REST API
JWT
```

Source-defined feature modules:

```text
auth
organizations
staff
stores
products
campaigns
storefront
orders
payments
production
pickups
dashboard
audit
notifications
platform-admin
```

Required UI states:

```text
loading
success
empty
error
unauthorized
forbidden
```

Detailed contract: `docs/specs/frontend/SPEC.md`

### 12.2 Backend

Technology baseline:

```text
Node.js
Express.js
AWS Lambda
DynamoDB
S3
SQS
JWT
```

Layering:

```text
Route
↓
Middleware
↓
Controller
↓
Service
↓
Repository
↓
DynamoDB / AWS Service
```

Source-defined backend modules:

```text
auth
users
organizations
members
stores
products
campaigns
orders
payments
production
pickups
reports
audit
files
notifications
platform-admin
health
```

Detailed contract: `docs/specs/backend/SPEC.md`

### 12.3 Data

Owns the design contract for:

- Entity fields
- Single-table layout
- Access patterns
- PK / SK / GSI usage
- Tenant-safe query rules
- Snapshot rules

Detailed contract: `docs/specs/data/SPEC.md`

### 12.4 Infrastructure

Owns the CloudFormation contract for:

- Frontend S3 Bucket
- Frontend Bucket Policy
- Private Files S3 Bucket
- DynamoDB AppTable
- SQS NotificationQueue
- Backend Lambda
- Notification Worker Lambda
- SQS EventSourceMapping
- API Gateway REST API
- API Deployment / Stage
- CloudWatch Log Groups
- Existing `LabRole`

Detailed contract: `docs/specs/infrastructure/SPEC.md`

### 12.5 Development Mode

**PROJECT DECISION**

Development Mode is an additional local-development profile requested for this project.

It must preserve production behavior for:

- API shapes
- Authentication / JWT behavior
- RBAC and tenant rules
- Business rules
- Data semantics
- File-flow semantics
- Notification event semantics

Any local tool, emulator, storage substitute, seed strategy or local command not defined by the source must be documented as **PROJECT DECISION** in `docs/specs/dev/SPEC.md`.

### 12.6 Testing

Owns:

- Unit verification expectations
- API contract verification
- Integration verification
- Tenant / security verification
- Core E2E flow verification
- Development-mode smoke verification
- AWS deployment smoke verification
- future cross-system test implementation under `tests/**`

Subsystem-local unit tests remain inside their subsystem ownership.

Detailed contract: `docs/specs/testing/SPEC.md`

### 12.7 Integration

Owns future cross-subsystem compatibility and handoff sequencing.

Detailed contract: `docs/specs/integration/SPEC.md`

---

## 13. Target Repository Structure

The implementation target remains:

```text
unistore-hub/
├── frontend/
├── backend/
│   ├── src/
│   ├── scripts/
│   │   └── seed-platform-admin.js
│   └── package.json
├── infrastructure/
│   ├── template.yaml
│   ├── parameters.example.json
│   └── README.md
├── scripts/
│   ├── build-backend.sh
│   ├── deploy-infra.sh
│   ├── deploy-frontend.sh
│   ├── deploy-all.sh
│   └── destroy.sh
├── docs/
│   ├── specs/
│   ├── architecture/
│   ├── api/
│   └── deployment/
├── package.json
├── .gitignore
└── README.md
```

**PROJECT DECISION:** `SPEC.md` and `AGENTS.md` are added at repository root as implementation coordination documents.

**PROJECT DECISION:** future cross-system test suites use root `tests/**`. This is an implementation-coordination addition; it does not replace the source-defined frontend/backend/infrastructure/scripts/docs layout.

---

## 14. Deployment Baseline

Deployment goal:

```bash
npm run deploy
```

Source-defined flow:

```text
1. Validate AWS identity / region
2. Install backend dependencies
3. Package Backend + Worker
4. Deploy CloudFormation
5. Read Stack Outputs
6. Set Frontend API URL
7. Build Next.js Static Export
8. aws s3 sync frontend/out → Frontend Bucket
9. Call GET /health
10. Print Frontend URL + API URL
```

CloudFormation commands:

```bash
aws cloudformation package
aws cloudformation deploy
```

Baseline:

```text
Region: us-east-1
Stack:  unistore-hub-dev
IAM:    LabRole
```

Detailed deployment contract belongs in `docs/deployment/DEPLOYMENT_SPEC.md`.

---

## 15. Learner Lab Constraints

Must use:

```text
Region: us-east-1
IAM: LabRole
```

Avoid in the baseline:

- EC2
- RDS
- NAT Gateway
- Load Balancer
- ECS / EKS
- Provisioned Lambda Concurrency

CloudWatch Log Retention recommendation:

```text
7 days
```

Learner Lab Lambda concurrency is constrained; this deployment is for demo / educational usage and is not a production-capacity benchmark.

---

## 16. MVP Scope

### Included

- Auth + JWT
- Organization / Staff
- Store
- Product / Variant
- Campaign
- Storefront
- Order
- Payment Slip / Verification
- Production Summary
- Pickup
- Dashboard
- Audit
- In-app Notification
- Basic Platform Admin
- Monitoring
- CloudFormation deployment

### OUT OF SCOPE

- Real Payment Gateway
- 100% Automatic Slip Verification
- Accounting
- Shipping
- Large Marketplace
- Multi-region
- Cognito in Learner Lab version
- CloudFront in Learner Lab version
- SES in Learner Lab version

---

## 17. Parallel Implementation Boundary

**PROJECT DECISION**

The future implementation is intentionally split so agents can work in parallel.

Primary implementation ownership:

```text
Frontend Agent
→ frontend/**

Backend Agent
→ backend/**

Infrastructure Agent
→ infrastructure/**

Deployment / Tooling Agent
→ scripts/**

Testing Agent
→ tests/** for cross-system tests

Integration ownership
→ root shared files and final cross-subsystem reconciliation
```

The Data specification is a shared design contract and must not become a separate agent that simultaneously edits both Backend and Infrastructure implementation directories.

Detailed ownership, read order and shared-change protocol are defined in `AGENTS.md`.

### 17.1 Relationship to the Final Source Implementation Phases

The Final source defines this sequential functional reference:

```text
Phase 1  Baseline
Phase 2  Auth
Phase 3  Organization
Phase 4  Product / Campaign
Phase 5  Order / Payment
Phase 6  Production / Pickup
Phase 7  Notification / Report / Audit
Phase 8  AWS Infrastructure
Phase 9  One-command Deploy
Phase 10 E2E Verification
```

**PROJECT DECISION**

The parallel-agent workflow changes **execution scheduling and ownership only**. It does not replace these source milestones, business requirements, or final E2E sequence.

Implementation/Integration reports must remain traceable back to this source sequence.

---

## 18. Resolved Project Decisions

The source intentionally leaves some implementation detail open. To make parallel implementation deterministic, the MVP resolves those gaps explicitly as **PROJECT DECISIONs**.

Locked decisions include:

- UUID v4 entity IDs
- ISO 8601 UTC timestamps
- integer-satang money
- Payment/Pickup status enums
- JWT minimum claims and Frontend sessionStorage
- Platform Admin authority via `User.platformRole`
- Customer Order/Payment/Pickup ownership path without requiring Organization membership
- Campaign cancellation guard
- post-PAID Order lifecycle including CLOSED-Campaign late-payment approval
- `CLOSED → PRODUCING` blocked while Payment review remains
- Order cancellation permissions/states
- Pickup token format
- Organization-scoped PickupLink for pickup list/`pickupId` lookup
- Last Organization Admin protection
- Dashboard metric baseline
- 5 MiB Product Image / 10 MiB Payment Slip limits with JPEG/PNG/WebP
- Payment Slip Pre-signed request includes canonical `contentType`
- 900-second Pre-signed URL expiry
- tenant-hardened Order child partitions
- public read-only Storefront API
- Static Export trailing-slash route strategy
- no automatic MVP retention/TTL cleanup
- no project-created SQS DLQ in MVP
- Lambda reserved `AWS_REGION` is runtime-provided rather than manually injected
- CloudFormation packaging artifact bucket strategy
- canonical Frontend/Backend build/test handoff
- Testing Agent ownership under `tests/**`
- Local Development Mode via LocalStack while preserving production contracts

The canonical detail lives in Shared/API/Data/subsystem specs. There are no remaining MVP-blocking OPEN DECISIONs that require an implementation agent to guess.

---
## 19. Definition of Done

The system is ready for demo when:

- All source is stored in Git
- Infrastructure is defined in CloudFormation
- `npm run deploy` successfully deploys the system
- Frontend is accessible from S3 Website
- Backend is accessible through HTTPS API Gateway
- JWT / RBAC works
- Tenant Isolation passes
- Payment Slip is private
- SQS → Worker → Notification works
- CloudWatch contains Logs
- `GET /health` passes
- Core flow `Order → Payment → Production → Pickup` passes
- There is no dependency on CloudFront / Cognito / SES in the Learner Lab baseline
- Lambda uses `LabRole`
- Deployment runs in `us-east-1`

---

## 20. Specification Gate Before Parallel Implementation

Parallel implementation agents must not start until the following contracts exist and are reviewed:

```text
SPEC.md
docs/architecture/AWS_ARCHITECTURE.md
docs/specs/00-shared-contracts.md
docs/api/API_CONTRACT.md
docs/specs/data/SPEC.md
AGENTS.md
```

After these are locked:

```text
Frontend Agent       ┐
Backend Agent        ├─ may begin in parallel
Infrastructure Agent ┘

Deployment / Tooling work
→ may proceed against Infrastructure outputs and repository contracts

Integration / Testing
→ validates compatibility across all outputs
```
