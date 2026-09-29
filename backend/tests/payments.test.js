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
  createPaymentService,
} = require('../src/modules/payments/payment.service');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  validateRejectPaymentBody,
} = require('../src/validators/payment.validator');

const FIXED_TIME = '2026-09-29T11:30:00.000Z';
const SLIP_KEY =
  'payments/org-1/order-1/11111111-1111-4111-8111-111111111111';
const REPLACEMENT_SLIP_KEY =
  'payments/org-1/order-1/22222222-2222-4222-8222-222222222222';

function makeOrder(overrides = {}) {
  return {
    orderId: 'order-1',
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    customerId: 'customer-1',
    status: ORDER_STATUS.PAYMENT_REVIEW,
    subtotal: 50000,
    total: 50000,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

function makeCampaign(overrides = {}) {
  return {
    campaignId: 'campaign-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt Pre-order',
    status: CAMPAIGN_STATUS.OPEN,
    openAt: '2026-09-20T00:00:00.000Z',
    closeAt: '2026-10-10T00:00:00.000Z',
    paymentDeadline: '2026-10-11T00:00:00.000Z',
    pickupAt: '2026-10-25T00:00:00.000Z',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    paymentId: 'payment-1',
    organizationId: 'org-1',
    orderId: 'order-1',
    customerId: 'customer-1',
    slipKey: SLIP_KEY,
    status: PAYMENT_STATUS.PENDING_REVIEW,
    rejectReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-09-29T10:15:00.000Z',
    updatedAt: '2026-09-29T10:15:00.000Z',
    ...overrides,
  };
}

function createIdFactory(values) {
  let index = 0;

  return () => {
    const value = values[index];

    if (value === undefined) {
      throw new Error('Unexpected idFactory call');
    }

    index += 1;
    return value;
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

function createPaymentHarness({
  order = makeOrder(),
  campaign = makeCampaign(),
  payment = makePayment(),
  existingPayment,
  repository = createRepositoryRecorder(),
  sqsAdapter,
  logger,
  validatePaymentSlipObject,
  ids = ['audit-1', 'event-1'],
} = {}) {
  const sentEvents = [];
  const warnings = [];
  const adapter =
    sqsAdapter || {
      async sendJson(event) {
        sentEvents.push(event);
      },
    };
  const testLogger =
    logger || {
      warn(message, context) {
        warnings.push({
          message,
          context,
        });
      },
    };

  const service = createPaymentService({
    repository,
    orderRepository: {
      async getById(organizationId, orderId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(orderId, 'order-1');
        return order;
      },
    },
    campaignRepository: {
      async getById(organizationId, campaignId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(campaignId, 'campaign-1');
        return campaign;
      },
    },
    paymentRepository: {
      async getByOrder() {
        return existingPayment === undefined
          ? payment
          : existingPayment;
      },
      async findById(organizationId, paymentId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(paymentId, 'payment-1');
        return payment;
      },
      async listByOrganizationPage() {
        return {
          items: [payment],
          lastEvaluatedKey: null,
        };
      },
    },
    validatePaymentSlipObject:
      validatePaymentSlipObject ||
      (async () => ({
        contentType: 'image/png',
        contentLength: 1024,
      })),
    sqsAdapter: adapter,
    logger: testLogger,
    idFactory: createIdFactory(ids),
    clock: () => FIXED_TIME,
  });

  return {
    repository,
    sentEvents,
    service,
    warnings,
  };
}

function getTransactionItem(transaction, predicate) {
  return transaction.TransactItems.find(predicate);
}

test('first payment submission validates slip, writes one logical Payment and synchronizes Order projection', async () => {
  const order = makeOrder({
    status: ORDER_STATUS.PENDING_PAYMENT,
  });
  const repository = createRepositoryRecorder();
  const validated = [];
  const harness = createPaymentHarness({
    order,
    existingPayment: null,
    repository,
    ids: ['payment-new', 'audit-submit'],
    validatePaymentSlipObject: async (input) => {
      validated.push(input);
      return {
        contentType: 'image/png',
        contentLength: 512,
      };
    },
  });

  const result = await harness.service.submitPayment({
    organizationId: 'org-1',
    orderId: 'order-1',
    customerId: 'customer-1',
    slipKey: SLIP_KEY,
  });

  assert.deepEqual(validated, [
    {
      organizationId: 'org-1',
      orderId: 'order-1',
      slipKey: SLIP_KEY,
    },
  ]);
  assert.equal(result.paymentId, 'payment-new');
  assert.equal(result.status, PAYMENT_STATUS.PENDING_REVIEW);
  assert.equal(result.slipKey, SLIP_KEY);
  assert.equal(repository.transactions.length, 1);

  const transaction = repository.transactions[0];
  assert.equal(transaction.TransactItems.length, 5);

  const paymentPut = getTransactionItem(
    transaction,
    (item) => item.Put?.Item?.entityType === 'Payment',
  ).Put.Item;
  assert.equal(
    paymentPut.PK,
    'ORG#org-1#ORDER#order-1',
  );
  assert.equal(paymentPut.SK, 'PAYMENT#payment-new');
  assert.equal(paymentPut.GSI1PK, 'ORG#org-1');
  assert.equal(
    paymentPut.GSI1SK,
    `PAYMENT#PENDING_REVIEW#${FIXED_TIME}#payment-new`,
  );

  const orderUpdate = getTransactionItem(
    transaction,
    (item) => item.Update?.Key?.SK === 'ORDER#order-1',
  ).Update;
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':expectedStatus'
    ],
    ORDER_STATUS.PENDING_PAYMENT,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':paymentReview'
    ],
    ORDER_STATUS.PAYMENT_REVIEW,
  );

  const linkUpdate = getTransactionItem(
    transaction,
    (item) =>
      item.Update?.Key?.SK?.startsWith(
        'CAMPAIGN#campaign-1#ORDER#',
      ),
  ).Update;
  assert.equal(
    linkUpdate.ExpressionAttributeValues[
      ':paymentReview'
    ],
    ORDER_STATUS.PAYMENT_REVIEW,
  );

  const audit = getTransactionItem(
    transaction,
    (item) => item.Put?.Item?.action === 'PAYMENT_SUBMITTED',
  ).Put.Item;
  assert.equal(audit.actorId, 'customer-1');
  assert.equal(audit.resourceId, 'payment-new');
  assert.equal(audit.metadata.resubmission, false);
  assert.equal(harness.sentEvents.length, 0);
});

test('rejected Payment resubmission reuses paymentId, replaces slip and clears prior review fields', async () => {
  const order = makeOrder({
    status: ORDER_STATUS.PAYMENT_REJECTED,
  });
  const payment = makePayment({
    status: PAYMENT_STATUS.REJECTED,
    rejectReason: 'Amount mismatch',
    reviewedBy: 'staff-old',
    reviewedAt: '2026-09-29T10:20:00.000Z',
  });
  const repository = createRepositoryRecorder();
  const harness = createPaymentHarness({
    order,
    payment,
    existingPayment: payment,
    repository,
    ids: ['audit-resubmit'],
  });

  const result = await harness.service.submitPayment({
    organizationId: 'org-1',
    orderId: 'order-1',
    customerId: 'customer-1',
    slipKey: REPLACEMENT_SLIP_KEY,
  });

  assert.equal(result.paymentId, 'payment-1');
  assert.equal(result.slipKey, REPLACEMENT_SLIP_KEY);
  assert.equal(result.status, PAYMENT_STATUS.PENDING_REVIEW);
  assert.equal(result.rejectReason, null);
  assert.equal(result.reviewedBy, null);
  assert.equal(result.reviewedAt, null);

  const transaction = repository.transactions[0];
  const paymentUpdate = getTransactionItem(
    transaction,
    (item) =>
      item.Update?.Key?.SK === 'PAYMENT#payment-1',
  ).Update;

  assert.match(
    paymentUpdate.UpdateExpression,
    /REMOVE #rejectReason, #reviewedBy, #reviewedAt/,
  );
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':rejected'
    ],
    PAYMENT_STATUS.REJECTED,
  );
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':pendingReview'
    ],
    PAYMENT_STATUS.PENDING_REVIEW,
  );
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':slipKey'
    ],
    REPLACEMENT_SLIP_KEY,
  );

  const orderUpdate = getTransactionItem(
    transaction,
    (item) => item.Update?.Key?.SK === 'ORDER#order-1',
  ).Update;
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':expectedStatus'
    ],
    ORDER_STATUS.PAYMENT_REJECTED,
  );
});

