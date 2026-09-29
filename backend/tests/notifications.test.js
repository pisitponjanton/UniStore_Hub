'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const {
  NOTIFICATION_TYPE,
} = require('../src/modules/notifications/notification.constants');
const {
  mapEventToNotification,
  validateNotificationEvent,
} = require('../src/modules/notifications/notification.event');
const {
  createNotificationPublisher,
} = require('../src/modules/notifications/notification.publisher');
const {
  createNotificationRepository,
} = require('../src/modules/notifications/notification.repository');
const {
  createNotificationService,
} = require('../src/modules/notifications/notification.service');
const {
  validateNotificationListQuery,
} = require('../src/validators/notification.validator');
const {
  createNotificationWorker,
} = require('../src/worker');

const EVENT_ID =
  '11111111-1111-4111-8111-111111111111';
const SECOND_EVENT_ID =
  '22222222-2222-4222-8222-222222222222';
const OCCURRED_AT =
  '2026-09-29T14:30:00.000Z';

function makeEvent(overrides = {}) {
  return {
    version: 1,
    eventId: EVENT_ID,
    type: NOTIFICATION_TYPE.PAYMENT_APPROVED,
    occurredAt: OCCURRED_AT,
    organizationId: 'org-1',
    recipientUserId: 'user-1',
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
    data: {},
    ...overrides,
  };
}

function makeNotification(overrides = {}) {
  return {
    notificationId: EVENT_ID,
    userId: 'user-1',
    type: NOTIFICATION_TYPE.PAYMENT_APPROVED,
    title: 'Payment Approved',
    message: 'Payment Approved',
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
    readAt: null,
    createdAt: OCCURRED_AT,
    ...overrides,
  };
}

function page(items, lastEvaluatedKey = null) {
  return {
    items,
    lastEvaluatedKey,
  };
}

