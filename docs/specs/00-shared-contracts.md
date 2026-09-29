# UniStore Hub — Shared Contracts

> **Purpose:** Canonical cross-subsystem contract  
> **Consumers:** Frontend, Backend, Data, Infrastructure, Dev, Testing, Integration  
> **Read together with:** `SPEC.md`  
> **Status:** Shared source of truth for interfaces and invariants

---

## 1. Contract Rules

This file contains only behavior or naming that is shared across more than one subsystem.

Subsystem agents must not create their own incompatible version of:

- Roles
- Entity identifiers
- Status names
- Tenant rules
- API prefix / response envelope
- Authentication header
- File path conventions
- Notification event names / semantics
- Cross-system business invariants

If a required detail is not supported by the source, it is explicitly marked:

- **PROJECT DECISION**
- **OPEN DECISION**

An **OPEN DECISION** must not be silently resolved inside implementation code.

---

## 2. Canonical Roles

Source-defined role names:

```text
Customer
Staff
Organization Admin
Platform Admin
```

Responsibilities:

| Role | Source-defined capability boundary |
|---|---|
| Customer | Browse Store/Campaign/Product, create Order, upload Payment Slip, track own Order/Payment, view Pickup QR/Token, view notifications |
| Staff | View/search Organization Orders, review Payment Slip, approve/reject payment, confirm Pickup |
| Organization Admin | Manage Organization/Staff, Store/Product/Variant, Campaign, Production Summary, Dashboard/Report, Audit Log |
| Platform Admin | View/approve/suspend Organizations, view Users, view Platform Summary |

### 2.1 Role Token Values

**PROJECT DECISION**

When serialized in API/data, use:

```text
CUSTOMER
STAFF
ORGANIZATION_ADMIN
PLATFORM_ADMIN
```

Reason:

- Stable machine-readable token names are required for parallel Frontend/Backend/Data implementation.
- Display labels remain the source-defined human role names above.

Agents must not introduce alternate tokens such as `ADMIN`, `ORG_ADMIN`, or `USER` without changing this shared contract.

### 2.2 Role Resolution Model

**PROJECT DECISION**

Role storage/resolution is split deliberately:

- `CUSTOMER` is an implicit capability of any authenticated active User for customer-owned flows; it is not stored as an Organization membership
- `STAFF` and `ORGANIZATION_ADMIN` are stored on `OrganizationMember.role`
- `PLATFORM_ADMIN` is stored on `User.platformRole`

Within an Organization, `ORGANIZATION_ADMIN` inherits the operational Staff capabilities (Order viewing, Payment review, Pickup confirmation) in addition to Admin-only management/report capabilities.

Exception: **Production Summary is explicitly Organization Admin only** to preserve the Final source role boundary.

### 2.3 Platform Admin Authority

**PROJECT DECISION — source-aligned implementation detail**

Platform Admin authority is persisted on the `User` entity as:

```text
platformRole = PLATFORM_ADMIN | null
```

Rules:

- normal users have `platformRole = null`
- the Platform Admin seed sets `platformRole = PLATFORM_ADMIN`
- Backend reloads the current User from DynamoDB before authorizing Platform Admin operations
- `PLATFORM_ADMIN` is not an Organization membership role
- Organization membership roles remain only `STAFF` and `ORGANIZATION_ADMIN`

### 2.4 Last Organization Admin Protection

**PROJECT DECISION**

An Organization must always keep at least one active `ORGANIZATION_ADMIN`.

Removing or demoting the last active Organization Admin must fail with:

```text
LAST_ORGANIZATION_ADMIN
```

---

## 3. Canonical Identifiers

Use these field names where the corresponding entity exists:

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

The source explicitly uses many of these names in entity/key examples.

### 3.1 Identifier Value Format

**PROJECT DECISION — resolved by Data contract**

Generated entity IDs use UUID v4 strings.

Subsystems still treat IDs as opaque strings across API boundaries.
## 4. Canonical Entities

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

No subsystem may rename these concepts in a way that changes API/domain meaning without an integration change.

---

## 5. Tenant Contract

Primary tenant:

```text
Organization
```

