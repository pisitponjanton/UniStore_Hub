# UniStore Hub — Frontend Specification

> **Subsystem:** Frontend  
> **Implementation ownership:** `frontend/**`  
> **Stack:** Next.js + TypeScript  
> **Production build:** Static Export (`output: "export"`)  
> **API:** REST via `NEXT_PUBLIC_API_BASE_URL`  
> **Authentication:** Bearer JWT  
> **Read first:** `SPEC.md`, `AGENTS.md`, `docs/specs/00-shared-contracts.md`, `docs/api/API_CONTRACT.md`

---

## 1. Purpose

This document is the implementation contract for the Frontend Agent.

The Frontend Agent must be able to implement `frontend/**` without reading Backend implementation details.

The Frontend owns:

- page rendering
- navigation
- forms and client-side validation
- API client integration
- session restoration
- role-based UI visibility
- loading / empty / error / unauthorized / forbidden states
- Product Image and Payment Slip upload UX
- Notification UX
- responsive presentation

The Frontend does **not** own authoritative:

- authentication validity
- tenant authorization
- membership validation
- resource ownership validation
- business state-transition validation
- price calculation
- Payment approval rules
- Pickup duplicate protection

Those rules are enforced by Backend.

---

## 2. Source-Defined Frontend Baseline

Technology:

```text
Next.js
TypeScript
Static Export
REST API
JWT
```

Required module groups:

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

Required UI data states:

```text
loading
success
empty
error
unauthorized
forbidden
```

Frontend role visibility is for UX only.

Backend remains the authoritative permission layer.

---

## 3. Target Frontend Structure

**PROJECT DECISION**

Target structure:

```text
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── login/
│   │   ├── register/
│   │   ├── stores/
│   │   ├── campaigns/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── my/
│   │   ├── notifications/
│   │   ├── org/
│   │   └── platform/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── staff/
│   │   ├── stores/
│   │   ├── products/
│   │   ├── campaigns/
│   │   ├── storefront/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── production/
│   │   ├── pickups/
│   │   ├── dashboard/
│   │   ├── audit/
│   │   ├── notifications/
│   │   └── platform-admin/
│   │
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── lib/
│   ├── types/
│   └── utils/
│
├── public/
├── next.config.*
├── package.json
└── tsconfig.json
```

### 3.1 Directory Responsibilities

`app/`

- route-level composition only
- reads search parameters
- assembles module screens
- does not contain API/business logic directly

`modules/`

- feature-specific UI
- feature hooks
- feature forms
- feature view models
- feature client-side validation

`components/`

- reusable cross-feature UI primitives
- layout
- empty/error/loading components
- confirmation dialogs
- badges
- tables
- pagination controls

`services/`

- HTTP client
- endpoint adapters
- Pre-signed URL upload/download client

`lib/`

- auth/session utilities
- environment config
- route helpers
- shared API helpers

`types/`

- Frontend DTO types matching `docs/api/API_CONTRACT.md`

`utils/`

- pure formatting/helpers
- money display
- timestamp formatting
- non-business utility functions

---

## 4. Static Export Routing Strategy

Next.js production build must use:

```js
{
  output: "export"
}
```

Runtime database IDs are not known at build time.

Therefore arbitrary runtime entities must not depend on dynamic route segments that require build-time `generateStaticParams()`.

### 4.1 Canonical Strategy

**PROJECT DECISION**

Use **static route pages + query parameters** for runtime IDs.

Production Next.js config also uses:

```text
trailingSlash: true
```

so exported routes become directory-style `.../index.html` paths that can be refreshed through S3 Static Website hosting. Internal production links should use the canonical trailing-slash path.

Example:

```text
/stores/view/?organizationId=<id>&storeId=<id>
/products/view/?organizationId=<id>&productId=<id>
/campaigns/view/?organizationId=<id>&campaignId=<id>
/my/order/?orderId=<id>
/org/orders/view/?organizationId=<id>&orderId=<id>
```

