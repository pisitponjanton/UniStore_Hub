'use strict';

const express = require('express');
const {
  createAuthMiddleware,
} = require('../../middleware/auth.middleware');
const {
  createOrganizationContextMiddleware,
  createOrganizationMembershipMiddleware,
  requireOrganizationRoles,
} = require('../../middleware/organization.middleware');
const {
  createAuditRouter,
} = require('../audit/audit.routes');
const {
  createCampaignRouter,
} = require('../campaigns/campaign.routes');
const {
  createFileRouter,
} = require('../files/file.routes');
const {
  ORGANIZATION_ROLE,
} = require('../members/member.constants');
const {
  createMemberRouter,
} = require('../members/member.routes');
const {
  createOrderRouter,
} = require('../orders/order.routes');
const {
  createPaymentRouter,
} = require('../payments/payment.routes');
const {
  createPickupRouter,
} = require('../pickups/pickup.routes');
const {
  createProductRouter,
} = require('../products/product.routes');
const {
  createProductionRouter,
} = require('../production/production.routes');
const {
  createReportRouter,
} = require('../reports/report.routes');
const {
  createStoreRouter,
} = require('../stores/store.routes');
const {
  createOrganizationController,
} = require('./organization.controller');

function createOrganizationRouter(options = {}) {
  const router = express.Router();
  const authMiddleware =
    options.authMiddleware ||
    createAuthMiddleware(options.authOptions);
  const organizationContextMiddleware =
    options.organizationContextMiddleware ||
    createOrganizationContextMiddleware(
      options.organizationOptions,
    );
  const membershipMiddleware =
    options.membershipMiddleware ||
    createOrganizationMembershipMiddleware(
      options.membershipOptions,
    );
  const adminOnly = requireOrganizationRoles(
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );
  const staffOrAdmin = requireOrganizationRoles(
    ORGANIZATION_ROLE.STAFF,
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );
  const controller = createOrganizationController(options);

  router.use(authMiddleware);

  router.get('/', controller.list);
  router.post('/', controller.create);

  router.use(
    '/:organizationId/files',
    organizationContextMiddleware,
    createFileRouter(options.files),
  );

  router.use(
    '/:organizationId/orders',
    organizationContextMiddleware,
    createOrderRouter({
      ...options.orders,
      membershipMiddleware,
      files: options.files,
      payments: options.payments,
    }),
  );

  router.use(
    '/:organizationId/payments',
    organizationContextMiddleware,
    membershipMiddleware,
    staffOrAdmin,
    createPaymentRouter(options.payments),
  );

  router.use(
    '/:organizationId/pickups',
    organizationContextMiddleware,
    membershipMiddleware,
    staffOrAdmin,
    createPickupRouter(options.pickups),
  );

  router.use(
    '/:organizationId/production',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    createProductionRouter(options.production),
  );

  router.use(
    '/:organizationId/reports',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    createReportRouter(options.reports),
  );

  router.use(
    '/:organizationId/audit-logs',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    createAuditRouter(options.audit),
  );

  router.use(
    '/:organizationId/members',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    createMemberRouter(options.members),
  );

  router.use(
    '/:organizationId/stores',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    createStoreRouter(options.stores),
  );

  router.use(
    '/:organizationId/products',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    createProductRouter({
      ...options.products,
      files: options.files,
    }),
  );

  router.use(
    '/:organizationId/campaigns',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    createCampaignRouter(options.campaigns),
  );

  router.get(
    '/:organizationId',
    organizationContextMiddleware,
    membershipMiddleware,
    controller.get,
  );

  router.patch(
    '/:organizationId',
    organizationContextMiddleware,
    membershipMiddleware,
    adminOnly,
    controller.update,
  );

  return router;
}

module.exports = {
  createOrganizationRouter,
};
