import test from 'node:test';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertFrontendSourceEvidence,
  assertFrontendSuiteEvidence,
} from '../helpers/frontend-suite-evidence.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../../frontend');

test('FE-001 Frontend Next.js project manifest exists', async () => {
  await access(path.join(frontendRoot, 'package.json'));
});

test('FE-002 required App Router entry/login/register pages exist', async () => {
  const required = [
    'src/app/page.tsx',
    'src/app/login/page.tsx',
    'src/app/register/page.tsx',
  ];

  for (const relativePath of required) {
    await access(path.join(frontendRoot, relativePath));
  }
});

test('FE-003 public Storefront renders active browse data without JWT while Order creation requires authentication', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/app/page.test.tsx',
      'src/modules/storefront/storefront-service.test.ts',
      'src/modules/orders/order-service.test.ts',
    ],
    [
      'composes the public storefront landing',
      'uses only documented public storefront organization/store endpoints',
      'posts the documented create payload to the organization order endpoint with authentication',
    ],
  );
});

test('FE-004 Login page handles successful login and stable API error-code feedback', async () => {
  await assertFrontendSourceEvidence('src/modules/auth/login-form.tsx', [
    'authService.login',
    'authSession.establish',
    'error instanceof ApiClientError',
    'error.userMessage',
    'window.location.assign',
  ]);
  await assertFrontendSourceEvidence('src/modules/auth/auth-service.ts', [
    '"/auth/login"',
  ]);
  await assertFrontendSuiteEvidence(
    [
      'src/modules/auth/auth-validation.test.ts',
      'src/modules/auth/session.test.ts',
      'src/utils/utils.test.ts',
    ],
    [
      'validates obvious email, password, and name constraints',
      'stores a new token then restores authoritative memberships',
      'maps stable API error codes to user-facing messages',
    ],
  );
});

test('FE-005 Register page handles successful registration and stable API error-code feedback', async () => {
  await assertFrontendSourceEvidence('src/modules/auth/register-form.tsx', [
    'authService.register',
    'authSession.establish',
    'error instanceof ApiClientError',
    'error.userMessage',
    'window.location.assign',
  ]);
  await assertFrontendSourceEvidence('src/modules/auth/auth-service.ts', [
    '"/auth/register"',
  ]);
  await assertFrontendSuiteEvidence(
    [
      'src/modules/auth/auth-validation.test.ts',
      'src/modules/auth/session.test.ts',
      'src/utils/utils.test.ts',
    ],
    [
      'validates obvious email, password, and name constraints',
      'stores a new token then restores authoritative memberships',
      'maps stable API error codes to user-facing messages',
    ],
  );
});

test('FE-006 session restore reads unistoreHub.accessToken and restores identity via GET /me', async () => {
  await assertFrontendSuiteEvidence(
    'src/modules/auth/session.test.ts',
    ['restores user and memberships from GET /me when a token exists'],
  );
  await assertFrontendSourceEvidence('src/lib/session-storage.ts', [
    'unistoreHub.accessToken',
    'sessionStorage',
  ]);
  await assertFrontendSourceEvidence('src/modules/auth/session.ts', [
    '/me',
  ]);
});

test('FE-007 logout clears unistoreHub.accessToken from sessionStorage', async () => {
  await assertFrontendSuiteEvidence(
    'src/modules/auth/session.test.ts',
    ['logout clears session and active organization context'],
  );
  await assertFrontendSourceEvidence('src/lib/session-storage.ts', [
    'sessionStorage',
    'unistoreHub.accessToken',
  ]);
});

test('FE-008 401 clears invalid auth state and renders/login-redirects without treating user as authenticated', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/auth/session.test.ts',
      'src/modules/auth/access-navigation.test.ts',
    ],
    [
      'clears a definitive invalid session for TOKEN_INVALID',
      'clears a definitive invalid session for TOKEN_EXPIRED',
      'distinguishes unauthorized from forbidden responses',
    ],
  );
});

test('FE-009 403 retains authenticated state and renders forbidden UI without redirecting to Login', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/auth/session.test.ts',
      'src/modules/auth/access-navigation.test.ts',
      'src/components/ui/state-panel.test.tsx',
    ],
    [
      'retains the token when GET /me is forbidden rather than treating 403 as logout',
      'distinguishes unauthorized from forbidden responses',
      'distinguishes unauthorized from forbidden states',
    ],
  );
});

test('FE-010 remote-data screens expose loading, success, empty, error/retry, unauthorized, and forbidden states', async () => {
  await assertFrontendSuiteEvidence(
    'src/components/ui/state-panel.test.tsx',
    [
      'renders loading as a polite atomic status',
      'renders an explicit empty state without generic English chrome',
      'renders errors with alert semantics',
      'distinguishes unauthorized from forbidden states',
    ],
  );
  await assertFrontendSourceEvidence('src/components/ui/state-panel.tsx', [
    'actions ?',
    'kind="error"',
    'kind="unauthorized"',
    'kind="forbidden"',
  ]);
});

test('FE-011 invalid runtime query parameters render controlled invalid-link state before repeated malformed API calls', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/utils/utils.test.ts',
      'src/app/static-export.test.ts',
    ],
    [
      'treats ids as opaque non-empty strings',
      'rejects control characters and reads the requested query key only',
      'uses query-based entity routes instead of runtime dynamic route directories',
    ],
  );
});

test('FE-012 Customer own-order flow supports list/detail/status and only eligible own cancellation actions', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/orders/order-service.test.ts',
      'src/modules/orders/order-tracking-helpers.test.ts',
    ],
    [
      'lists own orders using the opaque cursor and authenticated /me endpoint',
      'loads and cancels only through customer-owned /me order routes',
      'allows customer cancellation only from documented source states',
    ],
  );
});

