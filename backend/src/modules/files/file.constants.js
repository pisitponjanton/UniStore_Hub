'use strict';

const PRESIGN_EXPIRES_SECONDS = 900;
const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PAYMENT_SLIP_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_CONTENT_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

module.exports = {
  PRESIGN_EXPIRES_SECONDS,
  PRODUCT_IMAGE_MAX_BYTES,
  PAYMENT_SLIP_MAX_BYTES,
  ALLOWED_IMAGE_CONTENT_TYPES,
};
