# UniStore Hub — Backend Specification

> Subsystem: Backend
> Implementation ownership: backend/**
> Runtime: Node.js + Express.js on AWS Lambda
> Data: Amazon DynamoDB
> Files: Amazon S3 via Pre-signed URL
> Async: Amazon SQS + Notification Worker Lambda
> Auth: Application-managed JWT
> Read first: SPEC.md, AGENTS.md, docs/specs/00-shared-contracts.md, docs/api/API_CONTRACT.md, docs/specs/data/SPEC.md, docs/architecture/AWS_ARCHITECTURE.md

---

## 1. Purpose

This document is the implementation contract for the Backend Agent.

The Backend Agent must be able to implement backend/** without reading Frontend implementation details.

The Backend owns:

- Express application
- API routes
- request validation
- authentication
- JWT generation / verification
- RBAC
- Organization membership enforcement
- tenant isolation
- business rules
- lifecycle validation
- DynamoDB repository access
- S3 Pre-signed URL generation
- SQS notification publishing
- Notification Worker application logic
- Audit creation
- API response/error mapping
- Health endpoint

The Backend does not own AWS resource creation or deployment orchestration. Those belong to Infrastructure / Deployment ownership.

---

## 2. Source-Defined Backend Baseline

Technology:

~~~text
Node.js
Express.js
AWS Lambda
DynamoDB
S3
SQS
JWT
~~~

Layering:

~~~text
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
~~~

Source-defined modules:

~~~text
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
~~~

---

## 3. Target Backend Structure

PROJECT DECISION

~~~text
backend/
├── src/
│   ├── app.js
│   ├── lambda.js
│   ├── worker.js
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── members/
│   │   ├── stores/
│   │   ├── products/
│   │   ├── campaigns/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── production/
│   │   ├── pickups/
│   │   ├── reports/
│   │   ├── audit/
│   │   ├── files/
│   │   ├── notifications/
│   │   ├── platform-admin/
│   │   └── health/
│   ├── repositories/
│   ├── services/
│   ├── policies/
│   ├── validators/
│   ├── mappers/
│   ├── aws/
│   ├── errors/
│   └── utils/
├── scripts/
│   └── seed-platform-admin.js
├── tests/
├── package.json
└── README.md
~~~

Module internal pattern:

~~~text
<module>/
├── <singular>.routes.js
├── <singular>.controller.js
├── <singular>.service.js
├── <singular>.repository.js
├── <singular>.validator.js
├── <singular>.policy.js
├── <singular>.mapper.js
├── <singular>.constants.js
└── index.js

Example from the Final source:

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

A module may omit files that are unnecessary.

---

## 4. Layer Responsibilities

### Route

Owns HTTP method/path wiring, middleware chain and controller binding.

Must not implement business rules or call DynamoDB directly.

### Middleware

Owns generic authentication, request context, Organization context, role checks and common error handling.

### Controller

Reads validated request values, calls service operations and maps results to the API envelope.

Must not call DynamoDB/S3/SQS directly.

### Service

Owns business rules, lifecycle transitions, policy orchestration, transactions, Audit side effects and notification publishing.

Service is the authoritative business layer.

### Repository

Owns DynamoDB keys, queries, conditional writes, transaction items and storage mapping.

Must follow docs/specs/data/SPEC.md.

### AWS Adapters

Own S3 Pre-signed URL generation, SQS send-message and AWS SDK client configuration.

Resource names come from environment variables, not hard-coded names.

---

## 5. Express / Lambda Boundary

PROJECT DECISION

Use one Express application for both Lambda and local Dev Mode.

~~~text
src/app.js
→ creates Express app

src/lambda.js
→ adapts Express app to Lambda

local dev entry
→ starts the same Express app locally
~~~

Business modules must not depend directly on API Gateway event structure.

---

## 6. Request Context

PROJECT DECISION

Protected requests normalize:

~~~text
requestId
user.userId
user.email
organization.organizationId
organization.membershipRole
~~~

Rules:

- auth middleware resolves user
- Organization middleware resolves membership from DynamoDB
- role middleware checks the resolved membership
- client-supplied role is never authoritative
- route organizationId is only request context until verified

---

## 7. Authentication Module

### Register

POST /api/v1/auth/register

Responsibilities:

1. validate email/password/name
2. normalize email
3. ensure email is not already registered
4. hash password
5. transactionally create User + Data Spec PlatformUserLink
6. issue JWT
7. return sanitized User + token

Store passwordHash only.

Source recommends bcryptjs.

### Login

Responsibilities:

1. normalize email
2. find User by email
3. reject disabled User
4. verify password
5. issue JWT
6. return sanitized User + token

Do not reveal account existence through materially different credential errors.

### JWT Claims

Canonical minimum:

~~~text
sub = userId
email
iat
exp
~~~

Organization role/membership is not an authoritative JWT claim.

Platform Admin authority is loaded from the current User record:

```text
user.platformRole = PLATFORM_ADMIN
```

and is not inferred from Organization membership.

### Current User

GET /api/v1/me returns:

- sanitized User
- current Organization memberships

### Logout

MVP logout is client-side token removal. No revocation store is required by the source.

---

## 8. Authentication Middleware

Flow:

~~~text
Authorization: Bearer <token>
→ extract token
→ verify signature
→ verify expiry
→ load User
→ reject disabled/missing User
→ set request user context
~~~

Canonical auth errors:

~~~text
AUTH_REQUIRED
TOKEN_INVALID
TOKEN_EXPIRED
USER_DISABLED
~~~

Never log password, passwordHash or JWT.

---

## 9. Organization Membership and RBAC

Organization-scoped protected endpoints use two authorization paths.

### 9.1 Staff / Organization Admin Path

~~~text
authenticated user
→ route organizationId
→ load Organization
→ load OrganizationMember
→ require ACTIVE membership
→ validate STAFF / ORGANIZATION_ADMIN role
→ continue
~~~

Membership role values:

~~~text
STAFF
ORGANIZATION_ADMIN
~~~

### 9.2 Customer Ownership Path

**PROJECT DECISION — source-aligned role clarification**

Customer Order / Payment / Pickup operations do not require an `OrganizationMember` record.

Backend instead requires:

~~~text
authenticated user
→ route organizationId
→ load target Campaign / Order tenant-safely
→ verify stored organizationId matches route context
→ verify order.customerId == current userId when accessing an existing customer-owned resource
→ continue
~~~

Order creation verifies the Campaign/Product/Variant tenant relationship before writing the new Order.

Platform Admin is a platform-level role and must not be treated as Organization membership.

Backend is authoritative even if Frontend hides/shows actions.

---

## 10. Tenant Isolation Policy

For every tenant-owned resource:

~~~text
organizationId + resourceId
→ tenant-scoped repository access
→ verify stored organizationId
~~~

Resource ID alone is not sufficient authorization.

Customer ownership is an additional policy check, not a substitute for tenant-safe data access.

Repositories must follow tenant-safe access patterns in Data Spec.

---

## 11. Error Model

Backend uses stable codes from docs/api/API_CONTRACT.md.

PROJECT DECISION internal error shape:

~~~text
code
message
httpStatus
details?
cause?
~~~

External envelope:

~~~json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found"
  }
}
~~~

Never expose stack traces, raw AWS errors, passwordHash, secrets or credentials.

---

## 12. Validation Strategy

State-changing endpoints validate:

- route parameters
- query parameters
- request body
- enums
- quantities
- integer-satang money fields where accepted
- required fields
- file contentType fields
- business preconditions

IDs are UUID v4 but treated as opaque strings at API boundaries.

Timestamps are ISO 8601 UTC.

Money is integer satang.

Client-calculated Order price/total is never authoritative.

---

## 13. users Module

Owns:

- User repository/query helpers
- sanitized User mapper
- status checks
- Platform Admin User listing through the Data Spec `PlatformUserLink` access pattern

User fields:

~~~text
userId
email
passwordHash
name
status
platformRole
createdAt
updatedAt
~~~

`platformRole` is `PLATFORM_ADMIN` or `null` per Shared/Data contract.

Never expose passwordHash or DynamoDB storage keys in API DTOs.

---

## 14. organizations Module

Owns create/list/get/update Organization.

PROJECT DECISION:

Organization creator receives ORGANIZATION_ADMIN membership.

Organization creation should create:

- Organization
- creator OrganizationMember
- AuditLog

in one DynamoDB transaction where feasible.

Organization statuses:

~~~text
PENDING
ACTIVE
SUSPENDED
~~~

---

## 15. members Module

Owns:

- list members
- add member
- update role
- remove member

Roles:

~~~text
STAFF
ORGANIZATION_ADMIN
~~~

Caller must have Organization Admin authority.

**PROJECT DECISION**

Add Member accepts the existing User's email. Backend normalizes the email, resolves the User, stores the resolved `userId`, and returns `USER_NOT_FOUND` if the account does not exist.

The final active `ORGANIZATION_ADMIN` cannot be removed or demoted. Return `LAST_ORGANIZATION_ADMIN` with HTTP 409.

---

## 16. stores Module

Owns:

- list Stores
- create Store
- get Store
- update Store

Rules:

- Store belongs to Organization
- management requires Organization Admin
- tenant isolation is enforced

Store statuses:

~~~text
ACTIVE
INACTIVE
~~~

---

## 17. products Module

Owns:

- list Products
- create/get/update/delete Product
- create/update/delete Variant
- Product Image object-key association

Rules:

- Product belongs to Store
- Store belongs to same Organization
- Variant belongs to Product
- Product/Variant edits do not mutate historical OrderItem snapshots
- Variant.price is integer satang

File transfer itself belongs to files module.

---

## 17A. Storefront Read Routes

The source defines a Frontend Storefront module but no separate Backend storefront module.

**PROJECT DECISION**

Public `/api/v1/storefront/*` read routes are composed from the existing organizations/stores/products/campaigns services.

Rules:

- no new backend domain module is required
- return only `ACTIVE` Organization/Store/Product/Variant data
- Campaign Product scope is same-store: `product.storeId === campaign.storeId`
- expose Campaign data intended for customer ordering
- if Product has `imageKey`, Backend may return a 900-second Pre-signed GET `imageUrl` derived from that stored key
- the public Storefront never accepts an arbitrary object key to sign
- never expose members, private payments, audit data, password fields, or private S3 keys
- Order creation remains authenticated

---

## 18. campaigns Module

Owns Campaign list/create/get/update and lifecycle actions.

**PROJECT DECISION:** `openAt/closeAt/paymentDeadline/pickupAt` are planning/display data only. No scheduler automatically changes Campaign status in the MVP; lifecycle action endpoints are authoritative.

Canonical lifecycle:

~~~text
DRAFT
→ OPEN
→ CLOSED
→ PRODUCING
→ READY_FOR_PICKUP
→ COMPLETED
~~~

OPEN → PRODUCING must be rejected.

Service owns one centralized transition policy.

**PROJECT DECISION — close/production payment boundary**

- `CLOSED` Campaign may still finish outstanding Payment reviews/resubmissions.
- `CLOSED → PRODUCING` is allowed only when no Order remains `PAYMENT_REVIEW`.
- once Campaign is `PRODUCING` or later, new Payment submission/resubmission/approval is not reviewable.

**PROJECT DECISION**

Campaign cancellation is allowed from `DRAFT`, `OPEN`, or `CLOSED` only when no Order is in `PAYMENT_REVIEW`, `PAID`, or later. `PRODUCING` and later cannot cancel. Unpaid `PENDING_PAYMENT` / `PAYMENT_REJECTED` Orders become `CANCELLED` when Campaign cancellation succeeds.

---

## 19. orders Module

Owns:

- create Order
- Organization Order list/search/detail
- current-user own Orders
- business-triggered Order status updates
- OrderItem snapshot creation

### Order Creation

Input:

~~~text
campaignId
items[]
  productId
  variantId
  quantity
~~~

Backend must:

1. verify authenticated caller
2. verify Campaign belongs to Organization
3. require Campaign OPEN
4. load Product/Variant tenant-safely
5. require `product.storeId === campaign.storeId`
6. validate Variant belongs to Product
7. read authoritative Variant.price
8. calculate unitPrice/totalPrice
9. calculate Order subtotal/total
10. create immutable OrderItem snapshots
11. create CampaignOrderLink
12. commit transaction

Initial status:

~~~text
PENDING_PAYMENT
~~~

Snapshot:

~~~text
productName
variantName
unitPrice
quantity
totalPrice
~~~

Customer own-order access requires order.customerId equal current userId.

Staff/Admin access requires current Organization membership.

**PROJECT DECISION — post-payment progression**

```text
Payment approve while Campaign OPEN   → Order PAID
Campaign close                         → currently PAID Orders CONFIRMED
Payment approve while Campaign CLOSED → Order CONFIRMED immediately
Campaign start-production              → requires no PAYMENT_REVIEW Orders, then CONFIRMED Orders IN_PRODUCTION
Campaign ready-for-pickup              → IN_PRODUCTION Orders READY_FOR_PICKUP + Pickup READY + PickupLink + notification event
Pickup confirm                          → Order RECEIVED + Pickup RECEIVED + PickupLink RECEIVED
```

Payment submission/resubmission and approval are allowed only while Campaign is `OPEN` or `CLOSED`. Once Campaign is `PRODUCING` or later, return `PAYMENT_NOT_REVIEWABLE`.

Campaign completion requires all paid/production Orders to be `RECEIVED`.

**PROJECT DECISION — Order cancellation**

Allowed states:

```text
PENDING_PAYMENT
PAYMENT_REJECTED
```

Actors:

- Customer for own Order
- Organization Admin for tenant Order
- Staff cannot perform general cancellation

Successful cancellation writes `ORDER_CANCELLED` AuditLog and updates any CampaignOrderLink status projection.

Paid-or-later and `PAYMENT_REVIEW` Orders cannot cancel in MVP because refund/reversal behavior is outside scope.

---

## 20. payments Module

Owns:

- payment submission/resubmission
- review queue
- get Payment
- approve
- reject
- Payment ↔ Order status synchronization

Payment statuses:

~~~text
PENDING_REVIEW
APPROVED
REJECTED
~~~

### Submit

After S3 upload:

~~~text
verify Customer owns the Order
→ validate slipKey path / uploaded object metadata
→ require Campaign OPEN or CLOSED
→ create Payment on first submission
→ Payment PENDING_REVIEW
→ Order PAYMENT_REVIEW
→ write PAYMENT_SUBMITTED Audit
~~~

If Campaign is `PRODUCING` or later, return `PAYMENT_NOT_REVIEWABLE` and do not accept a new/resubmitted slip.

**PROJECT DECISION**

Each Order has one logical Payment record.

Rejected resubmission:

~~~text
PAYMENT_REJECTED
→ replacement slip submit while Campaign OPEN/CLOSED
→ reuse same paymentId
→ replace slipKey
→ clear rejectReason/reviewedBy/reviewedAt
→ Payment PENDING_REVIEW
→ Order PAYMENT_REVIEW
~~~

Approved/paid-or-later Orders cannot submit another slip.

### Approve

Core effects depend on current Campaign status:

~~~text
Campaign OPEN:
  Payment → APPROVED
  Order → PAID

Campaign CLOSED:
  Payment → APPROVED
  Order → CONFIRMED

Campaign PRODUCING or later:
  reject with PAYMENT_NOT_REVIEWABLE
~~~

A successful approval also sets `reviewedBy` / `reviewedAt`, writes AuditLog, and updates the CampaignOrderLink projection.

After successful core write publish PAYMENT_APPROVED event.

### Reject

Require non-empty reason.

Core effects:

~~~text
Payment → REJECTED
Order → PAYMENT_REJECTED
rejectReason
reviewedBy
reviewedAt
AuditLog
CampaignOrderLink projection update
~~~

Then publish PAYMENT_REJECTED.

### Notification Failure

FINAL:

Failure to publish/process notification must not roll back the core Order/Payment transaction.

Log and monitor notification failure independently.

---

## 21. production Module

Role: Organization Admin.

Owns:

~~~text
Paid Orders
→ Order Items
→ group Product
→ group Variant
→ sum Quantity
~~~

Rules:

- campaign-scoped
- tenant-scoped
- a contributing Order must have `Payment.status = APPROVED`
- contributing Order statuses are `PAID`, `CONFIRMED`, `IN_PRODUCTION`, `READY_FOR_PICKUP`, or `RECEIVED`
- unpaid/rejected/cancelled Orders are excluded
- use Data Spec access patterns
- no full-table Scan in normal request flow

This includes Payments approved after Campaign close, whose Orders move directly to `CONFIRMED`.

Frontend consumes Backend summary; it does not recalculate authoritative production totals.

---

## 22. pickups Module

Owns:

- list/search Pickup
- tenant-scoped lookup by `pickupId`
- token lookup
- detail
- confirm
- customer pickup DTO

Pickup statuses:

~~~text
READY
RECEIVED
~~~

**PROJECT DECISION — PickupLink access**

Organization list/get-by-`pickupId` uses Data Spec `PickupLink` items under the Organization partition. Backend resolves `pickupId → orderId` from the PickupLink, then loads the canonical Order-scoped Pickup.

When Campaign becomes `READY_FOR_PICKUP`, creation of a missing Pickup must also create the matching PickupLink in the same business transaction.

Confirm service must enforce:

- correct Organization
- Staff/Admin authorization
- Order ready for pickup
- Pickup not already received

Core transaction:

~~~text
condition Pickup.status != RECEIVED
→ Pickup.status = RECEIVED
→ PickupLink.status = RECEIVED
→ Order.status = RECEIVED
→ receivedBy = current userId
→ receivedAt = current UTC timestamp
→ AuditLog
~~~

Duplicate confirmation returns PICKUP_ALREADY_RECEIVED.

**PROJECT DECISION**

Pickup token uses 128 bits of cryptographically secure randomness encoded as base64url without padding (22 characters).

---

## 23. reports Module

Owns Organization report/dashboard aggregation API.

**PROJECT DECISION**

Dashboard / Report baseline returns:

```text
totalStores
totalProducts
campaignsByStatus
ordersByStatus
pendingPaymentReviews
paidOrderCount
paidRevenueSatang
```

`paidRevenueSatang` uses integer satang and includes Orders that reached `PAID` or later paid states.

---

## 24. audit Module

Owns:

- AuditLog write helper/service
- audit list/query
- metadata sanitization

Audit fields:

~~~text
auditId
organizationId
actorId
action
resourceType
resourceId
metadata
createdAt
~~~

Action tokens come from Data Spec.

Required Audit events include Payment approve/reject and Pickup confirm.

Never place credentials, JWT or slip binary in metadata.

---

## 25. files Module

Owns:

- Product Image upload URL generation
- Payment Slip upload URL generation
- private file download URL generation
- object-key authorization/validation

Canonical keys:

~~~text
products/{organizationId}/{productId}/{uuid}
payments/{organizationId}/{orderId}/{uuid}
~~~

Pre-signed URL expiry:

~~~text
900 seconds
~~~

Payment Slip is private.

Before private file URL issuance validate:

- authenticated caller
- tenant/membership for Staff/Admin
- Order ownership for Customer
- object key belongs to expected tenant/resource path

Browser uploads/downloads directly to S3. Backend does not proxy binary.

**PROJECT DECISION**

Upload limits:

```text
Product Image: max 5 MiB
Payment Slip: max 10 MiB
Allowed MIME: image/jpeg, image/png, image/webp
```

Backend validates these constraints as part of the authorized upload flow.

For direct PUT:

1. validate requested `contentType` before generating the Pre-signed URL
2. sign the expected Content-Type where supported by the SDK request
3. before persisting Product `imageKey` or accepting Payment `slipKey`, issue S3 HEAD/metadata lookup
4. reject missing objects, unsupported Content-Type, or objects above the relevant size limit

---

## 26. notifications Module

Owns:

- current-user Notification list
- Notification ownership
- mark-read
- Worker event-to-notification mapping

Canonical notification types:

~~~text
PAYMENT_APPROVED
PAYMENT_REJECTED
READY_FOR_PICKUP
~~~

Mark read sets readAt to current ISO UTC timestamp.

Current user may access only Notification items where notification.userId matches current userId.

---

## 27. Notification Publisher

Backend publishes canonical versioned event payload from Data Spec.

Fields:

~~~text
version
eventId
type
occurredAt
organizationId
recipientUserId
resourceType
resourceId
data
~~~

Do not put passwordHash, JWT, AWS credentials or slip binary into the event.

Queue URL comes from NOTIFICATION_QUEUE_URL.

---

## 28. Notification Worker

Worker code is under Backend ownership but deployed as a separate Lambda.

Entry target:

~~~text
src/worker.js
~~~

Flow:

~~~text
SQS batch
→ validate event
→ idempotency check
→ map event to Notification
→ write Notification
→ complete
~~~

PROJECT DECISION:

Use eventId as the logical idempotency key so repeated SQS delivery does not create duplicate Notifications.

Canonical mapping:

```text
Notification.notificationId = event.eventId
Notification.createdAt = event.occurredAt
```

Repository writes the Notification with a conditional put. If the same event is delivered again and the same Notification already exists, treat that duplicate delivery as successfully idempotent rather than creating a second item.

Worker must not report success when the required Notification write failed.

Infrastructure controls retry/event-source configuration.

---

## 29. platform-admin Module

Owns:

- list Organizations
- approve Organization
- suspend Organization
- list Users
- platform summary

Platform Admin is separate from Organization membership roles.

Authorization requires the persisted current User to have:

```text
platformRole = PLATFORM_ADMIN
```

The Platform Admin seed writes this field. Backend reloads User state before protected platform actions.

Approve:

~~~text
PENDING → ACTIVE
~~~

Suspend:

~~~text
→ SUSPENDED
~~~

Both actions write Audit entries according to Data Spec.

Effects of suspension beyond normal authorization checks are not fully source-defined and must remain consistent with shared/API policy.

---

## 30. health Module

Endpoint:

~~~text
GET /health
~~~

Public response:

~~~json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
~~~

PROJECT DECISION:

Baseline health verifies application startup/config initialization and stays fast enough for deployment smoke tests.

Do not make basic health depend on expensive full dependency diagnostics.

---

## 31. Repository / Data Contract

Repositories implement docs/specs/data/SPEC.md.

Critical rules:

- one application table
- PAY_PER_REQUEST is infrastructure billing mode
- PK/SK/GSI1 contracts match Data Spec
- no normal request flow uses full-table Scan
- CampaignOrderLink maintained as specified
- ProductVariant remains tenant-scoped
- OrderItem/Payment/Pickup child partitions use `ORG#{organizationId}#ORDER#{orderId}`
- storage fields do not leak to API

---

## 32. Transaction Boundaries

### Order Creation

Transactional core:

- Order
- OrderItems
- CampaignOrderLink

### Payment Approve/Reject

Transactional core:

- Payment
- Order
- AuditLog
- CampaignOrderLink projection when required

SQS event publication occurs after successful core transaction.

### Pickup Confirm

Conditional/transactional core:

- require Pickup not RECEIVED
- update Pickup
- update Order
- AuditLog

### Organization Creation

PROJECT DECISION:

Create Organization + creator membership + Audit in one transaction where feasible.

---

## 33. Conditional Writes and Concurrency

Use conditional writes for state-sensitive mutations.

Examples:

- Payment approve/reject only from reviewable state
- Pickup cannot confirm after RECEIVED
- Campaign action requires expected current state

Do not rely on read-then-write without a conditional guard where concurrent requests can create an invalid transition.

---

## 34. API Mapping

Backend must match docs/api/API_CONTRACT.md for:

- route
- method
- request fields
- response envelope
- HTTP status
- error code
- authentication boundary

No undocumented convenience endpoint should become a Frontend dependency.

---

## 35. Response Mapping

Success:

~~~json
{
  "success": true,
  "data": {}
}
~~~

List:

~~~json
{
  "success": true,
  "data": {
    "items": [],
    "nextCursor": null
  }
}
~~~

Repository objects are mapped to API DTOs before returning.

---

## 36. Cursor Pagination

PROJECT DECISION:

Cursor is opaque. Backend may encode DynamoDB pagination state into a base64url-safe cursor.

Rules:

- Frontend never parses it
- malformed cursor returns INVALID_CURSOR
- cursor preserves tenant/query scope
- avoid exposing sensitive storage internals unnecessarily

---

## 36A. Backend Command Contract

**PROJECT DECISION**

**PROJECT DECISION:** `backend/package-lock.json` is committed so deployment can use deterministic `npm ci`.

Backend `package.json` must expose:

```bash
npm test
npm run check
npm run seed:platform-admin
```

`npm run seed:platform-admin` executes `backend/scripts/seed-platform-admin.js`, sets the target User's `platformRole = PLATFORM_ADMIN`, and ensures the Data Spec `PlatformUserLink` exists.

Seed inputs are environment-driven:

```text
PLATFORM_ADMIN_EMAIL
PLATFORM_ADMIN_PASSWORD
PLATFORM_ADMIN_NAME
```

Behavior:

- if User does not exist, create it with hashed password and `platformRole=PLATFORM_ADMIN`
- if User already exists, keep the existing password and set `platformRole=PLATFORM_ADMIN`
- never print the password

`npm run check` performs non-destructive static/syntax/lint validation.

Deployment packaging is owned by `scripts/build-backend.sh`, which runs:

```text
npm ci
→ npm test
→ npm run check
→ assemble production dependencies + Backend source into backend/.build/lambda/
```

The artifact contains both `src/lambda.js` and `src/worker.js`; BackendFunction and WorkerFunction may use the same packaged code with different handlers.

`backend/.build/**` is generated and Git-ignored.

Backend does not require a separate transpilation build unless implementation later introduces one and updates Deployment Spec.

---

## 37. Environment Contract

Expected application-configured Backend/Worker variables:

~~~text
NODE_ENV
APP_TABLE_NAME
FILES_BUCKET_NAME
NOTIFICATION_QUEUE_URL
JWT_SECRET
JWT_EXPIRES_IN
~~~

Production baseline:

~~~text
JWT_EXPIRES_IN=1d
~~~

`AWS_REGION` is provided automatically by the AWS Lambda runtime and must not be configured manually in Lambda `Environment.Variables`.

Local/CLI tooling may still set `AWS_REGION=us-east-1` explicitly outside Lambda.

Rules:

- no secret committed
- JWT_SECRET has no hard-coded production fallback
- resource names come from environment
- Infrastructure/Deployment owns injection

---

## 38. AWS SDK Rules

Learner Lab Lambda obtains AWS permissions from existing LabRole.

Do not:

- hard-code AWS access keys
- create IAM Users
- commit credentials
- assume physical bucket/table/queue names

Dev Mode may use alternate endpoints only through configuration defined in Dev Spec.

---

## 39. Logging

Backend/Worker logs to stdout/stderr for CloudWatch capture.

PROJECT DECISION structured fields should include when available:

~~~text
level
message
requestId
userId
organizationId
module
action
errorCode
timestamp
~~~

Never log:

- password
- passwordHash
- JWT
- AWS secrets
- full Pre-signed URL
- sensitive Payment Slip content

---

## 40. Security Requirements

1. Passwords are hashed.
2. JWT is verified for protected routes.
3. Disabled users cannot continue protected operations.
4. Backend resolves current membership.
5. resource ownership is verified.
6. tenant boundaries are enforced.
7. client roles are not trusted.
8. client prices/totals are not authoritative.
9. Payment Slip remains private.
10. Pre-signed access is authorized first.
11. S3 object keys are checked against expected tenant/resource paths.
12. duplicate Pickup confirmation is rejected.
13. Payment reject requires reason.
14. secrets are not logged/returned.
15. Notification failure does not fail core Order/Payment transaction.

---

## 41. Organization Status Enforcement

Organization statuses:

~~~text
PENDING
ACTIVE
SUSPENDED
~~~

PROJECT DECISION:

Organization business mutations that require an operational tenant should require ACTIVE status.

Platform Admin approval/suspension routes operate according to their documented policy.

Exact read-only visibility for suspended tenants remains conservative until integration/security tests finalize it.

---

## 42. CORS Boundary

Backend may provide Express-side CORS-compatible headers/config where needed.

Infrastructure owns API Gateway and S3 CORS resources.

Allowed origins must come from environment/config rather than an unrestricted production wildcard by default.

Exact origin policy is finalized in Infrastructure Spec.

---

## 43. Dev Mode Boundary

Backend must support the same application code locally.

~~~text
same Express app
same services
same repositories/contracts
same JWT behavior
same RBAC
same tenant rules
same business rules
+
environment-specific adapters/config
~~~

Forbidden dev shortcuts:

- bypass authorization
- skip tenant checks
- change status rules
- use a separate fake business logic path

Detailed local services belong to docs/specs/dev/SPEC.md.

---

## 44. Backend Test Responsibilities

Backend Agent must verify:

### Auth

- register
- duplicate email
- login success/failure
- password hashing
- JWT generation/expiry/invalid
- disabled user

### Tenant / RBAC

- valid membership
- missing membership
- wrong tenant
- wrong role
- Customer ownership
- cross-tenant resource access rejected

### Campaign

- valid lifecycle actions
- OPEN → PRODUCING rejected
- unresolved cancel states not invented

### Order

- creation only in OPEN Campaign
- authoritative server price calculation
- snapshots
- tenant scope
- own-order access

### Payment

- submit slipKey
- approve
- reject reason required
- Payment/Order status sync
- Audit
- event publication
- core transaction retained when notification publish fails

### Production

- paid orders only
- Product/Variant grouping
- campaign/tenant scope

### Pickup

- confirm once
- duplicate conflict
- receivedBy/receivedAt
- tenant enforcement

### Files

- key validation
- ownership authorization
- 900-second URL contract
- no binary proxy

### Worker

- event validation
- idempotency
- Notification creation
- retryable failure behavior

### API

- standard envelopes
- stable errors/statuses
- cursor validation
- no secret/storage leakage

---

## 45. Backend Acceptance Criteria

Backend subsystem is implementation-ready when:

- [ ] Express follows Route → Middleware → Controller → Service → Repository
- [ ] one Express app supports Lambda adapter and Dev Mode
- [ ] all source-defined modules exist
- [ ] routes match API_CONTRACT
- [ ] password is hashed and never returned
- [ ] JWT claim contract is followed
- [ ] GET /me returns user + memberships
- [ ] Organization membership/role is authoritative
- [ ] tenant access follows Data Spec
- [ ] no normal request flow requires full-table Scan
- [ ] Order prices/totals are server-calculated
- [ ] OrderItem snapshots are created
- [ ] Payment review core writes are transactional
- [ ] Payment reject requires reason
- [ ] approve/reject create Audit + Notification event
- [ ] notification failure does not roll back core transaction
- [ ] Production Summary uses paid orders
- [ ] Pickup duplicate confirm is conditionally rejected
- [ ] successful Pickup stores receivedBy/receivedAt
- [ ] Product Image/Payment Slip use direct S3 Pre-signed flow
- [ ] Payment Slip remains private
- [ ] Worker uses canonical SQS event
- [ ] Notification API checks ownership
- [ ] Platform Admin is separated from Organization Admin
- [ ] GET /health matches contract
- [ ] AWS names come from environment
- [ ] no CloudFront/Cognito/SES dependency
- [ ] no AWS credentials/secrets committed

---

## 46. Backend Decision Closure

The previous blocking gaps are resolved as explicit PROJECT DECISIONs in Shared/API/Data contracts:

- Campaign cancellation rules
- post-PAID lifecycle
- Order cancellation
- Pickup token format
- no automatic MVP retention/TTL cleanup
- Last Organization Admin protection
- Dashboard metric baseline
- upload size/MIME limits
- Platform Admin persistence/authorization
- no project-created SQS DLQ in MVP; use normal SQS redelivery + Worker idempotency

Backend Agent no longer needs to invent cross-system behavior before implementation.
