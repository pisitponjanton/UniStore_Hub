'use strict';

const express = require('express');
const {
  createPaymentController,
} = require('../payments/payment.controller');
const { createOrderController } = require('./order.controller');

function createOwnOrderRouter(options = {}) {
  const router = express.Router();
  const controller = createOrderController(options);
  const paymentController = createPaymentController(
    options.payments || {},
  );

  router.get('/', controller.listOwn);
  router.get('/:orderId/payment', paymentController.getOwn);
  router.get('/:orderId', controller.getOwn);
  router.post('/:orderId/cancel', controller.cancelOwn);

  return router;
}

module.exports = {
  createOwnOrderRouter,
};
