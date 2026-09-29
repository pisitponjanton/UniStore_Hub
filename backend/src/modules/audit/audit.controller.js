'use strict';

const {
  sendList,
} = require('../../utils/response');
const {
  validateAuditQuery,
} = require('../../validators/audit.validator');
const {
  createAuditService,
} = require('./audit.service');

function createAuditController(options = {}) {
  const auditService =
    options.auditService ||
    createAuditService(options);

  return {
    async list(req, res, next) {
      try {
        const filters =
          validateAuditQuery(req.query);
        const result =
          await auditService.listAuditLogs({
            organizationId:
              req.params.organizationId,
            ...filters,
          });

        return sendList(
          res,
          result.items,
          result.nextCursor,
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createAuditController,
};
