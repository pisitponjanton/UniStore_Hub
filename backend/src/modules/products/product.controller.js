'use strict';

const { sendList, sendSuccess } = require('../../utils/response');
const {
  validateCreateProductBody,
  validateUpdateProductBody,
  validateCreateVariantBody,
  validateUpdateVariantBody,
} = require('../../validators/product.validator');
const { createProductService } = require('./product.service');

function createProductController(options = {}) {
  const productService =
    options.productService || createProductService(options);

  return {
    async list(req, res, next) {
      try {
        const result = await productService.listProducts({
          organizationId: req.params.organizationId,
          storeId:
            typeof req.query.storeId === 'string'
              ? req.query.storeId
              : undefined,
          cursor:
            typeof req.query.cursor === 'string'
              ? req.query.cursor
              : undefined,
        });

        return sendList(
          res,
          result.items,
          result.nextCursor,
        );
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const input = validateCreateProductBody(req.body);
        const product = await productService.createProduct({
          organizationId: req.params.organizationId,
          actorId: req.user.userId,
          ...input,
        });

        return sendSuccess(res, product, 201);
      } catch (error) {
        return next(error);
      }
    },

    async get(req, res, next) {
      try {
        const product = await productService.getProduct({
          organizationId: req.params.organizationId,
          productId: req.params.productId,
        });

        return sendSuccess(res, product);
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const changes = validateUpdateProductBody(req.body);
        const product = await productService.updateProduct({
          organizationId: req.params.organizationId,
          productId: req.params.productId,
          actorId: req.user.userId,
          changes,
        });

        return sendSuccess(res, product);
      } catch (error) {
        return next(error);
      }
    },

    async remove(req, res, next) {
      try {
        await productService.deleteProduct({
          organizationId: req.params.organizationId,
          productId: req.params.productId,
          actorId: req.user.userId,
        });

        return res.status(204).send();
      } catch (error) {
        return next(error);
      }
    },

    async createVariant(req, res, next) {
      try {
        const input = validateCreateVariantBody(req.body);
        const variant = await productService.createVariant({
          organizationId: req.params.organizationId,
          productId: req.params.productId,
          actorId: req.user.userId,
          ...input,
        });

        return sendSuccess(res, variant, 201);
      } catch (error) {
        return next(error);
      }
    },

    async updateVariant(req, res, next) {
      try {
        const changes = validateUpdateVariantBody(req.body);
        const variant = await productService.updateVariant({
          organizationId: req.params.organizationId,
          productId: req.params.productId,
          variantId: req.params.variantId,
          actorId: req.user.userId,
          changes,
        });

        return sendSuccess(res, variant);
      } catch (error) {
        return next(error);
      }
    },

    async removeVariant(req, res, next) {
      try {
        await productService.deleteVariant({
          organizationId: req.params.organizationId,
          productId: req.params.productId,
          variantId: req.params.variantId,
          actorId: req.user.userId,
        });

        return res.status(204).send();
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createProductController,
};
