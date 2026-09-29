'use strict';

const express = require('express');
const {
  requireOperationalOrganization,
} = require('../../middleware/organization.middleware');
const {
  createCampaignController,
} = require('./campaign.controller');

function createCampaignRouter(options = {}) {
  const router = express.Router({ mergeParams: true });
  const controller = createCampaignController(options);

  router.get('/', controller.list);
  router.post(
    '/',
    requireOperationalOrganization,
    controller.create,
  );

  router.get('/:campaignId', controller.get);
  router.patch(
    '/:campaignId',
    requireOperationalOrganization,
    controller.update,
  );

  router.post(
    '/:campaignId/open',
    requireOperationalOrganization,
    controller.open,
  );
  router.post(
    '/:campaignId/close',
    requireOperationalOrganization,
    controller.close,
  );
  router.post(
    '/:campaignId/start-production',
    requireOperationalOrganization,
    controller.startProduction,
  );
  router.post(
    '/:campaignId/ready-for-pickup',
    requireOperationalOrganization,
    controller.readyForPickup,
  );
  router.post(
    '/:campaignId/complete',
    requireOperationalOrganization,
    controller.complete,
  );
  router.post(
    '/:campaignId/cancel',
    requireOperationalOrganization,
    controller.cancel,
  );

  return router;
}

module.exports = {
  createCampaignRouter,
};
