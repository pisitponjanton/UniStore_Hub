'use strict';

const { logger } = require('../utils/logger');

function requestLoggerMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    logger.info('http_request_completed', {
      requestId: req.requestId,
      userId: req.user?.userId,
      organizationId: req.organization?.organizationId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}

module.exports = {
  requestLoggerMiddleware,
};
