# UniStore Hub — API Contract

> **Purpose:** Canonical HTTP contract shared by Frontend and Backend  
> **Base prefix:** `/api/v1`  
> **Health endpoint:** `/health`  
> **Transport:** HTTPS through Amazon API Gateway in Learner Lab  
> **Read with:** `SPEC.md`, `docs/specs/00-shared-contracts.md`, `docs/specs/data/SPEC.md`

---

## 1. Contract Status

The source defines the API prefix, auth endpoints, organization-scoped resource families, notifications, health endpoint and common success/error envelopes.

Where this document expands those resource families into concrete HTTP methods, action endpoints or payload fields, those additions are explicitly marked **PROJECT DECISION**.

Frontend and Backend agents must implement this file exactly once it is locked.

---

## 2. Common HTTP Rules

### 2.1 Base URL

Production / Learner Lab:

```text
https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/api/v1
```

### 2.2 Authentication Header

Protected endpoint:

```http
Authorization: Bearer <token>
```

### 2.3 Content Type

JSON endpoints use:

```http
Content-Type: application/json
```

Binary Product Image / Payment Slip transfer does **not** pass through normal JSON API bodies. The API issues authorized Pre-signed S3 URLs.

### 2.4 Success Envelope

```json
{
  "success": true,
  "data": {}
}
```

### 2.5 List Envelope

**PROJECT DECISION**

List responses use:

```json
{
  "success": true,
  "data": {
    "items": [],
    "nextCursor": null
  }
}
```

Pagination is cursor-based where pagination is required.

### 2.6 Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found"
  }
}
```

### 2.7 Timestamp Serialization

**PROJECT DECISION**

All API timestamps are ISO 8601 UTC strings:

```text
2026-09-28T14:30:00.000Z
```

### 2.8 Money Serialization

**PROJECT DECISION**

All monetary amounts are integer **satang**.

Examples:

```text
10000 = 100.00 THB
250050 = 2,500.50 THB
```

Fields such as `price`, `unitPrice`, `subtotal`, `total`, `totalPrice` use this representation.

### 2.9 Canonical API DTOs

The source defines the domain entities but not every transport field.

**PROJECT DECISION**

The following DTOs are the canonical Frontend/Backend interface. Storage-only fields (`PK/SK/GSI*`, `passwordHash`) never appear.

#### UserDTO

```text
userId
email
name
status
platformRole: PLATFORM_ADMIN | null
createdAt
updatedAt
```

#### OrganizationDTO

```text
organizationId
name
description
status: PENDING | ACTIVE | SUSPENDED
createdBy
createdAt
updatedAt
```

#### OrganizationMemberDTO

```text
organizationId
userId
role: STAFF | ORGANIZATION_ADMIN
status: ACTIVE | INACTIVE
user:
  userId
  email
  name
createdAt
updatedAt
```

Backend joins/sanitizes the User summary for member-management UI; no password field is exposed.

#### StoreDTO

```text
storeId
organizationId
name
description
status: ACTIVE | INACTIVE
createdAt
updatedAt
```

#### ProductDTO

Authenticated management response:

```text
productId
organizationId
storeId
name
description
imageKey: string | null
imageUrl: string | null
status: ACTIVE | INACTIVE
variants: ProductVariantDTO[] when detail endpoint requests/includes them
createdAt
updatedAt
```

`imageUrl` is short-lived when generated. Storefront responses omit `imageKey`.

#### ProductVariantDTO

```text
variantId
organizationId
productId
name
price
status: ACTIVE | INACTIVE
createdAt
updatedAt
```

`price` is integer satang.

#### CampaignDTO

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

Timestamps may be null until configured when allowed by the relevant create/update validator.

#### OrderItemDTO

```text
orderItemId
productId
variantId
productName
variantName
unitPrice
quantity
totalPrice
```

#### OrderDTO

```text
orderId
organizationId
campaignId
customerId
status
subtotal
total
items: OrderItemDTO[]
createdAt
updatedAt
```

#### PaymentDTO

```text
paymentId
organizationId
orderId
customerId
slipKey
status: PENDING_REVIEW | APPROVED | REJECTED
rejectReason
reviewedBy
reviewedAt
createdAt
updatedAt
```

`slipKey` is returned only to an authorized Order owner or authorized tenant reviewer; Storefront/public APIs never expose it.

#### PickupDTO

```text
pickupId
organizationId
orderId
token
status: READY | RECEIVED
receivedBy
receivedAt
createdAt
updatedAt
```

#### AuditLogDTO

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

#### NotificationDTO

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

### 2.10 Common Validation Baseline

**PROJECT DECISION**

```text
email:
  trim + lowercase
  valid email syntax
  max 254 characters