Every Organization-owned resource must carry or be resolvable to:

```text
organizationId
```

### 5.1 Protected Tenant Authorization Paths

**PROJECT DECISION — source-aligned role clarification**

Protected Organization-scoped requests use one of two authorization paths.

**Staff / Organization Admin path**

```text
Authenticated User
+
Organization Membership
+
Required Membership Role
+
organizationId
+
Resource Ownership / Tenant Match when applicable
```

**Customer ownership path**

```text
Authenticated User
+
organizationId verified against the target resource / Campaign
+
Customer ownership or create-order eligibility
```

A Customer does **not** need an `OrganizationMember` record merely to create or access their own Order / Payment / Pickup flow. `OrganizationMember` role values remain `STAFF` and `ORGANIZATION_ADMIN`.

Public Storefront read endpoints use the separate public-read contract and do not use either protected path.

### 5.2 Required Invariants

**FINAL**

- Backend must not trust client-supplied `organizationId` without database/resource verification.
- Backend must not trust client-supplied role without database verification.
- A tenant resource must not be authorized by `resourceId` alone.
- Staff/Admin access is constrained to Organizations where they have valid membership.
- Customer access to Order/Payment/Pickup is constrained by authenticated ownership; Organization membership is not required for that customer-owned flow.
- Customer Order creation must verify the target Campaign/Product/Variant all resolve to the route Organization before writing tenant-owned data.
- Frontend role-based visibility is UX only; Backend remains authoritative.

---

## 6. Authentication Contract

Authentication implementation:

```text
Backend Lambda
→ Express.js
→ JWT
```

Functions defined by the source:

- Register
- Login
- Client-side Logout
- Password Verification
- JWT Generation
- JWT Verification
- Current User
- RBAC
- Organization Membership

Canonical protected-request header:

```http
Authorization: Bearer <token>
```

User source fields:

```text
userId
email
passwordHash
name
status
createdAt
updatedAt
```

### 6.1 Password Rules

**FINAL**

- Never store plaintext password.
- Source recommends `bcryptjs`.

### 6.2 JWT Claims

**PROJECT DECISION — resolved by API contract**

Minimum JWT claims:

```text
sub   = userId
email = normalized/current email
iat
exp
```

Organization membership and Organization role are not authoritative JWT claims. Backend resolves current membership/role from DynamoDB for protected tenant requests.

Platform Admin authority is also reloaded from the current `User.platformRole`; it is not trusted from a client-supplied value.

### 6.3 Token Storage on Frontend

**PROJECT DECISION — resolved by Frontend contract**

Frontend stores the Bearer JWT in:

```text
sessionStorage
key: unistoreHub.accessToken
```

An in-memory copy may be used while the app is running.

Rules:

- clear token on logout
- clear token on definitive invalid/expired-token response
- never store password
- never treat browser-stored Organization role as authoritative

This decision is specific to the Learner Lab/demo frontend contract.
## 7. API Base Contract

Canonical version prefix:

```text
/api/v1
```

Source-defined endpoints/resources:

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

Detailed methods/actions belong to:

```text
docs/api/API_CONTRACT.md
```

### 7.1 Success Envelope

```json
{
  "success": true,
  "data": {}
}
```

