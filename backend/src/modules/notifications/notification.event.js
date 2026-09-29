'use strict';

const {
  NOTIFICATION_LABEL,
  NOTIFICATION_TYPE,
} = require('./notification.constants');
const {
  isIsoUtcTimestamp,
} = require('../../utils/time');

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORBIDDEN_EVENT_DATA_KEYS = new Set([
  'password',
  'passwordHash',
  'jwt',
  'authorization',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsSessionToken',
  'slipBinary',
  'binary',
]);

function invalidEvent(message) {
  const error = new Error(message);
  error.code = 'INVALID_NOTIFICATION_EVENT';
  return error;
}

function requireNonEmptyString(value, fieldName) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw invalidEvent(
      `${fieldName} must be a non-empty string`,
    );
  }

  return value;
}

function assertSafeEventData(value, path = 'data') {
  if (
    value === null ||
    ['string', 'number', 'boolean'].includes(
      typeof value,
    )
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeEventData(
        item,
        `${path}[${index}]`,
      ),
    );
    return;
  }

  if (
    !value ||
    typeof value !== 'object' ||
    Buffer.isBuffer(value)
  ) {
    throw invalidEvent(
      `${path} contains an unsupported value`,
    );
  }

  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_EVENT_DATA_KEYS.has(key)) {
      throw invalidEvent(
        `${path} contains forbidden field ${key}`,
      );
    }

    assertSafeEventData(
      item,
      `${path}.${key}`,
    );
  }
}

function validateNotificationEvent(event) {
  if (
    !event ||
    typeof event !== 'object' ||
    Array.isArray(event)
  ) {
    throw invalidEvent(
      'Notification event must be an object',
    );
  }

  if (event.version !== 1) {
    throw invalidEvent(
      'Notification event version must be 1',
    );
  }

  requireNonEmptyString(event.eventId, 'eventId');

  if (!UUID_V4_PATTERN.test(event.eventId)) {
    throw invalidEvent(
      'eventId must be a UUID v4',
    );
  }

  if (
    !Object.values(NOTIFICATION_TYPE).includes(
      event.type,
    )
  ) {
    throw invalidEvent(
      'Notification event type is invalid',
    );
  }

  if (!isIsoUtcTimestamp(event.occurredAt)) {
    throw invalidEvent(
      'occurredAt must be an ISO 8601 UTC timestamp',
    );
  }

  requireNonEmptyString(
    event.organizationId,
    'organizationId',
  );
  requireNonEmptyString(
    event.recipientUserId,
    'recipientUserId',
  );
  requireNonEmptyString(
    event.resourceType,
    'resourceType',
  );
  requireNonEmptyString(
    event.resourceId,
    'resourceId',
  );

  if (
    !event.data ||
    typeof event.data !== 'object' ||
    Array.isArray(event.data)
  ) {
    throw invalidEvent(
      'data must be an object',
    );
  }

  assertSafeEventData(event.data);

  return event;
}

function mapEventToNotification(event) {
  validateNotificationEvent(event);

  const label = NOTIFICATION_LABEL[event.type];

  return {
    notificationId: event.eventId,
    userId: event.recipientUserId,
    type: event.type,
    title: label,
    message: label,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    readAt: null,
    createdAt: event.occurredAt,
  };
}

module.exports = {
  UUID_V4_PATTERN,
  FORBIDDEN_EVENT_DATA_KEYS,
  invalidEvent,
  assertSafeEventData,
  validateNotificationEvent,
  mapEventToNotification,
};