password:
  8–72 UTF-8 bytes

name:
  trimmed
  1–100 characters

quantity:
  integer
  1–999

money:
  integer satang
  >= 0
```

Campaign date validation when values are supplied:

```text
openAt < closeAt
paymentDeadline >= openAt
pickupAt >= closeAt
```

More restrictive feature validation may be added only when documented in this API contract.

---

## 3. Authentication Contract

### 3.1 Register

```http
POST /api/v1/auth/register
```

Auth: Public

Request:

```json
{
  "email": "student@example.com",
  "password": "example-password",
  "name": "Example User"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid",
      "email": "student@example.com",
      "name": "Example User",
      "status": "ACTIVE",
      "platformRole": null,
      "createdAt": "2026-09-28T14:30:00.000Z",
      "updatedAt": "2026-09-28T14:30:00.000Z"
    },
    "token": "<jwt>",
    "expiresIn": "1d"
  }
}
```

**PROJECT DECISION**

Register returns a JWT immediately after successful registration.

### 3.2 Login

```http
POST /api/v1/auth/login
```

Auth: Public

Request:

```json
{
  "email": "student@example.com",
  "password": "example-password"
}
```

Response has the same `user + token + expiresIn` shape as Register.

### 3.3 Current User

```http
GET /api/v1/me
```

Auth: Bearer JWT

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid",
      "email": "student@example.com",
      "name": "Example User",
      "status": "ACTIVE",
      "platformRole": null
    },
    "memberships": [
      {
        "organizationId": "uuid",
        "role": "ORGANIZATION_ADMIN",
        "status": "ACTIVE"
      }
    ]
  }
}
```

### 3.4 JWT Claims

**PROJECT DECISION**

JWT minimum claims:

```json
{
  "sub": "<userId>",
  "email": "<email>",
  "iat": 0,
  "exp": 0
}
```

Organization membership and organization role are **not authoritative JWT claims**. Backend resolves membership/role from DynamoDB for protected tenant operations.

### 3.5 Logout

Source defines Logout as client-side.

No backend logout endpoint is required for the MVP.

---

## 4. Canonical Error Codes

**PROJECT DECISION**

### 4.1 Authentication / Authorization

```text
AUTH_REQUIRED
INVALID_CREDENTIALS
TOKEN_INVALID
TOKEN_EXPIRED
USER_DISABLED
FORBIDDEN
MEMBERSHIP_REQUIRED
ROLE_FORBIDDEN
TENANT_MISMATCH
RESOURCE_OWNERSHIP_REQUIRED
LAST_ORGANIZATION_ADMIN
```

### 4.2 Validation

```text
VALIDATION_ERROR
INVALID_CURSOR
INVALID_STATUS_TRANSITION
```

### 4.3 Resource Errors

```text
USER_NOT_FOUND
ORGANIZATION_NOT_FOUND
MEMBER_NOT_FOUND
STORE_NOT_FOUND
PRODUCT_NOT_FOUND
VARIANT_NOT_FOUND
CAMPAIGN_NOT_FOUND
ORDER_NOT_FOUND
PAYMENT_NOT_FOUND
PICKUP_NOT_FOUND
NOTIFICATION_NOT_FOUND
```

### 4.4 Business Errors

```text
CAMPAIGN_NOT_OPEN
PAYMENT_NOT_REVIEWABLE
PAYMENT_REJECT_REASON_REQUIRED
PAYMENT_SLIP_REQUIRED
ORDER_NOT_READY_FOR_PICKUP
PICKUP_ALREADY_RECEIVED
FILE_ACCESS_FORBIDDEN
```

Unexpected server failures use:

```text
INTERNAL_ERROR
```

---

## 5. Authorization Model

Protected Organization-scoped APIs use one of two authorization paths.

### 5.1 Staff / Organization Admin

