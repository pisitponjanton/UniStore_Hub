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
  createCampaignProgressionService,
} = require('../src/modules/campaigns/campaign-progression.service');
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
  PICKUP_STATUS,
} = require('../src/modules/pickups/pickup.constants');
const {
  createPickupRepository,
} = require('../src/modules/pickups/pickup.repository');
const {
  PICKUP_TOKEN_PATTERN,
  createPickupService,
  createPickupToken,
} = require('../src/modules/pickups/pickup.service');

const FIXED_TIME = '2026-09-29T12:00:00.000Z';
const TOKEN = 'ABCDEFGHIJKLMNOPQRSTUV';

function makeOrder(overrides = {}) {
  return {
    orderId: 'order-1',
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    customerId: 'customer-1',
    status: ORDER_STATUS.READY_FOR_PICKUP,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T11:00:00.000Z',
    ...overrides,
  };
}

function makeCampaignLink(overrides = {}) {
  const createdAt =
    overrides.createdAt ||
    '2026-09-29T10:00:00.000Z';

  return {
    PK: 'ORG#org-1',
    SK:
      `CAMPAIGN#campaign-1#ORDER#${createdAt}#order-1`,
    entityType: 'CampaignOrderLink',
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    orderId: 'order-1',
    customerId: 'customer-1',
    status: ORDER_STATUS.IN_PRODUCTION,
    createdAt,
    ...overrides,
  };
}

