import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertErrorEnvelope,
  assertHttpStatus,
  assertNoStorageFields,
} from '../helpers/assertions.mjs';
import { requestJson } from '../helpers/http.mjs';
import { withBackendServer } from '../helpers/backend-app.mjs';
import { createFixtureFactory } from '../fixtures/factories.mjs';

const requireFromHere = createRequire(import.meta.url);
const { createSqsAdapter } = requireFromHere('../../backend/src/aws/sqs.js');

const fixture = createFixtureFactory({ seed: 'CT-NOTIFICATION' });
const notificationId = fixture.id('notification', 1);
const organizationId = fixture.id('organization', 1);
const recipientUserId = fixture.id('user', 1);
const paymentId = fixture.id('payment', 1);
const eventId = fixture.id('event', 1);
const occurredAt = '2026-09-29T09:30:00.000Z';

async function againstBackend(callback) {
  return withBackendServer(async ({ baseUrl }) => callback(baseUrl));
}

function assertAuthRequired(result) {
  assertHttpStatus(result, 401);
  assertErrorEnvelope(result.body, 'AUTH_REQUIRED');
  assertNoStorageFields(result.body);
}

test('CT-NOTIFY-001 notification list requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: '/api/v1/notifications?read=false',
    });

    assertAuthRequired(result);
  });
});

test('CT-NOTIFY-002 mark-read requires bearer authentication', async () => {
  await againstBackend(async (baseUrl) => {
    const result = await requestJson({
      baseUrl,
      path: `/api/v1/notifications/${notificationId}/read`,
      method: 'PATCH',
    });

    assertAuthRequired(result);
  });
});

test('CT-NOTIFY-003 SQS adapter sends the canonical JSON payload to the configured queue URL', async () => {
  let capturedCommand = null;
  const queueUrl = 'http://localhost:4566/000000000000/unistore-hub-notifications-local';
  const client = {
    async send(command) {
      capturedCommand = command;
      return { MessageId: 'test-message-id' };
    },
  };

  const event = {
    version: 1,
    eventId,
    type: 'PAYMENT_APPROVED',
    occurredAt,
    organizationId,
    recipientUserId,
    resourceType: 'PAYMENT',
    resourceId: paymentId,
    data: {},
  };

  const adapter = createSqsAdapter({ client, queueUrl });
  await adapter.sendJson(event);

  assert.ok(capturedCommand);
  assert.equal(capturedCommand.input.QueueUrl, queueUrl);
  assert.deepEqual(JSON.parse(capturedCommand.input.MessageBody), event);
});

test('CT-NOTIFY-004 Backend Worker entrypoint src/worker.js exists', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const workerPath = path.resolve(here, '../../backend/src/worker.js');
  await access(workerPath);
});

test(
  'CT-NOTIFY-005 current-user Notification list returns only notification.userId matching authenticated user',
  { todo: 'BLOCKED: requires mounted Notification routes plus two authenticated users with distinct persisted Notifications' },
  () => {},
);

test(
  'CT-NOTIFY-006 read filter and cursor pagination remain scoped to current user',
  { todo: 'BLOCKED: requires Notification repository/list implementation with disposable read/unread fixtures' },
  () => {},
);

test(
  'CT-NOTIFY-007 mark-read requires Notification ownership and sets readAt to current canonical ISO UTC timestamp',
  { todo: 'BLOCKED: requires mounted mark-read route and persisted Notifications owned by two different users' },
  () => {},
);

test(
  'CT-NOTIFY-008 PAYMENT_APPROVED publishes canonical version-1 event only after Payment/Order/Audit core transaction commits',
  { todo: 'BLOCKED: requires implemented Payment approval transaction plus injectable failing/recording SQS publisher' },
  () => {},
);

test(
  'CT-NOTIFY-009 PAYMENT_REJECTED publishes canonical version-1 event only after core rejection transaction commits',
  { todo: 'BLOCKED: requires implemented Payment rejection transaction plus injectable failing/recording SQS publisher' },
  () => {},
);

test(
  'CT-NOTIFY-010 READY_FOR_PICKUP publishes one canonical event per eligible Order after core ready-for-pickup writes commit',
  { todo: 'BLOCKED: requires Campaign ready-for-pickup implementation plus Order/Pickup/PickupLink fixtures and observable publisher' },
  () => {},
);

test(
  'CT-NOTIFY-011 SQS publish failure after Payment approval does not roll back committed Payment/Order state and is observable',
  { todo: 'BLOCKED: mandatory resilience case requires implemented Payment approval with injectable SQS failure and observable logging' },
  () => {},
);

test(
  'CT-NOTIFY-012 Worker failure after message receipt does not alter committed core state and is reported as failure for retry',
  { todo: 'BLOCKED: mandatory resilience case requires src/worker.js and injectable failing Notification repository' },
  () => {},
);

test(
  'CT-NOTIFY-013 Worker maps notificationId=eventId and createdAt=occurredAt',
  { todo: 'BLOCKED: requires implemented Worker event-to-Notification mapping' },
  () => {},
);

test(
  'CT-NOTIFY-014 duplicate delivery of the same eventId creates only one Notification and succeeds idempotently',
  { todo: 'BLOCKED: requires Worker conditional-put implementation and duplicate SQS event fixture' },
  () => {},
);

test(
  'CT-NOTIFY-015 Worker write failure is not reported as successful processing',
  { todo: 'BLOCKED: requires implemented Worker handler and injectable failing DynamoDB Notification write' },
  () => {},
);

test(
  'CT-NOTIFY-016 canonical event payload excludes passwordHash, JWT, AWS credentials, and slip binary',
  { todo: 'BLOCKED: requires implemented notification publisher/event builders for Payment and ready-for-pickup flows' },
  () => {},
);