Do not implement arbitrary database entities as:

```text
/stores/[storeId]
/orders/[orderId]
/products/[productId]
```

unless the Static Export constraint is deliberately changed at the shared architecture level.

### 4.2 Route Parameters

- search parameters are identifiers only
- Frontend must fetch authoritative entity data from API
- never treat query `organizationId` as authorization proof
- missing/invalid required query parameters render a controlled error/invalid-navigation state

---

## 5. Route / Page Map

Routes below are **PROJECT DECISION** mappings from source-defined capabilities.

### 5.1 Public / Auth

| Route | Purpose | Auth |
|---|---|---|
| `/` | Public Storefront / active Organizations and Stores | Public |
| `/login/` | Login | Public |
| `/register/` | Register | Public |
| `/stores/view/` | View public Store | Public |
| `/campaigns/view/` | View public Campaign | Public |
| `/products/view/` | View public Product / Variant | Public |

### 5.2 Customer

| Route | Purpose |
|---|---|
| `/orders/new/` | Build and submit Order |
| `/my/orders/` | List current user's Orders |
| `/my/order/` | Order detail / tracking |
| `/my/payment/` | Payment Slip upload/resubmit |
| `/my/pickup/` | Pickup QR / Token |
| `/notifications/` | In-app notifications |

### 5.3 Organization Context

| Route | Purpose | Role |
|---|---|---|
| `/org/select/` | Select accessible Organization | Staff/Admin |
| `/org/dashboard/` | Dashboard | Organization Admin |
| `/org/settings/` | Organization details | Organization Admin |
| `/org/staff/` | Member/Staff management | Organization Admin |
| `/org/stores/` | Store management | Organization Admin |
| `/org/products/` | Product / Variant management | Organization Admin |
| `/org/campaigns/` | Campaign management | Organization Admin |
| `/org/orders/` | Order list/search | Staff/Admin |
| `/org/orders/view/` | Order detail | Staff/Admin |
| `/org/payments/` | Payment review queue | Staff/Admin |
| `/org/production/` | Production Summary | Organization Admin |
| `/org/pickups/` | Pickup search/confirmation | Staff/Admin |
| `/org/audit/` | Audit Log | Organization Admin |

### 5.4 Platform Admin

| Route | Purpose |
|---|---|
| `/platform/summary/` | Platform summary |
| `/platform/organizations/` | Organization list / approve / suspend |
| `/platform/users/` | User list |

### 5.5 Route Naming Rule

Route names are frontend navigation contracts only.

API routes remain defined exclusively in:

```text
docs/api/API_CONTRACT.md
```

---

## 6. Auth and Session Contract

### 6.1 Login Flow

```text
Login form
→ POST /api/v1/auth/login
→ receive user + JWT
→ store session
→ GET /api/v1/me when restoring/refreshing identity
→ render role-aware navigation
```

### 6.2 Register Flow

```text
Register form
→ POST /api/v1/auth/register
→ receive user + JWT
→ store session
→ route to authenticated experience
```

### 6.3 Token Storage

**PROJECT DECISION — resolved by Frontend contract**

Frontend stores the Bearer JWT in:

```text
sessionStorage
key: unistoreHub.accessToken
```

Also keep an in-memory copy while the app is running.

Reason:

- API contract requires Bearer JWT accessible to the client
- source does not require persistent login across browser restarts
- sessionStorage limits persistence compared with localStorage

Rules:

- never store password
- never log JWT
- clear token on logout
- clear token when API returns definitive invalid/expired token response
- do not store Organization role as authoritative authorization state

### 6.4 Learner Lab Security Caveat

The Final Learner Lab S3 Static Website is HTTP while API calls are HTTPS.

This is an educational/demo deployment constraint from the final architecture.

It must not be presented as the recommended production hosting security baseline.

Frontend code must still use HTTPS API URL.

---