test('notification list query accepts read=true/false and rejects invalid read values', () => {
  assert.deepEqual(
    validateNotificationListQuery({
      read: 'true',
      cursor: 'cursor-1',
    }),
    {
      read: true,
      cursor: 'cursor-1',
    },
  );

  assert.deepEqual(
    validateNotificationListQuery({
      read: 'false',
    }),
    {
      read: false,
      cursor: undefined,
    },
  );

  assert.throws(
    () =>
      validateNotificationListQuery({
        read: 'yes',
      }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.httpStatus === 400,
  );
});

test('notification repository lists only one User partition and filters read/unread without Scan', async () => {
  const queries = [];
  const repository = createNotificationRepository({
    repository: {
      async query(input) {
        queries.push(input);
        return page([]);
      },
    },
  });

  await repository.listByUserPage('user-1', {
    read: false,
  });
  await repository.listByUserPage('user-1', {
    read: true,
  });

  assert.equal(queries.length, 2);
  assert.equal(
    queries[0].ExpressionAttributeValues[':pk'],
    'USER#user-1',
  );
  assert.equal(
    queries[0].ExpressionAttributeValues[
      ':notificationPrefix'
    ],
    'NOTIFICATION#',
  );
  assert.match(
    queries[0].FilterExpression,
    /attribute_not_exists\(#readAt\)/,
  );
  assert.match(
    queries[1].FilterExpression,
    /attribute_exists\(#readAt\)/,
  );
  assert.equal(
    Object.hasOwn(queries[0], 'Scan'),
    false,
  );
});

test('notification service returns only current-user items and binds cursor to read filter', async () => {
  const calls = [];
  const service = createNotificationService({
    notificationRepository: {
      async listByUserPage(userId, options) {
        calls.push({
          userId,
          options,
        });

        if (calls.length === 1) {
          return page(
            [makeNotification()],
            {
              PK: 'USER#user-1',
              SK:
                `NOTIFICATION#${OCCURRED_AT}#${EVENT_ID}`,
            },
          );
        }

        return page([]);
      },
    },
  });

  const first =
    await service.listNotifications({
      userId: 'user-1',
      read: false,
    });

  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].userId, 'user-1');
  assert.equal(
    typeof first.nextCursor,
    'string',
  );

  await assert.rejects(
    service.listNotifications({
      userId: 'user-1',
      read: true,
      cursor: first.nextCursor,
    }),
    (error) =>
      error.code === 'INVALID_CURSOR' &&
      error.httpStatus === 400,
  );

  const second =
    await service.listNotifications({
      userId: 'user-1',
      read: false,
      cursor: first.nextCursor,
    });

  assert.equal(second.items.length, 0);
  assert.deepEqual(
    calls[1].options.exclusiveStartKey,
    {
      PK: 'USER#user-1',
      SK:
        `NOTIFICATION#${OCCURRED_AT}#${EVENT_ID}`,
    },
  );
});

test('notification service fails closed if repository returns another User notification', async () => {
  const service = createNotificationService({
    notificationRepository: {
      async listByUserPage() {
        return page([
          makeNotification({
            userId: 'user-other',
          }),
        ]);
      },
    },
  });

  await assert.rejects(
    service.listNotifications({
      userId: 'user-1',
    }),
    (error) =>
      error.httpStatus === 403,
  );
});

test('mark read looks up notification within current User partition and records current ISO UTC timestamp', async () => {
  const calls = [];
  const service = createNotificationService({
    clock: () => '2026-09-29T15:00:00.000Z',
    notificationRepository: {
      async findById(userId, notificationId) {
        calls.push({
          type: 'find',
          userId,
          notificationId,
        });
        return makeNotification();
      },

      async markRead(
        userId,
        createdAt,
        notificationId,
        readAt,
      ) {
        calls.push({
          type: 'update',
          userId,
          createdAt,
          notificationId,
          readAt,
        });

        return makeNotification({
          readAt,
        });
      },
    },
  });

  const result = await service.markRead({
    userId: 'user-1',
    notificationId: EVENT_ID,
  });

  assert.equal(
    result.readAt,
    '2026-09-29T15:00:00.000Z',
  );
  assert.deepEqual(calls, [
    {
      type: 'find',
      userId: 'user-1',
      notificationId: EVENT_ID,
    },
    {
      type: 'update',
      userId: 'user-1',
      createdAt: OCCURRED_AT,
      notificationId: EVENT_ID,
      readAt: '2026-09-29T15:00:00.000Z',
    },
  ]);
});

test('mark read returns NOTIFICATION_NOT_FOUND for missing or non-owned notification', async () => {
  const missing = createNotificationService({
    notificationRepository: {
      async findById() {
        return null;
      },
    },
  });

  await assert.rejects(
    missing.markRead({
      userId: 'user-1',
      notificationId: EVENT_ID,
    }),
    (error) =>
      error.code ===
        'NOTIFICATION_NOT_FOUND' &&
      error.httpStatus === 404,
  );

  const wrongOwner = createNotificationService({
    notificationRepository: {
      async findById() {
        return makeNotification({
          userId: 'user-other',
        });
      },
    },
  });

  await assert.rejects(
    wrongOwner.markRead({
      userId: 'user-1',
      notificationId: EVENT_ID,
    }),
    (error) =>
      error.code ===
        'NOTIFICATION_NOT_FOUND' &&
      error.httpStatus === 404,
  );
});

test('notification publisher emits the exact versioned event contract', async () => {
  const sent = [];
  const publisher = createNotificationPublisher({
    idFactory: () => EVENT_ID,
    clock: () => OCCURRED_AT,
    sqsAdapter: {
      async sendJson(event) {
        sent.push(event);
      },
    },
  });

  const event = await publisher.publish({
    type: NOTIFICATION_TYPE.PAYMENT_APPROVED,
    organizationId: 'org-1',
    recipientUserId: 'user-1',
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
  });

  assert.deepEqual(event, {
    version: 1,
    eventId: EVENT_ID,
    type: NOTIFICATION_TYPE.PAYMENT_APPROVED,
    occurredAt: OCCURRED_AT,
    organizationId: 'org-1',
    recipientUserId: 'user-1',
    resourceType: 'PAYMENT',
    resourceId: 'payment-1',
    data: {},
  });
  assert.deepEqual(sent, [event]);
});

test('event validation accepts only canonical types and rejects sensitive data fields', () => {
  for (const type of [
    NOTIFICATION_TYPE.PAYMENT_APPROVED,
    NOTIFICATION_TYPE.PAYMENT_REJECTED,
    NOTIFICATION_TYPE.READY_FOR_PICKUP,
  ]) {
    assert.equal(
      validateNotificationEvent(
        makeEvent({ type }),
      ).type,
      type,
    );
  }

  for (const data of [
    { passwordHash: 'secret' },
    { jwt: 'token' },
    { awsSecretAccessKey: 'secret' },
    { nested: { slipBinary: 'blob' } },
    { binary: Buffer.from('raw') },
  ]) {
    assert.throws(
      () =>
        validateNotificationEvent(
          makeEvent({ data }),
        ),
      (error) =>
        error.code ===
          'INVALID_NOTIFICATION_EVENT',
    );
  }

  assert.throws(
    () =>
      validateNotificationEvent(
        makeEvent({
          type: 'UNKNOWN_EVENT',
        }),
      ),
    (error) =>
      error.code ===
        'INVALID_NOTIFICATION_EVENT',
  );
});

test('worker maps eventId and occurredAt to canonical Notification identity', async () => {
  const writes = [];
  const worker = createNotificationWorker({
    notificationRepository: {
      async putNotification(notification) {
        writes.push(notification);
      },
    },
  });

  const result = await worker.processEvent(
    makeEvent(),
  );

  assert.equal(result.duplicate, false);
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0].notificationId,
    EVENT_ID,
  );
  assert.equal(
    writes[0].createdAt,
    OCCURRED_AT,
  );
  assert.equal(writes[0].userId, 'user-1');
  assert.equal(
    writes[0].type,
    NOTIFICATION_TYPE.PAYMENT_APPROVED,
  );
  assert.equal(writes[0].readAt, null);

  assert.deepEqual(
    mapEventToNotification(makeEvent()),
    writes[0],
  );
});

