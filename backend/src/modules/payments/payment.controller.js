'use strict';

const {
  sendList,
  sendSuccess,
} = require('../../utils/response');
const {
  optionalId,
  validatePaymentStatusFilter,
  validateRejectPaymentBody,
  validateSubmitPaymentBody,
} = require('../../validators/payment.validator');
const {
  createPaymentService,
} = require('./payment.service');

function createPaymentController(options = {}) {
  const paymentService =
    options.paymentService ||
    createPaymentService(options);

  return {
    async submit(req, res, next) {
      try {
        const { slipKey } =
          validateSubmitPaymentBody(req.body);

        const payment =
          await paymentService.submitPayment({
            organizationId: req.params.organizationId,
            orderId: req.params.orderId,
            customerId: req.user.userId,
            slipKey,
          });

        return sendSuccess(res, payment, 201);
      } catch (error) {
        return next(error);
      }
    },

    async list(req, res, next) {
      try {
        const result =
          await paymentService.listPayments({
            organizationId: req.params.organizationId,
            status: validatePaymentStatusFilter(
              typeof req.query.status === 'string'
                ? req.query.status
                : undefined,
            ),
            campaignId: optionalId(
              typeof req.query.campaignId === 'string'
                ? req.query.campaignId
                : undefined,
              'campaignId',
            ),
            orderId: optionalId(
              typeof req.query.orderId === 'string'
                ? req.query.orderId
                : undefined,
              'orderId',
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

    async get(req, res, next) {
      try {
        return sendSuccess(
          res,
          await paymentService.getPayment({
            organizationId: req.params.organizationId,
            paymentId: req.params.paymentId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },

    async approve(req, res, next) {
      try {
        return sendSuccess(
          res,
          await paymentService.approvePayment({
            organizationId: req.params.organizationId,
            paymentId: req.params.paymentId,
            reviewerId: req.user.userId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },

    async reject(req, res, next) {
      try {
        const { reason } =
          validateRejectPaymentBody(req.body);

        return sendSuccess(
          res,
          await paymentService.rejectPayment({
            organizationId: req.params.organizationId,
            paymentId: req.params.paymentId,
            reviewerId: req.user.userId,
            reason,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createPaymentController,
};
