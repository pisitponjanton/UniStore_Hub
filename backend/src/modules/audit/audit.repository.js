'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');

function createAuditRepository(options = {}) {
  let repository = options.repository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  return {
    async listByOrganizationPage(
      organizationId,
      {
        actorId,
        action,
        resourceType,
        resourceId,
        exclusiveStartKey,
      } = {},
    ) {
      const input = {
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :auditPrefix)',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':pk': `ORG#${organizationId}`,
          ':auditPrefix': 'AUDIT#',
          ':auditType': 'AuditLog',
        },
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
      };
      const filters = [
        '#entityType = :auditType',
      ];

      if (actorId) {
        input.ExpressionAttributeNames['#actorId'] =
          'actorId';
        input.ExpressionAttributeValues[':actorId'] =
          actorId;
        filters.push('#actorId = :actorId');
      }

      if (action) {
        input.ExpressionAttributeNames['#action'] =
          'action';
        input.ExpressionAttributeValues[':action'] =
          action;
        filters.push('#action = :action');
      }

      if (resourceType) {
        input.ExpressionAttributeNames[
          '#resourceType'
        ] = 'resourceType';
        input.ExpressionAttributeValues[
          ':resourceType'
        ] = resourceType;
        filters.push(
          '#resourceType = :resourceType',
        );
      }

      if (resourceId) {
        input.ExpressionAttributeNames[
          '#resourceId'
        ] = 'resourceId';
        input.ExpressionAttributeValues[
          ':resourceId'
        ] = resourceId;
        filters.push('#resourceId = :resourceId');
      }

      input.FilterExpression =
        filters.join(' AND ');

      return getRepository().query(input);
    },
  };
}

module.exports = {
  createAuditRepository,
};
