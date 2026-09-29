'use strict';

const {
  createDynamoRepository,
} = require('../../aws/dynamodb');
const {
  notificationKey,
} = require('../../repositories/keys');

function createNotificationRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async listByUserPage(
      userId,
      {
        read,
        exclusiveStartKey,
      } = {},
    ) {
      const input = {
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :notificationPrefix)',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':notificationPrefix':
            'NOTIFICATION#',
          ':notificationType':
            'Notification',
        },
        FilterExpression:
          '#entityType = :notificationType',
        ...(exclusiveStartKey
          ? {
              ExclusiveStartKey:
                exclusiveStartKey,
            }
          : {}),
      };

      if (read === true) {
        input.ExpressionAttributeNames[
          '#readAt'
        ] = 'readAt';
        input.FilterExpression +=
          ' AND attribute_exists(#readAt)';
      } else if (read === false) {
        input.ExpressionAttributeNames[
          '#readAt'
        ] = 'readAt';
        input.FilterExpression +=
          ' AND attribute_not_exists(#readAt)';
      }

      return getRepository().query(input);
    },

    async findById(userId, notificationId) {
      let exclusiveStartKey;

      do {
        const result =
          await getRepository().query({
            KeyConditionExpression:
              'PK = :pk AND begins_with(SK, :notificationPrefix)',
            FilterExpression:
              '#entityType = :notificationType AND #notificationId = :notificationId',
            ExpressionAttributeNames: {
              '#entityType': 'entityType',
              '#notificationId':
                'notificationId',
            },
            ExpressionAttributeValues: {
              ':pk': `USER#${userId}`,
              ':notificationPrefix':
                'NOTIFICATION#',
              ':notificationType':
                'Notification',
              ':notificationId':
                notificationId,
            },
            ...(exclusiveStartKey
              ? {
                  ExclusiveStartKey:
                    exclusiveStartKey,
                }
              : {}),
          });

        if (result.items.length > 0) {
          return result.items[0];
        }

        exclusiveStartKey =
          result.lastEvaluatedKey;
      } while (exclusiveStartKey);

      return null;
    },

    async markRead(
      userId,
      createdAt,
      notificationId,
      readAt,
    ) {
      const response =
        await getRepository().update({
          Key: notificationKey(
            userId,
            createdAt,
            notificationId,
          ),
          UpdateExpression:
            'SET #readAt = :readAt',
          ExpressionAttributeNames: {
            '#readAt': 'readAt',
            '#userId': 'userId',
            '#entityType': 'entityType',
          },
          ExpressionAttributeValues: {
            ':readAt': readAt,
            ':userId': userId,
            ':notificationType':
              'Notification',
          },
          ConditionExpression:
            '#userId = :userId AND #entityType = :notificationType',
          ReturnValues: 'ALL_NEW',
        });

      return response.Attributes ?? null;
    },
    async putNotification(notification) {
      const item = {
        ...notificationKey(
          notification.userId,
          notification.createdAt,
          notification.notificationId,
        ),
        entityType: 'Notification',
        ...notification,
      };

      if (item.readAt == null) {
        delete item.readAt;
      }

      return getRepository().put({
        Item: item,
        ConditionExpression:
          'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      });
    },
  };
}

module.exports = {
  createNotificationRepository,
};