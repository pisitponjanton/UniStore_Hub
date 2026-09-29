'use strict';

const { AppError } = require('../errors/app-error');
const {
  CAMPAIGN_STATUS,
} = require('../modules/campaigns/campaign.constants');
const { isIsoUtcTimestamp } = require('../utils/time');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function validateRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${fieldName} is required`);
  }

  return value.trim();
}

function validateCampaignTimestamp(value, fieldName) {
  if (value === null) {
    return null;
  }

  if (!isIsoUtcTimestamp(value)) {
    throw validationError(
      `${fieldName} must be an ISO 8601 UTC timestamp or null`,
    );
  }

  return value;
}

function validateCampaignDates(values) {
  const {
    openAt,
    closeAt,
    paymentDeadline,
    pickupAt,
  } = values;

  if (
    openAt &&
    closeAt &&
    Date.parse(openAt) >= Date.parse(closeAt)
  ) {
    throw validationError('openAt must be before closeAt');
  }

  if (
    paymentDeadline &&
    openAt &&
    Date.parse(paymentDeadline) < Date.parse(openAt)
  ) {
    throw validationError(
      'paymentDeadline must be greater than or equal to openAt',
    );
  }

  if (
    pickupAt &&
    closeAt &&
    Date.parse(pickupAt) < Date.parse(closeAt)
  ) {
    throw validationError(
      'pickupAt must be greater than or equal to closeAt',
    );
  }

  return values;
}

function validateCreateCampaignBody(body = {}) {
  const input = {
    storeId: validateRequiredString(body.storeId, 'storeId'),
    name: validateRequiredString(body.name, 'Campaign name'),
    openAt:
      body.openAt === undefined
        ? null
        : validateCampaignTimestamp(body.openAt, 'openAt'),
    closeAt:
      body.closeAt === undefined
        ? null
        : validateCampaignTimestamp(body.closeAt, 'closeAt'),
    paymentDeadline:
      body.paymentDeadline === undefined
        ? null
        : validateCampaignTimestamp(
            body.paymentDeadline,
            'paymentDeadline',
          ),
    pickupAt:
      body.pickupAt === undefined
        ? null
        : validateCampaignTimestamp(body.pickupAt, 'pickupAt'),
  };

  return validateCampaignDates(input);
}

function validateUpdateCampaignBody(body = {}) {
  const changes = {};

  if (Object.prototype.hasOwnProperty.call(body, 'storeId')) {
    changes.storeId = validateRequiredString(
      body.storeId,
      'storeId',
    );
  }

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    changes.name = validateRequiredString(
      body.name,
      'Campaign name',
    );
  }

  for (const field of [
    'openAt',
    'closeAt',
    'paymentDeadline',
    'pickupAt',
  ]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      changes[field] = validateCampaignTimestamp(
        body[field],
        field,
      );
    }
  }

  if (Object.keys(changes).length === 0) {
    throw validationError(
      'At least one campaign field is required',
    );
  }

  return changes;
}

function validateCampaignStatusFilter(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Object.values(CAMPAIGN_STATUS).includes(value)) {
    throw validationError('Invalid campaign status');
  }

  return value;
}

module.exports = {
  validateCampaignTimestamp,
  validateCampaignDates,
  validateCreateCampaignBody,
  validateUpdateCampaignBody,
  validateCampaignStatusFilter,
};