### 7.2 Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found"
  }
}
```

### 7.3 Error Code Set

**PROJECT DECISION — resolved by API contract**

The canonical MVP error-code baseline is defined in:

```text
docs/api/API_CONTRACT.md
```

Frontend and Backend must use that catalog for documented contract errors. New cross-subsystem error codes require an API contract update first.

### 7.4 Storefront Read Contract

**PROJECT DECISION**

The source defines a customer Storefront module but not browse authorization/path details.

Canonical browse behavior:

- public read-only access through `/api/v1/storefront/*`
- expose only active customer-facing Organization/Store/Product/Variant/Campaign data
- Organization management endpoints remain protected
- Order creation still requires Bearer JWT
- private member/payment/audit/file data is never part of Storefront responses

---
## 8. Campaign Status Contract

Canonical source-defined statuses:

```text
DRAFT
OPEN
CLOSED
PRODUCING
READY_FOR_PICKUP
COMPLETED
CANCELLED
```

Canonical happy path:

```text
DRAFT
→ OPEN
→ CLOSED
→ PRODUCING
→ READY_FOR_PICKUP
→ COMPLETED
```

Required invalid transition:

```text
OPEN → PRODUCING
```

must be rejected.

### 8.0 Campaign Product Scope

The source defines Store, Product/Variant and Campaign but does not define a CampaignProduct join entity.

**PROJECT DECISION**

A Campaign applies to the active Products/Variants belonging to the same `storeId`.

Order validation requires:

```text
campaign.organizationId = order.organizationId
product.organizationId = campaign.organizationId
product.storeId = campaign.storeId
variant.productId = product.productId
```

No separate CampaignProduct entity is introduced in the MVP.

### 8.1 Campaign Cancellation

**PROJECT DECISION — resolves source gap**

The source defines `CANCELLED` but does not define all allowed source states. The MVP contract is:

```text
DRAFT  → CANCELLED
OPEN   → CANCELLED
CLOSED → CANCELLED
```

Cancellation is not allowed once the Campaign is `PRODUCING` or later.

Additional guard:

- cancellation from `OPEN` or `CLOSED` is allowed only when no Order is in `PAYMENT_REVIEW`, `PAID`, or a later paid lifecycle state
- unpaid Orders in `PENDING_PAYMENT` or `PAYMENT_REJECTED` are moved to `CANCELLED`
- a Campaign with paid Orders must continue through the normal production/pickup flow because refunds are outside MVP scope

---

## 9. Order Status Contract

Canonical source-defined statuses:

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

Source-backed flow elements:

- New Order is part of the pre-order flow.
- Payment review may approve or reject.
- Ready-for-pickup orders can be collected.
- Received order/pickup must not be confirmed twice.

### 9.1 Order Transition Details

**PROJECT DECISION — resolves source gap including late payment review**

The canonical post-payment lifecycle is:

```text
Payment approved while Campaign = OPEN
→ Order PAID

Campaign OPEN → CLOSED
→ all currently PAID Orders in that Campaign become CONFIRMED

Payment approved while Campaign = CLOSED
→ Order CONFIRMED immediately

Campaign CLOSED → PRODUCING
→ allowed only when no Order remains in PAYMENT_REVIEW
→ all CONFIRMED Orders become IN_PRODUCTION

Campaign PRODUCING → READY_FOR_PICKUP
→ all IN_PRODUCTION Orders become READY_FOR_PICKUP
→ create Pickup status READY when missing
→ create/update the Organization PickupLink
→ publish READY_FOR_PICKUP notification event per eligible Order

Pickup confirmation
→ Order RECEIVED
→ Pickup RECEIVED
→ PickupLink RECEIVED
```

Payment submission/resubmission and approval are allowed only while Campaign is `OPEN` or `CLOSED`. Once Campaign is `PRODUCING` or later, a pending Payment cannot be newly submitted or approved and returns `PAYMENT_NOT_REVIEWABLE`.

This prevents a late approval from remaining at `PAID` after the Campaign has already entered production.

Campaign `COMPLETED` is allowed when all paid/production Orders are `RECEIVED`. Unpaid/cancelled Orders do not block completion.
### 9.2 Order Cancellation

**PROJECT DECISION — resolves source gap**

Order cancellation is allowed only before payment approval:

```text
PENDING_PAYMENT  → CANCELLED
PAYMENT_REJECTED → CANCELLED
```

Allowed actors:

- Customer may cancel their own Order
- Organization Admin may cancel an Order in their Organization
- Staff does not receive a general Order-cancel permission

`PAYMENT_REVIEW`, `PAID`, `CONFIRMED`, `IN_PRODUCTION`, `READY_FOR_PICKUP` and `RECEIVED` cannot be cancelled in the MVP.

This avoids introducing a refund flow, which is outside scope.

---

## 10. Order Snapshot Contract

Every Order Item must snapshot:

```text
productName
variantName
unitPrice
quantity
totalPrice
```

**FINAL invariant**

Historical Order Item commercial/display data must not change because Product or Variant is edited later.

---

## 11. Payment Contract

**FINAL**

- Payment Slip is private.
- Customer can manage only payment flow for their own Order.
- Staff/Admin can review payment only inside their Organization.
- Reject requires a reason.
- Approve / Reject creates an Audit event.
- Approve / Reject creates a Notification event.

### 11.0 Customer Own Payment Read

**PROJECT DECISION — resolves Customer rejection-reason read gap**

The authoritative Customer read path for an existing Order Payment is:

```http
GET /api/v1/me/orders/:orderId/payment
```

Rules:

- requires an authenticated active User
- does not require `OrganizationMember` membership
- Backend first resolves `orderId` through the current User's own-Order ownership path
- Backend derives `organizationId` from that owned Order; Customer does not provide tenant authority
- Backend then loads the one logical Payment for that Order and verifies Payment `organizationId`, `orderId`, and `customerId` against the owned Order/current User
- another Customer's `orderId` fails closed as `ORDER_NOT_FOUND`
- an owned Order with no Payment yet returns `PAYMENT_NOT_FOUND`
- success returns the canonical `PaymentDTO`, including current `status` and `rejectReason`
- the Staff/Admin Organization payment-review endpoints are not a Customer read path
- Notifications may alert the Customer about rejection/approval but are not authoritative for `rejectReason`

### 11.1 Payment Submission / Resubmission

**PROJECT DECISION**

Each Order has one logical Payment record in the MVP.

First slip submission creates `paymentId`. If rejected, resubmission reuses the same Payment record:

```text
REJECTED
→ replace slipKey
→ status PENDING_REVIEW
→ clear rejectReason/reviewedBy/reviewedAt
```

AuditLog preserves review history. A `PAID`/approved Order cannot submit another slip.

### 11.2 Payment Entity Status

**PROJECT DECISION — resolved by API/Data contract**

Independent Payment status:

```text
PENDING_REVIEW
APPROVED
REJECTED
```

Related Order payment states remain:

```text
PENDING_PAYMENT
PAYMENT_REVIEW
PAID
PAYMENT_REJECTED
```
---

## 12. Production Contract

Production Summary uses:

```text
Paid Orders
→ Order Items
→ Group Product
→ Group Variant
→ Sum Quantity
```

**PROJECT DECISION — paid-order definition**

An Order counts as paid for Production Summary when its logical Payment is `APPROVED` and the Order is in a paid lifecycle state:

```text
PAID
CONFIRMED
IN_PRODUCTION
READY_FOR_PICKUP
RECEIVED
```

Required invariants:

- unpaid/rejected/cancelled Orders do not contribute.
- a Payment approved while Campaign is `CLOSED` contributes even though the Order becomes `CONFIRMED` directly rather than stopping at `PAID`.
- Summary remains tenant-scoped.
- Product/Variant grouping uses Order Item snapshot/reference data consistently as defined by the Data contract.

### 12.1 Dashboard / Report Contract

The source assigns Dashboard / Report to Organization Admin but does not define exact metrics.

**PROJECT DECISION**

Canonical MVP metrics:

```text
totalStores
totalProducts
campaignsByStatus
ordersByStatus
pendingPaymentReviews
paidOrderCount
paidRevenueSatang
```

`paidRevenueSatang` uses integer satang and includes Orders that reached `PAID` or later paid lifecycle states.

---

## 13. Pickup Contract

**FINAL**

- Pickup uses Token / QR.
- Duplicate confirmation after received is not allowed.
- Successful confirmation records:
  - `receivedBy`
  - `receivedAt`

Order status includes:

```text
READY_FOR_PICKUP
RECEIVED
```

### 13.1 Pickup Entity Status

**PROJECT DECISION — resolved by API/Data contract**

Independent Pickup status:

```text
READY
RECEIVED
```

Order status still carries `READY_FOR_PICKUP` / `RECEIVED` for the Order lifecycle.

### 13.2 Pickup Token

**PROJECT DECISION**

Pickup token is a cryptographically secure random 128-bit value encoded as base64url without padding.

Expected presentation length:

```text
22 characters
```

The QR contains the token value only. The token is not a substitute for Staff authorization.

---

## 14. File Contract

Frontend static files and business files use separate S3 purposes.

Canonical business-file paths:

```text
products/{organizationId}/{productId}/{uuid}
payments/{organizationId}/{orderId}/{uuid}
```

Canonical flow:

```text
Browser
→ Backend API
→ Authorize
→ Generate Pre-signed URL
→ Browser
↔ S3 Files
```

**FINAL**

- Payment Slip must be private.
- Binary file transfer must not be proxied through API Gateway when using this flow.
- Browser performs direct S3 transfer with Pre-signed URL.

### 14.1 File Type and Size Limits

**PROJECT DECISION**

MVP limits:

```text
Product Image: 5 MiB
Payment Slip: 10 MiB
Allowed MIME: image/jpeg, image/png, image/webp
```

Frontend validates for UX; Backend remains authoritative when issuing/accepting the upload flow.

### 14.1 Pre-signed URL Expiry

**PROJECT DECISION — resolved by API contract**

Canonical expiry:

```text
900 seconds
```

Frontend must treat the URL as short-lived and request a new URL when expired.
---

## 15. Notification Event Contract

Source-defined business notification events:

```text
Payment Approved
Payment Rejected
Ready for Pickup
```

### 15.1 Machine Event Tokens

**PROJECT DECISION**

Use canonical machine-readable event tokens:

```text
PAYMENT_APPROVED
PAYMENT_REJECTED
READY_FOR_PICKUP
```

Display text can be localized independently.

**PROJECT DECISION — Customer Payment read authority**

`PAYMENT_REJECTED` and `PAYMENT_APPROVED` Notifications are asynchronous signals only. They are not the authoritative source of the current Payment status or `rejectReason`.

A Customer who needs the current state/rejection reason reads the Payment through the documented own-Order Payment API after ownership is verified.

### 15.2 Event Delivery Invariant

```text
Business Lambda
→ SQS
→ Worker Lambda
→ DynamoDB Notification
```

**FINAL**

Notification processing failure must not make the core Order / Payment transaction fail.

### 15.3 Event Payload Shape

**PROJECT DECISION — resolved by Data contract**

SQS notification events use the versioned canonical shape in `docs/specs/data/SPEC.md`:

```text
version
eventId
type
occurredAt
organizationId
recipientUserId
resourceType
resourceId
data
```

Backend and Worker must share this exact contract.
## 16. Audit Contract

The source requires Audit Log and specifically requires Audit creation for Payment Approve / Reject.

Audit fields:

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

**PROJECT DECISION — baseline action catalog**

The canonical MVP action tokens are defined in `docs/specs/data/SPEC.md`, including organization/member/store/product/variant/campaign/order/payment/pickup actions.

Subsystems must use the Data Spec action tokens rather than inventing local names.

---
## 17. Core Data Baseline

DynamoDB:

```text
Capacity: PAY_PER_REQUEST
Model: Single application table
```

Shared key attributes:

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

**PROJECT DECISION — tenant hardening**

The source also states that Organization-owned resources must not be queried by `resourceId` alone. Therefore canonical implementation hardens Order child partitions to include tenant context:

```text
ORG#{organizationId}#ORDER#{orderId} / ITEM#{orderItemId}
ORG#{organizationId}#ORDER#{orderId} / PAYMENT#{paymentId}
ORG#{organizationId}#ORDER#{orderId} / PICKUP
```

This intentionally refines the source's abbreviated `ORDER#{orderId}` examples to satisfy the stricter source tenant-isolation rule.

Access-pattern/GSI detail belongs to:

```text
docs/specs/data/SPEC.md
```

### 17.1 Retention Contract

**PROJECT DECISION**

The MVP enables no automatic DynamoDB TTL or automatic S3 business-file cleanup.

Notifications, AuditLogs and uploaded files remain until explicit development-stack cleanup/destroy or a future retention contract change.

---

## 18. Time Contract

Source-defined timestamp field names include:

```text
createdAt
updatedAt
reviewedAt
receivedAt
```

### 18.1 Serialized Timestamp Format

**PROJECT DECISION — resolved by API/Data contract**

Persist and serialize timestamps as ISO 8601 UTC strings.

Example:

```text
2026-09-28T14:30:00.000Z
```
## 19. Money Contract

Source-defined monetary fields include:

```text
price
unitPrice
subtotal
total
totalPrice
```

### 19.1 Numeric Representation

**PROJECT DECISION — resolved by API/Data contract**

Monetary values are integer **satang**.

Examples:

```text
10000  = 100.00 THB
250050 = 2,500.50 THB
```

Do not store application money as binary floating point.
## 20. Common Cross-System Invariants

The following are mandatory across all subsystem specs.

### AUTH-INV-01
Password is never stored as plaintext.

### AUTH-INV-02
Backend is the authoritative authentication/authorization layer.

### TENANT-INV-01
Organization-owned resources must never cross tenant boundaries.

### TENANT-INV-02
Resource ID alone is insufficient for tenant authorization.

### ORDER-INV-01
Order Item snapshot data is immutable with respect to later Product/Variant edits.

### PAYMENT-INV-01
Payment Slip is private.

### PAYMENT-INV-02
Reject Payment requires a reason.

### PAYMENT-INV-03
Payment Approve/Reject produces Audit + Notification events.

### PRODUCTION-INV-01
Production Summary uses paid orders.

### PICKUP-INV-01
Received Pickup cannot be confirmed twice.

### PICKUP-INV-02
Successful Pickup records `receivedBy` and `receivedAt`.

### FILE-INV-01
Browser uses authorized Pre-signed URL for direct business-file transfer.

### NOTIFY-INV-01
Notification failure does not fail the core Order/Payment transaction.

### AWS-INV-01
Learner Lab baseline uses `us-east-1`.

### AWS-INV-02
Runtime Lambda permission uses existing `LabRole`.

### AWS-INV-03
Learner Lab baseline has no dependency on CloudFront, Cognito or SES.

---

## 21. Shared Contract Change Protocol

`AGENTS.md` is the authoritative workflow for shared-contract changes.

Any change to this file is **integration-impacting** and must follow the Agent Working Agreement.

## 22. Resolved Decision Register

The source leaves several implementation details unspecified. For parallel-agent readiness, the MVP resolves them explicitly as **PROJECT DECISIONs** rather than letting subsystem agents guess independently.

Resolved decisions include:

- identifier generation → UUID v4
- JWT minimum claims → `sub/email/iat/exp`
- Platform Admin persistence → `User.platformRole = PLATFORM_ADMIN | null`
- Frontend JWT storage → `sessionStorage` key `unistoreHub.accessToken`
- error-code baseline → `docs/api/API_CONTRACT.md`
- Campaign cancellation → DRAFT/OPEN/CLOSED only, with no PAYMENT_REVIEW or paid-or-later Orders
- post-PAID Order lifecycle → PAID → CONFIRMED → IN_PRODUCTION → READY_FOR_PICKUP → RECEIVED
- Order cancellation → Customer/Organization Admin, only PENDING_PAYMENT or PAYMENT_REJECTED
- Payment status → `PENDING_REVIEW/APPROVED/REJECTED`
- Pickup status → `READY/RECEIVED`
- Pickup token → secure random 128-bit base64url value
- Pre-signed URL expiry → 900 seconds
- Product Image limit → 5 MiB
- Payment Slip limit → 10 MiB
- allowed upload MIME → JPEG/PNG/WebP
- Notification SQS payload → versioned payload in Data Spec
- Audit action baseline → Data Spec
- timestamp serialization → ISO 8601 UTC
- money representation → integer satang
- Last Organization Admin protection → cannot remove/demote final active admin
- Dashboard metric baseline → API/Backend contract
- retention baseline → no automatic TTL/cleanup in MVP; explicit dev-stack destroy/manual cleanup only
- action endpoint shapes → `docs/api/API_CONTRACT.md`
- Frontend runtime-entity routing → Static Export pages + query parameters + trailing-slash directories
- notification retry baseline → SQS redelivery without a project-created DLQ in MVP

There are no remaining **MVP-blocking** OPEN DECISIONs in the shared contract. Any new unresolved requirement must be added here before dependent implementation begins.