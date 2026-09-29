'use strict';

const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('./product.constants');
const { createProductController } = require('./product.controller');
const {
  toProductDto,
  toVariantDto,
} = require('./product.mapper');
const { createProductRepository } = require('./product.repository');
const { createProductRouter } = require('./product.routes');
const {
  createProductService,
  defaultProductImageValidator,
} = require('./product.service');

module.exports = {
  PRODUCT_STATUS,
  VARIANT_STATUS,
  createProductController,
  toProductDto,
  toVariantDto,
  createProductRepository,
  createProductRouter,
  createProductService,
  defaultProductImageValidator,
};
