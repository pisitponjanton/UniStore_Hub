'use strict';

const {
  logger,
} = require('./utils/logger');
const {
  mapEventToNotification,
  validateNotificationEvent,
} = require('./modules/notifications/notification.event');
const {
  createNotificationRepository,
} = require('./modules/notifications/notification.repository');

function isDuplicateNotificationError(error) {
  return (
    error?.name ===
      'ConditionalCheckFailedException' ||
    error?.code ===
      'ConditionalCheckFailedException'
  );
}

function createNotificationWorker(options = {}) {
  const log = options.logger || logger;
  let notificationRepository =
    options.notificationRepository;

  function getNotificationRepository() {
    if (!notificationRepository) {
      notificationRepository =
        createNotificationRepository({
          repository: options.repository,
        });
    }

    return notificationRepository;
  }

  async function processEvent(event) {
    validateNotificationEvent(event);
    const notification =
      mapEventToNotification(event);

    try {
      await getNotificationRepository()
        .putNotification(notification);

      return {
        duplicate: false,
        notification,
      };
    } catch (error) {
      if (
        isDuplicateNotificationError(
          error,
        )
      ) {
        return {
          duplicate: true,
          notification,
        };
      }

      throw error;
    }
  }

  async function processRecord(record) {
    if (
      !record ||
      typeof record.body !== 'string'
    ) {
      const error = new Error(
        'SQS record body must be a JSON string',
      );
      error.code =
        'INVALID_NOTIFICATION_EVENT';
      throw error;
    }

    let event;

    try {
      event = JSON.parse(record.body);
    } catch {
      const error = new Error(
        'SQS record body contains invalid JSON',
      );
      error.code =
        'INVALID_NOTIFICATION_EVENT';
      throw error;
    }

    return processEvent(event);
  }

  async function handleBatch(event = {}) {
    const records = Array.isArray(
      event.Records,
    )
      ? event.Records
      : [];
    const batchItemFailures = [];

    for (const record of records) {
      try {
        await processRecord(record);
      } catch (error) {
        if (
          typeof record?.messageId !==
            'string' ||
          record.messageId.length === 0
        ) {
          throw error;
        }

        batchItemFailures.push({
          itemIdentifier:
            record.messageId,
        });

        log.error(
          'notification_worker_record_failed',
          {
            messageId: record.messageId,
            errorCode:
              error?.code ||
              error?.name ||
              'UNKNOWN',
          },
        );
      }
    }

    return {
      batchItemFailures,
    };
  }

  return {
    processEvent,
    processRecord,
    handleBatch,
  };
}

const defaultWorker =
  createNotificationWorker();

async function handler(event) {
  return defaultWorker.handleBatch(event);
}

module.exports = {
  isDuplicateNotificationError,
  createNotificationWorker,
  handler,
};
