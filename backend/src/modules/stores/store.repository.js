'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { storeKey } = require('../../repositories/keys');

function createStoreRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  async function listByOrganizationPage(
    organizationId,
    { exclusiveStartKey } = {},
  ) {
    return getRepository().query({
      KeyConditionExpression:
        'PK = :pk AND begins_with(SK, :storePrefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${organizationId}`,
        ':storePrefix': 'STORE#',
      },
      ...(exclusiveStartKey
        ? { ExclusiveStartKey: exclusiveStartKey }
        : {}),
    });
  }

  return {
    async getById(organizationId, storeId) {
      return getRepository().get({
        Key: storeKey(organizationId, storeId),
      });
    },

    listByOrganizationPage,

    async listByOrganization(organizationId) {
      const items = [];
      let exclusiveStartKey;

      do {
        const result = await listByOrganizationPage(
          organizationId,
          { exclusiveStartKey },
        );
        items.push(...result.items);
        exclusiveStartKey = result.lastEvaluatedKey;
      } while (exclusiveStartKey);

      return items;
    },
  };
}

module.exports = {
  createStoreRepository,
};
