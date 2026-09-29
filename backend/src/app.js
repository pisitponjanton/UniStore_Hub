'use strict';

const express = require('express');
const {
  createCorsMiddleware,
} = require('./middleware/cors.middleware');
const {
  errorMiddleware,
} = require('./middleware/error.middleware');
const {
  notFoundMiddleware,
} = require('./middleware/not-found.middleware');
const {
  requestIdMiddleware,
} = require('./middleware/request-id.middleware');
const {
  requestLoggerMiddleware,
} = require('./middleware/request-logger.middleware');
const {
  createAuthRouter,
} = require('./modules/auth/auth.routes');
const { healthRouter } = require('./modules/health');
const {
  createNotificationRouter,
} = require('./modules/notifications/notification.routes');
const {
  createOrganizationRouter,
} = require('./modules/organizations/organization.routes');
const {
  createPlatformAdminRouter,
} = require('./modules/platform-admin/platform-admin.routes');
const {
  createStorefrontRouter,
} = require('./modules/storefront/storefront.routes');
const {
  createUserRouter,
} = require('./modules/users/user.routes');

function createApp(options = {}) {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(
    createCorsMiddleware(options.cors),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use(
    '/api/v1/auth',
    createAuthRouter(options.auth),
  );
  app.use(
    '/api/v1/storefront',
    createStorefrontRouter(options.storefront),
  );
  app.use(
    '/api/v1/notifications',
    createNotificationRouter(
      options.notifications,
    ),
  );
  app.use(
    '/api/v1/platform',
    createPlatformAdminRouter(
      options.platformAdmin,
    ),
  );
  app.use(
    '/api/v1/organizations',
    createOrganizationRouter(
      options.organizations,
    ),
  );
  app.use(
    '/api/v1',
    createUserRouter(options.users),
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

const app = createApp();

module.exports = {
  app,
  createApp,
};
