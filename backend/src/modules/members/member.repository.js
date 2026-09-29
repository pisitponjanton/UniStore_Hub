'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { organizationMemberKey } = require('../../repositories/keys');

function createMemberRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async getByOrganizationAndUser(organizationId, userId) {
      return getRepository().get({
        Key: organizationMemberKey(organizationId, userId),
      });
    },

    async listByOrganization(organizationId) {
      const result = await getRepository().query({
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :memberPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ORG#${organizationId}`,
          ':memberPrefix': 'MEMBER#',
        },
      });

      return result.items;
    },

    async listForUser(userId) {
      const result = await getRepository().query({
        IndexName: 'GSI1',
        KeyConditionExpression:
          'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)',
        ExpressionAttributeValues: {
          ':gsi1pk': `USER#${userId}`,
          ':gsi1sk': 'ORG#',
        },
      });

      return result.items;
    },
  };
}

module.exports = {
  createMemberRepository,
};