```text
JWT
+
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

### 5.2 Customer Ownership Flow

**PROJECT DECISION — source-aligned role clarification**

Customer Order / Payment / Pickup endpoints require:

```text
JWT
+
Authenticated User
+
organizationId verified against the target Campaign/Order
+
current user owns the target Order/Payment/Pickup, or is creating the Order
```

Customer does not require an `OrganizationMember` record for this ownership flow.

Role token values remain:

```text
CUSTOMER
STAFF
ORGANIZATION_ADMIN
PLATFORM_ADMIN
```

Frontend visibility does not substitute for Backend authorization.

---

## 6. Organizations

### 6.1 List Accessible Organizations

**PROJECT DECISION**

```http
GET /api/v1/organizations
```

Auth: Bearer JWT

Behavior:

- Normal users receive Organizations in which they have membership.
- Platform Admin may retrieve platform-level organization results according to Platform Admin policy.

### 6.2 Create Organization

```http
POST /api/v1/organizations
```

Auth: Bearer JWT

Request:

```json
{
  "name": "IT Club Store",
  "description": "Student club merchandise"
}
```

**PROJECT DECISION**

Creator receives `ORGANIZATION_ADMIN` membership for the new Organization.

### 6.3 Get Organization

```http
GET /api/v1/organizations/:organizationId
```

Access: active Staff / Organization Admin membership for that Organization, or Platform Admin under platform policy.

Returns `OrganizationDTO`.

### 6.4 Update Organization

```http
PATCH /api/v1/organizations/:organizationId
```

Role: Organization Admin, or Platform Admin under platform policy.

Request may contain:

```json
{
  "name": "IT Club Store",
  "description": "Updated description"
}
```

Returns `OrganizationDTO`.

---

## 7. Organization Members / Staff

### 7.1 List Members

```http
GET /api/v1/organizations/:organizationId/members
```

Role: Organization Admin

### 7.2 Add Member

**PROJECT DECISION**

```http
POST /api/v1/organizations/:organizationId/members
```

Role: Organization Admin.

Request:

```json
{
  "email": "staff@example.com",
  "role": "STAFF"
}
```

Backend normalizes `email`, resolves an existing User, then creates the membership. If no User exists, return `USER_NOT_FOUND`.

Allowed organization membership role values:

```text
STAFF
ORGANIZATION_ADMIN
```

### 7.3 Change Member Role

```http
PATCH /api/v1/organizations/:organizationId/members/:userId
```

Role: Organization Admin.

Request:

```json
{
  "role": "ORGANIZATION_ADMIN"
}
```

Returns `OrganizationMemberDTO`.

### 7.4 Remove Member

```http
DELETE /api/v1/organizations/:organizationId/members/:userId
```

Role: Organization Admin.

**PROJECT DECISION**

The final active `ORGANIZATION_ADMIN` membership cannot be removed or demoted. Return `409 LAST_ORGANIZATION_ADMIN`.

---

## 8. Stores

### 8.1 List Stores

```http
GET /api/v1/organizations/:organizationId/stores
```

Access: Organization Admin for management context.

Customer browsing uses the dedicated Storefront endpoints in Section 9A so public/read-only behavior does not weaken Organization management authorization.

### 8.2 Create Store

```http
POST /api/v1/organizations/:organizationId/stores
```

Role: Organization Admin

Request:

```json
{
  "name": "Main Store",
  "description": "Faculty merchandise"
}
```

Returns `StoreDTO`.

### 8.3 Get Store

**PROJECT DECISION**

```http
GET /api/v1/organizations/:organizationId/stores/:storeId
```

Role: Organization Admin.

Returns `StoreDTO`.

### 8.4 Update Store

```http
PATCH /api/v1/organizations/:organizationId/stores/:storeId
```

Role: Organization Admin

Request may contain:

```json
{
  "name": "Main Store",
  "description": "Updated",
  "status": "ACTIVE"
}
```

Returns `StoreDTO`.

---

## 9. Products and Variants

### 9.1 List Products

```http
GET /api/v1/organizations/:organizationId/products
```

Role: Organization Admin.

Optional query:

```text
storeId
cursor
```

### 9.2 Create Product

```http
POST /api/v1/organizations/:organizationId/products
```

Role: Organization Admin

Request baseline:

```json
{
  "storeId": "uuid",
  "name": "Faculty Shirt",
  "description": "Pre-order shirt"
}
```

Returns `ProductDTO`.

### 9.3 Get Product

```http
GET /api/v1/organizations/:organizationId/products/:productId
```

Role: Organization Admin.

Returns `ProductDTO`.

### 9.4 Update Product

```http
PATCH /api/v1/organizations/:organizationId/products/:productId
```

Role: Organization Admin.

Request may contain:

```json
{
  "name": "Faculty Shirt",
  "description": "Updated",
  "imageKey": "products/<organizationId>/<productId>/<uuid>",
  "status": "ACTIVE"
}
```

**PROJECT DECISION**

If `imageKey` is supplied, Backend accepts it only when:

- key prefix matches `products/{organizationId}/{productId}/`
- object exists
- object Content-Type is allowed
- object size is within the 5 MiB Product Image limit

### 9.5 Delete Product

**PROJECT DECISION**

```http
DELETE /api/v1/organizations/:organizationId/products/:productId
```

Role: Organization Admin.

MVP delete is a soft deactivate:

```text
Product.status → INACTIVE
```

Historical OrderItem snapshots remain unchanged. Return 204 on success.

### 9.6 Create Variant

**PROJECT DECISION**

```http
POST /api/v1/organizations/:organizationId/products/:productId/variants
```

Role: Organization Admin.

Request:

```json
{
  "name": "Size M",
  "price": 25000
}
```

Returns `ProductVariantDTO`.

### 9.7 Update Variant

```http
PATCH /api/v1/organizations/:organizationId/products/:productId/variants/:variantId
```

Role: Organization Admin.

Request may contain:

```json
{
  "name": "Size L",
  "price": 27000,
  "status": "ACTIVE"
}
```

Returns `ProductVariantDTO`.

### 9.8 Delete Variant

```http
DELETE /api/v1/organizations/:organizationId/products/:productId/variants/:variantId
```

Role: Organization Admin.

**PROJECT DECISION:** MVP delete is soft deactivate (`Variant.status → INACTIVE`). Historical OrderItem snapshots remain unchanged. Return 204 on success.

---

## 9A. Storefront Read API

The source includes a customer Storefront module but does not define dedicated browse paths.

**PROJECT DECISION**

Public read-only storefront endpoints are separated from Organization management endpoints:

```http
GET /api/v1/storefront/organizations
GET /api/v1/storefront/organizations/:organizationId/stores
GET /api/v1/storefront/organizations/:organizationId/stores/:storeId
GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/products
GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/products/:productId
GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/campaigns
GET /api/v1/storefront/organizations/:organizationId/stores/:storeId/campaigns/:campaignId
```

Auth: Public read-only.

Visibility:

- only `ACTIVE` Organizations
- only `ACTIVE` Stores
- only `ACTIVE` Products/Variants
- Campaign data intended for customer ordering; ordering itself still requires authentication
- private Organization/member/payment/audit fields are never returned

**PROJECT DECISION**

A Campaign exposes Products/Variants from the same `storeId`; no separate CampaignProduct relation exists.

If a Product has `imageKey`, Storefront Product DTO may include a short-lived `imageUrl` generated by Backend from that stored key. The Files bucket remains private and the public client never supplies an arbitrary object key for this operation.

Creating an Order requires Bearer JWT and uses the documented Organization Order endpoint.

---

## 10. Campaigns

### 10.1 List Campaigns

```http
GET /api/v1/organizations/:organizationId/campaigns
```

Role: Organization Admin.

Optional query:

```text
storeId
status
cursor
```

### 10.2 Create Campaign

```http
POST /api/v1/organizations/:organizationId/campaigns
```

Role: Organization Admin

Request:

```json
{
  "storeId": "uuid",
  "name": "Faculty Shirt Pre-order",
  "openAt": "2026-10-01T00:00:00.000Z",
  "closeAt": "2026-10-10T23:59:59.000Z",
  "paymentDeadline": "2026-10-11T23:59:59.000Z",
  "pickupAt": "2026-10-25T09:00:00.000Z"
}
```

Created status:

```text
DRAFT
```

Returns `CampaignDTO`.

**PROJECT DECISION:** Campaign timestamps are planning/display fields. They do not automatically change Campaign status in the MVP; Organization Admin lifecycle action endpoints remain authoritative.

### 10.3 Get Campaign

```http
GET /api/v1/organizations/:organizationId/campaigns/:campaignId
```

Role: Organization Admin.

Returns `CampaignDTO`.

### 10.4 Update Draft Campaign

```http
PATCH /api/v1/organizations/:organizationId/campaigns/:campaignId
```

Role: Organization Admin.

Editable while `DRAFT`:

```text
storeId
name
openAt
closeAt
paymentDeadline
pickupAt
```

Returns `CampaignDTO`.

### 10.5 Lifecycle Actions

Role: Organization Admin.

**PROJECT DECISION endpoint shapes; source-defined lifecycle**

```http
POST /api/v1/organizations/:organizationId/campaigns/:campaignId/open
POST /api/v1/organizations/:organizationId/campaigns/:campaignId/close
POST /api/v1/organizations/:organizationId/campaigns/:campaignId/start-production
POST /api/v1/organizations/:organizationId/campaigns/:campaignId/ready-for-pickup
POST /api/v1/organizations/:organizationId/campaigns/:campaignId/complete
POST /api/v1/organizations/:organizationId/campaigns/:campaignId/cancel
```

Required happy path:

```text
DRAFT
→ OPEN
→ CLOSED
→ PRODUCING
→ READY_FOR_PICKUP
→ COMPLETED
```

`OPEN → PRODUCING` must return `INVALID_STATUS_TRANSITION`.

**PROJECT DECISION — payment-review boundary**

- `CLOSED` Campaign may finish existing Payment reviews/resubmissions.
- `start-production` returns `PAYMENT_NOT_REVIEWABLE` while any Order remains `PAYMENT_REVIEW`.
- Payment approved while Campaign is `CLOSED` sets the Order directly to `CONFIRMED`.
- once Campaign is `PRODUCING` or later, payment submission/resubmission/approval returns `PAYMENT_NOT_REVIEWABLE`.

**PROJECT DECISION**


When cancel succeeds, Orders still in `PENDING_PAYMENT` or `PAYMENT_REJECTED` become `CANCELLED`.

---

## 11. Orders

### 11.1 List Organization Orders

```http
GET /api/v1/organizations/:organizationId/orders
```

Staff/Admin access only for their Organization.

Optional query:

```text
campaignId
status
customerId
cursor
```

### 11.2 Create Order

```http
POST /api/v1/organizations/:organizationId/orders
```

Role: Customer / authenticated user

Request:

```json
{
  "campaignId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "variantId": "uuid",
      "quantity": 2
    }
  ]
}
```

Backend must:
- validate Campaign is `OPEN`
- validate Product belongs to the same Organization and `storeId` as the Campaign
- validate Variant belongs to that Product
- calculate prices server-side
- create immutable OrderItem snapshots

Initial Order status:

```text
PENDING_PAYMENT
```

### 11.3 Get Organization Order

```http
GET /api/v1/organizations/:organizationId/orders/:orderId
```

Staff/Admin: tenant membership required.

Customer own-order reads use the `/api/v1/me/orders/:orderId` path in Section 11.4 and are authorized by ownership rather than Organization membership.

### 11.4 Customer Own Orders

**PROJECT DECISION**

```http
GET /api/v1/me/orders
GET /api/v1/me/orders/:orderId
```

Purpose:

- avoids requiring Customer to know an Organization role context merely to view their own orders
- Backend still validates ownership

### 11.5 Cancel Customer Order

**PROJECT DECISION**

```http
POST /api/v1/me/orders/:orderId/cancel
```

Customer ownership required.

Allowed source states:

```text
PENDING_PAYMENT
PAYMENT_REJECTED
```

Result:

```text
Order → CANCELLED
Audit → ORDER_CANCELLED
```

### 11.6 Cancel Organization Order

**PROJECT DECISION**

```http
POST /api/v1/organizations/:organizationId/orders/:orderId/cancel
```

Role: Organization Admin only.

### 11.7 Post-payment Order Progression

**PROJECT DECISION**

```text
Payment approved while Campaign OPEN
→ Order PAID

