'use strict';

const express = require('express');
const {
  createAuthMiddleware,
} = require('../../middleware/auth.middleware');
const {
  createNotificationController,
} = require('./notification.controller');

function createNotificationRouter(options = {}) {
  const router = express.Router();
  const authMiddleware =
    options.authMiddleware ||
    createAuthMiddleware(
      options.authOptions,
    );
  const controller =
    createNotificationController(options);

  router.use(authMiddleware);

  router.get('/', controller.list);
  router.patch(
    '/:notificationId/read',
    controller.markRead,
  );

  return router;
}

module.exports = {
  createNotificationRouter,
};
