'use strict';

const { sendSuccess } = require('../../utils/response');
const {
  validationError,
} = require('./file.validation');
const { createFileService } = require('./file.service');

function requireBodyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw validationError(`${fieldName} is required`);
  }

  return value;
}

function createFileController(options = {}) {
  const fileService =
    options.fileService || createFileService(options);

  return {
    async productImageUploadUrl(req, res, next) {
      try {
        const data =
          await fileService.createProductImageUploadUrl({
            organizationId: req.params.organizationId,
            productId: req.params.productId,
            contentType: requireBodyString(
              req.body?.contentType,
              'contentType',
            ),
          });

        return sendSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    async paymentSlipUploadUrl(req, res, next) {
      try {
        const data =
          await fileService.createPaymentSlipUploadUrl({
            organizationId: req.params.organizationId,
            orderId: req.params.orderId,
            userId: req.user.userId,
            contentType: requireBodyString(
              req.body?.contentType,
              'contentType',
            ),
          });

        return sendSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    async privateDownloadUrl(req, res, next) {
      try {
        const data =
          await fileService.createPrivateDownloadUrl({
            organizationId: req.params.organizationId,
            userId: req.user.userId,
            objectKey: requireBodyString(
              req.body?.objectKey,
              'objectKey',
            ),
          });

        return sendSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createFileController,
  requireBodyString,
};
