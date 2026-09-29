'use strict';

const express = require('express');
const {
  requireOperationalOrganization,
} = require('../../middleware/organization.middleware');
const {
  createPickupController,
} = require('./pickup.controller');

function createPickupRouter(options = {}) {
  const router = express.Router({
    mergeParams: true,
  });
  const controller =
    createPickupController(options);

  router.get('/', controller.list);
  router.get('/:pickupId', controller.get);
  router.post(
    '/:pickupId/confirm',
    requireOperationalOrganization,
    controller.confirm,
  );

  return router;
}

module.exports = {
  createPickupRouter,
};