test('payment submit and resubmit are blocked once Campaign is PRODUCING or later', async () => {
  for (const campaignStatus of [
    CAMPAIGN_STATUS.PRODUCING,
    CAMPAIGN_STATUS.READY_FOR_PICKUP,
    CAMPAIGN_STATUS.COMPLETED,
  ]) {
    for (const setup of [
      {
        order: makeOrder({
          status: ORDER_STATUS.PENDING_PAYMENT,
        }),
        payment: null,
      },
      {
        order: makeOrder({
          status: ORDER_STATUS.PAYMENT_REJECTED,
        }),
        payment: makePayment({
          status: PAYMENT_STATUS.REJECTED,
        }),
      },
    ]) {
      const repository = createRepositoryRecorder();
      const harness = createPaymentHarness({
        order: setup.order,
        campaign: makeCampaign({
          status: campaignStatus,
        }),
        existingPayment: setup.payment,
        repository,
        ids: ['unused-id'],
      });

      await assert.rejects(
        harness.service.submitPayment({
          organizationId: 'org-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          slipKey: SLIP_KEY,
        }),
        (error) =>
          error.code === 'PAYMENT_NOT_REVIEWABLE' &&
          error.httpStatus === 409,
      );

      assert.equal(repository.transactions.length, 0);
    }
  }
});

