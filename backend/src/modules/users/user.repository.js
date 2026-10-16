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

    async getManyByIds(userIds) {
      const ids = [...new Set(userIds)];
      const byId = new Map();

      // DynamoDB BatchGetItem allows at most 100 distinct keys per call.
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100);
        let keys = batch.map(userProfileKey);
        let attempt = 0;

        while (keys.length > 0) {
          const result = await getRepository().batchGet({
            Keys: keys,
          });

          for (const user of result.items) {
            byId.set(user.userId, user);
          }

          keys = result.unprocessedKeys;
          if (keys.length > 0) {
            if (attempt >= 6) {
              throw new Error(
                'DynamoDB BatchGet could not read all User profiles',
              );
            }
            await new Promise((resolve) => {
              setTimeout(resolve, 25 * 2 ** attempt);
            });
            attempt += 1;
          }
        }
      }

      // BatchGet does not guarantee item ordering. Missing profiles
      // remain null and the Platform service must reject them.
      return userIds.map((userId) => byId.get(userId) ?? null);
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