Campaign close
→ currently PAID Orders become CONFIRMED

Payment approved while Campaign CLOSED
→ Order CONFIRMED immediately

Campaign start-production
→ requires no PAYMENT_REVIEW Orders
→ CONFIRMED Orders become IN_PRODUCTION

Campaign ready-for-pickup
→ IN_PRODUCTION Orders become READY_FOR_PICKUP
→ Pickup + PickupLink READY are created when missing
→ READY_FOR_PICKUP event is published

Pickup confirm
→ Order/Pickup/PickupLink RECEIVED
```

Payment submission/resubmission/approval is not allowed once Campaign is `PRODUCING` or later.

A Campaign may complete when all paid/production Orders are `RECEIVED`.

A Campaign may complete when all paid/production Orders are `RECEIVED`.

---

## 12. Payments

### 12.1 Payment Status

**PROJECT DECISION**

Independent Payment status:

```text
PENDING_REVIEW
APPROVED
REJECTED
```

Related Order statuses remain:

```text
PENDING_PAYMENT
PAYMENT_REVIEW
PAID
PAYMENT_REJECTED
```

### 12.2 List Payments

```http
GET /api/v1/organizations/:organizationId/payments
```

Role: Staff / Organization Admin

Optional query:

```text
status
campaignId
orderId
cursor
```

### 12.3 Get Payment

```http
GET /api/v1/organizations/:organizationId/payments/:paymentId
```

Role: Staff / Organization Admin.

This is a tenant payment-review endpoint. Customer must not use it to read their own Payment.

### 12.4 Get Customer Own Payment

**PROJECT DECISION — resolves Customer rejection-reason read gap**

```http
GET /api/v1/me/orders/:orderId/payment
```

Auth: Bearer JWT. Customer ownership required; Organization membership is not required.

Backend authorization sequence:

```text
authenticated current user
→ resolve orderId through current user's own-Order access
→ if not owned/not visible: ORDER_NOT_FOUND
→ derive organizationId from the owned Order
→ load the one logical Payment by organizationId + orderId
→ if no Payment exists for the owned Order: PAYMENT_NOT_FOUND
→ verify Payment.organizationId == Order.organizationId
→ verify Payment.orderId == Order.orderId
→ verify Payment.customerId == current userId
→ return PaymentDTO
```

This endpoint must fail closed for another Customer's Order and must not reveal whether that Order has a Payment.

A successful response uses the canonical `PaymentDTO`. `status` and `rejectReason` are authoritative for Customer payment tracking. On rejected resubmission, the same `paymentId` is returned by the submit endpoint and `rejectReason`, `reviewedBy`, and `reviewedAt` are cleared as defined by the Payment resubmission contract.

### 12.5 Approve Payment

**PROJECT DECISION endpoint shape; source-defined action**

```http
POST /api/v1/organizations/:organizationId/payments/:paymentId/approve
```

Campaign-dependent Order effect:

```text
Campaign OPEN   → Payment APPROVED, Order PAID
Campaign CLOSED → Payment APPROVED, Order CONFIRMED
```

If Campaign is `PRODUCING` or later, return `PAYMENT_NOT_REVIEWABLE` and do not approve.

Other required effects:

- set `reviewedBy`
- set `reviewedAt`
- create Audit
- update CampaignOrderLink projection
- publish `PAYMENT_APPROVED` event after the core transaction

### 12.6 Reject Payment

```http
POST /api/v1/organizations/:organizationId/payments/:paymentId/reject
```

Request:

```json
{
  "reason": "Slip amount does not match order"
}
```

Required effects:

- reason must be non-empty
- Payment → `REJECTED`
- Order → `PAYMENT_REJECTED`
- set reviewer/time
- create Audit
- publish `PAYMENT_REJECTED`

---

## 13. File / Pre-signed URL API

The source defines the Pre-signed URL flow but not endpoint names.

The following endpoint shapes are **PROJECT DECISION**.

### 13.1 Request Product Image Upload URL

```http
POST /api/v1/organizations/:organizationId/products/:productId/image-upload-url
```

Request:

```json
{
  "contentType": "image/png"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "objectKey": "products/<organizationId>/<productId>/<uuid>",
    "url": "<presigned-url>",
    "method": "PUT",
    "expiresInSeconds": 900
  }
}
```

### 13.2 Request Payment Slip Upload URL

```http
POST /api/v1/organizations/:organizationId/orders/:orderId/payment-slip-upload-url
```

Auth: Customer who owns the Order

Request:

```json
{
  "contentType": "image/png"
}
```

`contentType` must be one of the canonical allowed image MIME types before Backend signs the PUT request.

Response uses:

```text
payments/{organizationId}/{orderId}/{uuid}
```

### 13.3 Submit Payment After Upload

**PROJECT DECISION**

```http
POST /api/v1/organizations/:organizationId/orders/:orderId/payment
```

Request:

```json
{
  "slipKey": "payments/<organizationId>/<orderId>/<uuid>"
}
```

Required effects:

- validate Customer owns the Order and the Order belongs to the route Organization
- validate object key is within the authorized Order path
- require Campaign status `OPEN` or `CLOSED`; `PRODUCING` or later returns `PAYMENT_NOT_REVIEWABLE`
- first submission creates the Order's Payment record
- Payment → `PENDING_REVIEW`
- Order → `PAYMENT_REVIEW`

**PROJECT DECISION**

Each Order has one logical Payment record. If Order was `PAYMENT_REJECTED`, resubmission reuses the same `paymentId`, replaces `slipKey`, clears previous rejection/reviewer fields and returns to `PENDING_REVIEW`.

Approved/paid-or-later Orders cannot submit another slip.

### 13.4 Request Private File Download URL

**PROJECT DECISION**

```http
POST /api/v1/organizations/:organizationId/files/download-url
```

Request:

```json
{
  "objectKey": "payments/<organizationId>/<orderId>/<uuid>"
}
```

Backend must authorize object ownership before generating the URL.

### 13.5 Pre-signed URL Expiry

**PROJECT DECISION**

```text
900 seconds
```

### 13.6 Upload Constraints

**PROJECT DECISION**

```text
Product Image: max 5 MiB
Payment Slip: max 10 MiB
Allowed MIME: image/jpeg, image/png, image/webp
```

Frontend validates for UX. Backend remains authoritative when issuing/accepting the upload workflow.

For direct PUT uploads, Backend validates requested `contentType` before signing and performs an S3 metadata/HEAD check before persisting Product `imageKey` or accepting Payment `slipKey`.

---

## 14. Production

### 14.1 Production Summary

```http
GET /api/v1/organizations/:organizationId/production
```

Required query:

```text
campaignId
```

Role: Organization Admin

Response baseline:

```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "products": [
      {
        "productId": "uuid",
        "productName": "Faculty Shirt",
        "variants": [
          {
            "variantId": "uuid",
            "variantName": "Size M",
            "quantity": 24
          }
        ]
      }
    ]
  }
}
```

**PROJECT DECISION:** Production Summary includes Orders with `Payment.status = APPROVED` whose Order status is `PAID`, `CONFIRMED`, `IN_PRODUCTION`, `READY_FOR_PICKUP`, or `RECEIVED`. Unpaid/rejected/cancelled Orders are excluded.

---

## 15. Pickups

### 15.1 Pickup Status

**PROJECT DECISION**

```text
READY
RECEIVED
```

### 15.2 List / Search Pickups

```http
GET /api/v1/organizations/:organizationId/pickups
```

Optional query:

```text
campaignId
status
token
orderId
cursor
```

Role: Staff / Organization Admin

**PROJECT DECISION — data access contract**

The Organization list is backed by Data Spec `PickupLink` items under `PK=ORG#{organizationId}`. Token lookup may use the tenant-qualified Pickup token GSI. Normal request paths must not Scan the table.

