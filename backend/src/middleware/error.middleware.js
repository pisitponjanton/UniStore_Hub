'use strict';

const { AppError } = require('../errors/app-error');
const { logger } = require('../utils/logger');
const { sendError } = require('../utils/response');

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error?.type === 'entity.parse.failed') {
    return new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON request body',
      httpStatus: 400,
      cause: error,
    });
  }

  return new AppError({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    httpStatus: 500,
    cause: error,
  });
}

function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalizedError = normalizeError(error);

  logger.error('http_request_failed', {
    requestId: req.requestId,
    userId: req.user?.userId,
    organizationId: req.organization?.organizationId,
    method: req.method,
    path: req.originalUrl,
    statusCode: normalizedError.httpStatus,
    errorCode: normalizedError.code,
  });

  sendError(res, normalizedError);
}

module.exports = {
  errorMiddleware,
  normalizeError,
};
