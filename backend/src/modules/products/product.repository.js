'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const {
  productKey,
  productVariantKey,
} = require('../../repositories/keys');

function createProductRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async getProduct(organizationId, productId) {
      return getRepository().get({
        Key: productKey(organizationId, productId),
      });
    },

    async listProductsByOrganization(
      organizationId,
      { exclusiveStartKey } = {},
    ) {
      return getRepository().query({
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :productPrefix)',
        FilterExpression: '#entityType = :productType',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':pk': `ORG#${organizationId}`,
          ':productPrefix': 'PRODUCT#',
          ':productType': 'Product',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      });
    },

    async listProductsByStore(
      organizationId,
      storeId,
      { exclusiveStartKey } = {},
    ) {
      return getRepository().query({
        IndexName: 'GSI1',
        KeyConditionExpression:
          'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :productPrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': `ORG#${organizationId}#STORE#${storeId}`,
          ':productPrefix': 'PRODUCT#',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      });
    },

    async getVariant(organizationId, productId, variantId) {
      return getRepository().get({
        Key: productVariantKey(
          organizationId,
          productId,
          variantId,
        ),
      });
    },

    async listVariants(organizationId, productId) {
      const result = await getRepository().query({
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :variantPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ORG#${organizationId}`,
          ':variantPrefix': `PRODUCT#${productId}#VARIANT#`,
        },
      });

      return result.items;
    },
  };
}

module.exports = {
  createProductRepository,
};
