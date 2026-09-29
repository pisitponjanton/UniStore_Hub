'use strict';

const {
  requireTenantMatch,
} = require('../../policies/organization.policy');
const {
  decodeCursor,
  encodeCursor,
} = require('../../utils/cursor');
const {
  toAuditLogDto,
} = require('./audit.mapper');
const {
  createAuditRepository,
} = require('./audit.repository');

function createAuditService(options = {}) {
  let auditRepository = options.auditRepository;

  function getAuditRepository() {
    if (!auditRepository) {
      auditRepository = createAuditRepository({
        repository: options.repository,
      });
    }

    return auditRepository;
  }

  return {
    async listAuditLogs({
      organizationId,
      actorId,
      action,
      resourceType,
      resourceId,
      cursor,
    }) {
      const scope = [
        'audit',
        organizationId,
        actorId || 'all-actors',
        action || 'all-actions',
        resourceType || 'all-resource-types',
        resourceId || 'all-resources',
      ].join(':');
      const exclusiveStartKey = decodeCursor(
        cursor,
        scope,
      );

      const result =
        await getAuditRepository().listByOrganizationPage(
          organizationId,
          {
            actorId,
            action,
            resourceType,
            resourceId,
            exclusiveStartKey,
          },
        );

      const items = result.items.map((audit) => {
        requireTenantMatch(
          audit,
          organizationId,
        );

        return toAuditLogDto(audit);
      });

      return {
        items,
        nextCursor: result.lastEvaluatedKey
          ? encodeCursor(
              scope,
              result.lastEvaluatedKey,
            )
          : null,
      };
    },
  };
}

module.exports = {
  createAuditService,
};