test('notification repository conditional put uses canonical USER/NOTIFICATION key and omits unread readAt', async () => {
  let seen;
  const repository = createNotificationRepository({
    repository: {
      async put(input) {
        seen = input;
        return {};
      },
    },
  });

  await repository.putNotification(
    makeNotification(),
  );

  assert.equal(
    seen.Item.PK,
    'USER#user-1',
  );
  assert.equal(
    seen.Item.SK,
    `NOTIFICATION#${OCCURRED_AT}#${EVENT_ID}`,
  );
  assert.equal(
    seen.Item.entityType,
    'Notification',
  );
  assert.equal(
    Object.hasOwn(seen.Item, 'readAt'),
    false,
  );
  assert.equal(
    seen.ConditionExpression,
    'attribute_not_exists(PK) AND attribute_not_exists(SK)',
  );
});

test('worker treats conditional duplicate delivery as successful idempotent processing', async () => {
  let attempts = 0;
  const duplicateError = new Error(
    'duplicate',
  );
  duplicateError.name =
    'ConditionalCheckFailedException';

  const worker = createNotificationWorker({
    notificationRepository: {
      async putNotification() {
        attempts += 1;
        throw duplicateError;
      },
    },
  });

  const result = await worker.processEvent(
    makeEvent(),
  );

  assert.equal(attempts, 1);
  assert.equal(result.duplicate, true);
  assert.equal(
    result.notification.notificationId,
    EVENT_ID,
  );
});

