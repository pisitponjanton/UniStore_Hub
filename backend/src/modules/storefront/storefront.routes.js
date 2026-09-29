'use strict';

const express = require('express');
const {
  createStorefrontController,
} = require('./storefront.controller');

function createStorefrontRouter(options = {}) {
  const router = express.Router();
  const controller = createStorefrontController(options);

  router.get('/organizations', controller.listOrganizations);
  router.get(
    '/organizations/:organizationId/stores',
    controller.listStores,
  );
  router.get(
    '/organizations/:organizationId/stores/:storeId',
    controller.getStore,
  );
  router.get(
    '/organizations/:organizationId/stores/:storeId/products',
    controller.listProducts,
  );
  router.get(
    '/organizations/:organizationId/stores/:storeId/products/:productId',
    controller.getProduct,
  );
  router.get(
    '/organizations/:organizationId/stores/:storeId/campaigns',
    controller.listCampaigns,
  );
  router.get(
    '/organizations/:organizationId/stores/:storeId/campaigns/:campaignId',
    controller.getCampaign,
  );

  return router;
}

module.exports = {
  createStorefrontRouter,
};
