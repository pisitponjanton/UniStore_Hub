'use strict';

const { AppError } = require('../errors/app-error');

function notFoundMiddleware(req, res, next) {
  next(
    new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Route not found',
      httpStatus: 404,
    }),
  );
}

module.exports = {
  notFoundMiddleware,
};
