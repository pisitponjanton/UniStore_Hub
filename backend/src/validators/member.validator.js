'use strict';

const { AppError } = require('../errors/app-error');
const {
  ORGANIZATION_ROLE,
} = require('../modules/members/member.constants');
const { normalizeEmail } = require('../modules/auth/auth.utils');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function validateMemberRole(value) {
  if (!Object.values(ORGANIZATION_ROLE).includes(value)) {
    throw validationError('Invalid organization member role');
  }

  return value;
}

function validateMemberEmail(value) {
  const email = normalizeEmail(value);

  if (
    email.length === 0 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw validationError('Invalid email');
  }

  return email;
}

function validateAddMemberBody(body = {}) {
  return {
    email: validateMemberEmail(body.email),
    role: validateMemberRole(body.role),
  };
}

function validateUpdateMemberBody(body = {}) {
  return {
    role: validateMemberRole(body.role),
  };
}

module.exports = {
  validateMemberRole,
  validateMemberEmail,
  validateAddMemberBody,
  validateUpdateMemberBody,
};