test('worker partial-batch response retries only failed records and logs failure observably', async () => {
  const errors = [];
  const worker = createNotificationWorker({
    notificationRepository: {
      async putNotification(notification) {
        if (
          notification.notificationId ===
          SECOND_EVENT_ID
        ) {
          const error = new Error(
            'DynamoDB unavailable',
          );
          error.code = 'DDB_UNAVAILABLE';
          throw error;
        }
      },
    },
    logger: {
      error(message, context) {
        errors.push({
          message,
          context,
        });
      },
    },
  });

  const result = await worker.handleBatch({
    Records: [
      {
        messageId: 'message-ok',
        body: JSON.stringify(
          makeEvent(),
        ),
      },
      {
        messageId: 'message-fail',
        body: JSON.stringify(
          makeEvent({
            eventId: SECOND_EVENT_ID,
          }),
        ),
      },
    ],
  });

  assert.deepEqual(result, {
    batchItemFailures: [
      {
        itemIdentifier: 'message-fail',
      },
    ],
  });
  assert.equal(errors.length, 1);
  assert.equal(
    errors[0].message,
    'notification_worker_record_failed',
  );
  assert.equal(
    errors[0].context.messageId,
    'message-fail',
  );
  assert.equal(
    errors[0].context.errorCode,
    'DDB_UNAVAILABLE',
  );
});

test('worker failure after SQS receipt is not acknowledged as success', async () => {
  const worker = createNotificationWorker({
    notificationRepository: {
      async putNotification() {
        throw new Error(
          'persistent write failure',
        );
      },
    },
    logger: {
      error() {},
    },
  });

  const result = await worker.handleBatch({
    Records: [
      {
        messageId: 'message-1',
        body: JSON.stringify(
          makeEvent(),
        ),
      },
    ],
  });

  assert.deepEqual(result, {
    batchItemFailures: [
      {
        itemIdentifier: 'message-1',
      },
    ],
  });
});

test('worker invalid JSON/event records are isolated as item failures in a mixed batch', async () => {
  const worker = createNotificationWorker({
    notificationRepository: {
      async putNotification() {},
    },
    logger: {
      error() {},
    },
  });

  const result = await worker.handleBatch({
    Records: [
      {
        messageId: 'invalid-json',
        body: '{',
      },
      {
        messageId: 'invalid-event',
        body: JSON.stringify({
          version: 99,
        }),
      },
      {
        messageId: 'valid',
        body: JSON.stringify(
          makeEvent(),
        ),
      },
    ],
  });

  assert.deepEqual(result, {
    batchItemFailures: [
      {
        itemIdentifier: 'invalid-json',
      },
      {
        itemIdentifier: 'invalid-event',
      },
    ],
  });
});

function createNotificationRouteApp({
  userId = 'user-1',
  notificationService,
} = {}) {
  return createApp({
    notifications: {
      authMiddleware(req, res, next) {
        req.user = {
          userId,
          email: `${userId}@example.com`,
          status: 'ACTIVE',
        };
        next();
      },
      notificationService,
    },
  });
}

test('notification HTTP routes use authenticated userId for list and mark-read ownership', async () => {
  const calls = [];
  const app = createNotificationRouteApp({
    notificationService: {
      async listNotifications(input) {
        calls.push({
          type: 'list',
          input,
        });

        return {
          items: [makeNotification()],
          nextCursor: null,
        };
      },

      async markRead(input) {
        calls.push({
          type: 'read',
          input,
        });

        return makeNotification({
          readAt:
            '2026-09-29T15:00:00.000Z',
        });
      },
    },
  });

  const listResponse = await request(app)
    .get(
      '/api/v1/notifications?read=false',
    )
    .expect(200);

  assert.equal(
    listResponse.body.data.items[0].userId,
    'user-1',
  );

  const readResponse = await request(app)
    .patch(
      `/api/v1/notifications/${EVENT_ID}/read`,
    )
    .expect(200);

  assert.equal(
    readResponse.body.data.readAt,
    '2026-09-29T15:00:00.000Z',
  );

  assert.deepEqual(calls, [
    {
      type: 'list',
      input: {
        userId: 'user-1',
        read: false,
        cursor: undefined,
      },
    },
    {
      type: 'read',
      input: {
        userId: 'user-1',
        notificationId: EVENT_ID,
      },
    },
  ]);
});
