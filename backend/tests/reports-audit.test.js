'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const { AppError } = require('../src/errors/app-error');
const {
  AUDIT_ACTION,
} = require('../src/modules/audit/audit.constants');
const {
  sanitizeAuditMetadata,
  toAuditLogDto,
} = require('../src/modules/audit/audit.mapper');
const {
  createAuditRepository,
} = require('../src/modules/audit/audit.repository');
const {
  createAuditService,
} = require('../src/modules/audit/audit.service');
const {
  CAMPAIGN_STATUS,
} = require('../src/modules/campaigns/campaign.constants');
const {
  MEMBERSHIP_STATUS,
  ORGANIZATION_ROLE,
} = require('../src/modules/members/member.constants');
const {
  ORDER_STATUS,
} = require('../src/modules/orders/order.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  PAYMENT_STATUS,
} = require('../src/modules/payments/payment.constants');
const {
  PAID_ORDER_STATUSES,
  addMoney,
  createReportService,
} = require('../src/modules/reports/report.service');
const {
  validateAuditQuery,
} = require('../src/validators/audit.validator');
const {
  validateReportQuery,
} = require('../src/validators/report.validator');

function makeStore(storeId, overrides = {}) {
  return {
    storeId,
    organizationId: 'org-1',
    name: `Store ${storeId}`,
    status: 'ACTIVE',
    ...overrides,
  };
}

function makeProduct(productId, storeId, overrides = {}) {
  return {
    productId,
    organizationId: 'org-1',
    storeId,
    name: `Product ${productId}`,
    status: 'ACTIVE',
    ...overrides,
  };
}

function makeCampaign(
  campaignId,
  storeId,
  status,
  overrides = {},
) {
  return {
    campaignId,
    organizationId: 'org-1',
    storeId,
    name: `Campaign ${campaignId}`,
    status,
    ...overrides,
  };
}