## 7. Auth State

**PROJECT DECISION**

Canonical client auth state:

```ts
type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | {
      status: "authenticated";
      user: CurrentUser;
      memberships: OrganizationMembership[];
    };
```

The token itself is not treated as proof of Organization role.

Memberships are restored from `GET /api/v1/me`.

---

## 8. Role-Aware Navigation

### Customer Navigation

- Storefront
- My Orders
- Notifications

### Staff Navigation

When Organization context is selected:

- Orders
- Payments
- Pickups
- Notifications

Production Summary is not shown to Staff because the Final source assigns Production Summary to Organization Admin.

### Organization Admin Navigation

- Dashboard
- Organization
- Staff
- Stores
- Products
- Campaigns
- Orders
- Payments
- Production
- Pickups
- Audit
- Notifications

### Platform Admin Navigation

Show only when `GET /me` returns:

```text
user.platformRole = PLATFORM_ADMIN
```

Navigation:

- Platform Summary
- Organizations
- Users
- Notifications if returned for the user

Platform Admin authority is not inferred from Organization memberships.

### 8.1 Visibility Rule

UI may hide unavailable navigation/actions.

If Backend returns `403`, Frontend must render forbidden state even if UI believed the action was allowed.

---

## 9. Organization Context

**PROJECT DECISION**

Organization-scoped staff/admin screens use:

```text
organizationId
```

from the route query parameter.

Frontend verifies the selected ID appears in the user's current memberships before displaying privileged organization navigation.

This is a UX check only.

Backend still performs authoritative membership and tenant checks.

Organization selection is not stored as a trusted security claim.

Optional convenience storage:

```text
sessionStorage
key: unistoreHub.activeOrganizationId
```

is allowed for navigation restoration.

---

## 10. HTTP Client Contract

All normal API calls go through one shared API client.

Required behavior:

- uses `NEXT_PUBLIC_API_BASE_URL`
- appends documented path from API contract
- adds Bearer token for protected requests
- serializes JSON
- parses standard success/error envelope
- distinguishes 401 / 403 / 404 / 409 / 500
- never retries state-changing request automatically without an explicit idempotency contract
- never exposes internal error stack to UI

### 10.1 Example Boundary

```text
UI
→ module hook/action
→ service/API adapter
→ shared HTTP client
→ API Gateway
```

Page components should not call `fetch()` directly.

---

## 11. Client Error Mapping

API error codes are defined in `docs/api/API_CONTRACT.md`.

Frontend must map stable error codes into user-facing messages.

Examples:

```text
INVALID_CREDENTIALS
→ Email or password is incorrect

CAMPAIGN_NOT_OPEN
→ This campaign is not accepting orders

PAYMENT_REJECT_REASON_REQUIRED
→ A rejection reason is required

PICKUP_ALREADY_RECEIVED
→ This order has already been received
```

User-facing text may be Thai in final UI.

Frontend must not branch business behavior from raw English backend `message` strings.

Use `error.code`.

---

## 12. Required Async UI States

Every page/module that fetches remote data must support:

### loading

- initial request pending
- disable destructive action where appropriate
- use skeleton/spinner/progress without fake data

### success

- valid data rendered

### empty

- successful request with no records
- include next action where appropriate

### error

- API/network/unexpected error
- allow retry where safe

### unauthorized

- no valid session / 401
- clear invalid token when applicable
- route to Login with return context if useful

### forbidden

- authenticated but 403
- do not redirect into another privileged page silently
- show permission-denied state

---

## 13. Shared Page-State Pattern

**PROJECT DECISION**

Feature screens should normalize remote state to:

```ts
type RemoteState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "empty" }
  | { status: "error"; error: UiError }
  | { status: "unauthorized" }
  | { status: "forbidden" };
```

Exact state-management library is not mandated.

The Frontend Agent may use React state/context/hooks without introducing a global state library unless clearly useful.

---

## 14. Module Contracts

