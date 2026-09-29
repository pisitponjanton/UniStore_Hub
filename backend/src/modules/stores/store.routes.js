'use strict';

const express = require('express');
const {
  requireOperationalOrganization,
} = require('../../middleware/organization.middleware');
const { createStoreController } = require('./store.controller');

function createStoreRouter(options = {}) {
  const router = express.Router({ mergeParams: true });
  const controller = createStoreController(options);

  router.get('/', controller.list);
  router.post('/', requireOperationalOrganization, controller.create);
  router.get('/:storeId', controller.get);
  router.patch(
    '/:storeId',
    requireOperationalOrganization,
    controller.update,
  );

  return router;
}

module.exports = {
  createStoreRouter,
};
