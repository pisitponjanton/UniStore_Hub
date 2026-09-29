'use strict';

function toVariantDto(variant) {
  if (!variant) {
    return null;
  }

  return {
    variantId: variant.variantId,
    organizationId: variant.organizationId,
    productId: variant.productId,
    name: variant.name,
    price: variant.price,
    status: variant.status,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

function toProductDto(product, options = {}) {
  if (!product) {
    return null;
  }

  const dto = {
    productId: product.productId,
    organizationId: product.organizationId,
    storeId: product.storeId,
    name: product.name,
    description: product.description,
    imageKey: product.imageKey ?? null,
    imageUrl: options.imageUrl ?? null,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (Array.isArray(options.variants)) {
    dto.variants = options.variants.map(toVariantDto);
  }

  return dto;
}

module.exports = {
  toProductDto,
  toVariantDto,
};
