'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CAMPAIGN_STATUS,
} = require('../src/modules/campaigns/campaign.constants');
const {
  assertCampaignTransition,
} = require('../src/modules/campaigns/campaign.policy');
const {
  createCampaignProgressionService,
} = require('../src/modules/campaigns/campaign-progression.service');
const {
  createCampaignService,
} = require('../src/modules/campaigns/campaign.service');
const {
  ORDER_STATUS,
} = require('../src/modules/orders/order.constants');

const FIXED_TIME = '2026-09-29T10:30:00.000Z';

function makeCampaign(overrides = {}) {
  return {
    campaignId: 'campaign-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt Pre-order',
    openAt: '2026-10-01T00:00:00.000Z',
    closeAt: '2026-10-10T23:59:59.000Z',
    paymentDeadline: '2026-10-11T23:59:59.000Z',
    pickupAt: '2026-10-25T09:00:00.000Z',
    status: CAMPAIGN_STATUS.DRAFT,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeCampaignLink(overrides = {}) {
  const organizationId = overrides.organizationId ?? 'org-1';
  const campaignId = overrides.campaignId ?? 'campaign-1';
  const orderId = overrides.orderId ?? 'order-1';
  const createdAt =
    overrides.createdAt ?? '2026-10-02T08:00:00.000Z';

  return {
    PK: `ORG#${organizationId}`,
    SK:
      `CAMPAIGN#${campaignId}#ORDER#${createdAt}#${orderId}`,
    entityType: 'CampaignOrderLink',
    organizationId,
    campaignId,
    orderId,
    customerId: overrides.customerId ?? 'customer-1',
    status: overrides.status ?? ORDER_STATUS.PENDING_PAYMENT,
    createdAt,
    ...overrides,
  };
}

function createRepositoryRecorder(options = {}) {
  const transactions = [];

  return {
    transactions,

    async transactWrite(input) {
      transactions.push(input);

      if (options.transactError) {
        throw options.transactError;
      }

      return {};
    },
  };
}

function createCampaignServiceHarness({
  status = CAMPAIGN_STATUS.DRAFT,
  transactError,
} = {}) {
  const repository = createRepositoryRecorder({
    transactError,
  });
  const campaign = makeCampaign({ status });
  let auditCounter = 0;

  const service = createCampaignService({
    repository,
    campaignRepository: {
      async getById(organizationId, campaignId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(campaignId, 'campaign-1');
        return campaign;
      },
    },
    idFactory() {
      auditCounter += 1;
      return `audit-${auditCounter}`;
    },
    clock: () => FIXED_TIME,
  });

  return {
    campaign,
    repository,
    service,
  };
}

function createProgressionHarness({
  campaignStatus,
  links = [],
  transactError,
} = {}) {
  const {
    service: campaignService,
    repository,
  } = createCampaignServiceHarness({
    status: campaignStatus,
    transactError,
  });

  const progressionService =
    createCampaignProgressionService({
      repository,
      campaignService,
      orderRepository: {
        async listCampaignLinks(organizationId, campaignId) {
          assert.equal(organizationId, 'org-1');
          assert.equal(campaignId, 'campaign-1');
          return links;
        },
      },
      clock: () => FIXED_TIME,
    });

  return {
    campaignService,
    progressionService,
    repository,
  };
}

function findCampaignUpdate(transaction) {
  return transaction.TransactItems.find(
    (item) =>
      item.Update?.Key?.PK === 'ORG#org-1' &&
      item.Update?.Key?.SK === 'CAMPAIGN#campaign-1',
  );
}

function orderUpdates(transaction) {
  return transaction.TransactItems.filter((item) =>
    item.Update?.Key?.SK?.startsWith('ORDER#'),
  );
}

function linkUpdates(transaction) {
  return transaction.TransactItems.filter((item) =>
    item.Update?.Key?.SK?.startsWith(
      'CAMPAIGN#campaign-1#ORDER#',
    ),
  );
}

test('canonical Campaign transition policy accepts only the documented lifecycle edges', () => {
  const valid = [
    [CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.OPEN],
    [CAMPAIGN_STATUS.OPEN, CAMPAIGN_STATUS.CLOSED],
    [CAMPAIGN_STATUS.CLOSED, CAMPAIGN_STATUS.PRODUCING],
    [
      CAMPAIGN_STATUS.PRODUCING,
      CAMPAIGN_STATUS.READY_FOR_PICKUP,
    ],
    [
      CAMPAIGN_STATUS.READY_FOR_PICKUP,
      CAMPAIGN_STATUS.COMPLETED,
    ],
    [CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.CANCELLED],
    [CAMPAIGN_STATUS.OPEN, CAMPAIGN_STATUS.CANCELLED],
    [CAMPAIGN_STATUS.CLOSED, CAMPAIGN_STATUS.CANCELLED],
  ];

  for (const [fromStatus, toStatus] of valid) {
    assert.doesNotThrow(() =>
      assertCampaignTransition(fromStatus, toStatus),
    );
  }

  assert.throws(
    () =>
      assertCampaignTransition(
        CAMPAIGN_STATUS.OPEN,
        CAMPAIGN_STATUS.PRODUCING,
      ),
    (error) =>
      error.code === 'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );

  assert.throws(
    () =>
      assertCampaignTransition(
        CAMPAIGN_STATUS.PRODUCING,
        CAMPAIGN_STATUS.CANCELLED,
      ),
    (error) => error.code === 'INVALID_STATUS_TRANSITION',
  );
});

test('DRAFT to OPEN writes Campaign status and Audit with an expected-state guard', async () => {
  const { service, repository } =
    createCampaignServiceHarness({
      status: CAMPAIGN_STATUS.DRAFT,
    });

  const result = await service.transitionCampaign({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    actorId: 'admin-1',
    toStatus: CAMPAIGN_STATUS.OPEN,
  });

  assert.equal(repository.transactions.length, 1);
  const transaction = repository.transactions[0];
  const campaignUpdate = findCampaignUpdate(transaction);

  assert.equal(
    campaignUpdate.Update.ConditionExpression,
    '#status = :fromStatus',
  );
  assert.equal(
    campaignUpdate.Update.ExpressionAttributeValues[
      ':fromStatus'
    ],
    CAMPAIGN_STATUS.DRAFT,
  );
  assert.equal(
    campaignUpdate.Update.ExpressionAttributeValues[
      ':toStatus'
    ],
    CAMPAIGN_STATUS.OPEN,
  );

  const audit = transaction.TransactItems.find(
    (item) =>
      item.Put?.Item?.action === 'CAMPAIGN_STATUS_CHANGED',
  ).Put.Item;

  assert.deepEqual(audit.metadata, {
    fromStatus: CAMPAIGN_STATUS.DRAFT,
    toStatus: CAMPAIGN_STATUS.OPEN,
  });
  assert.equal(result.status, CAMPAIGN_STATUS.OPEN);
});

test('OPEN to CLOSED moves only PAID Orders to CONFIRMED and updates CampaignOrderLink projections atomically', async () => {
  const links = [
    makeCampaignLink({
      orderId: 'paid-1',
      status: ORDER_STATUS.PAID,
    }),
    makeCampaignLink({
      orderId: 'review-1',
      status: ORDER_STATUS.PAYMENT_REVIEW,
      createdAt: '2026-10-02T08:01:00.000Z',
    }),
    makeCampaignLink({
      orderId: 'pending-1',
      status: ORDER_STATUS.PENDING_PAYMENT,
      createdAt: '2026-10-02T08:02:00.000Z',
    }),
  ];
  const { progressionService, repository } =
    createProgressionHarness({
      campaignStatus: CAMPAIGN_STATUS.OPEN,
      links,
    });

  const result = await progressionService.closeCampaign({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    actorId: 'admin-1',
  });

  const transaction = repository.transactions[0];
  assert.equal(result.status, CAMPAIGN_STATUS.CLOSED);
  assert.equal(orderUpdates(transaction).length, 1);
  assert.equal(linkUpdates(transaction).length, 1);

  const orderUpdate = orderUpdates(transaction)[0].Update;
  assert.deepEqual(orderUpdate.Key, {
    PK: 'ORG#org-1',
    SK: 'ORDER#paid-1',
  });
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':fromStatus'],
    ORDER_STATUS.PAID,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':toStatus'],
    ORDER_STATUS.CONFIRMED,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':campaignId'],
    'campaign-1',
  );

  const linkUpdate = linkUpdates(transaction)[0].Update;
  assert.equal(
    linkUpdate.ExpressionAttributeValues[':fromStatus'],
    ORDER_STATUS.PAID,
  );
  assert.equal(
    linkUpdate.ExpressionAttributeValues[':toStatus'],
    ORDER_STATUS.CONFIRMED,
  );
  assert.ok(findCampaignUpdate(transaction));
});

