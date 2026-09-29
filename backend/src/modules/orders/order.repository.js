'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const {
  orderKey,
  orderChildPartition,
} = require('../../repositories/keys');

function createOrderRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  async function listCampaignLinksPage(
    organizationId,
    campaignId,
    {
      status,
      customerId,
      exclusiveStartKey,
    } = {},
  ) {
    const input = {
      KeyConditionExpression:
        'PK = :pk AND begins_with(SK, :campaignOrderPrefix)',
      FilterExpression: '#entityType = :linkType',
      ExpressionAttributeNames: {
        '#entityType': 'entityType',
      },
      ExpressionAttributeValues: {
        ':pk': `ORG#${organizationId}`,
        ':campaignOrderPrefix':
          `CAMPAIGN#${campaignId}#ORDER#`,
        ':linkType': 'CampaignOrderLink',
      },
      ...(exclusiveStartKey
        ? { ExclusiveStartKey: exclusiveStartKey }
        : {}),
    };

    const filters = ['#entityType = :linkType'];

    if (status) {
      input.ExpressionAttributeNames['#status'] = 'status';
      input.ExpressionAttributeValues[':status'] = status;
      filters.push('#status = :status');
    }

    if (customerId) {
      input.ExpressionAttributeNames['#customerId'] =
        'customerId';
      input.ExpressionAttributeValues[':customerId'] =
        customerId;
      filters.push('#customerId = :customerId');
    }

    input.FilterExpression = filters.join(' AND ');

    return getRepository().query(input);
  }

  return {
    async getById(organizationId, orderId) {
      return getRepository().get({
        Key: orderKey(organizationId, orderId),
      });
    },

    async listItems(organizationId, orderId) {
      const result = await getRepository().query({
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :itemPrefix)',
        ExpressionAttributeValues: {
          ':pk': orderChildPartition(
            organizationId,
            orderId,
          ),
          ':itemPrefix': 'ITEM#',
        },
      });

      return result.items;
    },

    async listByOrganizationPage(
      organizationId,
      {
        status,
        customerId,
        exclusiveStartKey,
      } = {},
    ) {
      const input = {
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :orderPrefix)',
        FilterExpression: '#entityType = :orderType',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':pk': `ORG#${organizationId}`,
          ':orderPrefix': 'ORDER#',
          ':orderType': 'Order',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      };

      const filters = ['#entityType = :orderType'];

      if (status) {
        input.ExpressionAttributeNames['#status'] = 'status';
        input.ExpressionAttributeValues[':status'] = status;
        filters.push('#status = :status');
      }

      if (customerId) {
        input.ExpressionAttributeNames['#customerId'] =
          'customerId';
        input.ExpressionAttributeValues[':customerId'] =
          customerId;
        filters.push('#customerId = :customerId');
      }

      input.FilterExpression = filters.join(' AND ');

      return getRepository().query(input);
    },

    listCampaignLinksPage,

    async listCampaignLinks(organizationId, campaignId) {
      const items = [];
      let exclusiveStartKey;

      do {
        const result = await listCampaignLinksPage(
          organizationId,
          campaignId,
          { exclusiveStartKey },
        );

        items.push(...result.items);
        exclusiveStartKey = result.lastEvaluatedKey;
      } while (exclusiveStartKey);

      return items;
    },

    async listByCustomerPage(
      customerId,
      { exclusiveStartKey } = {},
    ) {
      return getRepository().query({
        IndexName: 'GSI1',
        KeyConditionExpression:
          'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :orderPrefix)',
        FilterExpression: '#entityType = :orderType',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':gsi1pk': `USER#${customerId}`,
          ':orderPrefix': 'ORDER#',
          ':orderType': 'Order',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      });
    },

    async findOwnedById(customerId, orderId) {
      let exclusiveStartKey;

      do {
        const result = await getRepository().query({
          IndexName: 'GSI1',
          KeyConditionExpression:
            'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :orderPrefix)',
          FilterExpression:
            '#entityType = :orderType AND #orderId = :orderId',
          ExpressionAttributeNames: {
            '#entityType': 'entityType',
            '#orderId': 'orderId',
          },
          ExpressionAttributeValues: {
            ':gsi1pk': `USER#${customerId}`,
            ':orderPrefix': 'ORDER#',
            ':orderType': 'Order',
            ':orderId': orderId,
          },
          ...(exclusiveStartKey
            ? { ExclusiveStartKey: exclusiveStartKey }
            : {}),
        });

        if (result.items.length > 0) {
          return result.items[0];
        }

        exclusiveStartKey = result.lastEvaluatedKey;
      } while (exclusiveStartKey);

      return null;
    },
  };
}

module.exports = {
  createOrderRepository,
};
