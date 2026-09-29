'use strict';

const { AppError } = require('../errors/app-error');

function validateProductionQuery(query = {}) {
  if (
    typeof query.campaignId !== 'string' ||
    query.campaignId.trim().length === 0
  ) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'campaignId is required',
      httpStatus: 400,
    });
  }

  return {
    campaignId: query.campaignId.trim(),
  };
}

module.exports = {
  validateProductionQuery,
};
