'use strict';

const { AppError } = require('../errors/app-error');
const {
  PICKUP_STATUS,
} = require('../modules/pickups/pickup.constants');

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

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(
      `${fieldName} must be a non-empty string`,
    );
  }

  return value.trim();
}

function validatePickupStatusFilter(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Object.values(PICKUP_STATUS).includes(value)) {
    throw validationError('Invalid pickup status');
  }

  return value;
}

function validatePickupListQuery(query = {}) {
  return {
    campaignId: optionalString(
      typeof query.campaignId === 'string'
        ? query.campaignId
        : undefined,
      'campaignId',
    ),
    status: validatePickupStatusFilter(
      typeof query.status === 'string'
        ? query.status
        : undefined,
    ),
    token: optionalString(
      typeof query.token === 'string'
        ? query.token
        : undefined,
      'token',
    ),
    orderId: optionalString(
      typeof query.orderId === 'string'
        ? query.orderId
        : undefined,
      'orderId',
    ),
    cursor:
      typeof query.cursor === 'string'
        ? query.cursor
        : undefined,
  };
}

module.exports = {
  optionalString,
  validatePickupStatusFilter,
  validatePickupListQuery,
};