function makeOrder(
  orderId,
  campaignId,
  status,
  total,
  overrides = {},
) {
  return {
    orderId,
    organizationId: 'org-1',
    campaignId,
    customerId: `customer-${orderId}`,
    status,
    subtotal: total,
    total,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

function makeCampaignLink(order, overrides = {}) {
  return {
    PK: 'ORG#org-1',
    SK:
      `CAMPAIGN#${order.campaignId}#ORDER#${order.createdAt}#${order.orderId}`,
    entityType: 'CampaignOrderLink',
    organizationId: 'org-1',
    campaignId: order.campaignId,
    orderId: order.orderId,
    customerId: order.customerId,
    status: order.status,
    createdAt: order.createdAt,
    ...overrides,
  };
}

function makePayment(
  paymentId,
  orderId,
  status,
  overrides = {},
) {
  return {
    paymentId,
    organizationId: 'org-1',
    orderId,
    customerId: `customer-${orderId}`,
    status,
    createdAt: '2026-09-29T10:15:00.000Z',
    updatedAt: '2026-09-29T10:15:00.000Z',
    ...overrides,
  };
}

function page(items, lastEvaluatedKey = null) {
  return {
    items,
    lastEvaluatedKey,
  };
}

function createReportHarness({
  stores = [],
  products = [],
  campaigns = [],
  orders = [],
  payments = [],
} = {}) {
  const storeById = new Map(
    stores.map((item) => [item.storeId, item]),
  );
  const campaignById = new Map(
    campaigns.map((item) => [item.campaignId, item]),
  );
  const orderById = new Map(
    orders.map((item) => [item.orderId, item]),
  );

  return createReportService({
    storeRepository: {
      async getById(organizationId, storeId) {
        assert.equal(organizationId, 'org-1');
        return storeById.get(storeId) || null;
      },

      async listByOrganization(organizationId) {
        assert.equal(organizationId, 'org-1');
        return stores;
      },
    },

    productRepository: {
      async listProductsByOrganization(
        organizationId,
        { exclusiveStartKey },
      ) {
        assert.equal(organizationId, 'org-1');
        assert.equal(exclusiveStartKey, undefined);
        return page(products);
      },

      async listProductsByStore(
        organizationId,
        storeId,
        { exclusiveStartKey },
      ) {
        assert.equal(organizationId, 'org-1');
        assert.equal(exclusiveStartKey, undefined);
        return page(
          products.filter(
            (product) => product.storeId === storeId,
          ),
        );
      },
    },

    campaignRepository: {
      async getById(organizationId, campaignId) {
        assert.equal(organizationId, 'org-1');
        return campaignById.get(campaignId) || null;
      },

      async listByOrganizationPage(
        organizationId,
        { exclusiveStartKey },
      ) {
        assert.equal(organizationId, 'org-1');
        assert.equal(exclusiveStartKey, undefined);
        return page(campaigns);
      },

      async listByStorePage(
        organizationId,
        storeId,
        { exclusiveStartKey },
      ) {
        assert.equal(organizationId, 'org-1');
        assert.equal(exclusiveStartKey, undefined);
        return page(
          campaigns.filter(
            (campaign) => campaign.storeId === storeId,
          ),
        );
      },
    },

    orderRepository: {
      async listByOrganizationPage(
        organizationId,
        { exclusiveStartKey },
      ) {
        assert.equal(organizationId, 'org-1');
        assert.equal(exclusiveStartKey, undefined);
        return page(orders);
      },

      async listCampaignLinks(
        organizationId,
        campaignId,
      ) {
        assert.equal(organizationId, 'org-1');

        return orders
          .filter(
            (order) => order.campaignId === campaignId,
          )
          .map((order) => makeCampaignLink(order));
      },

      async getById(organizationId, orderId) {
        assert.equal(organizationId, 'org-1');
        return orderById.get(orderId) || null;
      },
    },

    paymentRepository: {
      async listByOrganizationPage(
        organizationId,
        { status, exclusiveStartKey },
      ) {
        assert.equal(organizationId, 'org-1');
        assert.equal(
          status,
          PAYMENT_STATUS.PENDING_REVIEW,
        );
        assert.equal(exclusiveStartKey, undefined);

        return page(
          payments.filter(
            (payment) => payment.status === status,
          ),
        );
      },
    },
  });
}

test('report query accepts optional campaignId/storeId and trims them', () => {
  assert.deepEqual(
    validateReportQuery({
      campaignId: ' campaign-1 ',
      storeId: ' store-1 ',
    }),
    {
      campaignId: 'campaign-1',
      storeId: 'store-1',
    },
  );

  assert.deepEqual(validateReportQuery({}), {
    campaignId: undefined,
    storeId: undefined,
  });
});

test('dashboard summary returns the exact baseline metric schema and counts statuses', async () => {
  const stores = [
    makeStore('store-1'),
    makeStore('store-2'),
  ];
  const products = [
    makeProduct('product-1', 'store-1'),
    makeProduct('product-2', 'store-1'),
    makeProduct('product-3', 'store-2'),
  ];
  const campaigns = [
    makeCampaign(
      'campaign-1',
      'store-1',
      CAMPAIGN_STATUS.OPEN,
    ),
    makeCampaign(
      'campaign-2',
      'store-1',
      CAMPAIGN_STATUS.CLOSED,
    ),
    makeCampaign(
      'campaign-3',
      'store-2',
      CAMPAIGN_STATUS.CLOSED,
    ),
  ];
  const orders = [
    makeOrder(
      'order-pending',
      'campaign-1',
      ORDER_STATUS.PENDING_PAYMENT,
      10000,
    ),
    makeOrder(
      'order-review',
      'campaign-1',
      ORDER_STATUS.PAYMENT_REVIEW,
      20000,
    ),
    makeOrder(
      'order-paid',
      'campaign-1',
      ORDER_STATUS.PAID,
      30001,
    ),
    makeOrder(
      'order-confirmed',
      'campaign-2',
      ORDER_STATUS.CONFIRMED,
      40002,
    ),
    makeOrder(
      'order-production',
      'campaign-2',
      ORDER_STATUS.IN_PRODUCTION,
      50003,
    ),
    makeOrder(
      'order-ready',
      'campaign-3',
      ORDER_STATUS.READY_FOR_PICKUP,
      60004,
    ),
    makeOrder(
      'order-received',
      'campaign-3',
      ORDER_STATUS.RECEIVED,
      70005,
    ),
    makeOrder(
      'order-rejected',
      'campaign-1',
      ORDER_STATUS.PAYMENT_REJECTED,
      80000,
    ),
    makeOrder(
      'order-cancelled',
      'campaign-2',
      ORDER_STATUS.CANCELLED,
      90000,
    ),
  ];
  const payments = [
    makePayment(
      'payment-review-1',
      'order-review',
      PAYMENT_STATUS.PENDING_REVIEW,
    ),
    makePayment(
      'payment-review-2',
      'order-pending',
      PAYMENT_STATUS.PENDING_REVIEW,
    ),
    makePayment(
      'payment-approved',
      'order-paid',
      PAYMENT_STATUS.APPROVED,
    ),
  ];

  const service = createReportHarness({
    stores,
    products,
    campaigns,
    orders,
    payments,
  });

  const summary = await service.getSummary({
    organizationId: 'org-1',
  });

  assert.deepEqual(Object.keys(summary), [
    'totalStores',
    'totalProducts',
    'campaignsByStatus',
    'ordersByStatus',
    'pendingPaymentReviews',
    'paidOrderCount',
    'paidRevenueSatang',
  ]);
  assert.equal(summary.totalStores, 2);
  assert.equal(summary.totalProducts, 3);
  assert.deepEqual(summary.campaignsByStatus, {
    [CAMPAIGN_STATUS.OPEN]: 1,
    [CAMPAIGN_STATUS.CLOSED]: 2,
  });
  assert.deepEqual(summary.ordersByStatus, {
    [ORDER_STATUS.PENDING_PAYMENT]: 1,
    [ORDER_STATUS.PAYMENT_REVIEW]: 1,
    [ORDER_STATUS.PAID]: 1,
    [ORDER_STATUS.CONFIRMED]: 1,
    [ORDER_STATUS.IN_PRODUCTION]: 1,
    [ORDER_STATUS.READY_FOR_PICKUP]: 1,
    [ORDER_STATUS.RECEIVED]: 1,
    [ORDER_STATUS.PAYMENT_REJECTED]: 1,
    [ORDER_STATUS.CANCELLED]: 1,
  });
  assert.equal(summary.pendingPaymentReviews, 2);
  assert.equal(summary.paidOrderCount, 5);
  assert.equal(
    summary.paidRevenueSatang,
    30001 + 40002 + 50003 + 60004 + 70005,
  );
});

test('paid report lifecycle is exactly PAID plus later paid states and excludes unpaid/cancelled Orders', () => {
  assert.deepEqual(
    [...PAID_ORDER_STATUSES],
    [
      ORDER_STATUS.PAID,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.IN_PRODUCTION,
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.RECEIVED,
    ],
  );

  assert.equal(
    PAID_ORDER_STATUSES.has(
      ORDER_STATUS.PENDING_PAYMENT,
    ),
    false,
  );
  assert.equal(
    PAID_ORDER_STATUSES.has(
      ORDER_STATUS.PAYMENT_REJECTED,
    ),
    false,
  );
  assert.equal(
    PAID_ORDER_STATUSES.has(
      ORDER_STATUS.CANCELLED,
    ),
    false,
  );
});

test('paidRevenueSatang preserves integer-satang arithmetic and rejects invalid stored money', async () => {
  assert.equal(addMoney(10001, 20002), 30003);

  assert.throws(
    () => addMoney(10000, 12.5),
    /integer-satang/,
  );
  assert.throws(
    () => addMoney(10000, -1),
    /integer-satang/,
  );

  const service = createReportHarness({
    stores: [makeStore('store-1')],
    products: [],
    campaigns: [
      makeCampaign(
        'campaign-1',
        'store-1',
        CAMPAIGN_STATUS.OPEN,
      ),
    ],
    orders: [
      makeOrder(
        'order-1',
        'campaign-1',
        ORDER_STATUS.PAID,
        12.5,
      ),
    ],
    payments: [],
  });

  await assert.rejects(
    service.getSummary({
      organizationId: 'org-1',
    }),
    /integer-satang/,
  );
});

test('campaign filter narrows report metrics and pending reviews to Orders in that Campaign', async () => {
  const stores = [
    makeStore('store-1'),
    makeStore('store-2'),
  ];
  const products = [
    makeProduct('product-1', 'store-1'),
    makeProduct('product-2', 'store-1'),
    makeProduct('product-3', 'store-2'),
  ];
  const campaigns = [
    makeCampaign(
      'campaign-1',
      'store-1',
      CAMPAIGN_STATUS.OPEN,
    ),
    makeCampaign(
      'campaign-2',
      'store-2',
      CAMPAIGN_STATUS.CLOSED,
    ),
  ];
  const order1 = makeOrder(
    'order-1',
    'campaign-1',
    ORDER_STATUS.PAID,
    12345,
  );
  const order2 = makeOrder(
    'order-2',
    'campaign-2',
    ORDER_STATUS.PAYMENT_REVIEW,
    99999,
  );
  const service = createReportHarness({
    stores,
    products,
    campaigns,
    orders: [order1, order2],
    payments: [
      makePayment(
        'payment-1',
        'order-1',
        PAYMENT_STATUS.APPROVED,
      ),
      makePayment(
        'payment-2',
        'order-2',
        PAYMENT_STATUS.PENDING_REVIEW,
      ),
    ],
  });

  const summary = await service.getSummary({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
  });

  assert.equal(summary.totalStores, 1);
  assert.equal(summary.totalProducts, 2);
  assert.deepEqual(summary.campaignsByStatus, {
    [CAMPAIGN_STATUS.OPEN]: 1,
  });
  assert.deepEqual(summary.ordersByStatus, {
    [ORDER_STATUS.PAID]: 1,
  });
  assert.equal(summary.pendingPaymentReviews, 0);
  assert.equal(summary.paidOrderCount, 1);
  assert.equal(summary.paidRevenueSatang, 12345);
});

test('report rejects a campaign/store filter combination that does not match', async () => {
  const service = createReportHarness({
    stores: [
      makeStore('store-1'),
      makeStore('store-2'),
    ],
    campaigns: [
      makeCampaign(
        'campaign-1',
        'store-1',
        CAMPAIGN_STATUS.OPEN,
      ),
    ],
  });

  await assert.rejects(
    service.getSummary({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      storeId: 'store-2',
    }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.httpStatus === 400,
  );
});

test('report aggregation fails closed when any repository record belongs to another tenant', async () => {
  const service = createReportHarness({
    stores: [
      makeStore('store-1', {
        organizationId: 'org-other',
      }),
    ],
    products: [],
    campaigns: [],
    orders: [],
    payments: [],
  });

  await assert.rejects(
    service.getSummary({
      organizationId: 'org-1',
    }),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

function makeAudit(overrides = {}) {
  return {
    PK: 'ORG#org-1',
    SK: 'AUDIT#2026-09-29T12:00:00.000Z#audit-1',
    entityType: 'AuditLog',
    auditId: 'audit-1',
    organizationId: 'org-1',
    actorId: 'admin-1',
    action: AUDIT_ACTION.PAYMENT_APPROVED,
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
    metadata: {
      orderId: 'order-1',
    },
    createdAt: '2026-09-29T12:00:00.000Z',
    ...overrides,
  };
}

test('audit action validator accepts canonical action tokens and rejects unknown actions', () => {
  assert.equal(
    validateAuditQuery({
      action: AUDIT_ACTION.PICKUP_CONFIRMED,
    }).action,
    AUDIT_ACTION.PICKUP_CONFIRMED,
  );

  assert.throws(
    () =>
      validateAuditQuery({
        action: 'SOMETHING_UNDOCUMENTED',
      }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.httpStatus === 400,
  );
});

test('audit repository uses tenant PK, AUDIT sort prefix and documented filters without Scan', async () => {
  let seen;
  const repository = createAuditRepository({
    repository: {
      async query(input) {
        seen = input;
        return page([]);
      },
    },
  });

  await repository.listByOrganizationPage(
    'org-1',
    {
      actorId: 'admin-1',
      action: AUDIT_ACTION.PAYMENT_APPROVED,
      resourceType: 'PAYMENT',
      resourceId: 'payment-1',
    },
  );

  assert.equal(
    seen.ExpressionAttributeValues[':pk'],
    'ORG#org-1',
  );
  assert.equal(
    seen.ExpressionAttributeValues[
      ':auditPrefix'
    ],
    'AUDIT#',
  );
  assert.equal(
    seen.ExpressionAttributeValues[
      ':auditType'
    ],
    'AuditLog',
  );
  assert.equal(
    seen.ExpressionAttributeValues[':actorId'],
    'admin-1',
  );
  assert.equal(
    seen.ExpressionAttributeValues[':action'],
    AUDIT_ACTION.PAYMENT_APPROVED,
  );
  assert.equal(
    seen.ExpressionAttributeValues[
      ':resourceType'
    ],
    'PAYMENT',
  );
  assert.equal(
    seen.ExpressionAttributeValues[
      ':resourceId'
    ],
    'payment-1',
  );
  assert.match(
    seen.FilterExpression,
    /#entityType = :auditType/,
  );
  assert.match(
    seen.FilterExpression,
    /#actorId = :actorId/,
  );
  assert.match(
    seen.FilterExpression,
    /#action = :action/,
  );
  assert.match(
    seen.FilterExpression,
    /#resourceType = :resourceType/,
  );
  assert.match(
    seen.FilterExpression,
    /#resourceId = :resourceId/,
  );
});

test('AuditLogDTO exposes canonical fields only and recursively sanitizes sensitive metadata', () => {
  const audit = makeAudit({
    passwordHash: 'storage-only',
    GSI1PK: 'internal',
    metadata: {
      orderId: 'order-1',
      password: 'secret',
      nested: {
        jwt: 'jwt-secret',
        token: 'pickup-token',
        keep: 'safe',
      },
      list: [
        {
          authorization: 'Bearer secret',
          keep: 'safe-2',
        },
      ],
      slipBinary: Buffer.from('binary'),
    },
  });

  const dto = toAuditLogDto(audit);

  assert.deepEqual(Object.keys(dto), [
    'auditId',
    'organizationId',
    'actorId',
    'action',
    'resourceType',
    'resourceId',
    'metadata',
    'createdAt',
  ]);
  assert.deepEqual(dto.metadata, {
    orderId: 'order-1',
    password: '[REDACTED]',
    nested: {
      jwt: '[REDACTED]',
      token: '[REDACTED]',
      keep: 'safe',
    },
    list: [
      {
        authorization: '[REDACTED]',
        keep: 'safe-2',
      },
    ],
    slipBinary: '[REDACTED]',
  });
  assert.equal(
    Object.hasOwn(dto, 'passwordHash'),
    false,
  );
  assert.equal(
    Object.hasOwn(dto, 'GSI1PK'),
    false,
  );
});

test('audit metadata sanitizer redacts raw binary values even when nested under a non-sensitive key', () => {
  assert.deepEqual(
    sanitizeAuditMetadata({
      attachment: Buffer.from('binary-data'),
      nested: [
        {
          data: Buffer.from('more-binary'),
        },
      ],
    }),
    {
      attachment: '[REDACTED]',
      nested: [
        {
          data: '[REDACTED]',
        },
      ],
    },
  );
});

test('audit service forwards filters, emits scoped cursor and rejects cursor reuse across filters', async () => {
  const calls = [];
  const service = createAuditService({
    auditRepository: {
      async listByOrganizationPage(
        organizationId,
        options,
      ) {
        calls.push({
          organizationId,
          options,
        });

        if (calls.length === 1) {
          return page(
            [makeAudit()],
            {
              PK: 'ORG#org-1',
              SK:
                'AUDIT#2026-09-29T12:00:00.000Z#audit-1',
            },
          );
        }

        return page([]);
      },
    },
  });

  const first = await service.listAuditLogs({
    organizationId: 'org-1',
    actorId: 'admin-1',
    action: AUDIT_ACTION.PAYMENT_APPROVED,
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
  });

  assert.equal(first.items.length, 1);
  assert.equal(
    typeof first.nextCursor,
    'string',
  );

  await assert.rejects(
    service.listAuditLogs({
      organizationId: 'org-1',
      actorId: 'admin-1',
      action: AUDIT_ACTION.PAYMENT_REJECTED,
      resourceType: 'PAYMENT',
      resourceId: 'payment-1',
      cursor: first.nextCursor,
    }),
    (error) =>
      error.code === 'INVALID_CURSOR' &&
      error.httpStatus === 400,
  );

  const second = await service.listAuditLogs({
    organizationId: 'org-1',
    actorId: 'admin-1',
    action: AUDIT_ACTION.PAYMENT_APPROVED,
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
    cursor: first.nextCursor,
  });

  assert.equal(second.items.length, 0);
  assert.deepEqual(
    calls[1].options.exclusiveStartKey,
    {
      PK: 'ORG#org-1',
      SK:
        'AUDIT#2026-09-29T12:00:00.000Z#audit-1',
    },
  );
});

test('audit service fails closed on cross-tenant AuditLog data', async () => {
  const service = createAuditService({
    auditRepository: {
      async listByOrganizationPage() {
        return page([
          makeAudit({
            organizationId: 'org-other',
            PK: 'ORG#org-other',
          }),
        ]);
      },
    },
  });

  await assert.rejects(
    service.listAuditLogs({
      organizationId: 'org-1',
    }),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

function createAdminModuleApp({
  role,
  reports,
  audit,
  userId = 'admin-1',
} = {}) {
  return createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId,
          email: `${userId}@example.com`,
          status: 'ACTIVE',
        };
        next();
      },
      organizationContextMiddleware(req, res, next) {
        req.organization = {
          organizationId:
            req.params.organizationId,
          status: ORGANIZATION_STATUS.ACTIVE,
        };
        next();
      },
      membershipMiddleware(req, res, next) {
        req.membership = {
          organizationId:
            req.params.organizationId,
          userId,
          role,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        next();
      },
      reports: {
        reportService: reports,
      },
      audit: {
        auditService: audit,
      },
    },
  });
}

test('Organization Admin can access report and audit routes with canonical envelopes', async () => {
  let reportInput;
  let auditInput;

  const app = createAdminModuleApp({
    role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    reports: {
      async getSummary(input) {
        reportInput = input;
        return {
          totalStores: 1,
          totalProducts: 2,
          campaignsByStatus: {
            OPEN: 1,
          },
          ordersByStatus: {
            PAID: 3,
          },
          pendingPaymentReviews: 1,
          paidOrderCount: 3,
          paidRevenueSatang: 123456,
        };
      },
    },
    audit: {
      async listAuditLogs(input) {
        auditInput = input;
        return {
          items: [
            toAuditLogDto(makeAudit()),
          ],
          nextCursor: null,
        };
      },
    },
  });

  const reportResponse = await request(app)
    .get(
      '/api/v1/organizations/org-1/reports?campaignId=campaign-1&storeId=store-1',
    )
    .expect(200);

  assert.deepEqual(reportInput, {
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    storeId: 'store-1',
  });
  assert.equal(
    reportResponse.body.data.paidRevenueSatang,
    123456,
  );

  const auditResponse = await request(app)
    .get(
      '/api/v1/organizations/org-1/audit-logs?action=PAYMENT_APPROVED&actorId=admin-1&resourceType=PAYMENT&resourceId=payment-1',
    )
    .expect(200);

  assert.deepEqual(auditInput, {
    organizationId: 'org-1',
    actorId: 'admin-1',
    action: AUDIT_ACTION.PAYMENT_APPROVED,
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
    cursor: undefined,
  });
  assert.equal(
    auditResponse.body.data.items[0].auditId,
    'audit-1',
  );
  assert.equal(
    auditResponse.body.data.nextCursor,
    null,
  );
});

test('STAFF is forbidden from report and audit routes before module services run', async () => {
  let reportCalled = false;
  let auditCalled = false;
  const app = createAdminModuleApp({
    role: ORGANIZATION_ROLE.STAFF,
    userId: 'staff-1',
    reports: {
      async getSummary() {
        reportCalled = true;
        return {};
      },
    },
    audit: {
      async listAuditLogs() {
        auditCalled = true;
        return {
          items: [],
          nextCursor: null,
        };
      },
    },
  });

  const reportResponse = await request(app)
    .get('/api/v1/organizations/org-1/reports')
    .expect(403);
  const auditResponse = await request(app)
    .get('/api/v1/organizations/org-1/audit-logs')
    .expect(403);

  assert.equal(
    reportResponse.body.error.code,
    'ROLE_FORBIDDEN',
  );
  assert.equal(
    auditResponse.body.error.code,
    'ROLE_FORBIDDEN',
  );
  assert.equal(reportCalled, false);
  assert.equal(auditCalled, false);
});
