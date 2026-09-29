# UniStore Hub — Testing Specification

> Subsystem: Testing
> Purpose: Verification contract for requirements, security, integration and deployment
> Read first: SPEC.md, AGENTS.md, docs/specs/00-shared-contracts.md, docs/api/API_CONTRACT.md, docs/specs/data/SPEC.md

---

## 1. Purpose

This document defines how UniStore Hub is verified before demo and before subsystem integration is considered complete.

Testing must verify not only that pages/API calls work, but that implementation remains consistent with:

- FR-01 through FR-15
- Shared Contracts
- API Contract
- Data Contract
- Frontend Spec
- Backend Spec
- Infrastructure Spec
- Dev Mode Spec
- Deployment Spec
- Final Learner Lab architecture

Testing must not silently redefine unresolved business behavior.

If a test requires an OPEN DECISION, that test remains blocked until the canonical contract is resolved.

---

## 2. Test Layers

PROJECT DECISION

The verification stack consists of:

~~~text
Unit
→ Contract
→ Integration
→ Tenant / Security
→ Frontend interaction
→ Dev Mode smoke
→ Core E2E
→ AWS deployment smoke
~~~

Each layer has a different purpose and should not duplicate all lower-level cases.

---

## 2.1 Testing Filesystem Ownership

**PROJECT DECISION**

Future cross-system tests owned by the Testing Agent live under:

