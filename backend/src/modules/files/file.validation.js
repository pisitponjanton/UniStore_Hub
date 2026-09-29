'use strict';

const { createS3Adapter } = require('../../aws/s3');
const { AppError } = require('../../errors/app-error');
const {
  ALLOWED_IMAGE_CONTENT_TYPES,
  PRODUCT_IMAGE_MAX_BYTES,
  PAYMENT_SLIP_MAX_BYTES,
} = require('./file.constants');

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function fileAccessForbidden(message = 'File access forbidden') {
  return new AppError({
    code: 'FILE_ACCESS_FORBIDDEN',
    message,
    httpStatus: 403,
  });
}

function validateContentType(value) {
  if (
    typeof value !== 'string' ||
    !ALLOWED_IMAGE_CONTENT_TYPES.includes(value)
  ) {
    throw validationError('Unsupported file contentType');
  }

  return value;
}

function parseCanonicalFileKey(objectKey) {
  if (typeof objectKey !== 'string' || objectKey.length === 0) {
    throw fileAccessForbidden();
  }

  const segments = objectKey.split('/');

  if (
    segments.length !== 4 ||
    !segments.every((segment) => segment.length > 0) ||
    !UUID_V4_PATTERN.test(segments[3])
  ) {
    throw fileAccessForbidden();
  }

  if (segments[0] === 'products') {
    return {
      kind: 'PRODUCT_IMAGE',
      organizationId: segments[1],
      resourceId: segments[2],
      objectId: segments[3],
      objectKey,
    };
  }

  if (segments[0] === 'payments') {
    return {
      kind: 'PAYMENT_SLIP',
      organizationId: segments[1],
      resourceId: segments[2],
      objectId: segments[3],
      objectKey,
    };
  }

  throw fileAccessForbidden();
}

function assertProductImageKey({
  organizationId,
  productId,
  objectKey,
}) {
  const parsed = parseCanonicalFileKey(objectKey);

  if (
    parsed.kind !== 'PRODUCT_IMAGE' ||
    parsed.organizationId !== organizationId ||
    parsed.resourceId !== productId
  ) {
    throw fileAccessForbidden(
      'Product image key is outside the authorized resource path',
    );
  }

  return parsed;
}

function assertPaymentSlipKey({
  organizationId,
  orderId,
  objectKey,
}) {
  const parsed = parseCanonicalFileKey(objectKey);

  if (
    parsed.kind !== 'PAYMENT_SLIP' ||
    parsed.organizationId !== organizationId ||
    parsed.resourceId !== orderId
  ) {
    throw fileAccessForbidden(
      'Payment slip key is outside the authorized resource path',
    );
  }

  return parsed;
}

function normalizeHeadFailure(error) {
  const statusCode = error?.$metadata?.httpStatusCode;

  if (
    statusCode === 404 ||
    error?.name === 'NotFound' ||
    error?.name === 'NoSuchKey'
  ) {
    throw validationError('Uploaded file object was not found');
  }

  throw error;
}

async function validateUploadedObject({
  s3Adapter,
  objectKey,
  maxBytes,
}) {
  let metadata;

  try {
    metadata = await s3Adapter.headObject({ objectKey });
  } catch (error) {
    normalizeHeadFailure(error);
  }

  const contentType = metadata?.ContentType;
  const contentLength = metadata?.ContentLength;

  validateContentType(contentType);

  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 0
  ) {
    throw validationError('Invalid uploaded file size metadata');
  }

  if (contentLength > maxBytes) {
    throw validationError('Uploaded file exceeds the allowed size limit');
  }

  return {
    contentType,
    contentLength,
  };
}

function createProductImageAssociationValidator(options = {}) {
  let s3Adapter = options.s3Adapter;

  function getS3Adapter() {
    if (!s3Adapter) {
      s3Adapter = createS3Adapter();
    }

    return s3Adapter;
  }

  return async function validateProductImageAssociation({
    organizationId,
    productId,
    imageKey,
  }) {
    if (imageKey === null) {
      return null;
    }

    assertProductImageKey({
      organizationId,
      productId,
      objectKey: imageKey,
    });

    return validateUploadedObject({
      s3Adapter: getS3Adapter(),
      objectKey: imageKey,
      maxBytes: PRODUCT_IMAGE_MAX_BYTES,
    });
  };
}

function createPaymentSlipObjectValidator(options = {}) {
  let s3Adapter = options.s3Adapter;

  function getS3Adapter() {
    if (!s3Adapter) {
      s3Adapter = createS3Adapter();
    }

    return s3Adapter;
  }

  return async function validatePaymentSlipObject({
    organizationId,
    orderId,
    slipKey,
  }) {
    assertPaymentSlipKey({
      organizationId,
      orderId,
      objectKey: slipKey,
    });

    return validateUploadedObject({
      s3Adapter: getS3Adapter(),
      objectKey: slipKey,
      maxBytes: PAYMENT_SLIP_MAX_BYTES,
    });
  };
}

module.exports = {
  UUID_V4_PATTERN,
  validationError,
  fileAccessForbidden,
  validateContentType,
  parseCanonicalFileKey,
  assertProductImageKey,
  assertPaymentSlipKey,
  validateUploadedObject,
  createProductImageAssociationValidator,
  createPaymentSlipObjectValidator,
};