test('CLOSED to PRODUCING rejects while any Order remains PAYMENT_REVIEW and performs no write', async () => {
  const { progressionService, repository } =
    createProgressionHarness({
      campaignStatus: CAMPAIGN_STATUS.CLOSED,
      links: [
        makeCampaignLink({
          status: ORDER_STATUS.CONFIRMED,
        }),
        makeCampaignLink({
          orderId: 'review-1',
          status: ORDER_STATUS.PAYMENT_REVIEW,
          createdAt: '2026-10-02T08:01:00.000Z',
        }),
      ],
    });

  await assert.rejects(
    progressionService.startProduction({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      actorId: 'admin-1',
    }),
    (error) =>
      error.code === 'PAYMENT_NOT_REVIEWABLE' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 0);
});

test('CLOSED to PRODUCING moves CONFIRMED Orders to IN_PRODUCTION while leaving unpaid Orders unchanged', async () => {
  const { progressionService, repository } =
    createProgressionHarness({
      campaignStatus: CAMPAIGN_STATUS.CLOSED,
      links: [
        makeCampaignLink({
          orderId: 'confirmed-1',
          status: ORDER_STATUS.CONFIRMED,
        }),
        makeCampaignLink({
          orderId: 'pending-1',
          status: ORDER_STATUS.PENDING_PAYMENT,
          createdAt: '2026-10-02T08:01:00.000Z',
        }),
        makeCampaignLink({
          orderId: 'rejected-1',
          status: ORDER_STATUS.PAYMENT_REJECTED,
          createdAt: '2026-10-02T08:02:00.000Z',
        }),
      ],
    });

  const result =
    await progressionService.startProduction({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      actorId: 'admin-1',
    });

  const transaction = repository.transactions[0];
  assert.equal(result.status, CAMPAIGN_STATUS.PRODUCING);
  assert.equal(orderUpdates(transaction).length, 1);
  assert.equal(linkUpdates(transaction).length, 1);

  const orderUpdate = orderUpdates(transaction)[0].Update;
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':fromStatus'],
    ORDER_STATUS.CONFIRMED,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':toStatus'],
    ORDER_STATUS.IN_PRODUCTION,
  );
});