### 14.1 auth

Owns:

- Register form
- Login form
- Logout
- sessionStorage token helper
- session restore
- Current User state
- authenticated navigation boundary

Consumes:

```text
POST /auth/register
POST /auth/login
GET /me
```

Must not:

- locally calculate authoritative role
- trust stale membership forever
- store plaintext password

---

### 14.2 organizations

Owns:

- Organization list/select
- create Organization
- view Organization
- edit Organization

Consumes:

```text
GET/POST /organizations
GET/PATCH /organizations/:organizationId
```

Organization approval/suspension belongs to `platform-admin`.

---

### 14.3 staff

Owns:

- member list
- add member by existing User email
- change member role
- remove member

Consumes:

```text
GET    /organizations/:organizationId/members
POST   /organizations/:organizationId/members
PATCH  /organizations/:organizationId/members/:userId
DELETE /organizations/:organizationId/members/:userId
```

Last-admin rule:

- the final active Organization Admin cannot be removed or demoted
- API returns `LAST_ORGANIZATION_ADMIN`
- Frontend should disable the obviously invalid action when it can determine the condition, while still handling the server error authoritatively

---

### 14.4 stores

Owns:

- organization Store list
- create/edit Store
- storefront store view

Consumes Store endpoints from API contract.

---

### 14.5 products

Owns:

- Product list
- Product create/edit/delete
- Variant create/edit/delete
- Product Image upload
- product display

Price input/display:

- UI displays THB
- API sends integer satang
- conversion occurs through one shared money utility

Never send a binary image through JSON API.

---

### 14.6 campaigns

Owns:

- Campaign list/detail
- create/edit draft
- lifecycle action controls
- customer campaign view

Campaign dates are displayed/planned values; Frontend must not assume status changes automatically when a clock time is reached.

Canonical source flow:

```text
DRAFT
→ OPEN
→ CLOSED
→ PRODUCING
→ READY_FOR_PICKUP
→ COMPLETED
```

Frontend must never enable `OPEN → PRODUCING`.

**PROJECT DECISION**

Campaign Cancel is available only in `DRAFT`, `OPEN`, or `CLOSED` and only when Backend confirms there is no paid-or-later Order. The Backend remains authoritative.

---

### 14.7 storefront

Owns customer-facing:

- Store view
- active/available Campaign presentation
- Product cards
- Variant selection
- quantity selection
- order-entry path

Consumes the dedicated public read-only Storefront API:

```text
GET /storefront/organizations
GET /storefront/organizations/:organizationId/stores
GET /storefront/organizations/:organizationId/stores/:storeId
GET /storefront/organizations/:organizationId/stores/:storeId/products
GET /storefront/organizations/:organizationId/stores/:storeId/products/:productId
GET /storefront/organizations/:organizationId/stores/:storeId/campaigns
GET /storefront/organizations/:organizationId/stores/:storeId/campaigns/:campaignId
```

If a Storefront Product DTO contains `imageUrl`, Frontend uses that short-lived URL directly. Frontend does not request signing of an arbitrary Product `imageKey`.

Campaign Product scope is same-store: customer choices come from Products/Variants returned for the Campaign's Store.

Storefront must not calculate final authoritative total.

It may display a client-side estimate, but Backend response is authoritative.

---

### 14.8 orders

Customer owns:

- create Order
- list My Orders
- order detail / status
- cancel own Order while status is `PENDING_PAYMENT` or `PAYMENT_REJECTED`

Staff/Admin owns UI for:

- organization Order list
- search/filter
- detail

Organization Admin additionally may cancel a tenant Order while it is `PENDING_PAYMENT` or `PAYMENT_REJECTED`. Staff does not receive the general cancel action.

Order creation request sends:

```text
campaignId
items[]
  productId
  variantId
  quantity
```

Frontend must not submit:

- authoritative `unitPrice`
- authoritative `totalPrice`
- authoritative `total`

