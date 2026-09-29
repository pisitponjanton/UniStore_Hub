'use strict';

const { AppError } = require('../../errors/app-error');
const {
  decodeCursor,
  encodeCursor,
} = require('../../utils/cursor');
const {
  nowIsoUtc,
} = require('../../utils/time');
const {
  toNotificationDto,
} = require('./notification.mapper');
const {
  createNotificationRepository,
} = require('./notification.repository');

function notificationNotFound() {
  return new AppError({
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'Notification not found',
    httpStatus: 404,
  });
}

function createNotificationService(options = {}) {
  const clock = options.clock || nowIsoUtc;
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

  return {
    async listNotifications({
      userId,
      read,
      cursor,
    }) {
      const scope = [
        'notifications',
        userId,
        read === undefined
          ? 'all'
          : read
            ? 'read'
            : 'unread',
      ].join(':');
      const exclusiveStartKey =
        decodeCursor(cursor, scope);

      const result =
        await getNotificationRepository()
          .listByUserPage(userId, {
            read,
            exclusiveStartKey,
          });

      const items = result.items.map(
        (notification) => {
          if (
            notification.userId !== userId
          ) {
            throw new AppError({
              code: 'FORBIDDEN',
              message:
                'Notification ownership mismatch',
              httpStatus: 403,
            });
          }

          return toNotificationDto(
            notification,
          );
        },
      );

      return {
        items,
        nextCursor:
          result.lastEvaluatedKey
            ? encodeCursor(
                scope,
                result.lastEvaluatedKey,
              )
            : null,
      };
    },

    async markRead({
      userId,
      notificationId,
    }) {
      const notification =
        await getNotificationRepository()
          .findById(
            userId,
            notificationId,
          );

      if (!notification) {
        throw notificationNotFound();
      }

      if (notification.userId !== userId) {
        throw notificationNotFound();
      }

      try {
        const updated =
          await getNotificationRepository()
            .markRead(
              userId,
              notification.createdAt,
              notificationId,
              clock(),
            );

        if (!updated) {
          throw notificationNotFound();
        }

        if (updated.userId !== userId) {
          throw notificationNotFound();
        }

        return toNotificationDto(updated);
      } catch (error) {
        if (
          error?.name ===
            'ConditionalCheckFailedException' ||
          error?.code ===
            'ConditionalCheckFailedException'
        ) {
          throw notificationNotFound();
        }

        throw error;
      }
    },
  };
}

module.exports = {
  notificationNotFound,
  createNotificationService,
};