### 15.3 Get Pickup

```http
GET /api/v1/organizations/:organizationId/pickups/:pickupId
```

Role: Staff / Organization Admin

Backend resolves the tenant-scoped `PickupLink` by `organizationId + pickupId`, obtains `orderId`, then loads the canonical Order-scoped Pickup item.

### 15.4 Confirm Pickup

**PROJECT DECISION endpoint shape; source-defined action**

```http
POST /api/v1/organizations/:organizationId/pickups/:pickupId/confirm
```

Required effects:

- resolve `PickupLink` by the route Organization + `pickupId`
- require Order is ready for pickup
- reject if already received
- Pickup → `RECEIVED`
- PickupLink → `RECEIVED`
- Order → `RECEIVED`
- set `receivedBy`
- set `receivedAt`
- create Audit

Duplicate confirmation returns:

```text
PICKUP_ALREADY_RECEIVED
```

### 15.5 Customer Pickup QR / Token

**PROJECT DECISION**

```http
GET /api/v1/me/orders/:orderId/pickup
```

Customer ownership required.

---

## 16. Reports / Dashboard

### 16.1 Organization Report Summary

```http
GET /api/v1/organizations/:organizationId/reports
```

Role: Organization Admin

Optional query:

```text
campaignId
storeId
```

**PROJECT DECISION**