Backend calculates them.

Order lifecycle UI follows the shared PROJECT DECISION:

```text
PAID
→ CONFIRMED when Campaign closes
→ IN_PRODUCTION when production starts
→ READY_FOR_PICKUP when Campaign becomes ready
→ RECEIVED after Pickup confirm
```

---

### 14.9 payments

Customer side:

- request Payment Slip upload URL
- upload directly to S3
- submit `slipKey`
- resubmit after rejection
- view payment state/rejection reason

Staff/Admin side:

- payment review queue
- open authorized slip
- approve
- reject with required reason

Payment statuses:

```text
PENDING_REVIEW
APPROVED
REJECTED
```

Related Order states:

```text
PENDING_PAYMENT
PAYMENT_REVIEW
PAID
PAYMENT_REJECTED
```

---

### 14.10 production

Role: Organization Admin.

Owns:

- Campaign production summary
- grouped Product / Variant quantities

Consumes:

```text
GET /organizations/:organizationId/production?campaignId=<id>
```

Frontend displays Backend summary.

Frontend must not rebuild production totals from arbitrary client-side cached orders.

---

### 14.11 pickups

Customer:

- Pickup QR / Token display

Staff/Admin:

- search by token/order
- Pickup detail
- confirm Pickup
- duplicate-received error state

Pickup statuses:

```text
READY
RECEIVED
```

A successful confirm must refresh displayed state.

---

### 14.12 dashboard

Owns Organization Admin summary UI.

Source requires Dashboard / Report but does not define every metric.

**PROJECT DECISION**

Display the API baseline metrics:

```text
totalStores
totalProducts
campaignsByStatus
ordersByStatus
pendingPaymentReviews
paidOrderCount
paidRevenueSatang
```

Frontend formats `paidRevenueSatang` using the shared money utility.

---

### 14.13 audit

Owns:

- Organization Audit Log list
- filters defined in API contract

Audit is read-only from Frontend.

---

### 14.14 notifications

Owns:

- current user's notification list
- read/unread presentation
- mark read

Consumes:

```text
GET   /notifications
PATCH /notifications/:notificationId/read
```

Canonical notification types:

```text
PAYMENT_APPROVED
PAYMENT_REJECTED
READY_FOR_PICKUP
```

---

### 14.15 platform-admin

Owns:

- Platform Summary
- Organization list
- approve Organization
- suspend Organization
- User list

Consumes only documented `/platform/*` endpoints.

Platform Admin must not use Organization Admin routes as a substitute for platform operations.

---

## 15. Product Image Upload Flow

```text
User selects image
→ validate basic file type/size in UI
→ request image-upload-url from Backend
→ receive { objectKey, url, method, expiresInSeconds }
→ PUT file directly to S3
→ persist/use objectKey through documented API flow
→ refresh Product data
```

Frontend must:

- not expose AWS credentials
- not construct trusted S3 access policy locally
- not make Payment/Product bucket public
- request a fresh Pre-signed URL after expiry

Upload constraints are the shared PROJECT DECISION:

```text
Product Image: max 5 MiB
Allowed MIME: image/jpeg, image/png, image/webp
```

Frontend validates before requesting the Pre-signed URL; Backend remains authoritative.

---

## 16. Payment Slip Upload Flow

```text
Customer selects slip
→ validate allowed MIME / 10 MiB limit
→ request payment-slip-upload-url with { contentType }
→ PUT directly to S3 Files using the same Content-Type
→ POST /orders/:orderId/payment with slipKey
→ Order becomes PAYMENT_REVIEW
→ Staff reviews later
```

If Payment is rejected:

```text
PAYMENT_REJECTED
→ show reason
→ customer uploads replacement
→ submit new/updated slipKey
→ PAYMENT_REVIEW
```

Frontend must not interpret an S3 upload success as Payment approval.

Payment Slip constraints:

