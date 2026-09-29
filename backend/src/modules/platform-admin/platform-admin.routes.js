'use strict';

const express = require('express');
const {
  createAuthMiddleware,
} = require('../../middleware/auth.middleware');
const {
  createPlatformAdminMiddleware,
} = require('../../middleware/platform-admin.middleware');
const {
  createPlatformAdminController,
} = require('./platform-admin.controller');

function createPlatformAdminRouter(
  options = {},
) {
  const router = express.Router();
  const authMiddleware =
    options.authMiddleware ||
    createAuthMiddleware(
      options.authOptions,
    );
  const platformAdminMiddleware =
    options.platformAdminMiddleware ||
    createPlatformAdminMiddleware(
      options.platformAdminOptions,
    );
  const controller =
    createPlatformAdminController(options);

  router.use(authMiddleware);
  router.use(platformAdminMiddleware);

  router.get(
    '/organizations',
    controller.listOrganizations,
  );
  router.post(
    '/organizations/:organizationId/approve',
    controller.approveOrganization,
  );
  router.post(
    '/organizations/:organizationId/suspend',
    controller.suspendOrganization,
  );
  router.get('/users', controller.listUsers);
  router.get('/summary', controller.summary);

  return router;
}

module.exports = {
  createPlatformAdminRouter,
};
