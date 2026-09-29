'use strict';

const {
  sendList,
  sendSuccess,
} = require('../../utils/response');
const {
  validatePickupListQuery,
} = require('../../validators/pickup.validator');
const {
  createPickupService,
} = require('./pickup.service');

function createPickupController(options = {}) {
  const pickupService =
    options.pickupService ||
    createPickupService(options);

  return {
    async list(req, res, next) {
      try {
        const filters =
          validatePickupListQuery(req.query);
        const result =
          await pickupService.listPickups({
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

    async get(req, res, next) {
      try {
        return sendSuccess(
          res,
          await pickupService.getPickup({
            organizationId:
              req.params.organizationId,
            pickupId: req.params.pickupId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },

    async confirm(req, res, next) {
      try {
        return sendSuccess(
          res,
          await pickupService.confirmPickup({
            organizationId:
              req.params.organizationId,
            pickupId: req.params.pickupId,
            actorId: req.user.userId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },

    async getOwn(req, res, next) {
      try {
        return sendSuccess(
          res,
          await pickupService.getOwnPickup({
            customerId: req.user.userId,
            orderId: req.params.orderId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createPickupController,
};
