'use strict';

const express = require('express');
const {
  createOrganizationMembershipMiddleware,
  requireOperationalOrganization,
  requireOrganizationRoles,
} = require('../../middleware/organization.middleware');
const {
  createFileController,
} = require('../files/file.controller');
const {
  ORGANIZATION_ROLE,
} = require('../members/member.constants');
const {
  createPaymentController,
} = require('../payments/payment.controller');
const { createOrderController } = require('./order.controller');

function createOrderRouter(options = {}) {
  const router = express.Router({ mergeParams: true });
  const controller = createOrderController(options);
  const fileController = createFileController(
    options.files || {},
  );
  const paymentController = createPaymentController(
    options.payments || {},
  );
  const membershipMiddleware =
    options.membershipMiddleware ||
    createOrganizationMembershipMiddleware(
      options.membershipOptions,
    );
  const staffOrAdmin = requireOrganizationRoles(
    ORGANIZATION_ROLE.STAFF,
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );
  const adminOnly = requireOrganizationRoles(
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );

  router.get(
    '/',
    membershipMiddleware,
    staffOrAdmin,
    controller.listOrganization,
  );

  router.post(
    '/',
    requireOperationalOrganization,
    controller.create,
  );

  router.post(
    '/:orderId/payment-slip-upload-url',
    requireOperationalOrganization,
    fileController.paymentSlipUploadUrl,
  );

  router.post(
    '/:orderId/payment',
    requireOperationalOrganization,
    paymentController.submit,
  );

  router.get(
    '/:orderId',
    membershipMiddleware,
    staffOrAdmin,
    controller.getOrganization,
  );

  router.post(
    '/:orderId/cancel',
    membershipMiddleware,
    adminOnly,
    requireOperationalOrganization,
    controller.cancelOrganization,
  );

  return router;
}

module.exports = {
  createOrderRouter,
};
