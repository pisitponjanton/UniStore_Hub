# UniStore Hub — Data Specification

> **Purpose:** Shared DynamoDB/domain data contract for Backend and Infrastructure  
> **Database:** Amazon DynamoDB  
> **Capacity:** `PAY_PER_REQUEST`  
> **Model:** Single application table  
> **Read with:** `SPEC.md`, `docs/specs/00-shared-contracts.md`, `docs/api/API_CONTRACT.md`

---

## 1. Ownership Boundary

This file defines the shared data design.

Implementation ownership is split:

- Backend Agent → repositories, mappers, application queries and writes
- Infrastructure Agent → DynamoDB table and index resources
- Integration Agent → verifies both match this contract

No independent Data Agent should edit both Backend and Infrastructure implementation directories in parallel.

---

## 2. Source-Defined Baseline

Core entities:

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

Base table attributes:

```text
PK
SK
GSI1PK
GSI1SK
entityType
createdAt
updatedAt
```

Source key examples:

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

**Source-alignment note:** the source examples use `ORDER#{orderId}` for Payment/Pickup child partitions, while the same source also prohibits querying Organization-owned resources by `resourceId` alone. The canonical implementation therefore uses tenant-qualified Order child partitions in Section 6 as an explicit **PROJECT DECISION**.

---

## 3. Shared Data Decisions

The following choices are required so parallel agents use the same values.

### 3.1 Identifier Format

**PROJECT DECISION**

Use UUID v4 strings for generated entity IDs.

Examples:

```text
userId
organizationId
storeId
productId
variantId
campaignId
orderId
orderItemId
paymentId
pickupId
auditId
notificationId
```

IDs are opaque outside the creating subsystem.

### 3.2 Timestamp Format

**PROJECT DECISION**

Persist and serialize timestamps as ISO 8601 UTC strings.

Example:

```text
2026-09-28T14:30:00.000Z
```

Lexicographic ordering therefore preserves chronological ordering for canonical timestamps.

### 3.3 Money Representation

**PROJECT DECISION**

Store monetary values as integer satang.

Examples:

```text
10000  = 100.00 THB
250050 = 2,500.50 THB
```

Never store application money as binary floating point.

### 3.4 Role Tokens

```text
CUSTOMER
STAFF
ORGANIZATION_ADMIN
PLATFORM_ADMIN
```

### 3.5 Payment Status

**PROJECT DECISION**

```text
PENDING_REVIEW
APPROVED
REJECTED
```

### 3.6 Pickup Status

**PROJECT DECISION**

```text
READY
RECEIVED
```

---

## 4. Single-Table Key Strategy

### 4.1 Table Primary Key

```text
PK  string
SK  string
```

### 4.2 GSI1

```text
GSI1PK string
GSI1SK string
```

**PROJECT DECISION**

GSI1 is the general alternate lookup index used for user-centric and cross-partition access patterns needed by the MVP.

No additional GSI is introduced in the baseline unless a documented access pattern cannot be supported safely.

### 4.3 Key Formatting

All key segments use uppercase entity prefixes.

Examples:

```text
USER#<id>
ORG#<id>
STORE#<id>
PRODUCT#<id>
CAMPAIGN#<id>
ORDER#<id>
PAYMENT#<id>
PICKUP#<id>
NOTIFICATION#<id>
```

---

## 5. Tenant Ownership Rules

### 5.1 Organization-Owned Entities

These are Organization-owned:

```text
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
```

Each stored item must either:

- include `organizationId` directly; or
- be stored under a partition where tenant ownership is unambiguous and also expose `organizationId` to application mappers when required

### 5.2 Explicit Tenant Field

**PROJECT DECISION**

For authorization simplicity and auditability, all Organization-owned application entities listed above store `organizationId` explicitly, including OrderItem.

### 5.3 Tenant Query Rule

Never authorize a tenant-owned resource from a global ID lookup alone.

Safe pattern:

```text
known organizationId
+
resource id
→ tenant-scoped query/get
→ verify stored organizationId
```

---

## 6. Entity Contracts

The Final source enumerates the canonical entities and defines selected fields/rules, but it does not provide a complete field schema for every entity.

**PROJECT DECISION**

Unless a field is explicitly identified as source-defined, the field sets below are the canonical MVP implementation schema chosen to satisfy the source requirements and shared API contracts.

