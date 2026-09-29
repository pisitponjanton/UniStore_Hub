'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
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
  createOrderService,
} = require('../src/modules/orders/order.service');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('../src/modules/products/product.constants');
const {
  validateCreateOrderBody,
  validateQuantity,
} = require('../src/validators/order.validator');
const {
  encodeCursor,
} = require('../src/utils/cursor');

const FIXED_TIME = '2026-09-29T10:45:00.000Z';

function makeCampaign(overrides = {}) {
  return {
    campaignId: 'campaign-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt Pre-order',
    openAt: '2026-09-29T00:00:00.000Z',
    closeAt: '2026-10-10T23:59:59.000Z',
    paymentDeadline: '2026-10-11T23:59:59.000Z',
    pickupAt: '2026-10-25T09:00:00.000Z',
    status: CAMPAIGN_STATUS.OPEN,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeProduct(overrides = {}) {
  return {
    productId: 'product-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt',
    description: 'Pre-order shirt',
    imageKey: null,
    status: PRODUCT_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeVariant(overrides = {}) {
  return {
    variantId: 'variant-1',
    organizationId: 'org-1',
    productId: 'product-1',
    name: 'Size M',
    price: 25000,
    status: VARIANT_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeOrder(overrides = {}) {
  return {
    orderId: 'order-1',
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    customerId: 'customer-1',
    status: ORDER_STATUS.PENDING_PAYMENT,
    subtotal: 50000,
    total: 50000,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeOrderItem(overrides = {}) {
  return {
    orderItemId: 'item-1',
    organizationId: 'org-1',
    orderId: 'order-1',
    productId: 'product-1',
    variantId: 'variant-1',
    productName: 'Faculty Shirt',
    variantName: 'Size M',
    unitPrice: 25000,
    quantity: 2,
    totalPrice: 50000,
    createdAt: FIXED_TIME,
    ...overrides,
  };
}

function makeCampaignLink(overrides = {}) {
  return {
    PK: 'ORG#org-1',
    SK:
      `CAMPAIGN#campaign-1#ORDER#${FIXED_TIME}#order-1`,
    entityType: 'CampaignOrderLink',
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    orderId: 'order-1',
    customerId: 'customer-1',
    status: ORDER_STATUS.PENDING_PAYMENT,
    createdAt: FIXED_TIME,
    ...overrides,
  };
}

function createRepositoryRecorder({ transactError } = {}) {
  const transactions = [];

  return {
    transactions,
    async transactWrite(input) {
      transactions.push(input);

      if (transactError) {
        throw transactError;
      }

      return {};
    },
  };
}

function createIdFactory(ids) {
  let index = 0;

  return () => {
    const value = ids[index];
    index += 1;
    return value;
  };
}

function createCreationHarness(overrides = {}) {
  const repository =
    overrides.repository || createRepositoryRecorder();
  const campaign =
    overrides.campaign || makeCampaign();
  const product =
    overrides.product || makeProduct();
  const variant =
    overrides.variant || makeVariant();

  const service = createOrderService({
    repository,
    campaignRepository: {
      async getById() {
        return campaign;
      },
    },
    productRepository: {
      async getProduct() {
        return product;
      },
      async getVariant() {
        return variant;
      },
    },
    idFactory:
      overrides.idFactory ||
      createIdFactory([
        'order-created',
        'item-created',
        'audit-created',
      ]),
    clock: () => FIXED_TIME,
  });

  return {
    campaign,
    product,
    variant,
    repository,
    service,
  };
}

test('quantity validation accepts only integer values from 1 through 999', () => {
  assert.equal(validateQuantity(1), 1);
  assert.equal(validateQuantity(999), 999);

  for (const invalid of [0, 1000, 1.5, '2', null, undefined]) {
    assert.throws(
      () => validateQuantity(invalid),
      (error) =>
        error.code === 'VALIDATION_ERROR' &&
        error.httpStatus === 400,
    );
  }
});

test('order request validation ignores client price and total authority fields', () => {
  const validated = validateCreateOrderBody({
    campaignId: 'campaign-1',
    subtotal: 1,
    total: 1,
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
        unitPrice: 1,
        totalPrice: 2,
        productName: 'forged',
      },
    ],
  });

  assert.deepEqual(validated, {
    campaignId: 'campaign-1',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
      },
    ],
  });
});

test('order cannot be created when Campaign is not OPEN', async () => {
  const { service, repository } =
    createCreationHarness({
      campaign: makeCampaign({
        status: CAMPAIGN_STATUS.CLOSED,
      }),
    });

  await assert.rejects(
    service.createOrder({
      organizationId: 'org-1',
      customerId: 'customer-1',
      campaignId: 'campaign-1',
      items: [
        {
          productId: 'product-1',
          variantId: 'variant-1',
          quantity: 2,
        },
      ],
    }),
    (error) =>
      error.code === 'CAMPAIGN_NOT_OPEN' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 0);
});

test('order creation rejects Product from another tenant or Campaign Store', async () => {
  for (const product of [
    makeProduct({
      organizationId: 'org-other',
    }),
    makeProduct({
      storeId: 'store-other',
    }),
  ]) {
    const { service, repository } =
      createCreationHarness({ product });

    await assert.rejects(
      service.createOrder({
        organizationId: 'org-1',
        customerId: 'customer-1',
        campaignId: 'campaign-1',
        items: [
          {
            productId: 'product-1',
            variantId: 'variant-1',
            quantity: 2,
          },
        ],
      }),
      (error) => error.code === 'TENANT_MISMATCH',
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('order creation rejects inactive Product and invalid or cross-Product Variant', async () => {
  const cases = [
    {
      product: makeProduct({
        status: PRODUCT_STATUS.INACTIVE,
      }),
      variant: makeVariant(),
      expectedCode: 'PRODUCT_NOT_FOUND',
    },
    {
      product: makeProduct(),
      variant: makeVariant({
        status: VARIANT_STATUS.INACTIVE,
      }),
      expectedCode: 'VARIANT_NOT_FOUND',
    },
    {
      product: makeProduct(),
      variant: makeVariant({
        productId: 'product-other',
      }),
      expectedCode: 'VARIANT_NOT_FOUND',
    },
  ];

  for (const entry of cases) {
    const { service, repository } =
      createCreationHarness(entry);

    await assert.rejects(
      service.createOrder({
        organizationId: 'org-1',
        customerId: 'customer-1',
        campaignId: 'campaign-1',
        items: [
          {
            productId: 'product-1',
            variantId: 'variant-1',
            quantity: 2,
          },
        ],
      }),
      (error) => error.code === entry.expectedCode,
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('order creation uses authoritative Variant price and creates immutable snapshots transactionally', async () => {
  const product = makeProduct({
    name: 'Original Product Name',
  });
  const variant = makeVariant({
    name: 'Original Variant Name',
    price: 25000,
  });
  const repository = createRepositoryRecorder();
  const service = createOrderService({
    repository,
    campaignRepository: {
      async getById() {
        return makeCampaign();
      },
    },
    productRepository: {
      async getProduct() {
        return product;
      },
      async getVariant() {
        return variant;
      },
    },
    idFactory: createIdFactory([
      'order-created',
      'item-created',
      'audit-created',
    ]),
    clock: () => FIXED_TIME,
  });

  const result = await service.createOrder({
    organizationId: 'org-1',
    customerId: 'customer-1',
    campaignId: 'campaign-1',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
        unitPrice: 1,
        totalPrice: 2,
      },
    ],
    subtotal: 1,
    total: 1,
  });

  assert.equal(result.subtotal, 50000);
  assert.equal(result.total, 50000);
  assert.equal(result.status, ORDER_STATUS.PENDING_PAYMENT);
  assert.deepEqual(result.items, [
    {
      orderItemId: 'item-created',
      productId: 'product-1',
      variantId: 'variant-1',
      productName: 'Original Product Name',
      variantName: 'Original Variant Name',
      unitPrice: 25000,
      quantity: 2,
      totalPrice: 50000,
    },
  ]);

  const transaction = repository.transactions[0];
  assert.equal(transaction.TransactItems.length, 5);

  const campaignCheck = transaction.TransactItems[0].ConditionCheck;
  assert.deepEqual(campaignCheck.Key, {
    PK: 'ORG#org-1',
    SK: 'CAMPAIGN#campaign-1',
  });
  assert.equal(
    campaignCheck.ExpressionAttributeValues[':open'],
    CAMPAIGN_STATUS.OPEN,
  );

  const order = transaction.TransactItems[1].Put.Item;
  assert.equal(order.PK, 'ORG#org-1');
  assert.equal(order.SK, 'ORDER#order-created');
  assert.equal(order.GSI1PK, 'USER#customer-1');
  assert.equal(
    order.GSI1SK,
    `ORDER#${FIXED_TIME}#order-created`,
  );
  assert.equal(order.subtotal, 50000);
  assert.equal(order.total, 50000);

  const item = transaction.TransactItems[2].Put.Item;
  assert.equal(
    item.PK,
    'ORG#org-1#ORDER#order-created',
  );
  assert.equal(item.SK, 'ITEM#item-created');
  assert.equal(item.productName, 'Original Product Name');
  assert.equal(item.variantName, 'Original Variant Name');
  assert.equal(item.unitPrice, 25000);
  assert.equal(item.totalPrice, 50000);

  const link = transaction.TransactItems[3].Put.Item;
  assert.equal(link.entityType, 'CampaignOrderLink');
  assert.equal(link.status, ORDER_STATUS.PENDING_PAYMENT);
  assert.equal(link.orderId, 'order-created');

  const audit = transaction.TransactItems[4].Put.Item;
  assert.equal(audit.action, 'ORDER_CREATED');
  assert.equal(audit.actorId, 'customer-1');

  product.name = 'Edited Product';
  variant.name = 'Edited Variant';
  variant.price = 99999;

  assert.equal(result.items[0].productName, 'Original Product Name');
  assert.equal(result.items[0].variantName, 'Original Variant Name');
  assert.equal(result.items[0].unitPrice, 25000);
});

test('multiple Order items calculate subtotal and total using integer satang server-side', async () => {
  const variants = {
    'variant-1': makeVariant({
      variantId: 'variant-1',
      name: 'Size M',
      price: 25000,
    }),
    'variant-2': makeVariant({
      variantId: 'variant-2',
      name: 'Size L',
      price: 30000,
    }),
  };
  const products = {
    'product-1': makeProduct({
      productId: 'product-1',
      name: 'Shirt',
    }),
    'product-2': makeProduct({
      productId: 'product-2',
      name: 'Jacket',
    }),
  };
  const repository = createRepositoryRecorder();
  const service = createOrderService({
    repository,
    campaignRepository: {
      async getById() {
        return makeCampaign();
      },
    },
    productRepository: {
      async getProduct(_organizationId, productId) {
        return products[productId];
      },
      async getVariant(_organizationId, productId, variantId) {
        const variant = variants[variantId];

        return variant
          ? {
              ...variant,
              productId,
            }
          : null;
      },
    },
    idFactory: createIdFactory([
      'order-created',
      'item-1',
      'item-2',
      'audit-created',
    ]),
    clock: () => FIXED_TIME,
  });

  const result = await service.createOrder({
    organizationId: 'org-1',
    customerId: 'customer-1',
    campaignId: 'campaign-1',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
      },
      {
        productId: 'product-2',
        variantId: 'variant-2',
        quantity: 3,
      },
    ],
  });

  assert.equal(result.items[0].totalPrice, 50000);
  assert.equal(result.items[1].totalPrice, 90000);
  assert.equal(result.subtotal, 140000);
  assert.equal(result.total, 140000);
});

test('Campaign OPEN race during order creation aborts transaction with CAMPAIGN_NOT_OPEN', async () => {
  const conflict = new Error('campaign closed');
  conflict.name = 'TransactionCanceledException';
  conflict.CancellationReasons = [
    {
      Code: 'ConditionalCheckFailed',
    },
  ];
  const repository = createRepositoryRecorder({
    transactError: conflict,
  });
  const { service } = createCreationHarness({
    repository,
  });

  await assert.rejects(
    service.createOrder({
      organizationId: 'org-1',
      customerId: 'customer-1',
      campaignId: 'campaign-1',
      items: [
        {
          productId: 'product-1',
          variantId: 'variant-1',
          quantity: 1,
        },
      ],
    }),
    (error) =>
      error.code === 'CAMPAIGN_NOT_OPEN' &&
      error.httpStatus === 409,
  );
});

test('Organization order list forwards status/customer filters and produces scoped cursor', async () => {
  const cursorState = {
    PK: 'ORG#org-1',
    SK: 'ORDER#order-previous',
  };
  const nextState = {
    PK: 'ORG#org-1',
    SK: 'ORDER#order-next',
  };
  const calls = [];
  const service = createOrderService({
    orderRepository: {
      async listByOrganizationPage(
        organizationId,
        options,
      ) {
        calls.push({ organizationId, options });

        return {
          items: [
            makeOrder({
              status: ORDER_STATUS.PENDING_PAYMENT,
            }),
          ],
          lastEvaluatedKey: nextState,
        };
      },
      async listItems() {
        return [makeOrderItem()];
      },
    },
  });

  const scope = [
    'orders',
    'organization',
    'org-1',
    'all-campaigns',
    ORDER_STATUS.PENDING_PAYMENT,
    'customer-1',
  ].join(':');
  const result = await service.listOrganizationOrders({
    organizationId: 'org-1',
    status: ORDER_STATUS.PENDING_PAYMENT,
    customerId: 'customer-1',
    cursor: encodeCursor(scope, cursorState),
  });

  assert.deepEqual(calls, [
    {
      organizationId: 'org-1',
      options: {
        status: ORDER_STATUS.PENDING_PAYMENT,
        customerId: 'customer-1',
        exclusiveStartKey: cursorState,
      },
    },
  ]);
  assert.equal(result.items.length, 1);
  assert.equal(typeof result.nextCursor, 'string');
});

test('Campaign-filtered Organization order list validates CampaignOrderLink against canonical Order', async () => {
  const service = createOrderService({
    orderRepository: {
      async listCampaignLinksPage() {
        return {
          items: [makeCampaignLink()],
          lastEvaluatedKey: null,
        };
      },
      async getById() {
        return makeOrder({
          campaignId: 'campaign-other',
        });
      },
      async listItems() {
        throw new Error('must not load mismatched order items');
      },
    },
  });

  await assert.rejects(
    service.listOrganizationOrders({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
    }),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

test('Organization order cursor cannot be reused across a different filter scope', async () => {
  const service = createOrderService({
    orderRepository: {
      async listByOrganizationPage() {
        throw new Error('must not query with invalid cursor');
      },
    },
  });
  const cursor = encodeCursor(
    'orders:organization:org-1:all-campaigns:PENDING_PAYMENT:all-customers',
    {
      PK: 'ORG#org-1',
      SK: 'ORDER#order-1',
    },
  );

  await assert.rejects(
    service.listOrganizationOrders({
      organizationId: 'org-1',
      status: ORDER_STATUS.PAID,
      cursor,
    }),
    (error) =>
      error.code === 'INVALID_CURSOR' &&
      error.httpStatus === 400,
  );
});

test('Customer own-order list enforces stored ownership and uses user GSI results', async () => {
  const service = createOrderService({
    orderRepository: {
      async listByCustomerPage(customerId) {
        assert.equal(customerId, 'customer-1');

        return {
          items: [
            makeOrder({
              customerId: 'customer-1',
            }),
          ],
          lastEvaluatedKey: null,
        };
      },
      async listItems() {
        return [makeOrderItem()];
      },
    },
  });

  const result = await service.listOwnOrders({
    customerId: 'customer-1',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].customerId, 'customer-1');
});

test('Customer own-order access fails closed if repository returns another Customer Order', async () => {
  const service = createOrderService({
    orderRepository: {
      async findOwnedById() {
        return makeOrder({
          customerId: 'customer-other',
        });
      },
    },
  });

  await assert.rejects(
    service.getOwnOrder({
      customerId: 'customer-1',
      orderId: 'order-1',
    }),
    (error) =>
      error.code === 'RESOURCE_OWNERSHIP_REQUIRED' &&
      error.httpStatus === 403,
  );
});

test('Customer cancellation updates Order, CampaignOrderLink and ORDER_CANCELLED Audit atomically', async () => {
  const repository = createRepositoryRecorder();
  const service = createOrderService({
    repository,
    orderRepository: {
      async findOwnedById(customerId, orderId) {
        assert.equal(customerId, 'customer-1');
        assert.equal(orderId, 'order-1');
        return makeOrder({
          status: ORDER_STATUS.PAYMENT_REJECTED,
        });
      },
      async listItems() {
        return [makeOrderItem()];
      },
    },
    organizationRepository: {
      async getById() {
        return {
          organizationId: 'org-1',
          status: ORGANIZATION_STATUS.ACTIVE,
        };
      },
    },
    idFactory: createIdFactory(['audit-cancel']),
    clock: () => FIXED_TIME,
  });

  const result = await service.cancelOwnOrder({
    customerId: 'customer-1',
    orderId: 'order-1',
  });

  assert.equal(result.status, ORDER_STATUS.CANCELLED);
  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 3);

  const orderUpdate = items[0].Update;
  assert.deepEqual(orderUpdate.Key, {
    PK: 'ORG#org-1',
    SK: 'ORDER#order-1',
  });
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':fromStatus'],
    ORDER_STATUS.PAYMENT_REJECTED,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':cancelled'],
    ORDER_STATUS.CANCELLED,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':customerId'],
    'customer-1',
  );

  const linkUpdate = items[1].Update;
  assert.equal(
    linkUpdate.Key.SK,
    `CAMPAIGN#campaign-1#ORDER#${FIXED_TIME}#order-1`,
  );
  assert.equal(
    linkUpdate.ExpressionAttributeValues[':cancelled'],
    ORDER_STATUS.CANCELLED,
  );

  const audit = items[2].Put.Item;
  assert.equal(audit.action, 'ORDER_CANCELLED');
  assert.equal(audit.actorId, 'customer-1');
  assert.equal(audit.resourceId, 'order-1');
});

test('Order cancellation rejects PAYMENT_REVIEW and all paid-or-later states without writes', async () => {
  const blocked = [
    ORDER_STATUS.PAYMENT_REVIEW,
    ORDER_STATUS.PAID,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.IN_PRODUCTION,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.RECEIVED,
    ORDER_STATUS.CANCELLED,
  ];

  for (const status of blocked) {
    const repository = createRepositoryRecorder();
    const service = createOrderService({
      repository,
      orderRepository: {
        async getById() {
          return makeOrder({ status });
        },
      },
    });

    await assert.rejects(
      service.cancelOrganizationOrder({
        organizationId: 'org-1',
        orderId: 'order-1',
        actorId: 'admin-1',
      }),
      (error) =>
        error.code === 'INVALID_STATUS_TRANSITION' &&
        error.httpStatus === 409,
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('conditional cancellation race is normalized to INVALID_STATUS_TRANSITION', async () => {
  const conflict = new Error('order changed');
  conflict.name = 'TransactionCanceledException';
  conflict.CancellationReasons = [
    {
      Code: 'ConditionalCheckFailed',
    },
  ];
  const repository = createRepositoryRecorder({
    transactError: conflict,
  });
  const service = createOrderService({
    repository,
    orderRepository: {
      async getById() {
        return makeOrder();
      },
    },
    organizationRepository: {
      async getById() {
        return {
          organizationId: 'org-1',
          status: ORGANIZATION_STATUS.ACTIVE,
        };
      },
    },
    idFactory: createIdFactory(['audit-cancel']),
    clock: () => FIXED_TIME,
  });

  await assert.rejects(
    service.cancelOrganizationOrder({
      organizationId: 'org-1',
      orderId: 'order-1',
      actorId: 'admin-1',
    }),
    (error) =>
      error.code === 'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 1);
});

test('Customer may create Order without Organization membership', async () => {
  let membershipCalls = 0;
  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'customer-1',
          email: 'customer@example.com',
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
        membershipCalls += 1;
        next(new Error('must not require membership for create'));
      },
      orders: {
        orderService: {
          async createOrder(input) {
            assert.equal(input.customerId, 'customer-1');
            assert.equal(input.organizationId, 'org-1');

            return {
              ...makeOrder(),
              items: [makeOrderItem()],
            };
          },
        },
      },
    },
  });

  const response = await request(app)
    .post('/api/v1/organizations/org-1/orders')
    .send({
      campaignId: 'campaign-1',
      items: [
        {
          productId: 'product-1',
          variantId: 'variant-1',
          quantity: 2,
        },
      ],
    })
    .expect(201);

  assert.equal(response.body.success, true);
  assert.equal(membershipCalls, 0);
});

test('Organization STAFF can list/detail Orders but cannot use general cancellation', async () => {
  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'staff-1',
          email: 'staff@example.com',
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
        req.membership = {
          organizationId: req.params.organizationId,
          userId: 'staff-1',
          role: ORGANIZATION_ROLE.STAFF,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        next();
      },
      orders: {
        orderService: {
          async listOrganizationOrders() {
            return {
              items: [],
              nextCursor: null,
            };
          },
          async getOrganizationOrder() {
            return {
              ...makeOrder(),
              items: [],
            };
          },
          async cancelOrganizationOrder() {
            throw new Error('must not reach cancel service');
          },
        },
      },
    },
  });

  await request(app)
    .get('/api/v1/organizations/org-1/orders')
    .expect(200);

  await request(app)
    .get('/api/v1/organizations/org-1/orders/order-1')
    .expect(200);

  const cancelResponse = await request(app)
    .post('/api/v1/organizations/org-1/orders/order-1/cancel')
    .expect(403);

  assert.equal(
    cancelResponse.body.error.code,
    'ROLE_FORBIDDEN',
  );
});

test('Organization Admin can use tenant Order cancellation route', async () => {
  let cancelledBy;
  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'admin-1',
          email: 'admin@example.com',
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
        req.membership = {
          organizationId: req.params.organizationId,
          userId: 'admin-1',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        next();
      },
      orders: {
        orderService: {
          async cancelOrganizationOrder(input) {
            cancelledBy = input.actorId;

            return {
              ...makeOrder({
                status: ORDER_STATUS.CANCELLED,
              }),
              items: [],
            };
          },
        },
      },
    },
  });

  const response = await request(app)
    .post('/api/v1/organizations/org-1/orders/order-1/cancel')
    .expect(200);

  assert.equal(cancelledBy, 'admin-1');
  assert.equal(
    response.body.data.status,
    ORDER_STATUS.CANCELLED,
  );
});

test('current-user own Order endpoints require authentication and pass authoritative userId', async () => {
  let seenCustomerId;
  const authMiddleware = (req, res, next) => {
    req.user = {
      userId: 'customer-1',
      email: 'customer@example.com',
      status: 'ACTIVE',
    };
    next();
  };

  const app = createApp({
    users: {
      authMiddleware,
      orders: {
        orderService: {
          async listOwnOrders({ customerId }) {
            seenCustomerId = customerId;

            return {
              items: [],
              nextCursor: null,
            };
          },
          async getOwnOrder({ customerId }) {
            seenCustomerId = customerId;

            return {
              ...makeOrder(),
              items: [],
            };
          },
          async cancelOwnOrder({ customerId }) {
            seenCustomerId = customerId;

            return {
              ...makeOrder({
                status: ORDER_STATUS.CANCELLED,
              }),
              items: [],
            };
          },
        },
      },
    },
  });

  await request(app)
    .get('/api/v1/me/orders')
    .expect(200);
  assert.equal(seenCustomerId, 'customer-1');

  await request(app)
    .get('/api/v1/me/orders/order-1')
    .expect(200);
  assert.equal(seenCustomerId, 'customer-1');

  await request(app)
    .post('/api/v1/me/orders/order-1/cancel')
    .expect(200);
  assert.equal(seenCustomerId, 'customer-1');
});
