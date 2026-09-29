'use strict';

class AppError extends Error {
  constructor({ code, message, httpStatus = 500, details, cause } = {}) {
    super(message || 'Internal server error', { cause });

    this.name = 'AppError';
    this.code = code || 'INTERNAL_ERROR';
    this.httpStatus = httpStatus;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace?.(this, AppError);
  }
}

module.exports = {
  AppError,
};
