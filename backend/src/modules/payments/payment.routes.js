'use strict';

const express = require('express');
const {
  requireOperationalOrganization,
} = require('../../middleware/organization.middleware');
const {
  createPaymentController,
} = require('./payment.controller');

function createPaymentRouter(options = {}) {
  const router = express.Router({ mergeParams: true });
  const controller = createPaymentController(options);

  router.get('/', controller.list);
  router.get('/:paymentId', controller.get);
  router.post(
    '/:paymentId/approve',
    requireOperationalOrganization,
    controller.approve,
  );
  router.post(
    '/:paymentId/reject',
    requireOperationalOrganization,
    controller.reject,
  );

  return router;
}

module.exports = {
  createPaymentRouter,
};
