'use strict';

const { sendList, sendSuccess } = require('../../utils/response');
const {
  validateCreateOrganizationBody,
  validateUpdateOrganizationBody,
} = require('../../validators/organization.validator');
const {
  createOrganizationService,
} = require('./organization.service');

function createOrganizationController(options = {}) {
  const organizationService =
    options.organizationService || createOrganizationService(options);

  return {
    async list(req, res, next) {
      try {
        const items =
          await organizationService.listAccessibleOrganizations(
            req.user.userId,
          );

        return sendList(res, items, null);
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const input = validateCreateOrganizationBody(req.body);
        const organization =
          await organizationService.createOrganization({
            ...input,
            actorId: req.user.userId,
          });

        return sendSuccess(res, organization, 201);
      } catch (error) {
        return next(error);
      }
    },

    async get(req, res, next) {
      try {
        return sendSuccess(
          res,
          await organizationService.getOrganization(
            req.params.organizationId,
          ),
        );
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const changes = validateUpdateOrganizationBody(req.body);
        const organization =
          await organizationService.updateOrganization({
            organizationId: req.params.organizationId,
            actorId: req.user.userId,
            changes,
          });

        return sendSuccess(res, organization);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createOrganizationController,
};
