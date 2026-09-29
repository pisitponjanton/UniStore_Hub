'use strict';

const { AppError } = require('../errors/app-error');
const { normalizeEmail } = require('../modules/auth/auth.utils');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message, details) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
    details,
  });
}

function validateEmail(value) {
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

function validatePassword(value) {
  if (typeof value !== 'string') {
    throw validationError('Invalid password');
  }

  const byteLength = Buffer.byteLength(value, 'utf8');

  if (byteLength < 8 || byteLength > 72) {
    throw validationError('Password must be between 8 and 72 UTF-8 bytes');
  }

  return value;
}

function validateName(value) {
  if (typeof value !== 'string') {
    throw validationError('Invalid name');
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 100) {
    throw validationError('Name must be between 1 and 100 characters');
  }

  return name;
}

function validateRegisterBody(body = {}) {
  return {
    email: validateEmail(body.email),
    password: validatePassword(body.password),
    name: validateName(body.name),
  };
}

function validateLoginBody(body = {}) {
  return {
    email: validateEmail(body.email),
    password: validatePassword(body.password),
  };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateRegisterBody,
  validateLoginBody,
};