### 6.1 User

Required fields:

```text
userId
email
passwordHash
name
status
platformRole
createdAt
updatedAt
```

**PROJECT DECISION**

User status baseline:

```text
ACTIVE
DISABLED
```

**PROJECT DECISION**

Platform Admin authority is stored as:

```text
platformRole = PLATFORM_ADMIN | null
```

Normal users use `null`. The Platform Admin seed writes `PLATFORM_ADMIN`.

Keys:

```text
PK = USER#{userId}
SK = PROFILE
```

GSI1 for login-by-email:

```text
GSI1PK = EMAIL#{normalizedEmail}
GSI1SK = USER#{userId}
```

Normalized email is lowercase trimmed email.

PasswordHash never appears in normal API response mappers.

### 6.1.1 Platform User Listing Link

**PROJECT DECISION**

To support Platform Admin `GET /platform/users` without a full-table Scan, User creation also writes an internal link item:

```text
PK = PLATFORM#USERS
SK = USER#{createdAt}#{userId}
entityType = PlatformUserLink
userId
status
createdAt
```

This is an internal index item, not a public domain entity. Platform user listing queries this partition and loads/sanitizes User profiles.

---

### 6.2 Organization

Fields:

```text
organizationId
name
description
status
createdBy
createdAt
updatedAt
```

**PROJECT DECISION**

Organization status:

```text
PENDING
ACTIVE
SUSPENDED
```

Keys:

```text
PK = ORG#{organizationId}
SK = PROFILE
```

GSI1 for creator/platform-oriented lookup when populated:

```text
GSI1PK = ORGS
GSI1SK = CREATED#{createdAt}#ORG#{organizationId}
```

Platform list behavior may use this index rather than Scan.

---

### 6.3 OrganizationMember

Fields:

```text
organizationId
userId
role
status
createdAt
updatedAt
```

Membership roles:

```text
STAFF
ORGANIZATION_ADMIN
```

**PROJECT DECISION**

Membership status:

```text
ACTIVE
INACTIVE
```

Keys:

```text
PK = ORG#{organizationId}
SK = MEMBER#{userId}
```

GSI1 enables "Organizations for current user":

```text
GSI1PK = USER#{userId}
GSI1SK = ORG#{organizationId}
```

---

### 6.4 Store

Fields:

```text
storeId
organizationId
name
description
status
createdAt
updatedAt
```

**PROJECT DECISION**

Store status:

```text
ACTIVE
INACTIVE
```

Keys:

```text
PK = ORG#{organizationId}
SK = STORE#{storeId}
```

---

### 6.5 Product

Fields:

```text
productId
organizationId
storeId
name
description
imageKey
status
createdAt
updatedAt
```

**PROJECT DECISION**

Product status:

```text
ACTIVE
INACTIVE
```

Keys:

```text
PK = ORG#{organizationId}
SK = PRODUCT#{productId}
```

GSI1 for Store product listing:

```text
GSI1PK = ORG#{organizationId}#STORE#{storeId}
GSI1SK = PRODUCT#{productId}
```

The alternate index carries tenant context directly.

---

### 6.6 ProductVariant

Fields:

```text
variantId
organizationId
productId
name
price
status
createdAt
updatedAt
```

Price is integer satang.

**PROJECT DECISION**

Variant status:

```text
ACTIVE
INACTIVE
```

Keys:


```text
PK = ORG#{organizationId}
SK = PRODUCT#{productId}#VARIANT#{variantId}
```

List variants with a tenant-scoped query:

```text
PK = ORG#{organizationId}
begins_with(SK, "PRODUCT#{productId}#VARIANT#")
```

This keeps ProductVariant access tenant-scoped without requiring a resource-id-only partition lookup.

---

### 6.7 Campaign

Fields:

```text
campaignId
organizationId
storeId
name
openAt
closeAt
paymentDeadline
pickupAt
status
createdAt
updatedAt
```

Status:

```text
DRAFT
OPEN
CLOSED
PRODUCING
READY_FOR_PICKUP
COMPLETED
CANCELLED
```

Keys:

```text
PK = ORG#{organizationId}
SK = CAMPAIGN#{campaignId}
```

GSI1 for Store campaigns:

```text
GSI1PK = ORG#{organizationId}#STORE#{storeId}
GSI1SK = CAMPAIGN#{createdAt}#{campaignId}
```