Minimum Organization dashboard/report metrics are:

```text
totalStores
totalProducts
campaignsByStatus
ordersByStatus
pendingPaymentReviews
paidOrderCount
paidRevenueSatang
```

Response:

```json
{
  "success": true,
  "data": {
    "totalStores": 1,
    "totalProducts": 12,
    "campaignsByStatus": {},
    "ordersByStatus": {},
    "pendingPaymentReviews": 3,
    "paidOrderCount": 40,
    "paidRevenueSatang": 2500000
  }
}
```

`paidRevenueSatang` sums Orders that have reached `PAID` or a later paid lifecycle state and excludes cancelled/unpaid Orders.

---

## 17. Audit Logs

### 17.1 List Audit Logs

```http
GET /api/v1/organizations/:organizationId/audit-logs
```

Role: Organization Admin

Optional query:

```text
actorId
action
resourceType
resourceId
cursor
```

Audit action token catalog is defined by Data/Backend contract.

---

## 18. Notifications

### 18.1 List Notifications

```http
GET /api/v1/notifications
```

Auth: Bearer JWT

Returns notifications for current user only.

Optional query:

```text
read
cursor
```

**PROJECT DECISION — Payment read authority**

`PAYMENT_APPROVED` / `PAYMENT_REJECTED` Notifications are asynchronous user alerts. `NotificationDTO` does not carry the authoritative Payment state or rejection reason. Customer Payment state and `rejectReason` must be read from `GET /api/v1/me/orders/:orderId/payment`.