test('approved or paid-or-later Order cannot submit another slip', async () => {
  for (const orderStatus of [
    ORDER_STATUS.PAID,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.IN_PRODUCTION,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.RECEIVED,
  ]) {
    const repository = createRepositoryRecorder();
    const harness = createPaymentHarness({
      order: makeOrder({
        status: orderStatus,
      }),
      payment: makePayment({
        status: PAYMENT_STATUS.APPROVED,
      }),
      existingPayment: makePayment({
        status: PAYMENT_STATUS.APPROVED,
      }),
      repository,
      ids: ['unused-id'],
    });

    await assert.rejects(
      harness.service.submitPayment({
        organizationId: 'org-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        slipKey: SLIP_KEY,
      }),
      (error) =>
        error.code === 'INVALID_STATUS_TRANSITION' &&
        error.httpStatus === 409,
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('arbitrary slipKey rejection stops payment submission before transaction', async () => {
  const repository = createRepositoryRecorder();
  const harness = createPaymentHarness({
    order: makeOrder({
      status: ORDER_STATUS.PENDING_PAYMENT,
    }),
    existingPayment: null,
    repository,
    ids: ['unused-id'],
    validatePaymentSlipObject: async () => {
      throw new AppError({
        code: 'FILE_ACCESS_FORBIDDEN',
        message: 'outside payment path',
        httpStatus: 403,
      });
    },
  });

  await assert.rejects(
    harness.service.submitPayment({
      organizationId: 'org-1',
      orderId: 'order-1',
      customerId: 'customer-1',
      slipKey:
        'payments/org-other/order-1/11111111-1111-4111-8111-111111111111',
    }),
    (error) =>
      error.code === 'FILE_ACCESS_FORBIDDEN' &&
      error.httpStatus === 403,
  );

  assert.equal(repository.transactions.length, 0);
});

test('OPEN Campaign approval atomically moves Payment to APPROVED and Order/link to PAID', async () => {
  const repository = createRepositoryRecorder();
  const harness = createPaymentHarness({
    repository,
    campaign: makeCampaign({
      status: CAMPAIGN_STATUS.OPEN,
    }),
    ids: ['audit-approve-open', 'event-approve-open'],
  });

  const result = await harness.service.approvePayment({
    organizationId: 'org-1',
    paymentId: 'payment-1',
    reviewerId: 'staff-1',
  });

  assert.equal(result.status, PAYMENT_STATUS.APPROVED);
  assert.equal(result.reviewedBy, 'staff-1');
  assert.equal(result.reviewedAt, FIXED_TIME);
  assert.equal(result.rejectReason, null);

  const transaction = repository.transactions[0];
  assert.equal(transaction.TransactItems.length, 5);

  const paymentUpdate = getTransactionItem(
    transaction,
    (item) =>
      item.Update?.Key?.SK === 'PAYMENT#payment-1',
  ).Update;
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':pendingReview'
    ],
    PAYMENT_STATUS.PENDING_REVIEW,
  );
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':reviewStatus'
    ],
    PAYMENT_STATUS.APPROVED,
  );
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':reviewedBy'
    ],
    'staff-1',
  );

  const orderUpdate = getTransactionItem(
    transaction,
    (item) => item.Update?.Key?.SK === 'ORDER#order-1',
  ).Update;
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':paymentReview'
    ],
    ORDER_STATUS.PAYMENT_REVIEW,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':orderStatus'
    ],
    ORDER_STATUS.PAID,
  );

  const linkUpdate = getTransactionItem(
    transaction,
    (item) =>
      item.Update?.Key?.SK?.startsWith(
        'CAMPAIGN#campaign-1#ORDER#',
      ),
  ).Update;
  assert.equal(
    linkUpdate.ExpressionAttributeValues[
      ':orderStatus'
    ],
    ORDER_STATUS.PAID,
  );

  const audit = getTransactionItem(
    transaction,
    (item) => item.Put?.Item?.action === 'PAYMENT_APPROVED',
  ).Put.Item;
  assert.equal(audit.actorId, 'staff-1');
  assert.equal(audit.resourceId, 'payment-1');

  assert.deepEqual(harness.sentEvents, [
    {
      version: 1,
      eventId: 'event-approve-open',
      type: 'PAYMENT_APPROVED',
      occurredAt: FIXED_TIME,
      organizationId: 'org-1',
      recipientUserId: 'customer-1',
      resourceType: 'PAYMENT',
      resourceId: 'payment-1',
      data: {},
    },
  ]);
  assert.equal(
    Object.hasOwn(
      harness.sentEvents[0],
      'slipKey',
    ),
    false,
  );
});