test('OPEN to PRODUCING is rejected before Campaign Order side effects are queried', async () => {
  let linkQueryCount = 0;
  const {
    service: campaignService,
    repository,
  } = createCampaignServiceHarness({
    status: CAMPAIGN_STATUS.OPEN,
  });
  const progressionService =
    createCampaignProgressionService({
      repository,
      campaignService,
      orderRepository: {
        async listCampaignLinks() {
          linkQueryCount += 1;
          return [];
        },
      },
    });

  await assert.rejects(
    progressionService.startProduction({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      actorId: 'admin-1',
    }),
    (error) =>
      error.code === 'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );

  assert.equal(linkQueryCount, 0);
  assert.equal(repository.transactions.length, 0);
});

test('DRAFT Campaign cancellation succeeds with no Orders', async () => {
  const { progressionService, repository } =
    createProgressionHarness({
      campaignStatus: CAMPAIGN_STATUS.DRAFT,
      links: [],
    });

  const result = await progressionService.cancelCampaign({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    actorId: 'admin-1',
  });

  const transaction = repository.transactions[0];
  assert.equal(result.status, CAMPAIGN_STATUS.CANCELLED);
  assert.equal(orderUpdates(transaction).length, 0);
  assert.equal(linkUpdates(transaction).length, 0);
  assert.ok(findCampaignUpdate(transaction));
});

test('OPEN/CLOSED Campaign cancellation rejects PAYMENT_REVIEW or paid-lifecycle Orders', async () => {
  const blockingStatuses = [
    ORDER_STATUS.PAYMENT_REVIEW,
    ORDER_STATUS.PAID,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.IN_PRODUCTION,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.RECEIVED,
  ];

  for (const campaignStatus of [
    CAMPAIGN_STATUS.OPEN,
    CAMPAIGN_STATUS.CLOSED,
  ]) {
    for (const status of blockingStatuses) {
      const { progressionService, repository } =
        createProgressionHarness({
          campaignStatus,
          links: [
            makeCampaignLink({ status }),
          ],
        });

      await assert.rejects(
        progressionService.cancelCampaign({
          organizationId: 'org-1',
          campaignId: 'campaign-1',
          actorId: 'admin-1',
        }),
        (error) =>
          error.code === 'INVALID_STATUS_TRANSITION' &&
          error.httpStatus === 409,
      );

      assert.equal(repository.transactions.length, 0);
    }
  }
});

test('Campaign cancellation converts PENDING_PAYMENT and PAYMENT_REJECTED Orders plus links to CANCELLED', async () => {
  const { progressionService, repository } =
    createProgressionHarness({
      campaignStatus: CAMPAIGN_STATUS.CLOSED,
      links: [
        makeCampaignLink({
          orderId: 'pending-1',
          status: ORDER_STATUS.PENDING_PAYMENT,
        }),
        makeCampaignLink({
          orderId: 'rejected-1',
          status: ORDER_STATUS.PAYMENT_REJECTED,
          createdAt: '2026-10-02T08:01:00.000Z',
        }),
        makeCampaignLink({
          orderId: 'cancelled-1',
          status: ORDER_STATUS.CANCELLED,
          createdAt: '2026-10-02T08:02:00.000Z',
        }),
      ],
    });

  const result = await progressionService.cancelCampaign({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    actorId: 'admin-1',
  });

  const transaction = repository.transactions[0];
  assert.equal(result.status, CAMPAIGN_STATUS.CANCELLED);
  assert.equal(orderUpdates(transaction).length, 2);
  assert.equal(linkUpdates(transaction).length, 2);

  for (const item of [
    ...orderUpdates(transaction),
    ...linkUpdates(transaction),
  ]) {
    assert.equal(
      item.Update.ExpressionAttributeValues[':toStatus'],
      ORDER_STATUS.CANCELLED,
    );
  }
});

test('PRODUCING and later Campaigns cannot cancel even when no Order exists', async () => {
  for (const campaignStatus of [
    CAMPAIGN_STATUS.PRODUCING,
    CAMPAIGN_STATUS.READY_FOR_PICKUP,
    CAMPAIGN_STATUS.COMPLETED,
    CAMPAIGN_STATUS.CANCELLED,
  ]) {
    const { progressionService, repository } =
      createProgressionHarness({
        campaignStatus,
        links: [],
      });

    await assert.rejects(
      progressionService.cancelCampaign({
        organizationId: 'org-1',
        campaignId: 'campaign-1',
        actorId: 'admin-1',
      }),
      (error) => error.code === 'INVALID_STATUS_TRANSITION',
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('READY_FOR_PICKUP Campaign completion requires every paid/production Order to be RECEIVED', async () => {
  const blockingStatuses = [
    ORDER_STATUS.PAID,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.IN_PRODUCTION,
    ORDER_STATUS.READY_FOR_PICKUP,
  ];

  for (const status of blockingStatuses) {
    const { progressionService, repository } =
      createProgressionHarness({
        campaignStatus:
          CAMPAIGN_STATUS.READY_FOR_PICKUP,
        links: [makeCampaignLink({ status })],
      });

    await assert.rejects(
      progressionService.completeCampaign({
        organizationId: 'org-1',
        campaignId: 'campaign-1',
        actorId: 'admin-1',
      }),
      (error) =>
        error.code === 'INVALID_STATUS_TRANSITION' &&
        error.httpStatus === 409,
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('READY_FOR_PICKUP Campaign completion ignores unpaid/cancelled Orders once paid Orders are RECEIVED', async () => {
  const { progressionService, repository } =
    createProgressionHarness({
      campaignStatus:
        CAMPAIGN_STATUS.READY_FOR_PICKUP,
      links: [
        makeCampaignLink({
          status: ORDER_STATUS.RECEIVED,
        }),
        makeCampaignLink({
          orderId: 'pending-1',
          status: ORDER_STATUS.PENDING_PAYMENT,
          createdAt: '2026-10-02T08:01:00.000Z',
        }),
        makeCampaignLink({
          orderId: 'rejected-1',
          status: ORDER_STATUS.PAYMENT_REJECTED,
          createdAt: '2026-10-02T08:02:00.000Z',
        }),
        makeCampaignLink({
          orderId: 'cancelled-1',
          status: ORDER_STATUS.CANCELLED,
          createdAt: '2026-10-02T08:03:00.000Z',
        }),
      ],
    });

  const result = await progressionService.completeCampaign({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    actorId: 'admin-1',
  });

  assert.equal(result.status, CAMPAIGN_STATUS.COMPLETED);
  assert.equal(repository.transactions.length, 1);
  assert.equal(
    orderUpdates(repository.transactions[0]).length,
    0,
  );
});

test('Campaign Order progression fails closed on a cross-tenant or malformed CampaignOrderLink', async () => {
  const invalidLinks = [
    makeCampaignLink({
      organizationId: 'org-other',
    }),
    makeCampaignLink({
      campaignId: 'campaign-other',
    }),
    makeCampaignLink({
      PK: 'ORG#org-other',
    }),
    makeCampaignLink({
      entityType: 'Order',
    }),
  ];

  for (const link of invalidLinks) {
    const { progressionService, repository } =
      createProgressionHarness({
        campaignStatus: CAMPAIGN_STATUS.OPEN,
        links: [link],
      });

    await assert.rejects(
      progressionService.closeCampaign({
        organizationId: 'org-1',
        campaignId: 'campaign-1',
        actorId: 'admin-1',
      }),
      (error) =>
        error.code === 'TENANT_MISMATCH' &&
        error.httpStatus === 403,
    );

    assert.equal(repository.transactions.length, 0);
  }
});

test('conditional Campaign transition conflicts are normalized to INVALID_STATUS_TRANSITION', async () => {
  const conflict = new Error('conditional write lost');
  conflict.name = 'TransactionCanceledException';
  conflict.CancellationReasons = [
    {
      Code: 'ConditionalCheckFailed',
    },
  ];

  const { service } = createCampaignServiceHarness({
    status: CAMPAIGN_STATUS.DRAFT,
    transactError: conflict,
  });

  await assert.rejects(
    service.transitionCampaign({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      actorId: 'admin-1',
      toStatus: CAMPAIGN_STATUS.OPEN,
    }),
    (error) =>
      error.code === 'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );
});

test('conditional Order/link race during Campaign close aborts the whole transition as INVALID_STATUS_TRANSITION', async () => {
  const conflict = new Error('order state changed');
  conflict.name = 'TransactionCanceledException';
  conflict.CancellationReasons = [
    { Code: 'None' },
    { Code: 'ConditionalCheckFailed' },
  ];

  const { progressionService, repository } =
    createProgressionHarness({
      campaignStatus: CAMPAIGN_STATUS.OPEN,
      links: [
        makeCampaignLink({
          status: ORDER_STATUS.PAID,
        }),
      ],
      transactError: conflict,
    });

  await assert.rejects(
    progressionService.closeCampaign({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      actorId: 'admin-1',
    }),
    (error) =>
      error.code === 'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 1);
});
