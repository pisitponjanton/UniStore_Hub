'use strict';

const { AppError } = require('../errors/app-error');
const { ORDER_STATUS } = require('../modules/orders/order.constants');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function requiredId(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${fieldName} is required`);
  }

  return value.trim();
}

function optionalId(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  return requiredId(value, fieldName);
}

function validateQuantity(value) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 999
  ) {
    throw validationError(
      'quantity must be an integer between 1 and 999',
    );
  }

  return value;
}

function validateOrderStatusFilter(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Object.values(ORDER_STATUS).includes(value)) {
    throw validationError('Invalid order status');
  }

  return value;
}

function validateCreateOrderBody(body = {}) {
  const campaignId = requiredId(body.campaignId, 'campaignId');

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw validationError('items must contain at least one item');
  }

  return {
    campaignId,
    items: body.items.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw validationError(
          `items[${index}] must be an object`,
        );
      }

      return {
        productId: requiredId(
          item.productId,
          `items[${index}].productId`,
        ),
        variantId: requiredId(
          item.variantId,
          `items[${index}].variantId`,
        ),
        quantity: validateQuantity(item.quantity),
      };
    }),
  };
}

module.exports = {
  requiredId,
  optionalId,
  validateQuantity,
  validateOrderStatusFilter,
  validateCreateOrderBody,
};
