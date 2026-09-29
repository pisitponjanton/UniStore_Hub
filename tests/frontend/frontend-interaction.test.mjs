import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

test(
  'FE-003 public Storefront renders active browse data without JWT while Order creation requires authentication',
  { todo: 'BLOCKED: Frontend application/routes are not implemented yet; requires rendered Storefront with API stubs or live Backend' },
  () => {},
);

test(
  'FE-004 Login page handles successful login and stable API error-code feedback',
  { todo: 'BLOCKED: requires Login UI, shared API client, session helper, and executable browser/component harness' },
  () => {},
);

test(
  'FE-005 Register page handles successful registration and stable API error-code feedback',
  { todo: 'BLOCKED: requires Register UI, shared API client, session helper, and executable browser/component harness' },
  () => {},
);

test(
  'FE-006 session restore reads unistoreHub.accessToken and restores identity via GET /me',
  { todo: 'BLOCKED: requires auth/session implementation and browser sessionStorage harness' },
  () => {},
);

test(
  'FE-007 logout clears unistoreHub.accessToken from sessionStorage',
  { todo: 'BLOCKED: requires auth/session implementation and browser sessionStorage harness' },
  () => {},
);

test(
  'FE-008 401 clears invalid auth state and renders/login-redirects without treating user as authenticated',
  { todo: 'BLOCKED: requires shared HTTP client, auth boundary, and route rendering harness' },
  () => {},
);

test(
  'FE-009 403 retains authenticated state and renders forbidden UI without redirecting to Login',
  { todo: 'BLOCKED: requires shared HTTP client, authenticated fixture, and forbidden-state UI' },
  () => {},
);

test(
  'FE-010 remote-data screens expose loading, success, empty, error/retry, unauthorized, and forbidden states',
  { todo: 'BLOCKED: requires implemented feature screens and component/browser harness' },
  () => {},
);

test(
  'FE-011 invalid runtime query parameters render controlled invalid-link state before repeated malformed API calls',
  { todo: 'BLOCKED: requires static query-parameter entity routes and route-state validation' },
  () => {},
);

test(
  'FE-012 Customer own-order flow supports list/detail/status and only eligible own cancellation actions',
  { todo: 'BLOCKED: requires Order UI/services plus authenticated Customer fixtures' },
  () => {},
);

test(
  'FE-013 Order creation submits only campaignId/productId/variantId/quantity and no authoritative prices or totals',
  { todo: 'BLOCKED: requires Order form and observable API adapter request payload' },
  () => {},
);

test(
  'FE-014 Payment UI displays backend rejection reason and supports replacement-slip resubmission',
  { todo: 'BLOCKED: requires Customer Payment UI and rejected Payment fixture' },
  () => {},
);

test(
  'FE-015 Product Image and Payment Slip uploads use Backend pre-sign then direct PUT to S3 rather than proxying binary through API',
  { todo: 'BLOCKED: requires file service/UI implementation and observable browser network flow' },
  () => {},
);

test(
  'FE-016 Payment Slip client validation enforces jpeg/png/webp and 10 MiB before requesting pre-sign',
  { todo: 'BLOCKED: requires Payment upload component and file-selection harness' },
  () => {},
);

test(
  'FE-017 Production view is Organization Admin-only UX and renders Backend summary rather than rebuilding totals client-side',
  { todo: 'BLOCKED: requires Production route/module and role-specific authenticated fixtures' },
  () => {},
);

test(
  'FE-018 Pickup UI refreshes after confirm and maps PICKUP_ALREADY_RECEIVED to controlled duplicate-conflict feedback',
  { todo: 'BLOCKED: requires Pickup staff/admin UI and confirm API fixture' },
  () => {},
);

test(
  'FE-019 Notification UI renders read/unread state and marks owned Notification read',
  { todo: 'BLOCKED: requires Notification module, API client, and authenticated notification fixtures' },
  () => {},
);

test(
  'FE-020 role-aware navigation matches Customer, Staff, Organization Admin, and persisted Platform Admin roles',
  { todo: 'BLOCKED: requires navigation shell plus GET /me membership/platformRole fixtures' },
  () => {},
);

test(
  'FE-021 Staff navigation hides Production while Organization Admin shows Production',
  { todo: 'BLOCKED: requires role-aware navigation implementation and Staff/Admin fixtures' },
  () => {},
);

test(
  'FE-022 Organization query parameter is treated as navigation context only and privileged nav requires current membership',
  { todo: 'BLOCKED: requires organization-context navigation implementation and multiple membership fixtures' },
  () => {},
);

test(
  'FE-023 empty states show no fake rows for Orders, Payment review, Notifications, and Production',
  { todo: 'BLOCKED: requires respective screens and successful-empty API fixtures' },
  () => {},
);