function makePickup(overrides = {}) {
  return {
    PK: 'ORG#org-1#ORDER#order-1',
    SK: 'PICKUP',
    GSI1PK:
      `ORG#org-1#PICKUP_TOKEN#${TOKEN}`,
    GSI1SK: 'PICKUP#pickup-1#ORDER#order-1',
    entityType: 'Pickup',
    pickupId: 'pickup-1',
    organizationId: 'org-1',
    orderId: 'order-1',
    campaignId: 'campaign-1',
    customerId: 'customer-1',
    token: TOKEN,
    status: PICKUP_STATUS.READY,
    receivedBy: null,
    receivedAt: null,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makePickupLink(overrides = {}) {
  return {
    PK: 'ORG#org-1',
    SK: 'PICKUP#pickup-1',
    entityType: 'PickupLink',
    organizationId: 'org-1',
    pickupId: 'pickup-1',
    orderId: 'order-1',
    campaignId: 'campaign-1',
    customerId: 'customer-1',
    token: TOKEN,
    status: PICKUP_STATUS.READY,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
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

function createPickupHarness({
  pickup = makePickup(),
  pickupLink = makePickupLink(),
  order = makeOrder(),
  repository = createRepositoryRecorder(),
  pickupByOrganization,
  linkByOrganization,
  ownedOrder = order,
  idFactory = () => 'audit-1',
  tokenFactory = () => TOKEN,
  clock = () => FIXED_TIME,
} = {}) {
  const calls = {
    getByOrder: [],
    getLinkById: [],
    findOwnedById: [],
    getOrderById: [],
  };

  const service = createPickupService({
    repository,
    idFactory,
    tokenFactory,
    clock,
    pickupRepository: {
      async getByOrder(organizationId, orderId) {
        calls.getByOrder.push({
          organizationId,
          orderId,
        });

        if (pickupByOrganization) {
          return pickupByOrganization(
            organizationId,
            orderId,
          );
        }

        return organizationId === 'org-1' &&
          orderId === 'order-1'
          ? pickup
          : null;
      },

      async getLinkById(organizationId, pickupId) {
        calls.getLinkById.push({
          organizationId,
          pickupId,
        });

        if (linkByOrganization) {
          return linkByOrganization(
            organizationId,
            pickupId,
          );
        }

        return organizationId === 'org-1' &&
          pickupId === 'pickup-1'
          ? pickupLink
          : null;
      },

      async listLinksPage() {
        return {
          items: pickupLink ? [pickupLink] : [],
          lastEvaluatedKey: null,
        };
      },

      async listByTokenPage() {
        return {
          items: pickup ? [pickup] : [],
          lastEvaluatedKey: null,
        };
      },
    },
    orderRepository: {
      async getById(organizationId, orderId) {
        calls.getOrderById.push({
          organizationId,
          orderId,
        });

        return organizationId === 'org-1' &&
          orderId === 'order-1'
          ? order
          : null;
      },

      async findOwnedById(customerId, orderId) {
        calls.findOwnedById.push({
          customerId,
          orderId,
        });

        return orderId === 'order-1'
          ? ownedOrder
          : null;
      },
    },
  });

  return {
    calls,
    repository,
    service,
  };
}

test('Pickup token is an unpadded 22-character base64url encoding of 128 random bits', () => {
  const tokens = new Set();

  for (let index = 0; index < 32; index += 1) {
    const token = createPickupToken();

    assert.equal(token.length, 22);
    assert.match(token, PICKUP_TOKEN_PATTERN);
    assert.equal(token.includes('='), false);
    assert.equal(
      Buffer.from(token, 'base64url').length,
      16,
    );
    tokens.add(token);
  }

  assert.equal(tokens.size, 32);
});

test('ready-for-pickup preparation creates canonical Pickup and PickupLink with matching identity in the same extra transaction set', async () => {
  const repository = createRepositoryRecorder();
  const order = makeOrder({
    status: ORDER_STATUS.IN_PRODUCTION,
  });
  const service = createPickupService({
    repository,
    idFactory: () => 'pickup-1',
    tokenFactory: () => TOKEN,
    pickupRepository: {
      async getByOrder() {
        return null;
      },
      async getLinkById() {
        return null;
      },
    },
    orderRepository: {
      async getById() {
        return order;
      },
    },
  });

  const prepared =
    await service.prepareCampaignReadiness({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      links: [makeCampaignLink()],
      timestamp: FIXED_TIME,
    });

  assert.equal(prepared.transactItems.length, 4);
  assert.deepEqual(prepared.events, [
    {
      organizationId: 'org-1',
      recipientUserId: 'customer-1',
      pickupId: 'pickup-1',
    },
  ]);

  const pickupPut = prepared.transactItems.find(
    (item) => item.Put?.Item?.entityType === 'Pickup',
  ).Put.Item;
  const linkPut = prepared.transactItems.find(
    (item) =>
      item.Put?.Item?.entityType === 'PickupLink',
  ).Put.Item;

  assert.equal(
    pickupPut.PK,
    'ORG#org-1#ORDER#order-1',
  );
  assert.equal(pickupPut.SK, 'PICKUP');
  assert.equal(pickupPut.pickupId, 'pickup-1');
  assert.equal(pickupPut.token, TOKEN);
  assert.equal(pickupPut.status, PICKUP_STATUS.READY);
  assert.equal(
    pickupPut.GSI1PK,
    `ORG#org-1#PICKUP_TOKEN#${TOKEN}`,
  );
  assert.equal(
    pickupPut.GSI1SK,
    'PICKUP#pickup-1#ORDER#order-1',
  );

  assert.equal(linkPut.PK, 'ORG#org-1');
  assert.equal(linkPut.SK, 'PICKUP#pickup-1');
  assert.equal(linkPut.pickupId, pickupPut.pickupId);
  assert.equal(linkPut.orderId, pickupPut.orderId);
  assert.equal(
    linkPut.organizationId,
    pickupPut.organizationId,
  );
  assert.equal(linkPut.token, pickupPut.token);
  assert.equal(linkPut.status, pickupPut.status);

  const orderUpdate = prepared.transactItems.find(
    (item) => item.Update?.Key?.SK === 'ORDER#order-1',
  ).Update;
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':inProduction'
    ],
    ORDER_STATUS.IN_PRODUCTION,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':readyForPickup'
    ],
    ORDER_STATUS.READY_FOR_PICKUP,
  );
});

test('Campaign readiness passes Pickup creation side effects into the Campaign transition transaction before notifications', async () => {
  const calls = [];
  const links = [makeCampaignLink()];
  const progression = createCampaignProgressionService({
    clock: () => FIXED_TIME,
    campaignService: {
      async getCampaign() {
        return {
          campaignId: 'campaign-1',
          organizationId: 'org-1',
          status: CAMPAIGN_STATUS.PRODUCING,
        };
      },
      async transitionCampaign(input) {
        calls.push({
          type: 'transition',
          input,
        });
        return {
          campaignId: 'campaign-1',
          organizationId: 'org-1',
          status: CAMPAIGN_STATUS.READY_FOR_PICKUP,
        };
      },
    },
    orderRepository: {
      async listCampaignLinks() {
        return links;
      },
    },
    pickupService: {
      async prepareCampaignReadiness(input) {
        calls.push({
          type: 'prepare',
          input,
        });

        return {
          transactItems: [
            {
              Put: {
                Item: makePickup(),
              },
            },
            {
              Put: {
                Item: makePickupLink(),
              },
            },
          ],
          events: [
            {
              organizationId: 'org-1',
              recipientUserId: 'customer-1',
              pickupId: 'pickup-1',
            },
          ],
        };
      },
      async publishReadyEvents(events, timestamp) {
        calls.push({
          type: 'publish',
          events,
          timestamp,
        });
      },
    },
  });

  await progression.readyForPickup({
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    actorId: 'admin-1',
  });

  assert.equal(calls[0].type, 'prepare');
  assert.equal(calls[1].type, 'transition');
  assert.equal(calls[2].type, 'publish');
  assert.equal(
    calls[1].input.toStatus,
    CAMPAIGN_STATUS.READY_FOR_PICKUP,
  );
  assert.equal(
    calls[1].input.extraTransactItems.length,
    2,
  );
  assert.equal(
    calls[1].input.extraTransactItems[0].Put.Item
      .entityType,
    'Pickup',
  );
  assert.equal(
    calls[1].input.extraTransactItems[1].Put.Item
      .entityType,
    'PickupLink',
  );
  assert.equal(calls[1].input.timestamp, FIXED_TIME);
  assert.equal(calls[2].timestamp, FIXED_TIME);
});

test('Pickup repository organization list is backed by tenant PickupLink query and token lookup uses tenant-qualified GSI', async () => {
  const queries = [];
  const repository = createPickupRepository({
    repository: {
      async query(input) {
        queries.push(input);
        return {
          items: [],
          lastEvaluatedKey: null,
        };
      },
    },
  });

  await repository.listLinksPage('org-1', {
    campaignId: 'campaign-1',
    status: PICKUP_STATUS.READY,
    orderId: 'order-1',
  });

  await repository.listByTokenPage(
    'org-1',
    TOKEN,
  );

  assert.equal(queries.length, 2);
  assert.equal(
    queries[0].ExpressionAttributeValues[':pk'],
    'ORG#org-1',
  );
  assert.equal(
    queries[0].ExpressionAttributeValues[
      ':pickupPrefix'
    ],
    'PICKUP#',
  );
  assert.match(
    queries[0].FilterExpression,
    /#entityType = :linkType/,
  );
  assert.equal(
    queries[1].IndexName,
    'GSI1',
  );
  assert.equal(
    queries[1].ExpressionAttributeValues[
      ':gsi1pk'
    ],
    `ORG#org-1#PICKUP_TOKEN#${TOKEN}`,
  );
});

test('get Pickup resolves tenant PickupLink first and then canonical Order-scoped Pickup', async () => {
  const { calls, service } = createPickupHarness();

  const pickup = await service.getPickup({
    organizationId: 'org-1',
    pickupId: 'pickup-1',
  });

  assert.equal(pickup.pickupId, 'pickup-1');
  assert.equal(pickup.orderId, 'order-1');
  assert.equal(pickup.token, TOKEN);
  assert.deepEqual(calls.getLinkById, [
    {
      organizationId: 'org-1',
      pickupId: 'pickup-1',
    },
  ]);
  assert.deepEqual(calls.getByOrder, [
    {
      organizationId: 'org-1',
      orderId: 'order-1',
    },
  ]);
});

test('token lookup remains tenant-scoped and fails closed if index returns another tenant Pickup', async () => {
  const service = createPickupService({
    pickupRepository: {
      async listByTokenPage(
        organizationId,
        token,
      ) {
        assert.equal(organizationId, 'org-1');
        assert.equal(token, TOKEN);

        return {
          items: [
            makePickup({
              organizationId: 'org-other',
              PK: 'ORG#org-other#ORDER#order-1',
            }),
          ],
          lastEvaluatedKey: null,
        };
      },
    },
  });

  await assert.rejects(
    service.listPickups({
      organizationId: 'org-1',
      token: TOKEN,
    }),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

test('Staff from another Organization cannot resolve or confirm a Pickup by pickupId', async () => {
  const { service, repository } = createPickupHarness();

  await assert.rejects(
    service.getPickup({
      organizationId: 'org-other',
      pickupId: 'pickup-1',
    }),
    (error) =>
      error.code === 'PICKUP_NOT_FOUND' &&
      error.httpStatus === 404,
  );

  await assert.rejects(
    service.confirmPickup({
      organizationId: 'org-other',
      pickupId: 'pickup-1',
      actorId: 'staff-other',
    }),
    (error) =>
      error.code === 'PICKUP_NOT_FOUND' &&
      error.httpStatus === 404,
  );

  assert.equal(repository.transactions.length, 0);
});

test('Customer can obtain own Pickup token when Order is READY_FOR_PICKUP without Organization membership', async () => {
  const { calls, service } = createPickupHarness();

  const pickup = await service.getOwnPickup({
    customerId: 'customer-1',
    orderId: 'order-1',
  });

  assert.equal(pickup.pickupId, 'pickup-1');
  assert.equal(pickup.token, TOKEN);
  assert.deepEqual(calls.findOwnedById, [
    {
      customerId: 'customer-1',
      orderId: 'order-1',
    },
  ]);
});

test('Customer cannot obtain another Customer Pickup', async () => {
  const { service } = createPickupHarness({
    ownedOrder: makeOrder({
      customerId: 'customer-other',
    }),
  });

  await assert.rejects(
    service.getOwnPickup({
      customerId: 'customer-1',
      orderId: 'order-1',
    }),
    (error) =>
      error.code === 'RESOURCE_OWNERSHIP_REQUIRED' &&
      error.httpStatus === 403,
  );
});

test('Pickup confirm atomically updates Pickup, PickupLink and Order to RECEIVED and writes audit metadata', async () => {
  const repository = createRepositoryRecorder();
  const { service } = createPickupHarness({
    repository,
  });

  const result = await service.confirmPickup({
    organizationId: 'org-1',
    pickupId: 'pickup-1',
    actorId: 'staff-1',
  });

  assert.equal(result.status, PICKUP_STATUS.RECEIVED);
  assert.equal(result.receivedBy, 'staff-1');
  assert.equal(result.receivedAt, FIXED_TIME);
  assert.equal(result.updatedAt, FIXED_TIME);

  assert.equal(repository.transactions.length, 1);
  const transaction = repository.transactions[0];
  assert.equal(transaction.TransactItems.length, 5);

  const pickupUpdate = transaction.TransactItems.find(
    (item) => item.Update?.Key?.SK === 'PICKUP',
  ).Update;
  assert.equal(
    pickupUpdate.ExpressionAttributeValues[':ready'],
    PICKUP_STATUS.READY,
  );
  assert.equal(
    pickupUpdate.ExpressionAttributeValues[':received'],
    PICKUP_STATUS.RECEIVED,
  );
  assert.equal(
    pickupUpdate.ExpressionAttributeValues[
      ':receivedBy'
    ],
    'staff-1',
  );
  assert.equal(
    pickupUpdate.ExpressionAttributeValues[
      ':receivedAt'
    ],
    FIXED_TIME,
  );

  const linkUpdate = transaction.TransactItems.find(
    (item) =>
      item.Update?.Key?.PK === 'ORG#org-1' &&
      item.Update?.Key?.SK === 'PICKUP#pickup-1',
  ).Update;
  assert.equal(
    linkUpdate.ExpressionAttributeValues[':received'],
    PICKUP_STATUS.RECEIVED,
  );

  const orderUpdate = transaction.TransactItems.find(
    (item) => item.Update?.Key?.SK === 'ORDER#order-1',
  ).Update;
  assert.equal(
    orderUpdate.ExpressionAttributeValues[
      ':readyForPickup'
    ],
    ORDER_STATUS.READY_FOR_PICKUP,
  );
  assert.equal(
    orderUpdate.ExpressionAttributeValues[':received'],
    ORDER_STATUS.RECEIVED,
  );

  const campaignLinkUpdate =
    transaction.TransactItems.find(
      (item) =>
        item.Update?.Key?.PK === 'ORG#org-1' &&
        item.Update?.Key?.SK ===
          'CAMPAIGN#campaign-1#ORDER#2026-09-29T10:00:00.000Z#order-1',
    ).Update;
  assert.equal(
    campaignLinkUpdate.ExpressionAttributeValues[
      ':readyForPickup'
    ],
    ORDER_STATUS.READY_FOR_PICKUP,
  );
  assert.equal(
    campaignLinkUpdate.ExpressionAttributeValues[
      ':received'
    ],
    ORDER_STATUS.RECEIVED,
  );

  const audit = transaction.TransactItems.find(
    (item) =>
      item.Put?.Item?.action === 'PICKUP_CONFIRMED',
  ).Put.Item;
  assert.equal(audit.actorId, 'staff-1');
  assert.equal(audit.resourceType, 'PICKUP');
  assert.equal(audit.resourceId, 'pickup-1');
  assert.deepEqual(audit.metadata, {
    orderId: 'order-1',
    campaignId: 'campaign-1',
  });
});

test('Pickup confirm rejects Order that is not READY_FOR_PICKUP before transaction', async () => {
  const repository = createRepositoryRecorder();
  const { service } = createPickupHarness({
    repository,
    order: makeOrder({
      status: ORDER_STATUS.IN_PRODUCTION,
    }),
  });

  await assert.rejects(
    service.confirmPickup({
      organizationId: 'org-1',
      pickupId: 'pickup-1',
      actorId: 'staff-1',
    }),
    (error) =>
      error.code ===
        'ORDER_NOT_READY_FOR_PICKUP' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 0);
});

test('duplicate confirm returns PICKUP_ALREADY_RECEIVED before writing when Pickup is already RECEIVED', async () => {
  const repository = createRepositoryRecorder();
  const { service } = createPickupHarness({
    repository,
    pickup: makePickup({
      status: PICKUP_STATUS.RECEIVED,
      receivedBy: 'staff-old',
      receivedAt: '2026-09-29T11:45:00.000Z',
    }),
    pickupLink: makePickupLink({
      status: PICKUP_STATUS.RECEIVED,
    }),
    order: makeOrder({
      status: ORDER_STATUS.RECEIVED,
    }),
  });

  await assert.rejects(
    service.confirmPickup({
      organizationId: 'org-1',
      pickupId: 'pickup-1',
      actorId: 'staff-1',
    }),
    (error) =>
      error.code === 'PICKUP_ALREADY_RECEIVED' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 0);
});

test('concurrent duplicate Pickup confirmation normalizes conditional Pickup/Link conflict to PICKUP_ALREADY_RECEIVED', async () => {
  for (const conflictIndex of [0, 1]) {
    const error = new Error('conditional conflict');
    error.name = 'TransactionCanceledException';
    error.CancellationReasons = [
      { Code: 'None' },
      { Code: 'None' },
      { Code: 'None' },
      { Code: 'None' },
    ];
    error.CancellationReasons[conflictIndex] = {
      Code: 'ConditionalCheckFailed',
    };

    const repository = createRepositoryRecorder({
      transactError: error,
    });
    const { service } = createPickupHarness({
      repository,
    });

    await assert.rejects(
      service.confirmPickup({
        organizationId: 'org-1',
        pickupId: 'pickup-1',
        actorId: 'staff-1',
      }),
      (caught) =>
        caught.code ===
          'PICKUP_ALREADY_RECEIVED' &&
        caught.httpStatus === 409,
    );

    assert.equal(repository.transactions.length, 1);
  }
});

test('concurrent Order readiness conflict returns ORDER_NOT_READY_FOR_PICKUP', async () => {
  const error = new Error('order changed');
  error.name = 'TransactionCanceledException';
  error.CancellationReasons = [
    { Code: 'None' },
    { Code: 'None' },
    { Code: 'ConditionalCheckFailed' },
    { Code: 'None' },
  ];

  const repository = createRepositoryRecorder({
    transactError: error,
  });
  const { service } = createPickupHarness({
    repository,
  });

  await assert.rejects(
    service.confirmPickup({
      organizationId: 'org-1',
      pickupId: 'pickup-1',
      actorId: 'staff-1',
    }),
    (caught) =>
      caught.code ===
        'ORDER_NOT_READY_FOR_PICKUP' &&
      caught.httpStatus === 409,
  );
});

function createOrganizationPickupApp({
  role,
  pickupService,
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
      pickups: {
        pickupService,
      },
    },
  });
}

test('STAFF and ORGANIZATION_ADMIN can confirm Pickup through organization route', async () => {
  for (const role of [
    ORGANIZATION_ROLE.STAFF,
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  ]) {
    let seen;
    const app = createOrganizationPickupApp({
      role,
      userId:
        role === ORGANIZATION_ROLE.STAFF
          ? 'staff-1'
          : 'admin-1',
      pickupService: {
        async confirmPickup(input) {
          seen = input;
          return {
            ...makePickup(),
            status: PICKUP_STATUS.RECEIVED,
            receivedBy: input.actorId,
            receivedAt: FIXED_TIME,
          };
        },
      },
    });

    await request(app)
      .post(
        '/api/v1/organizations/org-1/pickups/pickup-1/confirm',
      )
      .expect(200);

    assert.deepEqual(seen, {
      organizationId: 'org-1',
      pickupId: 'pickup-1',
      actorId:
        role === ORGANIZATION_ROLE.STAFF
          ? 'staff-1'
          : 'admin-1',
    });
  }
});

test('Customer without Organization membership cannot use organization Pickup confirm route', async () => {
  let called = false;
  const app = createOrganizationPickupApp({
    role: null,
    userId: 'customer-1',
    pickupService: {
      async confirmPickup() {
        called = true;
        return makePickup();
      },
    },
  });

  const response = await request(app)
    .post(
      '/api/v1/organizations/org-1/pickups/pickup-1/confirm',
    )
    .expect(403);

  assert.equal(
    response.body.error.code,
    'MEMBERSHIP_REQUIRED',
  );
  assert.equal(called, false);
});

test('Customer own Pickup endpoint requires only authenticated Customer identity and no Organization membership', async () => {
  let seen;
  const app = createApp({
    users: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'customer-1',
          email: 'customer@example.com',
          status: 'ACTIVE',
        };
        next();
      },
      pickups: {
        pickupService: {
          async getOwnPickup(input) {
            seen = input;
            return makePickup();
          },
        },
      },
    },
  });

  const response = await request(app)
    .get('/api/v1/me/orders/order-1/pickup')
    .expect(200);

  assert.deepEqual(seen, {
    customerId: 'customer-1',
    orderId: 'order-1',
  });
  assert.equal(response.body.data.token, TOKEN);
});
