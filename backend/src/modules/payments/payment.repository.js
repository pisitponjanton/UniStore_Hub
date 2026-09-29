'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const {
  orderChildPartition,
} = require('../../repositories/keys');

function createPaymentRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  async function listByOrder(organizationId, orderId) {
    const result = await getRepository().query({
      KeyConditionExpression:
        'PK = :pk AND begins_with(SK, :paymentPrefix)',
      FilterExpression: '#entityType = :paymentType',
      ExpressionAttributeNames: {
        '#entityType': 'entityType',
      },
      ExpressionAttributeValues: {
        ':pk': orderChildPartition(
          organizationId,
          orderId,
        ),
        ':paymentPrefix': 'PAYMENT#',
        ':paymentType': 'Payment',
      },
    });

    return result.items;
  }

  async function listByOrganizationPage(
    organizationId,
    { status, exclusiveStartKey } = {},
  ) {
    const sortPrefix = status
      ? `PAYMENT#${status}#`
      : 'PAYMENT#';

    return getRepository().query({
      IndexName: 'GSI1',
      KeyConditionExpression:
        'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :paymentPrefix)',
      FilterExpression: '#entityType = :paymentType',
      ExpressionAttributeNames: {
        '#entityType': 'entityType',
      },
      ExpressionAttributeValues: {
        ':gsi1pk': `ORG#${organizationId}`,
        ':paymentPrefix': sortPrefix,
        ':paymentType': 'Payment',
      },
      ...(exclusiveStartKey
        ? { ExclusiveStartKey: exclusiveStartKey }
        : {}),
    });
  }

  return {
    listByOrder,
    listByOrganizationPage,

    async getByOrder(organizationId, orderId) {
      const items = await listByOrder(
        organizationId,
        orderId,
      );

      if (items.length === 0) {
        return null;
      }

      if (items.length > 1) {
        throw new Error(
          'Multiple logical Payment records found for one Order',
        );
      }

      return items[0];
    },

    async findById(organizationId, paymentId) {
      let exclusiveStartKey;

      do {
        const result = await getRepository().query({
          IndexName: 'GSI1',
          KeyConditionExpression:
            'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :paymentPrefix)',
          FilterExpression:
            '#entityType = :paymentType AND #paymentId = :paymentId',
          ExpressionAttributeNames: {
            '#entityType': 'entityType',
            '#paymentId': 'paymentId',
          },
          ExpressionAttributeValues: {
            ':gsi1pk': `ORG#${organizationId}`,
            ':paymentPrefix': 'PAYMENT#',
            ':paymentType': 'Payment',
            ':paymentId': paymentId,
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
  createPaymentRepository,
};
