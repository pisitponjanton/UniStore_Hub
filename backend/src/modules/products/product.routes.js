'use strict';

const express = require('express');
const {
  requireOperationalOrganization,
} = require('../../middleware/organization.middleware');
const {
  createFileController,
} = require('../files/file.controller');
const { createProductController } = require('./product.controller');

function createProductRouter(options = {}) {
  const router = express.Router({ mergeParams: true });
  const controller = createProductController(options);
  const fileController = createFileController(
    options.files || {},
  );

  router.get('/', controller.list);
  router.post(
    '/',
    requireOperationalOrganization,
    controller.create,
  );

  router.post(
    '/:productId/image-upload-url',
    requireOperationalOrganization,
    fileController.productImageUploadUrl,
  );

  router.get('/:productId', controller.get);
  router.patch(
    '/:productId',
    requireOperationalOrganization,
    controller.update,
  );
  router.delete(
    '/:productId',
    requireOperationalOrganization,
    controller.remove,
  );

  router.post(
    '/:productId/variants',
    requireOperationalOrganization,
    controller.createVariant,
  );
  router.patch(
    '/:productId/variants/:variantId',
    requireOperationalOrganization,
    controller.updateVariant,
  );
  router.delete(
    '/:productId/variants/:variantId',
    requireOperationalOrganization,
    controller.removeVariant,
  );

  return router;
}

module.exports = {
  createProductRouter,
};