~~~text
tests/**
~~~

Subsystem-local unit tests remain with their subsystem owners:

~~~text
frontend/**  → Frontend Agent
backend/**   → Backend Agent
~~~

Testing Agent may read subsystem implementation but does not edit subsystem-local tests without an Integration handoff.

---

## 3. Test IDs

Canonical prefixes:

~~~text
UT-*      Unit
CT-*      Contract
IT-*      Integration
SEC-*     Tenant / Security
FE-*      Frontend interaction
DEV-*     Dev Mode
E2E-*     End-to-End
AWS-*     AWS deployment / infrastructure
REQ-*     Requirement traceability checks
~~~

Test reports should reference IDs when practical so failures can be traced back to requirements.

---

## 4. Unit Tests

### Backend Unit Coverage

Must cover:

- validators
- policies
- lifecycle guards
- money calculations
- Order snapshot calculations
- error mapping
- JWT helpers
- key builders
- repository mapping
- notification event mapping
- Worker idempotency logic

### Frontend Unit Coverage

Must cover:

- DTO → view-model mapping where non-trivial
- API error-code mapping
- THB ↔ satang conversion
- session helpers
- route/query validation helpers
- role-based visibility helpers
- file-upload client helpers

Unit tests may mock repositories/AWS clients.

Unit tests must not be used as evidence that cross-service integration works.

---

## 5. API Contract Tests

Contract tests verify docs/api/API_CONTRACT.md.

Required dimensions:

- route exists
- method matches
- auth requirement matches
- request payload matches
- response envelope matches
- documented error codes/statuses match
- pagination envelope matches
- no undocumented storage fields leak

Minimum contract cases include:

~~~text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET /api/v1/me
Public Storefront read endpoints
Organization resources
Members
Stores
Products / Variants
Campaign actions
Orders
Payments
Pre-signed URL endpoints
Production
Pickups
Reports
Audit Logs
Notifications
Platform Admin
GET /health
~~~

---

## 6. Data Contract Tests

Verify implementation against docs/specs/data/SPEC.md.

Required checks:

- UUID v4 IDs
- ISO 8601 UTC timestamps
- integer satang money
- canonical role/status tokens
- PK/SK/GSI1 fields
- one application table semantics
- tenant-owned records contain organizationId
- OrderItem snapshots
- CampaignOrderLink
- Notification item keys
- Audit item keys
- no normal request-path Scan dependency

Repository tests should verify key construction explicitly.

---

## 7. Tenant Isolation Tests

These are mandatory.

### SEC-TENANT-001

Staff from Organization A cannot read Organization B Order by guessing orderId.

### SEC-TENANT-002

Organization Admin from A cannot update Store/Product/Campaign in B.

### SEC-TENANT-003

Customer cannot access another Customer's own-order endpoint.

### SEC-TENANT-004

Customer cannot request private Payment Slip download URL for another Customer's Order.

### SEC-TENANT-005

Staff cannot approve/reject Payment outside their Organization.

### SEC-TENANT-006

Staff cannot confirm Pickup outside their Organization.

### SEC-TENANT-007

Notification endpoint returns only current user's Notifications.

### SEC-TENANT-008

Client-supplied Organization role is ignored as authoritative data.

### SEC-TENANT-009

Resource ID alone is insufficient to authorize tenant-owned data.

All cross-tenant attempts must fail without leaking unnecessary existence information.

---

## 8. Authentication / Authorization Tests

Required cases:

- register success
- duplicate email
- login success
- invalid password
- disabled User
- missing token
- malformed token
- expired token
- valid token
- GET /me membership restoration
- Staff role allowed only where documented
- Organization Admin allowed only where documented
- Customer can create/access their own Order/Payment/Pickup without an OrganizationMember record
- Customer ownership path still rejects another Customer's Order/Payment/Pickup
- Staff/Admin protected paths still require active Organization membership
- Platform Admin remains separate from Organization membership
- Add Member resolves an existing User by normalized email and returns USER_NOT_FOUND when absent
- last active Organization Admin cannot be removed/demoted and returns `LAST_ORGANIZATION_ADMIN`

JWT must not be logged or returned anywhere except intended auth response.

---

## 9. Campaign Tests

Canonical lifecycle:

~~~text
DRAFT
→ OPEN
→ CLOSED
→ PRODUCING
→ READY_FOR_PICKUP
→ COMPLETED
~~~

Required tests:

- create → DRAFT
- DRAFT → OPEN works
- OPEN → CLOSED works
- CLOSED → PRODUCING works
- PRODUCING → READY_FOR_PICKUP works
- READY_FOR_PICKUP → COMPLETED works
- OPEN → PRODUCING fails with INVALID_STATUS_TRANSITION

**PROJECT DECISION — resolved**

Campaign cancellation tests must verify:

- DRAFT → CANCELLED works
- OPEN → CANCELLED works only when no Order is in PAYMENT_REVIEW or a paid-or-later state
- CLOSED → CANCELLED works only when no Order is in PAYMENT_REVIEW or a paid-or-later state
- PRODUCING and later cannot cancel
- unpaid PENDING_PAYMENT/PAYMENT_REJECTED Orders become CANCELLED when Campaign cancellation succeeds

---

## 10. Order Tests

Required:

- Order cannot be created if Campaign is not OPEN
- valid Product/Variant belongs to correct tenant
- Product.storeId must equal Campaign.storeId
- Variant must belong to Product
- quantity validation
- Backend ignores client price/total as authority
- Variant.price is used server-side
- Order subtotal/total are correct integer satang
- OrderItem snapshot contains productName, variantName, unitPrice, quantity, totalPrice
- Product edit after Order creation does not mutate snapshot
- Customer own-order access works
- another Customer own-order access fails
- Organization staff/admin tenant access works

Resolved lifecycle tests must verify:

~~~text
Payment approve while Campaign OPEN   → PAID
Campaign close                         → currently PAID Orders CONFIRMED
Payment approve while Campaign CLOSED → CONFIRMED immediately
Campaign start-production              → blocked while any PAYMENT_REVIEW remains
Campaign start-production              → CONFIRMED Orders IN_PRODUCTION after the review queue is clear
Campaign ready-for-pickup              → READY_FOR_PICKUP + Pickup/PickupLink READY
Pickup confirm                          → Order/Pickup/PickupLink RECEIVED
~~~

Payment submission/resubmission or approval when Campaign is `PRODUCING` or later must return `PAYMENT_NOT_REVIEWABLE`.

Order cancellation tests must verify:

- Customer may cancel own PENDING_PAYMENT/PAYMENT_REJECTED Order
- Organization Admin may cancel tenant PENDING_PAYMENT/PAYMENT_REJECTED Order
- Staff cannot use general cancellation
- successful cancellation creates ORDER_CANCELLED Audit
- PAYMENT_REVIEW and paid-or-later Orders cannot cancel

---

## 11. Payment Tests

Required flow:

~~~text
Order PENDING_PAYMENT
→ request upload URL with allowed contentType
→ upload slip
→ submit slipKey while Campaign OPEN/CLOSED
→ Payment PENDING_REVIEW
→ Order PAYMENT_REVIEW
~~~

Approval while Campaign is `OPEN`:

~~~text
Payment APPROVED
Order PAID
reviewedBy
reviewedAt
Audit
PAYMENT_APPROVED event
~~~

Approval while Campaign is `CLOSED`:

~~~text
Payment APPROVED
Order CONFIRMED
reviewedBy
reviewedAt
Audit
PAYMENT_APPROVED event
~~~

Reject:

~~~text
reason required
Payment REJECTED
Order PAYMENT_REJECTED
rejectReason
Audit
PAYMENT_REJECTED event
~~~

Resubmit:

~~~text
PAYMENT_REJECTED
→ replacement slip while Campaign OPEN/CLOSED
→ same paymentId is reused
→ slipKey replaced
→ prior review/reject fields cleared
→ PENDING_REVIEW / PAYMENT_REVIEW
~~~

Approved/paid-or-later Order cannot submit another slip.

Customer Payment read contract must verify:

- owning Customer can `GET /api/v1/me/orders/:orderId/payment` without Organization membership
- rejected Payment response includes the persisted exact `rejectReason`
- another Customer's `orderId` fails closed as `ORDER_NOT_FOUND` and does not reveal Payment existence
- an owned Order with no Payment returns `PAYMENT_NOT_FOUND`
- returned Payment must match the owned Order's `organizationId`, `orderId`, and `customerId`
- Customer does not use `/organizations/:organizationId/payments/:paymentId` for own read
- Notification contents are not used as authoritative Payment state/rejection reason

Required negative/boundary cases:

- payment-slip upload-url requires `contentType` and rejects unsupported MIME before signing
- approve outside tenant
- reject without reason
- arbitrary slipKey outside expected path
- Customer cannot approve/reject Payment through Staff/Admin review actions
- Staff accesses unauthorized tenant slip
- submission/resubmission once Campaign is `PRODUCING` or later returns `PAYMENT_NOT_REVIEWABLE`
- approval once Campaign is `PRODUCING` or later returns `PAYMENT_NOT_REVIEWABLE`
- Campaign cannot start production while any Order remains `PAYMENT_REVIEW`

---

## 12. Notification Failure Test

Mandatory invariant:

~~~text
core Payment/Order transaction succeeds
even if notification enqueue/processing fails
~~~

Test at least:

- SQS publish failure after core Payment approval
- Worker failure after message receipt

Expected:

- core Payment/Order state remains committed
- failure is observable/logged
- notification can fail independently

This test protects a source-defined architectural rule.

---

## 13. Production Tests

Production Summary must use:

~~~text
Approved Payment + paid lifecycle Order
→ group Order Items by Product
→ group by Variant
→ sum Quantity
~~~

Required:

- unpaid orders excluded
- rejected payment excluded
- cancelled orders excluded
- `PAID` order with approved Payment included
- `CONFIRMED` order created by approval after Campaign close included
- `IN_PRODUCTION`, `READY_FOR_PICKUP`, and `RECEIVED` paid orders included
- quantities grouped correctly
- tenant isolation
- campaign isolation
- Organization Admin can access Production Summary
- Staff is forbidden from Production Summary according to the Final source role boundary
- no full-table Scan required by normal request path

---

## 14. Pickup Tests

Required:

- Customer can obtain own Pickup QR/Token when eligible without requiring Organization membership
- Staff can list Pickups in own Organization through PickupLink query without table Scan
- Staff can resolve `pickupId` through tenant-scoped PickupLink and load the canonical Pickup
- token lookup requires active `organizationId` and remains tenant-scoped
- Staff from another Organization cannot get/confirm the Pickup
- ready-for-pickup flow creates both canonical Pickup and PickupLink
- confirm updates Pickup → RECEIVED
- confirm updates PickupLink → RECEIVED
- confirm updates Order → RECEIVED
- receivedBy is recorded
- receivedAt is recorded
- duplicate confirm returns PICKUP_ALREADY_RECEIVED

Pickup token test must assert a 128-bit cryptographically secure base64url token represented as a 22-character unpadded string.

---

## 15. File Security Tests

### Product Image

- upload URL authorized for correct Product/Organization
- object key matches products/{organizationId}/{productId}/{uuid}
- public Storefront Product imageUrl is generated only from the Product's stored imageKey
- public Storefront cannot request signing for an arbitrary S3 object key

### Payment Slip

- bucket/object not public
- Customer can request URL only for own Order
- Staff/Admin can view only within authorized Organization
- arbitrary object key rejected
- key matches payments/{organizationId}/{orderId}/{uuid}
- binary transfer occurs directly Browser ↔ S3
- API does not accept/proxy raw file body in the documented flow
- Pre-signed expiry contract is 900 seconds

File boundary tests must verify:

~~~text
Product Image ≤ 5 MiB
Payment Slip ≤ 10 MiB
MIME ∈ image/jpeg, image/png, image/webp
~~~

Oversized/unsupported uploads must be rejected by the authoritative Backend flow.

Verify Backend performs object metadata/HEAD validation before persisting Product imageKey or accepting Payment slipKey; a forged key to a missing/wrong-size/wrong-type object must fail.

---

## 16. Frontend Interaction Tests

Frontend must verify:

- public Storefront endpoints render active browse data without requiring a JWT
- Order creation from Storefront requires authentication

- Login page success/error
- Register page success/error
- session restore via GET /me
- logout clears sessionStorage token
- 401 becomes unauthorized/login behavior
- 403 becomes forbidden behavior
- loading state
- empty state
- error/retry state
- invalid runtime query parameter state
- Customer own-order flow
- Customer own-Payment read via `GET /me/orders/:orderId/payment`
- Payment rejection reason display survives page reload and comes from `PaymentDTO.rejectReason`
- owned Order with no Payment handles `PAYMENT_NOT_FOUND` as the not-yet-submitted state
- direct S3 upload flow
- Production view
- Pickup duplicate-conflict UI
- Notification read/unread flow
- role-aware navigation

Frontend visibility tests are UX tests, not security proof.

---

## 17. Static Export Test

Mandatory Frontend build verification:

~~~text
Next.js output: "export"
→ build succeeds
→ frontend/out exists
~~~

Runtime entity pages must not require unknown build-time IDs.

Verify:

- `trailingSlash: true`
- exported route directories contain index files as expected
- direct refresh of canonical trailing-slash URLs works with S3 Website path semantics
- query-parameter entity routes can be loaded/refreshed without build-time IDs

---

## 18. Dev Mode Smoke Tests

### DEV-001 Local dependency setup

npm run dev:setup creates/ensures:

- LocalStack
- DynamoDB table
- Files bucket
- SQS queue

### DEV-002 Health

GET http://localhost:4000/health succeeds.

### DEV-003 Frontend

Frontend loads at localhost:3000.

### DEV-004 Auth parity

Register/Login/JWT works without auth bypass.

### DEV-005 Data parity

Entity/key/status semantics match Data Spec.

### DEV-006 File parity

Payment Slip uses Pre-signed LocalStack S3 path.

### DEV-007 Notification parity

Backend → LocalStack SQS → Local Worker → DynamoDB Notification.

### DEV-008 Reset safety

dev:reset refuses to target non-local AWS endpoints.

### DEV-009 No business bypass

Dev Mode still enforces tenant/RBAC/status rules.

---

## 19. Infrastructure / CloudFormation Tests

Verify template contains and correctly wires:

- FrontendBucket
- FrontendBucketPolicy
- FilesBucket
- AppTable
- NotificationQueue
- BackendFunction
- WorkerFunction
- EventSourceMapping
- API Gateway REST API
- Deployment
- Stage
- Lambda permission
- CloudWatch Log Groups

Also verify:

- AppTable PAY_PER_REQUEST
- PK/SK/GSI1
- FilesBucket private
- Frontend bucket public GetObject only
- Files CORS GET/PUT/HEAD
- LabRole usage
- no custom IAM execution role
- Lambda `Environment.Variables` does not set reserved `AWS_REGION`; Lambda runtime supplies it
- SQS EventSourceMapping uses normal redelivery with no project-created DLQ in MVP
- 7-day Lambda log retention
- no CloudFront/Cognito/SES
- no EC2/RDS/NAT/ALB/ECS/EKS
After npm run deploy:

### AWS-001 Identity / Region
## 20. AWS Deployment Smoke Tests

After npm run deploy:
### AWS-001 Identity / Region

~~~text
region = us-east-1
stack = unistore-hub-dev
~~~

### AWS-002 Stack Outputs

All expected outputs exist.

### AWS-003 Frontend

FrontendWebsiteURL responds with static site content.

### AWS-004 Health

GET <ApiBaseURL>/health returns healthy response.

### AWS-005 DynamoDB

AppTable exists with expected keys/GSI/billing mode.

### AWS-006 Files Bucket

FilesBucket is not publicly readable.

### AWS-007 SQS/Worker

NotificationQueue is connected to WorkerFunction.

### AWS-008 Logs

Backend/Worker logs appear in CloudWatch after invocation.

### AWS-009 Learner Lab architecture

No forbidden baseline dependency has been introduced.

---

## 21. Core End-to-End Scenario

### E2E-CORE-001

Canonical source-aligned flow:

~~~text
Register
→ Login
→ Create/Access Organization
→ Create Store
→ Create Product / Variant
→ Create Campaign
→ Open Campaign
→ Customer creates Order
→ Customer uploads Payment Slip
→ Staff approves Payment
→ Production Summary includes paid Order
→ Campaign progresses toward pickup
→ Customer receives Ready for Pickup notification
→ Staff confirms Pickup
→ Order becomes RECEIVED
~~~

E2E must execute the resolved post-payment flow explicitly:

~~~text
PAID
→ close Campaign → CONFIRMED
→ start production → IN_PRODUCTION
→ ready for pickup → READY_FOR_PICKUP + Notification
→ confirm Pickup → RECEIVED
~~~

---

## 22. E2E Payment Rejection Scenario

### E2E-PAYMENT-REJECT-001

~~~text
Order
→ upload slip
→ Staff rejects with reason
→ Customer loads GET /me/orders/:orderId/payment
→ Customer sees exact PaymentDTO.rejectReason
→ PAYMENT_REJECTED notification is delivered independently
→ Customer resubmits
→ same paymentId is reused
→ rejectReason/reviewedBy/reviewedAt are cleared
→ Staff approves
→ PAID
~~~

Verify Audit entries for reject and approve.

The notification is an alert, not the authoritative rejection-reason source.

---

## 23. E2E Tenant Isolation Scenario

### E2E-TENANT-001

Create two Organizations and users/memberships.

Attempt:

- Order access
- Payment review
- Slip access
- Product update
- Pickup confirm

across tenant boundaries.

All unauthorized cross-tenant operations must fail.

---

## 24. E2E Notification Scenario

### E2E-NOTIFY-001

Verify:

~~~text
Payment Approved
→ SQS event
→ Worker
→ Notification item
→ GET /notifications
→ PATCH /notifications/:id/read
~~~

Also repeat for Payment Rejected and Ready for Pickup.

Idempotency check:

- deliver the same SQS event twice
- `eventId` maps to `notificationId`
- only one Notification item exists

---

## 25. Requirement Traceability Matrix

| FR | Requirement | Minimum verification |
|---|---|---|
| FR-01 | Authentication + JWT | UT/CT/SEC + E2E login |
| FR-02 | Organization | API contract + organization integration/E2E |
| FR-03 | Staff / Member | RBAC + membership + tenant tests |
| FR-04 | Store | CRUD contract + tenant tests |
| FR-05 | Product / Variant | CRUD + price + snapshot + file tests |
| FR-06 | Pre-order Campaign | lifecycle tests + invalid transition |
| FR-07 | Order | create/list/detail + snapshot + ownership |
| FR-08 | Payment Slip / Verification | private file + submit/approve/reject/resubmit |
| FR-09 | Production Summary | paid-only grouping |
| FR-10 | Pickup QR / Token | own-token + staff confirm + duplicate prevention |
| FR-11 | Dashboard / Report | metric-schema contract + Organization Admin authorization + UI test |
| FR-12 | Audit Log | required side effects + list authorization |
| FR-13 | In-app Notification | SQS/Worker/API/read flow |
| FR-14 | Platform Admin | approve/suspend/list users/summary + role isolation |
| FR-15 | Health Check | local + AWS smoke |

No FR may be marked complete without at least one mapped verification path.

---

## 26. Decision Verification Gate

Previously blocking decisions are now resolved and must have tests:

- Campaign cancellation guard
- post-PAID Order progression
- Order cancellation rules
- Pickup token format
- no automatic MVP retention/TTL cleanup
- Last Organization Admin protection
- Dashboard metric schema
- file-size/MIME limits
- no project-created notification DLQ in MVP
- deployment artifact-bucket bootstrap
- Platform Admin persisted authority
- public Storefront read endpoints
- Static Export trailing-slash refresh behavior

If a future unresolved decision is introduced, add it to the Shared Contract before writing dependent tests.

Silent assumptions are not allowed.

---

## 27. Test Data Rules

PROJECT DECISION

Tests use dedicated deterministic fixtures.

Avoid:

- depending on developer manual data
- sharing mutable IDs between unrelated tests
- cross-test state leakage

Integration/E2E data must be clearly disposable and distinguishable from manual/demo data.

---

## 28. CI Independence

CI/CD is not required by the source.

Therefore this Testing Spec defines commands/coverage expectations, not a mandatory CI provider.

Future CI may execute the same test layers without changing contracts.

---

## 29. Test Result Handoff

Testing Agent handoff must include:

- test layer executed
- test IDs
- pass/fail
- blocked tests
- corresponding OPEN DECISION IDs
- environment used: unit/local/AWS
- relevant logs/artifacts
- regressions found

Do not mark blocked tests as passed.

---

## 30. Testing Acceptance Criteria

- [ ] FR-01..FR-15 each has verification mapping
- [ ] Unit tests cover key pure/business logic
- [ ] API Contract tests cover documented endpoints
- [ ] Data key/access patterns are verified
- [ ] cross-tenant tests are mandatory
- [ ] Payment Slip privacy is verified
- [ ] notification failure does not fail core transaction
- [ ] Production paid-only rule is verified
- [ ] duplicate Pickup prevention is verified
- [ ] Frontend loading/empty/error/unauthorized/forbidden are verified
- [ ] Next.js Static Export build is verified
- [ ] Dev Mode smoke tests verify parity and reset safety
- [ ] AWS smoke verifies stack/output/frontend/health/data/SQS/logging
- [ ] Core E2E flow is defined
- [ ] resolved PROJECT DECISION behavior is covered by tests
- [ ] Testing Agent cross-system files stay under tests/**
