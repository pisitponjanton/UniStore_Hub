'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createId } = require('../src/utils/id');
const { nowIsoUtc, isIsoUtcTimestamp } = require('../src/utils/time');
const { encodeCursor, decodeCursor } = require('../src/utils/cursor');
const keys = require('../src/repositories/keys');
const { buildAwsClientOptions } = require('../src/aws/client-options');
const {
  createDynamoRepository,
  requireTableName,
} = require('../src/aws/dynamodb');
const {
  DEFAULT_PRESIGN_EXPIRES_SECONDS,
  createS3Adapter,
  createS3Client,
  requireBucketName,
} = require('../src/aws/s3');
const {
  createSqsAdapter,
  requireQueueUrl,
  requireReceiptHandle,
} = require('../src/aws/sqs');


function createFakeClient(responseFactory = () => ({})) {
  const commands = [];

  return {
    commands,
    async send(command) {
      commands.push(command);
      return responseFactory(command, commands.length - 1);
    },
  };
}

test('createId returns UUID v4 identifiers', () => {
  const id = createId();

  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('time helper returns canonical ISO 8601 UTC timestamps', () => {
  const timestamp = nowIsoUtc();

  assert.equal(isIsoUtcTimestamp(timestamp), true);
  assert.equal(isIsoUtcTimestamp('2026-09-29T07:00:00Z'), false);
  assert.equal(isIsoUtcTimestamp('not-a-date'), false);
  assert.equal(isIsoUtcTimestamp(null), false);
});

test('opaque cursor round-trips storage state only for the expected scope', () => {
  const state = {
    PK: 'ORG#org-1',
    SK: 'ORDER#order-1',
    GSI1PK: 'USER#user-1',
    GSI1SK: 'ORDER#2026-09-29T07:00:00.000Z#order-1',
  };

  const cursor = encodeCursor('orders:org-1', state);

  assert.equal(cursor.includes('ORG#org-1'), false);
  assert.deepEqual(decodeCursor(cursor, 'orders:org-1'), state);
  assert.equal(decodeCursor(undefined, 'orders:org-1'), null);
});

test('cursor rejects malformed or cross-scope values with INVALID_CURSOR', () => {
  const valid = encodeCursor('orders:org-1', { PK: 'ORG#org-1' });

  assert.throws(
    () => decodeCursor(valid, 'orders:org-2'),
    (error) => error.code === 'INVALID_CURSOR' && error.httpStatus === 400,
  );

  for (const invalid of ['***', Buffer.from('{}').toString('base64url')]) {
    assert.throws(
      () => decodeCursor(invalid, 'orders:org-1'),
      (error) => error.code === 'INVALID_CURSOR',
    );
  }
});

test('key builders match the canonical User, Organization and member patterns', () => {
  assert.deepEqual(keys.userProfileKey('user-1'), {
    PK: 'USER#user-1',
    SK: 'PROFILE',
  });
  assert.deepEqual(keys.userEmailIndex('user@example.com', 'user-1'), {
    GSI1PK: 'EMAIL#user@example.com',
    GSI1SK: 'USER#user-1',
  });
  assert.deepEqual(
    keys.platformUserLinkKey('2026-09-29T07:00:00.000Z', 'user-1'),
    {
      PK: 'PLATFORM#USERS',
      SK: 'USER#2026-09-29T07:00:00.000Z#user-1',
    },
  );
  assert.deepEqual(keys.organizationProfileKey('org-1'), {
    PK: 'ORG#org-1',
    SK: 'PROFILE',
  });
  assert.deepEqual(keys.organizationMemberKey('org-1', 'user-1'), {
    PK: 'ORG#org-1',
    SK: 'MEMBER#user-1',
  });
  assert.deepEqual(keys.membershipUserIndex('user-1', 'org-1'), {
    GSI1PK: 'USER#user-1',
    GSI1SK: 'ORG#org-1',
  });
});

test('store, product, variant and campaign keys preserve tenant and store context', () => {
  assert.deepEqual(keys.storeKey('org-1', 'store-1'), {
    PK: 'ORG#org-1',
    SK: 'STORE#store-1',
  });
  assert.deepEqual(keys.productKey('org-1', 'product-1'), {
    PK: 'ORG#org-1',
    SK: 'PRODUCT#product-1',
  });
  assert.deepEqual(
    keys.productStoreIndex('org-1', 'store-1', 'product-1'),
    {
      GSI1PK: 'ORG#org-1#STORE#store-1',
      GSI1SK: 'PRODUCT#product-1',
    },
  );
  assert.deepEqual(
    keys.productVariantKey('org-1', 'product-1', 'variant-1'),
    {
      PK: 'ORG#org-1',
      SK: 'PRODUCT#product-1#VARIANT#variant-1',
    },
  );
  assert.deepEqual(keys.campaignKey('org-1', 'campaign-1'), {
    PK: 'ORG#org-1',
    SK: 'CAMPAIGN#campaign-1',
  });
  assert.deepEqual(
    keys.campaignStoreIndex(
      'org-1',
      'store-1',
      '2026-09-29T07:00:00.000Z',
      'campaign-1',
    ),
    {
      GSI1PK: 'ORG#org-1#STORE#store-1',
      GSI1SK:
        'CAMPAIGN#2026-09-29T07:00:00.000Z#campaign-1',
    },
  );
});

test('order and child keys always include organization tenant context', () => {
  assert.deepEqual(keys.orderKey('org-1', 'order-1'), {
    PK: 'ORG#org-1',
    SK: 'ORDER#order-1',
  });
  assert.equal(
    keys.orderChildPartition('org-1', 'order-1'),
    'ORG#org-1#ORDER#order-1',
  );
  assert.deepEqual(keys.orderItemKey('org-1', 'order-1', 'item-1'), {
    PK: 'ORG#org-1#ORDER#order-1',
    SK: 'ITEM#item-1',
  });
  assert.deepEqual(keys.paymentKey('org-1', 'order-1', 'payment-1'), {
    PK: 'ORG#org-1#ORDER#order-1',
    SK: 'PAYMENT#payment-1',
  });
  assert.deepEqual(keys.pickupKey('org-1', 'order-1'), {
    PK: 'ORG#org-1#ORDER#order-1',
    SK: 'PICKUP',
  });
});

test('denormalized order and pickup index keys match Data Spec access patterns', () => {
  assert.deepEqual(
    keys.campaignOrderLinkKey(
      'org-1',
      'campaign-1',
      '2026-09-29T07:00:00.000Z',
      'order-1',
    ),
    {
      PK: 'ORG#org-1',
      SK:
        'CAMPAIGN#campaign-1#ORDER#2026-09-29T07:00:00.000Z#order-1',
    },
  );

  assert.deepEqual(keys.pickupLinkKey('org-1', 'pickup-1'), {
    PK: 'ORG#org-1',
    SK: 'PICKUP#pickup-1',
  });

  assert.deepEqual(
    keys.pickupTokenIndex('org-1', 'token-1', 'pickup-1', 'order-1'),
    {
      GSI1PK: 'ORG#org-1#PICKUP_TOKEN#token-1',
      GSI1SK: 'PICKUP#pickup-1#ORDER#order-1',
    },
  );
});

test('key builders fail closed when a required tenant/resource identifier is missing', () => {
  assert.throws(
    () => keys.orderKey('', 'order-1'),
    /organizationId is required/,
  );
  assert.throws(
    () => keys.paymentKey('org-1', '', 'payment-1'),
    /orderId is required/,
  );
});

test('AWS client options use the configured region and optional local endpoint', () => {
  assert.deepEqual(
    buildAwsClientOptions({
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
    }),
    {
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
    },
  );

  assert.deepEqual(buildAwsClientOptions({ region: 'us-east-1', endpoint: '' }), {
    region: 'us-east-1',
  });
});

test('S3 client keeps required-only request checksums in local and production modes', async () => {
  const localClient = createS3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:4566',
  });
  const productionClient = createS3Client({
    region: 'us-east-1',
    endpoint: '',
  });

  try {
    assert.equal(
      await localClient.config.requestChecksumCalculation(),
      'WHEN_REQUIRED',
    );
    assert.equal(
      await productionClient.config.requestChecksumCalculation(),
      'WHEN_REQUIRED',
    );

    const localForcePathStyle =
      typeof localClient.config.forcePathStyle === 'function'
        ? await localClient.config.forcePathStyle()
        : localClient.config.forcePathStyle;
    const productionForcePathStyle =
      typeof productionClient.config.forcePathStyle === 'function'
        ? await productionClient.config.forcePathStyle()
        : productionClient.config.forcePathStyle;

    assert.equal(localForcePathStyle, true);
    assert.equal(productionForcePathStyle, false);
  } finally {
    localClient.destroy();
    productionClient.destroy();
  }
});

