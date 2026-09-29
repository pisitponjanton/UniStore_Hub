'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const { AppError } = require('../src/errors/app-error');
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
  PAYMENT_STATUS,
} = require('../src/modules/payments/payment.constants');
const {
  createProductionService,
} = require('../src/modules/production/production.service');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  validateProductionQuery,
} = require('../src/validators/production.validator');

function makeCampaign(overrides = {}) {
  return {
    campaignId: 'campaign-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt Pre-order',
    status: CAMPAIGN_STATUS.CLOSED,
    ...overrides,
  };
}

function makeLink(orderId, status, overrides = {}) {
  const createdAt =
    overrides.createdAt ||
    `2026-09-29T10:00:0${overrides.sequence || 0}.000Z`;

  return {
    PK: 'ORG#org-1',
    SK:
      `CAMPAIGN#campaign-1#ORDER#${createdAt}#${orderId}`,
    entityType: 'CampaignOrderLink',
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    orderId,
    customerId: `customer-${orderId}`,
    status,
    createdAt,
    ...overrides,
  };
}

function makeOrder(orderId, status, overrides = {}) {
  return {
    orderId,
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    customerId: `customer-${orderId}`,
    status,
    subtotal: 10000,
    total: 10000,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

function makePayment(order, status, overrides = {}) {
  return {
    paymentId: `payment-${order.orderId}`,
    organizationId: order.organizationId,
    orderId: order.orderId,
    customerId: order.customerId,
    slipKey:
      `payments/${order.organizationId}/${order.orderId}/11111111-1111-4111-8111-111111111111`,
    status,
    rejectReason: null,
    reviewedBy: 'staff-1',
    reviewedAt: '2026-09-29T10:30:00.000Z',
    createdAt: '2026-09-29T10:15:00.000Z',
    updatedAt: '2026-09-29T10:30:00.000Z',
    ...overrides,
  };
}

function makeItem(order, {
  orderItemId,
  productId,
  productName,
  variantId,
  variantName,
  quantity,
}) {
  return {
    orderItemId,
    organizationId: order.organizationId,
    orderId: order.orderId,
    productId,
    variantId,
    productName,
    variantName,
    unitPrice: 10000,
    quantity,
    totalPrice: 10000 * quantity,
    createdAt: order.createdAt,
  };
}

function createProductionHarness({
  campaign = makeCampaign(),
  links,
  orders,
  payments,
  items,
} = {}) {
  const calls = {
    listCampaignLinks: [],
    getOrder: [],
    getPayment: [],
    listItems: [],
  };

  const service = createProductionService({
    campaignRepository: {
      async getById(organizationId, campaignId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(campaignId, 'campaign-1');
        return campaign;
      },
    },
    orderRepository: {
      async listCampaignLinks(
        organizationId,
        campaignId,
      ) {
        calls.listCampaignLinks.push({
          organizationId,
          campaignId,
        });
        return links;
      },

      async getById(organizationId, orderId) {
        calls.getOrder.push({
          organizationId,
          orderId,
        });
        return orders[orderId] || null;
      },

      async listItems(organizationId, orderId) {
        calls.listItems.push({
          organizationId,
          orderId,
        });
        return items[orderId] || [];
      },
    },
    paymentRepository: {
      async getByOrder(organizationId, orderId) {
        calls.getPayment.push({
          organizationId,
          orderId,
        });
        return payments[orderId] || null;
      },
    },
  });

  return {
    calls,
    service,
  };
}

test('production query requires campaignId', () => {
  assert.deepEqual(
    validateProductionQuery({
      campaignId: ' campaign-1 ',
    }),
    {
      campaignId: 'campaign-1',
    },
  );

  for (const query of [
    {},
    { campaignId: '' },
    { campaignId: '   ' },
    { campaignId: null },
  ]) {
    assert.throws(
      () => validateProductionQuery(query),
      (error) =>
        error.code === 'VALIDATION_ERROR' &&
        error.httpStatus === 400,
    );
  }
});

test('Production Summary includes APPROVED payments for every paid lifecycle Order status', async () => {
  const statuses = [
    ORDER_STATUS.PAID,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.IN_PRODUCTION,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.RECEIVED,
  ];
  const links = [];
  const orders = {};
  const payments = {};
  const items = {};

  statuses.forEach((status, index) => {
    const orderId = `order-${index + 1}`;
    const order = makeOrder(orderId, status);
    links.push(
      makeLink(orderId, status, {
        sequence: index + 1,
      }),
    );
    orders[orderId] = order;
    payments[orderId] = makePayment(
      order,
      PAYMENT_STATUS.APPROVED,
    );
    items[orderId] = [
      makeItem(order, {
        orderItemId: `item-${index + 1}`,
        productId: 'product-1',
        productName: 'Faculty Shirt',
        variantId: 'variant-m',
        variantName: 'Size M',
        quantity: 1,
      }),
    ];
  });

  const { service } = createProductionHarness({
    links,
    orders,
    payments,
    items,
  });

  const summary = await service.getSummary({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
  });

  assert.deepEqual(summary, {
    campaignId: 'campaign-1',
    products: [
      {
        productId: 'product-1',
        productName: 'Faculty Shirt',
        variants: [
          {
            variantId: 'variant-m',
            variantName: 'Size M',
            quantity: 5,
          },
        ],
      },
    ],
  });
});

test('late approval after Campaign close contributes through CONFIRMED Order status', async () => {
  const order = makeOrder(
    'order-closed-approval',
    ORDER_STATUS.CONFIRMED,
  );
  const { service } = createProductionHarness({
    campaign: makeCampaign({
      status: CAMPAIGN_STATUS.CLOSED,
    }),
    links: [
      makeLink(
        order.orderId,
        ORDER_STATUS.CONFIRMED,
      ),
    ],
    orders: {
      [order.orderId]: order,
    },
    payments: {
      [order.orderId]: makePayment(
        order,
        PAYMENT_STATUS.APPROVED,
      ),
    },
    items: {
      [order.orderId]: [
        makeItem(order, {
          orderItemId: 'item-closed',
          productId: 'product-1',
          productName: 'Faculty Shirt',
          variantId: 'variant-l',
          variantName: 'Size L',
          quantity: 3,
        }),
      ],
    },
  });

  const summary = await service.getSummary({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
  });

  assert.equal(
    summary.products[0].variants[0].quantity,
    3,
  );
});

test('Production Summary excludes unpaid, rejected-payment and cancelled Orders', async () => {
  const excluded = [
    {
      orderId: 'pending',
      orderStatus: ORDER_STATUS.PENDING_PAYMENT,
      paymentStatus: null,
    },
    {
      orderId: 'review',
      orderStatus: ORDER_STATUS.PAYMENT_REVIEW,
      paymentStatus: PAYMENT_STATUS.PENDING_REVIEW,
    },
    {
      orderId: 'rejected-order',
      orderStatus: ORDER_STATUS.PAYMENT_REJECTED,
      paymentStatus: PAYMENT_STATUS.REJECTED,
    },
    {
      orderId: 'cancelled',
      orderStatus: ORDER_STATUS.CANCELLED,
      paymentStatus: PAYMENT_STATUS.APPROVED,
    },
    {
      orderId: 'paid-rejected-payment',
      orderStatus: ORDER_STATUS.PAID,
      paymentStatus: PAYMENT_STATUS.REJECTED,
    },
  ];
  const links = [];
  const orders = {};
  const payments = {};
  const items = {};

  for (const entry of excluded) {
    const order = makeOrder(
      entry.orderId,
      entry.orderStatus,
    );
    links.push(
      makeLink(
        entry.orderId,
        entry.orderStatus,
      ),
    );
    orders[entry.orderId] = order;

    if (entry.paymentStatus) {
      payments[entry.orderId] = makePayment(
        order,
        entry.paymentStatus,
      );
    }

    items[entry.orderId] = [
      makeItem(order, {
        orderItemId: `item-${entry.orderId}`,
        productId: 'product-1',
        productName: 'Faculty Shirt',
        variantId: 'variant-m',
        variantName: 'Size M',
        quantity: 99,
      }),
    ];
  }

  const { service, calls } =
    createProductionHarness({
      links,
      orders,
      payments,
      items,
    });

  const summary = await service.getSummary({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
  });

  assert.deepEqual(summary, {
    campaignId: 'campaign-1',
    products: [],
  });

  assert.deepEqual(
    calls.listItems,
    [],
  );
  assert.deepEqual(
    calls.getPayment.map((call) => call.orderId),
    ['paid-rejected-payment'],
  );
});

test('Production Summary groups quantities by Product and Variant using OrderItem snapshots', async () => {
  const orderA = makeOrder(
    'order-a',
    ORDER_STATUS.PAID,
  );
  const orderB = makeOrder(
    'order-b',
    ORDER_STATUS.IN_PRODUCTION,
  );

  const { service } = createProductionHarness({
    links: [
      makeLink(
        orderA.orderId,
        orderA.status,
      ),
      makeLink(
        orderB.orderId,
        orderB.status,
      ),
    ],
    orders: {
      [orderA.orderId]: orderA,
      [orderB.orderId]: orderB,
    },
    payments: {
      [orderA.orderId]: makePayment(
        orderA,
        PAYMENT_STATUS.APPROVED,
      ),
      [orderB.orderId]: makePayment(
        orderB,
        PAYMENT_STATUS.APPROVED,
      ),
    },
    items: {
      [orderA.orderId]: [
        makeItem(orderA, {
          orderItemId: 'item-a1',
          productId: 'product-shirt',
          productName: 'Faculty Shirt Snapshot',
          variantId: 'variant-m',
          variantName: 'Size M Snapshot',
          quantity: 2,
        }),
        makeItem(orderA, {
          orderItemId: 'item-a2',
          productId: 'product-shirt',
          productName: 'Faculty Shirt Snapshot',
          variantId: 'variant-l',
          variantName: 'Size L Snapshot',
          quantity: 1,
        }),
      ],
      [orderB.orderId]: [
        makeItem(orderB, {
          orderItemId: 'item-b1',
          productId: 'product-shirt',
          productName: 'Faculty Shirt Snapshot',
          variantId: 'variant-m',
          variantName: 'Size M Snapshot',
          quantity: 4,
        }),
        makeItem(orderB, {
          orderItemId: 'item-b2',
          productId: 'product-bag',
          productName: 'Faculty Bag Snapshot',
          variantId: 'variant-black',
          variantName: 'Black Snapshot',
          quantity: 3,
        }),
      ],
    },
  });

  const summary = await service.getSummary({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
  });

  assert.deepEqual(summary, {
    campaignId: 'campaign-1',
    products: [
      {
        productId: 'product-bag',
        productName: 'Faculty Bag Snapshot',
        variants: [
          {
            variantId: 'variant-black',
            variantName: 'Black Snapshot',
            quantity: 3,
          },
        ],
      },
      {
        productId: 'product-shirt',
        productName: 'Faculty Shirt Snapshot',
        variants: [
          {
            variantId: 'variant-l',
            variantName: 'Size L Snapshot',
            quantity: 1,
          },
          {
            variantId: 'variant-m',
            variantName: 'Size M Snapshot',
            quantity: 6,
          },
        ],
      },
    ],
  });
});

test('Production Summary rejects cross-tenant CampaignOrderLink, Order, Payment and OrderItem records', async () => {
  const baseOrder = makeOrder(
    'order-1',
    ORDER_STATUS.PAID,
  );
  const cases = [
    {
      links: [
        makeLink('order-1', ORDER_STATUS.PAID, {
          organizationId: 'org-other',
        }),
      ],
      orders: {
        'order-1': baseOrder,
      },
      payments: {},
      items: {},
    },
    {
      links: [
        makeLink('order-1', ORDER_STATUS.PAID),
      ],
      orders: {
        'order-1': makeOrder(
          'order-1',
          ORDER_STATUS.PAID,
          {
            organizationId: 'org-other',
          },
        ),
      },
      payments: {},
      items: {},
    },
    {
      links: [
        makeLink('order-1', ORDER_STATUS.PAID),
      ],
      orders: {
        'order-1': baseOrder,
      },
      payments: {
        'order-1': makePayment(
          baseOrder,
          PAYMENT_STATUS.APPROVED,
          {
            organizationId: 'org-other',
          },
        ),
      },
      items: {},
    },
    {
      links: [
        makeLink('order-1', ORDER_STATUS.PAID),
      ],
      orders: {
        'order-1': baseOrder,
      },
      payments: {
        'order-1': makePayment(
          baseOrder,
          PAYMENT_STATUS.APPROVED,
        ),
      },
      items: {
        'order-1': [
          {
            ...makeItem(baseOrder, {
              orderItemId: 'item-1',
              productId: 'product-1',
              productName: 'Faculty Shirt',
              variantId: 'variant-m',
              variantName: 'Size M',
              quantity: 1,
            }),
            organizationId: 'org-other',
          },
        ],
      },
    },
  ];

  for (const entry of cases) {
    const { service } =
      createProductionHarness(entry);

    await assert.rejects(
      service.getSummary({
        organizationId: 'org-1',
        campaignId: 'campaign-1',
      }),
      (error) =>
        error.code === 'TENANT_MISMATCH' &&
        error.httpStatus === 403,
    );
  }
});

test('Production Summary rejects CampaignOrderLink from another Campaign', async () => {
  const order = makeOrder(
    'order-1',
    ORDER_STATUS.PAID,
  );
  const { service } = createProductionHarness({
    links: [
      makeLink(
        'order-1',
        ORDER_STATUS.PAID,
        {
          campaignId: 'campaign-other',
        },
      ),
    ],
    orders: {
      'order-1': order,
    },
    payments: {
      'order-1': makePayment(
        order,
        PAYMENT_STATUS.APPROVED,
      ),
    },
    items: {},
  });

  await assert.rejects(
    service.getSummary({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
    }),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

function createProductionRouteApp({
  role,
  productionService,
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
          organizationId: req.params.organizationId,
          status: ORGANIZATION_STATUS.ACTIVE,
        };
        next();
      },
      membershipMiddleware(req, res, next) {
        if (!role) {
          return next(
            new AppError({
              code: 'MEMBERSHIP_REQUIRED',
              message: 'Active membership required',
              httpStatus: 403,
            }),
          );
        }

        req.membership = {
          organizationId: req.params.organizationId,
          userId,
          role,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        return next();
      },
      production: {
        productionService,
      },
    },
  });
}

test('Organization Admin can access Production Summary with canonical response envelope', async () => {
  let seen;
  const app = createProductionRouteApp({
    role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    productionService: {
      async getSummary(input) {
        seen = input;
        return {
          campaignId: input.campaignId,
          products: [],
        };
      },
    },
  });

  const response = await request(app)
    .get(
      '/api/v1/organizations/org-1/production?campaignId=campaign-1',
    )
    .expect(200);

  assert.deepEqual(seen, {
    organizationId: 'org-1',
    campaignId: 'campaign-1',
  });
  assert.deepEqual(response.body, {
    success: true,
    data: {
      campaignId: 'campaign-1',
      products: [],
    },
  });
});

test('STAFF is forbidden from Production Summary and service is not called', async () => {
  let called = false;
  const app = createProductionRouteApp({
    role: ORGANIZATION_ROLE.STAFF,
    userId: 'staff-1',
    productionService: {
      async getSummary() {
        called = true;
        return {
          campaignId: 'campaign-1',
          products: [],
        };
      },
    },
  });

  const response = await request(app)
    .get(
      '/api/v1/organizations/org-1/production?campaignId=campaign-1',
    )
    .expect(403);

  assert.equal(
    response.body.error.code,
    'ROLE_FORBIDDEN',
  );
  assert.equal(called, false);
});

test('Production Summary endpoint rejects missing campaignId before service call', async () => {
  let called = false;
  const app = createProductionRouteApp({
    role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    productionService: {
      async getSummary() {
        called = true;
        return {
          campaignId: 'campaign-1',
          products: [],
        };
      },
    },
  });

  const response = await request(app)
    .get('/api/v1/organizations/org-1/production')
    .expect(400);

  assert.equal(
    response.body.error.code,
    'VALIDATION_ERROR',
  );
  assert.equal(called, false);
});
