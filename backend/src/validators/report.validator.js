'use strict';

const { AppError } = require('../errors/app-error');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function optionalString(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw validationError(
      `${fieldName} must be a non-empty string`,
    );
  }

  return value.trim();
}

function validateReportQuery(query = {}) {
  return {
    campaignId: optionalString(
      typeof query.campaignId === 'string'
        ? query.campaignId
        : undefined,
      'campaignId',
    ),
    storeId: optionalString(
      typeof query.storeId === 'string'
        ? query.storeId
        : undefined,
      'storeId',
    ),
  };
}

module.exports = {
  optionalString,
  validateReportQuery,
};