test('S3 presigned PUT keeps canonical path and expiry without optional checksum query parameters', async () => {
  const previousAccessKey =
    process.env.AWS_ACCESS_KEY_ID;
  const previousSecretKey =
    process.env.AWS_SECRET_ACCESS_KEY;
  const previousSessionToken =
    process.env.AWS_SESSION_TOKEN;
  process.env.AWS_ACCESS_KEY_ID =
    'local-presign-test';
  process.env.AWS_SECRET_ACCESS_KEY =
    'local-presign-test-secret';
  delete process.env.AWS_SESSION_TOKEN;

  const client = createS3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:4566',
  });

  try {
    const adapter = createS3Adapter({
      client,
      bucketName: 'private-files-test',
    });
    const objectKey =
      'payments/org-1/order-1/11111111-1111-4111-8111-111111111111';
    const url = await adapter.createPutUrl({
      objectKey,
      contentType: 'image/png',
      expiresInSeconds: 900,
    });
    const parsed = new URL(url);

    assert.equal(
      parsed.pathname,
      `/private-files-test/${objectKey}`,
    );
    assert.equal(
      parsed.searchParams.get('X-Amz-Expires'),
      '900',
    );
    assert.equal(
      parsed.searchParams.get('X-Amz-Algorithm'),
      'AWS4-HMAC-SHA256',
    );
    assert.equal(
      parsed.searchParams.get('X-Amz-Content-Sha256'),
      'UNSIGNED-PAYLOAD',
    );
    assert.equal(
      parsed.searchParams.has(
        'x-amz-sdk-checksum-algorithm',
      ),
      false,
    );
    assert.equal(
      parsed.searchParams.has(
        'x-amz-checksum-crc32',
      ),
      false,
    );
  } finally {
    client.destroy();

    if (previousAccessKey === undefined) {
      delete process.env.AWS_ACCESS_KEY_ID;
    } else {
      process.env.AWS_ACCESS_KEY_ID =
        previousAccessKey;
    }

    if (previousSecretKey === undefined) {
      delete process.env.AWS_SECRET_ACCESS_KEY;
    } else {
      process.env.AWS_SECRET_ACCESS_KEY =
        previousSecretKey;
    }

    if (previousSessionToken === undefined) {
      delete process.env.AWS_SESSION_TOKEN;
    } else {
      process.env.AWS_SESSION_TOKEN =
        previousSessionToken;
    }
  }
});

