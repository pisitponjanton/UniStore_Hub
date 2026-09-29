'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const {
  platformUserLinkKey,
  userEmailIndex,
  userProfileKey,
} = require('../../repositories/keys');

function createUserRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async getById(userId) {
      return getRepository().get({
        Key: userProfileKey(userId),
      });
    },

    async findByEmail(normalizedEmail) {
      const result = await getRepository().query({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `EMAIL#${normalizedEmail}`,
        },
        Limit: 1,
      });

      return result.items[0] ?? null;
    },

    async listPlatformLinksPage({
      exclusiveStartKey,
    } = {}) {
      return getRepository().query({
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :userPrefix)',
        FilterExpression:
          '#entityType = :linkType',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':pk': 'PLATFORM#USERS',
          ':userPrefix': 'USER#',
          ':linkType': 'PlatformUserLink',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      });
    },

    async createUserWithPlatformLink(user) {
      const profileKey = userProfileKey(user.userId);
      const emailIndex = userEmailIndex(user.email, user.userId);
      const linkKey = platformUserLinkKey(user.createdAt, user.userId);

      const userItem = {
        ...profileKey,
        ...emailIndex,
        entityType: 'User',
        ...user,
      };

      const platformUserLink = {
        ...linkKey,
        entityType: 'PlatformUserLink',
        userId: user.userId,
        status: user.status,
        createdAt: user.createdAt,
      };

      await getRepository().transactWrite({
        TransactItems: [
          {
            Put: {
              Item: userItem,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              Item: platformUserLink,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });

      return user;
    },

    async setPlatformRoleAndEnsureLink(
      user,
      {
        platformRole,
        updatedAt,
      },
    ) {
      const link = {
        ...platformUserLinkKey(
          user.createdAt,
          user.userId,
        ),
        entityType: 'PlatformUserLink',
        userId: user.userId,
        status: user.status,
        createdAt: user.createdAt,
      };

      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: userProfileKey(user.userId),
              UpdateExpression:
                'SET #platformRole = :platformRole, #updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#platformRole': 'platformRole',
                '#updatedAt': 'updatedAt',
                '#entityType': 'entityType',
              },
              ExpressionAttributeValues: {
                ':platformRole': platformRole,
                ':updatedAt': updatedAt,
                ':userType': 'User',
              },
              ConditionExpression:
                '#entityType = :userType',
            },
          },
          {
            Put: {
              Item: link,
            },
          },
        ],
      });

      return {
        ...user,
        platformRole,
        updatedAt,
      };
    },
  };
}

module.exports = {
  createUserRepository,
};