```text
max 10 MiB
Allowed MIME: image/jpeg, image/png, image/webp
```

---

## 17. Pickup QR / Token Presentation

Source requires Pickup QR / Token.

**PROJECT DECISION**

Frontend QR rendering may encode the Pickup `token` value only.

Do not encode:

- JWT
- Payment Slip URL
- customer secrets
- AWS data

Staff confirmation still goes through Backend API.

---

## 18. Money UI Contract

API values are integer satang.

Frontend display helper:

```text
250050
→ ฿2,500.50
```

Input behavior:

- user may enter THB decimal in forms
- normalize to integer satang before API request
- reject more than two decimal places
- never use binary floating-point result as final sent amount without integer normalization

Product/Variant management uses this conversion.

Order creation price sent by customer is not authoritative.

---

## 19. Timestamp UI Contract

API timestamp format:

```text
ISO 8601 UTC
```

Frontend may display in user's local timezone.

Stored/raw DTO value remains the original API timestamp string.

Do not send locale-formatted date strings back to API where ISO timestamp is expected.

---

## 20. Forms

**PROJECT DECISION**

All forms must provide:

- field-level validation for obvious client constraints
- submission pending state
- server validation error display
- disabled duplicate submission while current request is pending
- success transition/refresh
- accessible labels

Backend validation remains authoritative.

---

## 21. Confirmation UX

Use confirmation for high-impact actions:

- delete Product
- delete Variant
- remove Staff
- lifecycle Campaign action
- Payment approve
- Payment reject
- Pickup confirm
- Organization suspend

Confirmation does not replace Backend validation.

---

## 22. Empty-State Requirements

Examples:

### No Orders

Show:

- clear "no orders" state
- link/action back to Storefront if Customer

### No Payments to Review

Show:

- queue is empty
- no fake rows

### No Notifications

Show empty notification state.

### No Production Rows

Explain that no paid orders currently contribute to the selected Campaign.

---

## 23. Unauthorized / Forbidden Behavior

### 401

Frontend should:

1. clear invalid session token when response indicates invalid/expired auth
2. set auth state anonymous
3. render/login redirect path
4. preserve intended return route when practical

### 403

Frontend should:

- retain authenticated state
- show forbidden screen/message
- not clear token automatically
- not redirect to Login as if unauthenticated

---

## 24. Not Found Behavior

404 resource response:

- show controlled not-found state
- do not leak alternate tenant existence
- allow return to appropriate list

For invalid query parameter navigation before API request:

- show invalid-link state
- do not send malformed IDs repeatedly

---

## 25. Storefront Visibility

The source requires a customer storefront but does not define browse authorization.

**PROJECT DECISION**

Storefront browsing is public read-only through the dedicated `/api/v1/storefront/*` endpoints.

Frontend may render only data returned by those endpoints.

Creating an Order still requires authentication and uses the authenticated Order endpoint.

Organization management endpoints are not used as public browse endpoints.

---

## 26. Static Asset Rules

Frontend static export includes application assets in the Frontend S3 Website bucket.

Business uploads are not placed in the Frontend bucket.

Separation:

```text
Frontend Bucket
→ generated website files

Files Bucket
→ Product Images
→ Payment Slips
```

Do not hard-code private Files bucket URLs for display.

Use API-authorized access strategy.

---

## 27. Environment Contract

Required variable:

```env
NEXT_PUBLIC_API_BASE_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/api/v1
```

Rules:

- no AWS credentials in Frontend environment
- no JWT secret in Frontend
- no private bucket credential/config that grants access
- API base URL must come from deployment output integration

---

## 28. Build Contract

Production build must create:

```text
frontend/out
```

Canonical subsystem commands:

```bash
npm ci
npm test
npm run build
```

**PROJECT DECISION:** `frontend/package-lock.json` is committed so `npm ci` is deterministic.

`npm run build` must produce `frontend/out`.

Expected flow:

