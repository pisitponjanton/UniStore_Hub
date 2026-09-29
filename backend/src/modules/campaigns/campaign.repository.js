'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { campaignKey } = require('../../repositories/keys');

function applyCampaignFilter(input, status) {
  input.ExpressionAttributeNames = {
    '#entityType': 'entityType',
  };
  input.ExpressionAttributeValues[':campaignType'] = 'Campaign';

  if (status) {
    input.ExpressionAttributeNames['#status'] = 'status';
    input.ExpressionAttributeValues[':status'] = status;
    input.FilterExpression =
      '#entityType = :campaignType AND #status = :status';
  } else {
    input.FilterExpression = '#entityType = :campaignType';
  }

  return input;
}

function createCampaignRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async getById(organizationId, campaignId) {
      return getRepository().get({
        Key: campaignKey(organizationId, campaignId),
      });
    },

    async listByOrganizationPage(
      organizationId,
      { status, exclusiveStartKey } = {},
    ) {
      const input = {
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :campaignPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ORG#${organizationId}`,
          ':campaignPrefix': 'CAMPAIGN#',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      };

      return getRepository().query(
        applyCampaignFilter(input, status),
      );
    },

    async listByStorePage(
      organizationId,
      storeId,
      { status, exclusiveStartKey } = {},
    ) {
      const input = {
        IndexName: 'GSI1',
        KeyConditionExpression:
          'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :campaignPrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': `ORG#${organizationId}#STORE#${storeId}`,
          ':campaignPrefix': 'CAMPAIGN#',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      };

      return getRepository().query(
        applyCampaignFilter(input, status),
      );
    },
  };
}

module.exports = {
  createCampaignRepository,
};