The alternate index carries tenant context directly.

**PROJECT DECISION — Campaign Product scope**

No CampaignProduct entity is added. A Campaign covers active Products/Variants whose `storeId` equals `Campaign.storeId`.

**PROJECT DECISION**

Campaign cancellation is allowed from `DRAFT`, `OPEN` or `CLOSED` only when no Order is in `PAYMENT_REVIEW`, `PAID`, or a later paid lifecycle state. `PRODUCING` and later Campaigns cannot be cancelled in the MVP.

---

### 6.8 Order

Fields:

```text
orderId
organizationId
campaignId
customerId
status
subtotal
total
createdAt
updatedAt
```

Status:

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

Money fields are integer satang.

Keys:

```text
PK = ORG#{organizationId}
SK = ORDER#{orderId}
```

GSI1 supports Customer own-order list:

```text
GSI1PK = USER#{customerId}
GSI1SK = ORDER#{createdAt}#{orderId}
```

### 6.8.1 Campaign Order Listing

**PROJECT DECISION**

To query Orders by Campaign without Scan, use a denormalized **CampaignOrderLink** item:

```text
PK = ORG#{organizationId}
SK = CAMPAIGN#{campaignId}#ORDER#{createdAt}#{orderId}
entityType = CampaignOrderLink
organizationId
campaignId
orderId
customerId
status
```

This is an internal index item, not a public domain entity.

Backend creates/updates it transactionally with Order status changes needed for production/payment filters.

Campaign-order queries remain tenant-scoped and avoid adding a second GSI in the baseline.

---

### 6.9 OrderItem

Required snapshot fields:

```text
orderItemId
organizationId
orderId
productId
variantId
productName
variantName
unitPrice
quantity
totalPrice
createdAt
```

Keys:

```text
PK = ORG#{organizationId}#ORDER#{orderId}
SK = ITEM#{orderItemId}
```

**PROJECT DECISION — tenant hardening**

This intentionally refines the source's abbreviated `ORDER#{orderId}` child partition example so the child query always carries `organizationId`.

Order snapshot fields are immutable after order creation except for correction workflows explicitly introduced later.

---

### 6.10 Payment

Fields:

```text
paymentId
organizationId
orderId
customerId
slipKey
status
rejectReason
reviewedBy
reviewedAt
createdAt
updatedAt
```

Status:

```text
PENDING_REVIEW
APPROVED
REJECTED
```

Keys:

```text
PK = ORG#{organizationId}#ORDER#{orderId}
SK = PAYMENT#{paymentId}
```

**PROJECT DECISION — tenant hardening**

Payment child access always includes tenant context in the partition key.

For Customer own-Payment reads, request authorization does not query Payment by `paymentId` alone. Backend first resolves the authenticated Customer's owned Order, derives `organizationId` from that Order, then queries the Order Payment partition using `organizationId + orderId`.

This reuses the canonical Order child partition and requires no new GSI.

GSI1 for organization payment-review queue:

```text
GSI1PK = ORG#{organizationId}
GSI1SK = PAYMENT#{status}#{createdAt}#{paymentId}
```

When status changes, GSI1SK is updated.

**PROJECT DECISION — one logical Payment per Order**

- first slip submission creates `paymentId`
- rejected resubmission updates the same Payment item and keeps the same `paymentId`
- resubmission replaces `slipKey`, resets status to `PENDING_REVIEW`, and clears `rejectReason/reviewedBy/reviewedAt`
- AuditLog preserves review history
- approved Payment cannot be resubmitted

Payment Slip key must match:

```text
payments/{organizationId}/{orderId}/{uuid}
```

---

### 6.11 Pickup

Fields:

```text
pickupId
organizationId
orderId
campaignId
customerId
token
status
receivedBy
receivedAt
createdAt
updatedAt
```

Status:

```text
READY
RECEIVED
```

Canonical Pickup item:

```text
PK = ORG#{organizationId}#ORDER#{orderId}
SK = PICKUP
```

**PROJECT DECISION — tenant hardening**

Pickup child access always includes tenant context in the partition key.

### 6.11.1 PickupLink

**PROJECT DECISION — API access-pattern support**

When a Pickup is created, Backend also writes an internal Organization-scoped link item:

```text
PK = ORG#{organizationId}
SK = PICKUP#{pickupId}
entityType = PickupLink
organizationId
pickupId
orderId
campaignId
customerId
token
status
createdAt
updatedAt
```

This link supports:

- Organization Pickup list without Scan
- tenant-safe lookup by `pickupId`
- resolving `pickupId → orderId` before loading the canonical Pickup item

Whenever Pickup status changes, Backend updates the PickupLink status in the same core transaction.

### 6.11.2 Token Lookup

GSI1 supports Organization-scoped token lookup:

```text
GSI1PK = ORG#{organizationId}#PICKUP_TOKEN#{token}
GSI1SK = PICKUP#{pickupId}#ORDER#{orderId}
```

Staff token lookup therefore always supplies the active `organizationId`.

### 6.11.3 Token Format

**PROJECT DECISION**

Token generation uses 128 bits of cryptographically secure randomness encoded as base64url without padding (22 characters).

---

### 6.12 AuditLog

Fields:

```text
auditId
organizationId
actorId
action
resourceType
resourceId
metadata
createdAt
```

Keys:

```text
PK = ORG#{organizationId}
SK = AUDIT#{createdAt}#{auditId}
```

**PROJECT DECISION**

Minimum action tokens:

```text
ORGANIZATION_CREATED
ORGANIZATION_UPDATED
MEMBER_ADDED
MEMBER_ROLE_UPDATED
MEMBER_REMOVED
STORE_CREATED
STORE_UPDATED
PRODUCT_CREATED
PRODUCT_UPDATED
PRODUCT_DELETED
VARIANT_CREATED
VARIANT_UPDATED
VARIANT_DELETED
CAMPAIGN_CREATED
CAMPAIGN_UPDATED
CAMPAIGN_STATUS_CHANGED
ORDER_CREATED
ORDER_CANCELLED
PAYMENT_SUBMITTED
PAYMENT_APPROVED
PAYMENT_REJECTED
PICKUP_CONFIRMED
ORGANIZATION_APPROVED
ORGANIZATION_SUSPENDED
```

Not every CRUD read produces an audit event.

---

### 6.13 Notification

Fields:

```text
notificationId
userId
type
title
message
resourceType
resourceId
readAt
createdAt
```

Keys:

```text
PK = USER#{userId}
SK = NOTIFICATION#{createdAt}#{notificationId}
```

Source-defined event semantics:

```text
PAYMENT_APPROVED
PAYMENT_REJECTED
READY_FOR_PICKUP
```

**PROJECT DECISION — Worker idempotency**

For Worker-created Notifications:

```text
notificationId = eventId
createdAt = occurredAt
```

The Worker performs a conditional put on the Notification key. Re-delivery of the same event therefore maps to the same item and must not create a duplicate Notification.

---

## 7. Notification Queue Payload

**PROJECT DECISION**

Versioned SQS event shape:

```json
{
  "version": 1,
  "eventId": "uuid",
  "type": "PAYMENT_APPROVED",
  "occurredAt": "2026-09-28T14:30:00.000Z",
  "organizationId": "uuid",
  "recipientUserId": "uuid",
  "resourceType": "PAYMENT",
  "resourceId": "uuid",
  "data": {}
}
```

Rules:

- `eventId` supports idempotency/deduplication logic inside Worker.
- `recipientUserId` identifies the notification owner.
- `data` must contain only the minimal values required to build the notification.
- Never include password hashes or sensitive slip binary data.

---

## 8. Access Pattern Matrix