```text
npm ci
→ npm test
→ npm run build
→ frontend/out
→ aws s3 sync
→ S3 Static Website
```

Frontend build must not depend on live API data to statically generate database entity pages.

---

## 29. Development Mode Boundary

Frontend Dev Mode implementation is specified later in:

```text
docs/specs/dev/SPEC.md
```

Frontend must be environment-driven so the same application code can use:

```text
Local API base URL
or
AWS API Gateway base URL
```

Do not create a separate fake frontend business flow for local mode.

---

## 30. Accessibility / Responsive Baseline

**PROJECT DECISION**

Minimum UI quality expectations:

- usable on desktop and mobile widths
- form controls have labels
- keyboard-accessible primary actions
- dialogs trap/return focus correctly where implemented
- meaningful button text
- status is not conveyed only by color
- tables provide a mobile-safe presentation or horizontal containment
- loading state does not shift layout excessively

These are implementation quality requirements, not changes to business behavior.

---

## 31. Frontend Security Rules

1. Never store password.
2. Never log JWT.
3. Never trust UI role checks as authorization.
4. Never expose `passwordHash`.
5. Never expose AWS credentials.
6. Never make Payment Slip public.
7. Never trust client-calculated price/total.
8. Never render unsanitized server/user HTML.
9. Never embed secrets in `NEXT_PUBLIC_*`.
10. Treat Organization query parameter as navigation context, not proof of permission.

---

## 32. Frontend Testing Responsibilities

Frontend Agent must provide tests/checks for:

- auth session restoration
- token removal on logout
- route query validation
- API error-code mapping
- role-based UI visibility
- loading state
- empty state
- error state
- unauthorized state
- forbidden state
- Order form payload
- THB ↔ satang conversion
- Product image direct-upload flow
- Payment Slip direct-upload flow
- Payment rejection reason display
- Pickup duplicate error display
- notification mark-read flow
- static export build

Cross-system tests belong to Testing Spec.

---

## 33. Frontend Acceptance Criteria

Frontend subsystem is implementation-ready when all of the following are true:

- [ ] Next.js + TypeScript structure matches this spec
- [ ] `output: "export"` is configured
- [ ] `trailingSlash: true` is configured for S3 Website refresh compatibility
- [ ] runtime entity pages use static routes/query parameters rather than unknown build-time dynamic routes
- [ ] all source-defined feature modules exist
- [ ] all required UI states are represented
- [ ] API client uses `NEXT_PUBLIC_API_BASE_URL`
- [ ] protected calls use Bearer JWT
- [ ] JWT is stored only according to the session contract
- [ ] membership is restored from `GET /me`
- [ ] role UI never substitutes for Backend authorization
- [ ] Orders submit identifiers/quantity, not trusted prices
- [ ] Product Image uses Pre-signed direct-S3 upload
- [ ] Payment Slip uses private Pre-signed direct-S3 upload
- [ ] Payment review UI supports Approve/Reject with required reject reason
- [ ] Production view consumes Backend summary
- [ ] Pickup confirm handles already-received conflict
- [ ] Notifications list and mark-read work
- [ ] Staff add flow uses existing User email and handles USER_NOT_FOUND
- [ ] Platform Admin views use documented `/platform/*` endpoints
- [ ] Frontend build outputs `frontend/out`
- [ ] no CloudFront/Cognito/SES dependency exists
- [ ] no AWS secret is shipped to browser

---

## 34. Frontend Decision Closure

The previously blocking cross-system decisions are now resolved in Shared/API contracts:

- Campaign cancellation states and paid-order guard
- Order cancellation actors/states
- post-`PAID` lifecycle progression
- Dashboard metric set
- Last Organization Admin protection
- Product Image / Payment Slip size/MIME limits
- Platform Admin authority from `User.platformRole`
- public Storefront endpoints
- Static Export trailing-slash routing

There are no remaining Frontend contract gaps that require the Frontend Agent to guess before implementation.
