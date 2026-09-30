'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const {
  createAuditRouter,
} = require('../src/modules/audit/audit.routes');
const {
  createAuthRouter,
} = require('../src/modules/auth/auth.routes');
const {
  createCampaignRouter,
} = require('../src/modules/campaigns/campaign.routes');
const {
  createFileRouter,
} = require('../src/modules/files/file.routes');
const {
  createMemberRouter,
} = require('../src/modules/members/member.routes');
const {
  createNotificationRouter,
} = require('../src/modules/notifications/notification.routes');
const {
  createOrderRouter,
} = require('../src/modules/orders/order.routes');
const {
  createOwnOrderRouter,
} = require('../src/modules/orders/own-order.routes');
const {
  createOrganizationRouter,
} = require('../src/modules/organizations/organization.routes');
const {
  createPaymentRouter,
} = require('../src/modules/payments/payment.routes');
const {
  createPickupRouter,
} = require('../src/modules/pickups/pickup.routes');
const {
  createPlatformAdminRouter,
} = require('../src/modules/platform-admin/platform-admin.routes');
const {
  createProductRouter,
} = require('../src/modules/products/product.routes');
const {
  createProductionRouter,
} = require('../src/modules/production/production.routes');
const {
  createReportRouter,
} = require('../src/modules/reports/report.routes');
const {
  createStoreRouter,
} = require('../src/modules/stores/store.routes');
const {
  createStorefrontRouter,
} = require('../src/modules/storefront/storefront.routes');
const {
  createUserRouter,
} = require('../src/modules/users/user.routes');
const {
  handler: lambdaHandler,
} = require('../src/lambda');
const {
  handler: workerHandler,
} = require('../src/worker');

function routeSurface(router) {
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods)
        .filter(
          (method) =>
            layer.route.methods[method],
        )
        .map((method) =>
          `${method.toUpperCase()} ${layer.route.path}`,
        ),
    )
    .sort();
}

function assertSurface(router, expected) {
  assert.deepEqual(
    routeSurface(router),
    [...expected].sort(),
  );
}

test('documented module routers expose only the canonical direct route surface', () => {
  assertSurface(createAuthRouter({}), [
    'POST /register',
    'POST /login',
  ]);

  assertSurface(createUserRouter({}), [
    'GET /me',
    'GET /me/orders/:orderId/pickup',
  ]);

  assertSurface(createOwnOrderRouter({}), [
    'GET /',
    'GET /:orderId/payment',
    'GET /:orderId',
    'POST /:orderId/cancel',
  ]);

  assertSurface(createStorefrontRouter({}), [
    'GET /organizations',
    'GET /organizations/:organizationId/stores',
    'GET /organizations/:organizationId/stores/:storeId',
    'GET /organizations/:organizationId/stores/:storeId/products',
    'GET /organizations/:organizationId/stores/:storeId/products/:productId',
    'GET /organizations/:organizationId/stores/:storeId/campaigns',
    'GET /organizations/:organizationId/stores/:storeId/campaigns/:campaignId',
  ]);

  assertSurface(createMemberRouter({}), [
    'GET /',
    'POST /',
    'PATCH /:userId',
    'DELETE /:userId',
  ]);

  assertSurface(createStoreRouter({}), [
    'GET /',
    'POST /',
    'GET /:storeId',
    'PATCH /:storeId',
  ]);

  assertSurface(createProductRouter({}), [
    'GET /',
    'POST /',
    'POST /:productId/image-upload-url',
    'GET /:productId',
    'PATCH /:productId',
    'DELETE /:productId',
    'POST /:productId/variants',
    'PATCH /:productId/variants/:variantId',
    'DELETE /:productId/variants/:variantId',
  ]);

  assertSurface(createCampaignRouter({}), [
    'GET /',
    'POST /',
    'GET /:campaignId',
    'PATCH /:campaignId',
    'POST /:campaignId/open',
    'POST /:campaignId/close',
    'POST /:campaignId/start-production',
    'POST /:campaignId/ready-for-pickup',
    'POST /:campaignId/complete',
    'POST /:campaignId/cancel',
  ]);

  assertSurface(createOrderRouter({}), [
    'GET /',
    'POST /',
    'POST /:orderId/payment-slip-upload-url',
    'POST /:orderId/payment',
    'GET /:orderId',
    'POST /:orderId/cancel',
  ]);

  assertSurface(createPaymentRouter({}), [
    'GET /',
    'GET /:paymentId',
    'POST /:paymentId/approve',
    'POST /:paymentId/reject',
  ]);

  assertSurface(createFileRouter({}), [
    'POST /download-url',
  ]);

  assertSurface(createProductionRouter({}), [
    'GET /',
  ]);

  assertSurface(createPickupRouter({}), [
    'GET /',
    'GET /:pickupId',
    'POST /:pickupId/confirm',
  ]);

  assertSurface(createReportRouter({}), [
    'GET /',
  ]);

  assertSurface(createAuditRouter({}), [
    'GET /',
  ]);

  assertSurface(
    createNotificationRouter({
      authMiddleware(req, res, next) {
        next();
      },
    }),
    [
      'GET /',
      'PATCH /:notificationId/read',
    ],
  );

  assertSurface(
    createPlatformAdminRouter({
      authMiddleware(req, res, next) {
        next();
      },
      platformAdminMiddleware(
        req,
        res,
        next,
      ) {
        next();
      },
    }),
    [
      'GET /organizations',
      'POST /organizations/:organizationId/approve',
      'POST /organizations/:organizationId/suspend',
      'GET /users',
      'GET /summary',
    ],
  );
});