### 18.2 Mark Notification Read

```http
PATCH /api/v1/notifications/:notificationId/read
```

Auth: Bearer JWT + notification ownership

Response returns updated Notification.

---

## 19. Platform Admin

The source defines Platform Admin capabilities but does not define paths.

The following are **PROJECT DECISION**.

### 19.0 Authorization Source

**PROJECT DECISION**

Backend authorizes these endpoints only when the current persisted User has:

```text
platformRole = PLATFORM_ADMIN
```

Platform Admin authority is not derived from Organization membership and must be reloaded from the User record.

### 19.1 List Organizations

```http
GET /api/v1/platform/organizations
```

Role: Platform Admin

### 19.2 Approve Organization

```http
POST /api/v1/platform/organizations/:organizationId/approve
```

### 19.3 Suspend Organization

```http
POST /api/v1/platform/organizations/:organizationId/suspend
```

### 19.4 List Users

```http
GET /api/v1/platform/users
```

### 19.5 Platform Summary

```http
GET /api/v1/platform/summary
```

Response baseline:

```json
{
  "success": true,
  "data": {
    "organizationsByStatus": {},
    "usersByStatus": {}
  }
}
```

---

## 20. Health Check

```http
GET /health
```

Auth: Public

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Deployment smoke test must call this endpoint.