test('CLOSED Campaign approval moves Order/link directly to CONFIRMED', async () => {
  const repository = createRepositoryRecorder();
  const harness = createPaymentHarness({
    repository,
    campaign: makeCampaign({
      status: CAMPAIGN_STATUS.CLOSED,
    }),
    ids: ['audit-approve-closed', 'event-approve-closed'],
  });

  const result = await harness.service.approvePayment({
    organizationId: 'org-1',
    paymentId: 'payment-1',
    reviewerId: 'admin-1',
  });

  assert.equal(result.status, PAYMENT_STATUS.APPROVED);

  const transaction = repository.transactions[0];
  const orderUpdate = getTransactionItem(
    transaction,
    (item) => item.Update?.Key?.SK === 'ORDER#order-1',
  ).Update;
  const linkUpdate = getTransactionItem(
    transaction,
    (item) =>
      item.Update?.Key?.SK?.startsWith(
        'CAMPAIGN#campaign-1#ORDER#',
      ),
  ).Update;

  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':orderStatus'
    ],
    ORDER_STATUS.CONFIRMED,
  );
  assert.equal(
    linkUpdate.ExpressionAttributeValues[
      ':orderStatus'
    ],
    ORDER_STATUS.CONFIRMED,
  );
});

test('reject requires non-empty reason and successful rejection synchronizes Payment, Order and link', async () => {
  for (const body of [
    {},
    { reason: '' },
    { reason: '   ' },
    { reason: null },
  ]) {
    assert.throws(
      () => validateRejectPaymentBody(body),
      (error) =>
        error.code ===
          'PAYMENT_REJECT_REASON_REQUIRED' &&
        error.httpStatus === 400,
    );
  }

  const repository = createRepositoryRecorder();
  const harness = createPaymentHarness({
    repository,
    ids: ['audit-reject', 'event-reject'],
  });

  const result = await harness.service.rejectPayment({
    organizationId: 'org-1',
    paymentId: 'payment-1',
    reviewerId: 'staff-1',
    reason: ' Slip amount does not match order ',
  });

  assert.equal(result.status, PAYMENT_STATUS.REJECTED);
  assert.equal(
    result.rejectReason,
    ' Slip amount does not match order ',
  );
  assert.equal(result.reviewedBy, 'staff-1');
  assert.equal(result.reviewedAt, FIXED_TIME);

  const transaction = repository.transactions[0];
  const paymentUpdate = getTransactionItem(
    transaction,
    (item) =>
      item.Update?.Key?.SK === 'PAYMENT#payment-1',
  ).Update;
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':reviewStatus'
    ],
    PAYMENT_STATUS.REJECTED,
  );
  assert.equal(
    paymentUpdate.ExpressionAttributeValues[
      ':rejectReason'
    ],
    ' Slip amount does not match order ',
  );

  const orderUpdate = getTransactionItem(
    transaction,
    (item) => item.Update?.Key?.SK === 'ORDER#order-1',
  ).Update;
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':orderStatus'
    ],
    ORDER_STATUS.PAYMENT_REJECTED,
  );

  const audit = getTransactionItem(
    transaction,
    (item) => item.Put?.Item?.action === 'PAYMENT_REJECTED',
  ).Put.Item;
  assert.deepEqual(audit.metadata, {
    orderId: 'order-1',
    campaignId: 'campaign-1',
    reason: ' Slip amount does not match order ',
  });

  assert.deepEqual(harness.sentEvents, [
    {
      version: 1,
      eventId: 'event-reject',
      type: 'PAYMENT_REJECTED',
      occurredAt: FIXED_TIME,
      organizationId: 'org-1',
      recipientUserId: 'customer-1',
      resourceType: 'PAYMENT',
      resourceId: 'payment-1',
      data: {},
    },
  ]);
});