| ID | Access Pattern | Key Strategy |
|---|---|---|
| AP-01 | Get User by userId | `PK=USER#{userId}, SK=PROFILE` |
| AP-02 | Login lookup by email | GSI1 `EMAIL#{normalizedEmail}` |
| AP-03 | List Organizations for user | GSI1 `USER#{userId}` over membership items |
| AP-04 | Get Organization | `ORG#{organizationId}/PROFILE` |
| AP-05 | List Organization members | Query `PK=ORG#{organizationId}, begins_with(SK,"MEMBER#")` |
| AP-06 | List Organization stores | Query `PK=ORG#{organizationId}, begins_with(SK,"STORE#")` |
| AP-07 | List Organization products | Query `PK=ORG#{organizationId}, begins_with(SK,"PRODUCT#")` |
| AP-08 | List Store products | GSI1 `ORG#{organizationId}#STORE#{storeId}` + `PRODUCT#` sort-key prefix |
| AP-09 | List Product variants | Query `PK=ORG#{organizationId}, begins_with(SK,"PRODUCT#{productId}#VARIANT#")` |
| AP-10 | List Organization campaigns | Query `PK=ORG#{organizationId}, begins_with(SK,"CAMPAIGN#")` |
| AP-11 | List Store campaigns | GSI1 `ORG#{organizationId}#STORE#{storeId}` + `CAMPAIGN#` sort-key prefix |
| AP-12 | Get Organization Order | `PK=ORG#{organizationId}, SK=ORDER#{orderId}` |
| AP-13 | List Customer own Orders | GSI1 `USER#{customerId}` over Order items |
| AP-14 | List Campaign Orders | Query `PK=ORG#{organizationId}, begins_with(SK,"CAMPAIGN#{campaignId}#ORDER#")` over CampaignOrderLink items |
| AP-15 | List Order Items | Query `PK=ORG#{organizationId}#ORDER#{orderId}, begins_with(SK,"ITEM#")` |
| AP-16 | Get/List Order Payments, including Customer own-Payment read after owned Order resolution | Query `PK=ORG#{organizationId}#ORDER#{orderId}, begins_with(SK,"PAYMENT#")` |
| AP-17 | Payment review queue by Organization | GSI1 `ORG#{organizationId}` + payment prefix |
| AP-18 | Get Order Pickup | `PK=ORG#{organizationId}#ORDER#{orderId}, SK=PICKUP` |
| AP-19 | Lookup Pickup by token | GSI1 `ORG#{organizationId}#PICKUP_TOKEN#{token}` |
| AP-20 | List Organization Audit | Query `PK=ORG#{organizationId}, begins_with(SK,"AUDIT#")` |
| AP-21 | List User Notifications | Query `PK=USER#{userId}, begins_with(SK,"NOTIFICATION#")` |
| AP-22 | List Platform Organizations | GSI1 `ORGS` over Organization profiles |
| AP-23 | List Platform Users | Query `PK=PLATFORM#USERS, begins_with(SK,"USER#")` over PlatformUserLink items |
| AP-24 | Get Pickup by pickupId | Get `PK=ORG#{organizationId}, SK=PICKUP#{pickupId}` PickupLink, then load canonical Order-scoped Pickup |
| AP-25 | List Organization Pickups | Query `PK=ORG#{organizationId}, begins_with(SK,"PICKUP#")` over PickupLink items |

---

## 9. Avoiding Scan

Application request paths must not depend on full-table Scan for normal MVP behavior.

If a new requirement cannot be satisfied by:

- primary-key query
- GSI1 query
- internal denormalized index item

then the Data contract must be updated before implementation.

Platform/demo maintenance scripts may use Scan only when explicitly documented as non-request-path tooling.

---

### 9.1 User Listing Projection

User registration writes the User profile and `PlatformUserLink` in the same transaction so Platform Admin listing does not drift.

---

## 10. Transaction / Consistency Boundaries

### 10.1 Order Creation

**PROJECT DECISION**

Use DynamoDB transactional write for:

- Order item
- OrderItem records
- CampaignOrderLink

so partial order creation does not occur.

### 10.2 Payment Approval / Rejection

Core business write should atomically update:

- Payment
- Order
- AuditLog
- CampaignOrderLink status projection when applicable

Approval chooses the Order status from current Campaign status: `OPEN → PAID`, `CLOSED → CONFIRMED`. `PRODUCING` or later is not reviewable.

Notification enqueue occurs after successful core write.

Notification enqueue failure must not roll back the core business transaction.

### 10.3 Pickup Confirmation

Use a conditional write / transaction that:

- requires Pickup.status != `RECEIVED`
- updates Pickup
- updates PickupLink status
- updates Order to `RECEIVED`
- writes AuditLog

Duplicate confirm must fail safely.

### 10.4 Pickup Readiness

When Campaign transitions to `READY_FOR_PICKUP`, each eligible `IN_PRODUCTION` Order is updated together with its canonical Pickup and Organization-scoped PickupLink. Missing Pickup/PickupLink records are created atomically for that Order.

Pickup and PickupLink must carry the same `pickupId`, `orderId`, tenant context, token and status.