test('FE-013 Order creation submits only campaignId/productId/variantId/quantity and no authoritative prices or totals', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/orders/order-create-helpers.test.ts',
      'src/modules/orders/order-service.test.ts',
    ],
    [
      'builds the exact create-order payload without client prices or totals',
      'posts the documented create payload to the organization order endpoint with authentication',
    ],
  );
});

test('FE-014 Payment UI displays backend rejection reason and supports replacement-slip resubmission', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/payments/my-payment-view.test.tsx',
      'src/modules/payments/payment-service.test.ts',
    ],
    [
      'reloads the authoritative own Payment and displays the exact rejection reason',
      'resubmits a rejected Payment with a fresh objectKey and replaces the rejection state after refresh',
      'loads the current Customer Payment through the documented own-Order endpoint',
    ],
  );
});

test('FE-015 Product Image and Payment Slip uploads use Backend pre-sign then direct PUT to S3 rather than proxying binary through API', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/payments/direct-upload.test.ts',
      'src/modules/payments/my-payment-view.test.tsx',
      'src/modules/products/product-image-upload.test.ts',
      'src/modules/products/product-image-upload-view.test.tsx',
    ],
    [
      'PUTs directly to the presigned URL with the exact signed content type and no Bearer header',
      'submits a new slip through fresh presign -> direct PUT -> Backend slipKey -> authoritative refresh',
      'PUTs directly to the signed URL with the exact Content-Type and no Authorization header',
      'requests a presign, PUTs directly to S3, persists imageKey, and refreshes Product data',
    ],
  );
});

test('FE-016 Payment Slip client validation enforces jpeg/png/webp and 10 MiB before requesting pre-sign', async () => {
  await assertFrontendSuiteEvidence(
    'src/utils/utils.test.ts',
    ['enforces the documented MIME and size limits'],
  );
  await assertFrontendSourceEvidence('src/utils/upload.ts', [
    'PAYMENT_SLIP_MAX_BYTES',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
});

test('FE-017 Production view is Organization Admin-only UX and renders Backend summary rather than rebuilding totals client-side', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/auth/access-boundary.test.tsx',
      'src/modules/auth/access-navigation.test.ts',
      'src/modules/production/production-service.test.ts',
      'src/modules/production/production-summary-view.test.tsx',
    ],
    [
      'hides Organization Admin UI from Staff membership',
      'keeps production and management links away from Staff navigation',
      'uses the documented Organization Admin summary endpoint with required campaignId',
      'loads and displays only the Backend Production Summary grouped by Product and Variant',
    ],
  );
});

test('FE-018 Pickup UI refreshes after confirm and maps PICKUP_ALREADY_RECEIVED to controlled duplicate-conflict feedback', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/pickups/organization-pickups-view.test.tsx',
      'src/utils/utils.test.ts',
    ],
    [
      'confirms READY pickup then refreshes both Pickup and Order from Backend',
      'handles duplicate confirmation as PICKUP_ALREADY_RECEIVED and refreshes displayed state',
      'maps stable API error codes to user-facing messages',
    ],
  );
});

test('FE-019 Notification UI renders read/unread state and marks owned Notification read', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/notifications/notification-service.test.ts',
      'src/modules/notifications/notifications-view.test.tsx',
    ],
    [
      'lists current-user notifications with read filter and opaque cursor',
      'marks only the selected notification read through PATCH',
      'renders unread presentation and updates the item after mark-read',
    ],
  );
});

test('FE-020 role-aware navigation matches Customer, Staff, Organization Admin, and persisted Platform Admin roles', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/modules/auth/access-navigation.test.ts',
      'src/modules/auth/access-boundary.test.tsx',
    ],
    [
      'provides the complete Organization Admin navigation set',
      'derives Platform Admin navigation only from user.platformRole',
      'combines customer, organization, and platform groups without treating membership as platform authority',
    ],
  );
});

test('FE-021 Staff navigation hides Production while Organization Admin shows Production', async () => {
  await assertFrontendSuiteEvidence(
    'src/modules/auth/access-navigation.test.ts',
    [
      'keeps production and management links away from Staff navigation',
      'provides the complete Organization Admin navigation set',
    ],
  );
});

test('FE-022 Organization query parameter is treated as navigation context only and privileged nav requires current membership', async () => {
  await assertFrontendSuiteEvidence(
    'src/modules/auth/access-navigation.test.ts',
    [
      'allows only an active membership and applies optional role constraints',
      'treats a missing organization id as invalid navigation context',
      'restores only an accessible remembered organization',
      'refuses to remember an inaccessible organization',
    ],
  );
});

test('FE-023 empty states show no fake rows for Orders, Payment review, Notifications, and Production', async () => {
  await assertFrontendSuiteEvidence(
    [
      'src/components/ui/state-panel.test.tsx',
      'src/modules/notifications/notifications-view.test.tsx',
      'src/modules/production/production-summary-view.test.tsx',
    ],
    [
      'renders an explicit empty state without generic English chrome',
      'shows a meaningful empty state when Backend returns no paid production quantities',
    ],
  );

  for (const relativePath of [
    'src/modules/orders/organization-orders-view.tsx',
    'src/modules/payments/organization-payments-view.tsx',
    'src/modules/notifications/notifications-view.tsx',
    'src/modules/production/production-summary-view.tsx',
  ]) {
    await assertFrontendSourceEvidence(relativePath, ['<EmptyState']);
  }
});
