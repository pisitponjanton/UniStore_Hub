'use strict';

const { AppError } = require('../errors/app-error');
const {
  AUDIT_ACTION,
} = require('../modules/audit/audit.constants');

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

function validateAuditQuery(query = {}) {
  const action = optionalString(
    typeof query.action === 'string'
      ? query.action
      : undefined,
    'action',
  );

  if (
    action &&
    !Object.values(AUDIT_ACTION).includes(action)
  ) {
    throw validationError('Invalid audit action');
  }

  return {
    actorId: optionalString(
      typeof query.actorId === 'string'
        ? query.actorId
        : undefined,
      'actorId',
    ),
    action,
    resourceType: optionalString(
      typeof query.resourceType === 'string'
        ? query.resourceType
        : undefined,
      'resourceType',
    ),
    resourceId: optionalString(
      typeof query.resourceId === 'string'
        ? query.resourceId
        : undefined,
      'resourceId',
    ),
    cursor:
      typeof query.cursor === 'string'
        ? query.cursor
        : undefined,
  };
}

module.exports = {
  optionalString,
  validateAuditQuery,
};