test('DynamoDB repository injects the configured table and exposes no Scan operation', async () => {
  const client = createFakeClient((command) => {
    if (command.constructor.name === 'GetCommand') {
      return { Item: { PK: 'ORG#org-1', SK: 'PROFILE' } };
    }

    if (command.constructor.name === 'QueryCommand') {
      return {
        Items: [{ PK: 'ORG#org-1', SK: 'STORE#store-1' }],
        LastEvaluatedKey: { PK: 'ORG#org-1', SK: 'STORE#store-1' },
        Count: 1,
      };
    }

    return {};
  });

  const repository = createDynamoRepository({
    client,
    tableName: 'unistore-test',
  });

  assert.equal(repository.scan, undefined);

  const item = await repository.get({
    Key: { PK: 'ORG#org-1', SK: 'PROFILE' },
  });
  assert.deepEqual(item, { PK: 'ORG#org-1', SK: 'PROFILE' });
  assert.equal(client.commands[0].input.TableName, 'unistore-test');

  const result = await repository.query({
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': 'ORG#org-1' },
  });
  assert.equal(client.commands[1].input.TableName, 'unistore-test');
  assert.deepEqual(result.items, [
    { PK: 'ORG#org-1', SK: 'STORE#store-1' },
  ]);
  assert.deepEqual(result.lastEvaluatedKey, {
    PK: 'ORG#org-1',
    SK: 'STORE#store-1',
  });
  assert.equal(result.count, 1);
});

test('DynamoDB transaction helper injects the same application table into every operation', async () => {
  const client = createFakeClient();
  const repository = createDynamoRepository({
    client,
    tableName: 'unistore-test',
  });

  await repository.transactWrite({
    TransactItems: [
      {
        Put: {
          Item: { PK: 'ORG#org-1', SK: 'ORDER#order-1' },
        },
      },
      {
        Update: {
          Key: { PK: 'ORG#org-1', SK: 'CAMPAIGN#campaign-1' },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': 'OPEN' },
        },
      },
    ],
  });

  const transactItems = client.commands[0].input.TransactItems;
  assert.equal(transactItems[0].Put.TableName, 'unistore-test');
  assert.equal(transactItems[1].Update.TableName, 'unistore-test');
});

