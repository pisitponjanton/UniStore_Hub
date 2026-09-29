'use strict';

const { sendList, sendSuccess } = require('../../utils/response');
const {
  optionalId,
  validateCreateOrderBody,
  validateOrderStatusFilter,
} = require('../../validators/order.validator');
const { createOrderService } = require('./order.service');

function createOrderController(options = {}) {
  const orderService =
    options.orderService || createOrderService(options);

  return {
    async create(req, res, next) {
      try {
        const input = validateCreateOrderBody(req.body);
        const order = await orderService.createOrder({
          organizationId: req.params.organizationId,
          customerId: req.user.userId,
          ...input,
        });

        return sendSuccess(res, order, 201);
      } catch (error) {
        return next(error);
      }
    },

    async listOrganization(req, res, next) {
      try {
        const result =
          await orderService.listOrganizationOrders({
            organizationId: req.params.organizationId,
            campaignId: optionalId(
              typeof req.query.campaignId === 'string'
                ? req.query.campaignId
                : undefined,
              'campaignId',
            ),
            status: validateOrderStatusFilter(
              typeof req.query.status === 'string'
                ? req.query.status
                : undefined,
            ),
            customerId: optionalId(
              typeof req.query.customerId === 'string'
                ? req.query.customerId
                : undefined,
              'customerId',
            ),
            cursor:
              typeof req.query.cursor === 'string'
                ? req.query.cursor
                : undefined,
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

    async getOrganization(req, res, next) {
      try {
        const order =
          await orderService.getOrganizationOrder({
            organizationId: req.params.organizationId,
            orderId: req.params.orderId,
          });

        return sendSuccess(res, order);
      } catch (error) {
        return next(error);
      }
    },

    async cancelOrganization(req, res, next) {
      try {
        const order =
          await orderService.cancelOrganizationOrder({
            organizationId: req.params.organizationId,
            orderId: req.params.orderId,
            actorId: req.user.userId,
          });

        return sendSuccess(res, order);
      } catch (error) {
        return next(error);
      }
    },

    async listOwn(req, res, next) {
      try {
        const result = await orderService.listOwnOrders({
          customerId: req.user.userId,
          cursor:
            typeof req.query.cursor === 'string'
              ? req.query.cursor
              : undefined,
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

    async getOwn(req, res, next) {
      try {
        const order = await orderService.getOwnOrder({
          customerId: req.user.userId,
          orderId: req.params.orderId,
        });

        return sendSuccess(res, order);
      } catch (error) {
        return next(error);
      }
    },

    async cancelOwn(req, res, next) {
      try {
        const order =
          await orderService.cancelOwnOrder({
            customerId: req.user.userId,
            orderId: req.params.orderId,
          });

        return sendSuccess(res, order);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createOrderController,
};