---

## 11. Order Snapshot Invariant

At order creation, Backend resolves current Product/Variant and stores:

```text
productName
variantName
unitPrice
quantity
totalPrice
```

TotalPrice calculation:

```text
unitPrice × quantity
```

All values are integer satang.

Order subtotal/total are calculated by Backend, never trusted from client request.

---

## 12. File Key Invariant

Product image:

```text
products/{organizationId}/{productId}/{uuid}
```

Payment slip:

```text
payments/{organizationId}/{orderId}/{uuid}
```

Database stores only the object key, not public URL.

Private download URL is generated on demand after authorization.

---

## 13. Data Returned to API

Repository/model items may contain storage-only fields:

```text
PK
SK
GSI1PK
GSI1SK
entityType
passwordHash
```

API mappers must not expose storage internals unless they are part of the API contract.

Never return:

- `passwordHash`
- raw DynamoDB key implementation details
- AWS credentials
- private S3 bucket internals beyond authorized object-key usage

---

## 14. Logical Notification Separation

The architecture diagram displays Application Data and In-app Notifications as logically separated DynamoDB areas.

**FINAL interpretation**

The Final Spec uses the same DynamoDB service/application-table baseline.

Notification items are separated logically by key namespace:

```text
PK = USER#{userId}
SK = NOTIFICATION#{createdAt}#{notificationId}
```

No second DynamoDB table is required by the source.

---

## 15. GSI1 Collision Rules

Because GSI1 is shared across entity types:

- every GSI1 partition prefix must identify lookup purpose
- every GSI1 sort key must include entity type/prefix where ambiguity is possible
- queries must use partition prefix + sort-key prefix rather than broad mixed-entity filtering

Examples:

```text
EMAIL#...
USER#...
STORE#...
ORG#...
PICKUP_TOKEN#...
ORGS
```

Backend repository helpers should centralize key construction.

---

## 16. Data Security Invariants

1. Password hash is never exposed.
2. Payment Slip is private.
3. Tenant-owned items include explicit `organizationId`.
4. Customer ownership is validated for own Order/Payment/Pickup access.
5. Repository methods accepting resource IDs must also accept/derive required tenant context.
6. Cross-tenant GSI results must still be policy-checked before use.
7. Client-supplied totals/prices/roles are never trusted as authoritative.

---

## 17. Resolved Data Decisions

The source leaves several data-level details unspecified. The MVP resolves them as explicit **PROJECT DECISIONs**:

### 17.1 Order lifecycle

```text
Payment approved while Campaign OPEN   → PAID
Campaign close                         → currently PAID orders become CONFIRMED
Payment approved while Campaign CLOSED → CONFIRMED immediately
Campaign start-production              → requires no PAYMENT_REVIEW orders, then CONFIRMED orders become IN_PRODUCTION
Campaign ready-for-pickup              → IN_PRODUCTION orders become READY_FOR_PICKUP + Pickup/PickupLink READY
Pickup confirmation                    → Order/Pickup/PickupLink RECEIVED
```

Payment submission/resubmission and approval are not allowed once Campaign is `PRODUCING` or later.

### 17.2 Order cancellation

Only `PENDING_PAYMENT` and `PAYMENT_REJECTED` Orders can become `CANCELLED`.

### 17.3 Pickup token

128-bit secure random base64url token without padding.

### 17.4 Retention

No automatic DynamoDB TTL or automatic S3 object cleanup is enabled in the MVP.

Notifications, AuditLogs and uploaded files remain until:

- explicit dev-stack destroy/cleanup, or
- a future retention requirement changes this contract

This preserves source behavior without adding an undocumented deletion policy.

---

## 18. Compatibility Gate

Before Backend and Infrastructure agents begin implementation, verify:

- both use `PK/SK/GSI1PK/GSI1SK`
- both use one application table
- table billing mode is `PAY_PER_REQUEST`
- GSI1 exists with the exact key attributes above
- entity/status/role tokens match Shared Contracts
- money uses integer satang
- timestamps use ISO UTC
- ID generation uses UUID v4
- Payment status uses `PENDING_REVIEW/APPROVED/REJECTED`
- Pickup status uses `READY/RECEIVED`
- Backend uses tenant-safe access patterns
- Infrastructure does not introduce a second app table silently
