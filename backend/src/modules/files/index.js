'use strict';

const {
  PRESIGN_EXPIRES_SECONDS,
  PRODUCT_IMAGE_MAX_BYTES,
  PAYMENT_SLIP_MAX_BYTES,
  ALLOWED_IMAGE_CONTENT_TYPES,
} = require('./file.constants');
const { createFileController } = require('./file.controller');
const { createFileRouter } = require('./file.routes');
const { createFileService } = require('./file.service');
const {
  UUID_V4_PATTERN,
  validateContentType,
  parseCanonicalFileKey,
  assertProductImageKey,
  assertPaymentSlipKey,
  validateUploadedObject,
  createProductImageAssociationValidator,
  createPaymentSlipObjectValidator,
} = require('./file.validation');

module.exports = {
  PRESIGN_EXPIRES_SECONDS,
  PRODUCT_IMAGE_MAX_BYTES,
  PAYMENT_SLIP_MAX_BYTES,
  ALLOWED_IMAGE_CONTENT_TYPES,
  createFileController,
  createFileRouter,
  createFileService,
  UUID_V4_PATTERN,
  validateContentType,
  parseCanonicalFileKey,
  assertProductImageKey,
  assertPaymentSlipKey,
  validateUploadedObject,
  createProductImageAssociationValidator,
  createPaymentSlipObjectValidator,
};
