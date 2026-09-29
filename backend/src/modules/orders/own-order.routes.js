'use strict';

const express = require('express');
const { createOrderController } = require('./order.controller');

function createOwnOrderRouter(options = {}) {
  const router = express.Router();
  const controller = createOrderController(options);

  router.get('/', controller.listOwn);
  router.get('/:orderId', controller.getOwn);
  router.post('/:orderId/cancel', controller.cancelOwn);

  return router;
}

module.exports = {
  createOwnOrderRouter,
};
