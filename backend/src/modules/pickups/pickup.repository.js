'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const {
  pickupKey,
  pickupLinkKey,
} = require('../../repositories/keys');

function createPickupRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async getByOrder(organizationId, orderId) {
      return getRepository().get({
        Key: pickupKey(
          organizationId,
          orderId,
        ),
      });
    },

    async getLinkById(
      organizationId,
      pickupId,
    ) {
      return getRepository().get({
        Key: pickupLinkKey(
          organizationId,
          pickupId,
        ),
      });
    },

    async listLinksPage(
      organizationId,
      {
        campaignId,
        status,
        orderId,
        exclusiveStartKey,
      } = {},
    ) {
      const input = {
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :pickupPrefix)',
        FilterExpression: '#entityType = :linkType',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':pk': `ORG#${organizationId}`,
          ':pickupPrefix': 'PICKUP#',
          ':linkType': 'PickupLink',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      };
      const filters = ['#entityType = :linkType'];

      if (campaignId) {
        input.ExpressionAttributeNames['#campaignId'] =
          'campaignId';
        input.ExpressionAttributeValues[':campaignId'] =
          campaignId;
        filters.push('#campaignId = :campaignId');
      }

      if (status) {
        input.ExpressionAttributeNames['#status'] =
          'status';
        input.ExpressionAttributeValues[':status'] =
          status;
        filters.push('#status = :status');
      }

      if (orderId) {
        input.ExpressionAttributeNames['#orderId'] =
          'orderId';
        input.ExpressionAttributeValues[':orderId'] =
          orderId;
        filters.push('#orderId = :orderId');
      }

      input.FilterExpression = filters.join(' AND ');

      return getRepository().query(input);
    },

    async listByTokenPage(
      organizationId,
      token,
      { exclusiveStartKey } = {},
    ) {
      return getRepository().query({
        IndexName: 'GSI1',
        KeyConditionExpression:
          'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :pickupPrefix)',
        FilterExpression: '#entityType = :pickupType',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':gsi1pk':
            `ORG#${organizationId}#PICKUP_TOKEN#${token}`,
          ':pickupPrefix': 'PICKUP#',
          ':pickupType': 'Pickup',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      });
    },
  };
}

module.exports = {
  createPickupRepository,
};