test('DynamoDB helper rejects operations when APP_TABLE_NAME is unavailable', () => {
  assert.throws(
    () => requireTableName(undefined),
    (error) =>
      error.code === 'CONFIG_MISSING' &&
      error.message === 'APP_TABLE_NAME is required for DynamoDB operations',
  );
});

test('S3 adapter HEAD requests stay inside the configured private Files bucket', async () => {
  const client = createFakeClient(() => ({
    ContentType: 'image/png',
    ContentLength: 1024,
  }));
  const adapter = createS3Adapter({
    client,
    bucketName: 'private-files-test',
  });

  const result = await adapter.headObject({
    objectKey: 'payments/org-1/order-1/file-1',
  });

  assert.equal(DEFAULT_PRESIGN_EXPIRES_SECONDS, 900);
  assert.equal(client.commands.length, 1);
  assert.equal(client.commands[0].constructor.name, 'HeadObjectCommand');
  assert.deepEqual(client.commands[0].input, {
    Bucket: 'private-files-test',
    Key: 'payments/org-1/order-1/file-1',
  });
  assert.deepEqual(result, {
    ContentType: 'image/png',
    ContentLength: 1024,
  });
});

test('S3 helper rejects use without a Files bucket name', () => {
  assert.throws(
    () => requireBucketName(undefined),
    (error) =>
      error.code === 'CONFIG_MISSING' &&
      error.message === 'FILES_BUCKET_NAME is required for S3 operations',
  );
});

test('SQS adapter serializes canonical event objects as JSON to the configured queue', async () => {
  const client = createFakeClient(() => ({ MessageId: 'message-1' }));
  const adapter = createSqsAdapter({
    client,
    queueUrl: 'http://localhost:4566/000000000000/notifications',
  });

  const event = {
    version: 1,
    eventId: 'event-1',
    type: 'PAYMENT_APPROVED',
    recipientUserId: 'user-1',
  };

  const response = await adapter.sendJson(event);

  assert.deepEqual(response, { MessageId: 'message-1' });
  assert.equal(client.commands[0].constructor.name, 'SendMessageCommand');
  assert.equal(
    client.commands[0].input.QueueUrl,
    'http://localhost:4566/000000000000/notifications',
  );
  assert.deepEqual(JSON.parse(client.commands[0].input.MessageBody), event);
});

test('SQS helper rejects use without a notification queue URL', () => {
  assert.throws(
    () => requireQueueUrl(undefined),
    (error) =>
      error.code === 'CONFIG_MISSING' &&
      error.message ===
        'NOTIFICATION_QUEUE_URL is required for SQS operations',
  );
});


test('SQS adapter long-polls and deletes by receipt handle for local worker use', async () => {
  const client = createFakeClient(
    (command) => {
      if (
        command.constructor.name ===
        'ReceiveMessageCommand'
      ) {
        return {
          Messages: [
            {
              MessageId: 'message-1',
              ReceiptHandle: 'receipt-1',
              Body: '{"version":1}',
            },
          ],
        };
      }

      return {};
    },
  );
  const queueUrl =
    'http://localhost:4566/000000000000/notifications';
  const adapter = createSqsAdapter({
    client,
    queueUrl,
  });

  const messages =
    await adapter.receiveMessages({
      maxNumberOfMessages: 10,
      waitTimeSeconds: 20,
    });

  assert.equal(messages.length, 1);
  assert.equal(
    client.commands[0].constructor.name,
    'ReceiveMessageCommand',
  );
  assert.deepEqual(
    client.commands[0].input,
    {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
    },
  );

  await adapter.deleteMessage(
    'receipt-1',
  );

  assert.equal(
    client.commands[1].constructor.name,
    'DeleteMessageCommand',
  );
  assert.deepEqual(
    client.commands[1].input,
    {
      QueueUrl: queueUrl,
      ReceiptHandle: 'receipt-1',
    },
  );
});

test('SQS delete helper rejects a missing receipt handle', () => {
  assert.throws(
    () => requireReceiptHandle(),
    (error) =>
      error.code ===
      'INVALID_SQS_MESSAGE',
  );
});