---

## 21. HTTP Status Baseline

**PROJECT DECISION**

```text
200 OK              successful read/action
201 Created         successful create
204 No Content      successful delete when no body is returned
400 Bad Request     validation/business precondition
401 Unauthorized    missing/invalid/expired JWT
403 Forbidden       authenticated but permission/tenant/ownership denied
404 Not Found       authorized lookup cannot find resource
409 Conflict        duplicate/state conflict
500 Internal Error  unexpected backend failure
```

Do not expose internal stack traces in API responses.

---

## 22. Cursor Pagination Contract

**PROJECT DECISION**

Cursor is opaque to clients.

Request:

```text
?cursor=<opaque>
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "nextCursor": "<opaque-or-null>"
  }
}
```

Frontend must not parse DynamoDB keys from cursors.

---

## 23. API Compatibility Rules

1. Frontend must consume only documented routes.
2. Backend must not expose alternate undocumented aliases that become frontend dependencies.
3. Breaking changes require updating this contract first.
4. Shared status/role tokens come from `docs/specs/00-shared-contracts.md`.
5. Data field semantics come from `docs/specs/data/SPEC.md`.
6. Tenant authorization remains authoritative on Backend.
7. Business files use Pre-signed S3 flow, not binary API upload.

---

## 24. Resolved API Decisions

The source does not define every endpoint-level behavior. The MVP resolves the required gaps as explicit **PROJECT DECISIONs**:

- Campaign cancellation: DRAFT/OPEN/CLOSED only, only when no Order is in PAYMENT_REVIEW or a paid-or-later state
- Order cancellation: Customer own Order or Organization Admin; only PENDING_PAYMENT/PAYMENT_REJECTED
- post-payment progression: PAID → CONFIRMED → IN_PRODUCTION → READY_FOR_PICKUP → RECEIVED driven by Campaign/Pickup actions
- Dashboard metric baseline: defined in Section 16
- Last Organization Admin protection: enforced with LAST_ORGANIZATION_ADMIN
- Platform Admin authority: persisted User.platformRole
- browser JWT storage: sessionStorage per Frontend contract
- Pre-signed URL expiry: 900 seconds
- Product Image limit: 5 MiB
- Payment Slip limit: 10 MiB
- allowed upload MIME: image/jpeg, image/png, image/webp

There are no remaining API decisions that block parallel implementation.
