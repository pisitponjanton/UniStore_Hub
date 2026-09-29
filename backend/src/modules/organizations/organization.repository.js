'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { organizationProfileKey } = require('../../repositories/keys');

function createOrganizationRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async getById(organizationId) {
      return getRepository().get({
        Key: organizationProfileKey(organizationId),
      });
    },

    async listPlatform({ exclusiveStartKey } = {}) {
      return getRepository().query({
        IndexName: 'GSI1',
        KeyConditionExpression:
          'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :createdPrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': 'ORGS',
          ':createdPrefix': 'CREATED#',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      });
    },
  };
}

module.exports = {
  createOrganizationRepository,
};
