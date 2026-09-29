'use strict';

const { AppError } = require('../errors/app-error');
const { STORE_STATUS } = require('../modules/stores/store.constants');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function validateStoreName(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError('Store name is required');
  }

  return value.trim();
}

function validateStoreDescription(value, { required = false } = {}) {
  if (value === undefined && !required) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw validationError('Store description must be a string');
  }

  return value.trim();
}

function validateStoreStatus(value) {
  if (!Object.values(STORE_STATUS).includes(value)) {
    throw validationError('Invalid store status');
  }

  return value;
}

function validateCreateStoreBody(body = {}) {
  return {
    name: validateStoreName(body.name),
    description: validateStoreDescription(body.description) ?? '',
  };
}

function validateUpdateStoreBody(body = {}) {
  const changes = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    changes.name = validateStoreName(body.name);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    changes.description = validateStoreDescription(body.description, {
      required: true,
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    changes.status = validateStoreStatus(body.status);
  }

  if (Object.keys(changes).length === 0) {
    throw validationError('At least one store field is required');
  }

  return changes;
}

module.exports = {
  validateStoreName,
  validateStoreDescription,
  validateStoreStatus,
  validateCreateStoreBody,
  validateUpdateStoreBody,
};