test('approval is blocked with PAYMENT_NOT_REVIEWABLE when Campaign is PRODUCING or later', async () => {
  for (const campaignStatus of [
    CAMPAIGN_STATUS.PRODUCING,
    CAMPAIGN_STATUS.READY_FOR_PICKUP,
    CAMPAIGN_STATUS.COMPLETED,
  ]) {
    const repository = createRepositoryRecorder();
    const harness = createPaymentHarness({
      repository,
      campaign: makeCampaign({
        status: campaignStatus,
      }),
      ids: ['unused-id'],
    });

    await assert.rejects(
      harness.service.approvePayment({
        organizationId: 'org-1',
        paymentId: 'payment-1',
        reviewerId: 'staff-1',
      }),
      (error) =>
        error.code === 'PAYMENT_NOT_REVIEWABLE' &&
        error.httpStatus === 409,
    );

    assert.equal(repository.transactions.length, 0);
    assert.equal(harness.sentEvents.length, 0);
  }
});

test('payment review requires Payment PENDING_REVIEW and Order PAYMENT_REVIEW', async () => {
  const cases = [
    {
      payment: makePayment({
        status: PAYMENT_STATUS.APPROVED,
      }),
      order: makeOrder({
        status: ORDER_STATUS.PAID,
      }),
    },
    {
      payment: makePayment(),
      order: makeOrder({
        status: ORDER_STATUS.PENDING_PAYMENT,
      }),
    },
  ];

  for (const entry of cases) {
    const repository = createRepositoryRecorder();
    const harness = createPaymentHarness({
      repository,
      payment: entry.payment,
      order: entry.order,
      ids: ['unused-id'],
    });

    await assert.rejects(
      harness.service.approvePayment({
        organizationId: 'org-1',
        paymentId: 'payment-1',
        reviewerId: 'staff-1',
      }),
      (error) =>
        error.code === 'INVALID_STATUS_TRANSITION' &&
        error.httpStatus === 409,
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('conditional Campaign race during review becomes PAYMENT_NOT_REVIEWABLE and publishes no event', async () => {
  const conflict = new Error('campaign changed');
  conflict.name = 'TransactionCanceledException';
  conflict.CancellationReasons = [
    { Code: 'ConditionalCheckFailed' },
    { Code: 'None' },
  ];
  const repository = createRepositoryRecorder({
    transactError: conflict,
  });
  const harness = createPaymentHarness({
    repository,
    ids: ['audit-race'],
  });

  await assert.rejects(
    harness.service.approvePayment({
      organizationId: 'org-1',
      paymentId: 'payment-1',
      reviewerId: 'staff-1',
    }),
    (error) =>
      error.code === 'PAYMENT_NOT_REVIEWABLE' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 1);
  assert.equal(harness.sentEvents.length, 0);
});

test('conditional Payment or Order race during review becomes INVALID_STATUS_TRANSITION', async () => {
  const conflict = new Error('payment changed');
  conflict.name = 'TransactionCanceledException';
  conflict.CancellationReasons = [
    { Code: 'None' },
    { Code: 'ConditionalCheckFailed' },
  ];
  const repository = createRepositoryRecorder({
    transactError: conflict,
  });
  const harness = createPaymentHarness({
    repository,
    ids: ['audit-race'],
  });

  await assert.rejects(
    harness.service.rejectPayment({
      organizationId: 'org-1',
      paymentId: 'payment-1',
      reviewerId: 'staff-1',
      reason: 'Mismatch',
    }),
    (error) =>
      error.code === 'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );

  assert.equal(harness.sentEvents.length, 0);
});

test('SQS publish failure does not roll back or fail the successful core Payment approval', async () => {
  const repository = createRepositoryRecorder();
  const warnings = [];
  const harness = createPaymentHarness({
    repository,
    ids: ['audit-approve', 'event-approve'],
    sqsAdapter: {
      async sendJson() {
        const error = new Error('queue unavailable');
        error.code = 'SQS_UNAVAILABLE';
        throw error;
      },
    },
    logger: {
      warn(message, context) {
        warnings.push({
          message,
          context,
        });
      },
    },
  });

  const result = await harness.service.approvePayment({
    organizationId: 'org-1',
    paymentId: 'payment-1',
    reviewerId: 'staff-1',
  });

  assert.equal(result.status, PAYMENT_STATUS.APPROVED);
  assert.equal(repository.transactions.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(
    warnings[0].message,
    'notification_publish_failed',
  );
  assert.equal(
    warnings[0].context.eventId,
    'event-approve',
  );
  assert.equal(
    warnings[0].context.type,
    'PAYMENT_APPROVED',
  );
});

test('payment list filters by tenant review index and campaign/order filters fail closed through canonical Orders', async () => {
  const calls = [];
  const paymentA = makePayment({
    paymentId: 'payment-a',
    orderId: 'order-1',
  });
  const paymentB = makePayment({
    paymentId: 'payment-b',
    orderId: 'order-2',
  });
  const service = createPaymentService({
    paymentRepository: {
      async listByOrganizationPage(
        organizationId,
        options,
      ) {
        calls.push({
          organizationId,
          options,
        });

        return {
          items: [paymentA, paymentB],
          lastEvaluatedKey: null,
        };
      },
    },
    orderRepository: {
      async getById(organizationId, orderId) {
        return {
          ...makeOrder({
            orderId,
            organizationId,
          }),
          campaignId:
            orderId === 'order-1'
              ? 'campaign-1'
              : 'campaign-other',
        };
      },
    },
  });

  const result = await service.listPayments({
    organizationId: 'org-1',
    status: PAYMENT_STATUS.PENDING_REVIEW,
    campaignId: 'campaign-1',
  });

  assert.deepEqual(calls, [
    {
      organizationId: 'org-1',
      options: {
        status: PAYMENT_STATUS.PENDING_REVIEW,
        exclusiveStartKey: null,
      },
    },
  ]);
  assert.deepEqual(
    result.items.map((item) => item.paymentId),
    ['payment-a'],
  );
});

function createPaymentRouteApp({
  role,
  paymentService,
  userId = 'staff-1',
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
      payments: {
        paymentService,
      },
    },
  });
}

test('STAFF and ORGANIZATION_ADMIN may review Payment while Customer without membership cannot', async () => {
  for (const role of [
    ORGANIZATION_ROLE.STAFF,
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  ]) {
    let reviewerId;
    const app = createPaymentRouteApp({
      role,
      userId:
        role === ORGANIZATION_ROLE.STAFF
          ? 'staff-1'
          : 'admin-1',
      paymentService: {
        async approvePayment(input) {
          reviewerId = input.reviewerId;
          return makePayment({
            status: PAYMENT_STATUS.APPROVED,
            reviewedBy: input.reviewerId,
            reviewedAt: FIXED_TIME,
          });
        },
      },
    });

    await request(app)
      .post(
        '/api/v1/organizations/org-1/payments/payment-1/approve',
      )
      .expect(200);

    assert.equal(
      reviewerId,
      role === ORGANIZATION_ROLE.STAFF
        ? 'staff-1'
        : 'admin-1',
    );
  }

  let called = false;
  const customerApp = createPaymentRouteApp({
    role: null,
    userId: 'customer-1',
    paymentService: {
      async approvePayment() {
        called = true;
        return makePayment();
      },
    },
  });

  const response = await request(customerApp)
    .post(
      '/api/v1/organizations/org-1/payments/payment-1/approve',
    )
    .expect(403);

  assert.equal(
    response.body.error.code,
    'MEMBERSHIP_REQUIRED',
  );
  assert.equal(called, false);
});

test('reject route requires a non-empty reason before Payment service is called', async () => {
  let called = false;
  const app = createPaymentRouteApp({
    role: ORGANIZATION_ROLE.STAFF,
    paymentService: {
      async rejectPayment() {
        called = true;
        return makePayment();
      },
    },
  });

  const response = await request(app)
    .post(
      '/api/v1/organizations/org-1/payments/payment-1/reject',
    )
    .send({
      reason: '   ',
    })
    .expect(400);

  assert.equal(
    response.body.error.code,
    'PAYMENT_REJECT_REASON_REQUIRED',
  );
  assert.equal(called, false);
});
