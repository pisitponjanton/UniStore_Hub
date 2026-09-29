'use strict';

const { AppError } = require('../errors/app-error');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function validateOrganizationName(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError('Organization name is required');
  }

  return value.trim();
}

function validateOrganizationDescription(value, { required = false } = {}) {
  if (value === undefined && !required) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw validationError('Organization description must be a string');
  }

  return value.trim();
}

function validateCreateOrganizationBody(body = {}) {
  return {
    name: validateOrganizationName(body.name),
    description: validateOrganizationDescription(body.description) ?? '',
  };
}

function validateUpdateOrganizationBody(body = {}) {
  const input = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    input.name = validateOrganizationName(body.name);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    input.description = validateOrganizationDescription(body.description, {
      required: true,
    });
  }

  if (Object.keys(input).length === 0) {
    throw validationError('At least one organization field is required');
  }

  return input;
}

module.exports = {
  validateCreateOrganizationBody,
  validateUpdateOrganizationBody,
  validateOrganizationName,
  validateOrganizationDescription,
};
