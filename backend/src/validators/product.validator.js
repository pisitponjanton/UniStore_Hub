'use strict';

const { AppError } = require('../errors/app-error');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('../modules/products/product.constants');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function requiredTrimmedString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${fieldName} is required`);
  }

  return value.trim();
}

function optionalDescription(value, { required = false } = {}) {
  if (value === undefined && !required) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw validationError('Product description must be a string');
  }

  return value.trim();
}

function validateProductStatus(value) {
  if (!Object.values(PRODUCT_STATUS).includes(value)) {
    throw validationError('Invalid product status');
  }

  return value;
}

function validateVariantStatus(value) {
  if (!Object.values(VARIANT_STATUS).includes(value)) {
    throw validationError('Invalid variant status');
  }

  return value;
}

function validatePrice(value) {
  if (!Number.isSafeInteger(value)) {
    throw validationError('Variant price must be integer satang');
  }

  return value;
}

function validateImageKey(value) {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw validationError('Invalid product imageKey');
  }

  return value;
}

function validateCreateProductBody(body = {}) {
  return {
    storeId: requiredTrimmedString(body.storeId, 'storeId'),
    name: requiredTrimmedString(body.name, 'Product name'),
    description: optionalDescription(body.description) ?? '',
  };
}

function validateUpdateProductBody(body = {}) {
  const changes = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    changes.name = requiredTrimmedString(body.name, 'Product name');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    changes.description = optionalDescription(body.description, {
      required: true,
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'imageKey')) {
    changes.imageKey = validateImageKey(body.imageKey);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    changes.status = validateProductStatus(body.status);
  }

  if (Object.keys(changes).length === 0) {
    throw validationError('At least one product field is required');
  }

  return changes;
}

function validateCreateVariantBody(body = {}) {
  return {
    name: requiredTrimmedString(body.name, 'Variant name'),
    price: validatePrice(body.price),
  };
}

function validateUpdateVariantBody(body = {}) {
  const changes = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    changes.name = requiredTrimmedString(body.name, 'Variant name');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'price')) {
    changes.price = validatePrice(body.price);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    changes.status = validateVariantStatus(body.status);
  }

  if (Object.keys(changes).length === 0) {
    throw validationError('At least one variant field is required');
  }

  return changes;
}

module.exports = {
  validateCreateProductBody,
  validateUpdateProductBody,
  validateCreateVariantBody,
  validateUpdateVariantBody,
  validatePrice,
  validateImageKey,
};
