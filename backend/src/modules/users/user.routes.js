'use strict';

const express = require('express');
const {
  createAuthMiddleware,
} = require('../../middleware/auth.middleware');
const {
  createOwnOrderRouter,
} = require('../orders/own-order.routes');
const {
  createPickupController,
} = require('../pickups/pickup.controller');
const {
  createUserController,
} = require('./user.controller');

function createUserRouter(options = {}) {
  const router = express.Router();
  const authMiddleware =
    options.authMiddleware ||
    createAuthMiddleware(options.authOptions);
  const controller =
    createUserController(options);
  const pickupController =
    createPickupController(options.pickups);

  router.get('/me', authMiddleware, controller.getMe);

  router.get(
    '/me/orders/:orderId/pickup',
    authMiddleware,
    pickupController.getOwn,
  );

  router.use(
    '/me/orders',
    authMiddleware,
    createOwnOrderRouter({
      ...(options.orders || {}),
      payments: options.payments,
    }),
  );

  return router;
}

module.exports = {
  createUserRouter,
};
