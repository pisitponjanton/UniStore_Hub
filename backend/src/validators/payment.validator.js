'use strict';

const { AppError } = require('../errors/app-error');
const {
  PAYMENT_STATUS,
} = require('../modules/payments/payment.constants');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function optionalId(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function validateSubmitPaymentBody(body = {}) {
  if (
    typeof body.slipKey !== 'string' ||
    body.slipKey.trim().length === 0
  ) {
    throw new AppError({
      code: 'PAYMENT_SLIP_REQUIRED',
      message: 'Payment slip is required',
      httpStatus: 400,
    });
  }

  return {
    slipKey: body.slipKey.trim(),
  };
}

function validatePaymentStatusFilter(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Object.values(PAYMENT_STATUS).includes(value)) {
    throw validationError('Invalid payment status');
  }

  return value;
}

function validateRejectPaymentBody(body = {}) {
  if (
    typeof body.reason !== 'string' ||
    body.reason.trim().length === 0
  ) {
    throw new AppError({
      code: 'PAYMENT_REJECT_REASON_REQUIRED',
      message: 'Payment reject reason is required',
      httpStatus: 400,
    });
  }

  return {
    reason: body.reason.trim(),
  };
}

module.exports = {
  optionalId,
  validateSubmitPaymentBody,
  validatePaymentStatusFilter,
  validateRejectPaymentBody,
};