test('organization router mounts every documented nested resource family exactly once', () => {
  const router = createOrganizationRouter({
    authMiddleware(req, res, next) {
      next();
    },
  });
  const nestedRouters = router.stack.filter(
    (layer) => layer.name === 'router',
  );
  const prefixes = [
    '/org-1/files',
    '/org-1/orders',
    '/org-1/payments',
    '/org-1/pickups',
    '/org-1/production',
    '/org-1/reports',
    '/org-1/audit-logs',
    '/org-1/members',
    '/org-1/stores',
    '/org-1/products',
    '/org-1/campaigns',
  ];

  assert.equal(
    nestedRouters.length,
    prefixes.length,
  );

  for (const prefix of prefixes) {
    const matches = nestedRouters.filter(
      (layer) =>
        layer.matchers?.[0]?.(prefix),
    );

    assert.equal(
      matches.length,
      1,
      `expected exactly one mount for ${prefix}`,
    );
  }

  assertSurface(router, [
    'GET /',
    'POST /',
    'GET /:organizationId',
    'PATCH /:organizationId',
  ]);
});

test('top-level app wiring preserves public and protected authentication boundaries', async () => {
  const storefrontService = {
    async listOrganizations() {
      return [];
    },
    async listStores() {
      return [];
    },
    async getStore() {
      return {};
    },
    async listProducts() {
      return [];
    },
    async getProduct() {
      return {};
    },
    async listCampaigns() {
      return [];
    },
    async getCampaign() {
      return {};
    },
  };
  const app = createApp({
    storefront: {
      storefrontService,
    },
  });

  const health = await request(app)
    .get('/health')
    .expect(200);
  assert.deepEqual(health.body, {
    success: true,
    data: {
      status: 'ok',
    },
  });

  await request(app)
    .get('/api/v1/storefront/organizations')
    .expect(200);

  await request(app)
    .get('/api/v1/me')
    .expect(401);

  await request(app)
    .get('/api/v1/notifications')
    .expect(401);

  await request(app)
    .get('/api/v1/platform/summary')
    .expect(401);

  await request(app)
    .get('/api/v1/organizations')
    .expect(401);
});

test('configured CORS allows only exact configured origins and handles preflight without wildcarding', async () => {
  const app = createApp({
    cors: {
      allowedOrigins: [
        'http://localhost:3000',
      ],
    },
  });

  const preflight = await request(app)
    .options('/api/v1/auth/login')
    .set(
      'Origin',
      'http://localhost:3000',
    )
    .set(
      'Access-Control-Request-Method',
      'POST',
    )
    .expect(204);

  assert.equal(
    preflight.headers[
      'access-control-allow-origin'
    ],
    'http://localhost:3000',
  );
  assert.match(
    preflight.headers[
      'access-control-allow-methods'
    ],
    /POST/,
  );
  assert.equal(
    preflight.headers[
      'access-control-allow-headers'
    ],
    'Authorization,Content-Type',
  );
  assert.equal(
    preflight.headers[
      'access-control-allow-headers'
    ].includes('X-Request-Id'),
    false,
  );
  assert.equal(
    preflight.headers.vary,
    'Origin',
  );

  const denied = await request(app)
    .get('/health')
    .set(
      'Origin',
      'https://example.com',
    )
    .expect(200);

  assert.equal(
    denied.headers[
      'access-control-allow-origin'
    ],
    undefined,
  );
});

test('unknown routes and malformed JSON keep canonical safe error envelopes', async () => {
  const app = createApp();

  const missing = await request(app)
    .get('/not-a-route')
    .expect(404);

  assert.deepEqual(
    Object.keys(missing.body).sort(),
    ['error', 'success'],
  );
  assert.equal(
    missing.body.success,
    false,
  );
  assert.equal(
    missing.body.error.code,
    'VALIDATION_ERROR',
  );
  assert.equal(
    Object.hasOwn(
      missing.body.error,
      'stack',
    ),
    false,
  );

  const malformed = await request(app)
    .post('/api/v1/auth/login')
    .set(
      'Content-Type',
      'application/json',
    )
    .send('{"email":')
    .expect(400);

  assert.equal(
    malformed.body.success,
    false,
  );
  assert.equal(
    malformed.body.error.code,
    'VALIDATION_ERROR',
  );
  assert.equal(
    malformed.body.error.message,
    'Invalid JSON request body',
  );
  assert.equal(
    JSON.stringify(malformed.body).includes(
      'SyntaxError',
    ),
    false,
  );
});

test('backend package exposes required commands and both packaged Lambda handlers', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../package.json'),
      'utf8',
    ),
  );

  assert.equal(
    packageJson.scripts.test,
    'node --test',
  );
  assert.equal(
    packageJson.scripts.check,
    'node scripts/check-syntax.js',
  );
  assert.equal(
    packageJson.scripts[
      'seed:platform-admin'
    ],
    'node scripts/seed-platform-admin.js',
  );
  assert.equal(
    packageJson.main,
    'src/lambda.js',
  );
  assert.equal(
    typeof lambdaHandler,
    'function',
  );
  assert.equal(
    typeof workerHandler,
    'function',
  );
});

test('normal backend source has no DynamoDB Scan command or repository scan invocation', () => {
  const srcRoot = path.resolve(
    __dirname,
    '../src',
  );
  const files = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(
      directory,
      { withFileTypes: true },
    )) {
      const entryPath = path.join(
        directory,
        entry.name,
      );

      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.js')
      ) {
        files.push(entryPath);
      }
    }
  }

  walk(srcRoot);

  for (const file of files) {
    const source = fs.readFileSync(
      file,
      'utf8',
    );

    assert.doesNotMatch(
      source,
      /\bScanCommand\b/,
      `ScanCommand found in ${file}`,
    );
    assert.doesNotMatch(
      source,
      /\.\s*scan\s*\(/i,
      `scan() found in ${file}`,
    );
  }
});
