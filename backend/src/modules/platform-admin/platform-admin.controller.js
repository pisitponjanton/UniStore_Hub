'use strict';

const {
  sendList,
  sendSuccess,
} = require('../../utils/response');
const {
  createPlatformAdminService,
} = require('./platform-admin.service');

function createPlatformAdminController(
  options = {},
) {
  const service =
    options.platformAdminService ||
    createPlatformAdminService(options);

  return {
    async listOrganizations(
      req,
      res,
      next,
    ) {
      try {
        return sendList(
          res,
          await service.listOrganizations(),
          null,
        );
      } catch (error) {
        return next(error);
      }
    },

    async approveOrganization(
      req,
      res,
      next,
    ) {
      try {
        return sendSuccess(
          res,
          await service.approveOrganization({
            organizationId:
              req.params.organizationId,
            actorId: req.user.userId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },

    async suspendOrganization(
      req,
      res,
      next,
    ) {
      try {
        return sendSuccess(
          res,
          await service.suspendOrganization({
            organizationId:
              req.params.organizationId,
            actorId: req.user.userId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },

    async listUsers(req, res, next) {
      try {
        return sendList(
          res,
          await service.listUsers(),
          null,
        );
      } catch (error) {
        return next(error);
      }
    },

    async summary(req, res, next) {
      try {
        return sendSuccess(
          res,
          await service.getSummary(),
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createPlatformAdminController,
};
