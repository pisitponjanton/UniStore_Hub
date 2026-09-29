'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  productKey,
  productStoreIndex,
  productVariantKey,
} = require('../../repositories/keys');
const { requireTenantMatch } = require('../../policies/organization.policy');
const { decodeCursor, encodeCursor } = require('../../utils/cursor');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const {
  assertProductImageKey,
  createProductImageAssociationValidator,
} = require('../files/file.validation');
const {
  createStoreRepository,
} = require('../stores/store.repository');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('./product.constants');
const {
  toProductDto,
  toVariantDto,
} = require('./product.mapper');
const {
  createProductRepository,
} = require('./product.repository');

function resourceNotFound(code, message) {
  return new AppError({
    code,
    message,
    httpStatus: 404,
  });
}

function defaultProductImageValidator({
  organizationId,
  productId,
  imageKey,
}) {
  if (imageKey === null) {
    return;
  }

  assertProductImageKey({
    organizationId,
    productId,
    objectKey: imageKey,
  });
}

function createProductService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;
  const validateProductImageAssociation =
    options.validateProductImageAssociation ||
    createProductImageAssociationValidator({
      s3Adapter: options.s3Adapter,
    });

  let repository = options.repository;
  let productRepository = options.productRepository;
  let storeRepository = options.storeRepository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getProductRepository() {
    if (!productRepository) {
      productRepository = createProductRepository({
        repository: getRepository(),
      });
    }

    return productRepository;
  }

  function getStoreRepository() {
    if (!storeRepository) {
      storeRepository = createStoreRepository({
        repository: getRepository(),
      });
    }

    return storeRepository;
  }

  async function requireStore(organizationId, storeId) {
    const store = await getStoreRepository().getById(
      organizationId,
      storeId,
    );

    if (!store) {
      throw resourceNotFound('STORE_NOT_FOUND', 'Store not found');
    }

    requireTenantMatch(store, organizationId);
    return store;
  }

  async function requireProduct(organizationId, productId) {
    const product = await getProductRepository().getProduct(
      organizationId,
      productId,
    );

    if (!product) {
      throw resourceNotFound(
        'PRODUCT_NOT_FOUND',
        'Product not found',
      );
    }

    requireTenantMatch(product, organizationId);
    return product;
  }

  async function requireVariant(
    organizationId,
    productId,
    variantId,
  ) {
    const variant = await getProductRepository().getVariant(
      organizationId,
      productId,
      variantId,
    );

    if (
      !variant ||
      variant.productId !== productId
    ) {
      throw resourceNotFound(
        'VARIANT_NOT_FOUND',
        'Product variant not found',
      );
    }

    requireTenantMatch(variant, organizationId);
    return variant;
  }

  function makeAudit({
    organizationId,
    actorId,
    action,
    resourceType,
    resourceId,
    metadata,
    timestamp,
  }) {
    const auditId = idFactory();

    return {
      ...auditKey(organizationId, timestamp, auditId),
      entityType: 'AuditLog',
      auditId,
      organizationId,
      actorId,
      action,
      resourceType,
      resourceId,
      metadata: metadata || {},
      createdAt: timestamp,
    };
  }

  return {
    async listProducts({
      organizationId,
      storeId,
      cursor,
    }) {
      if (storeId) {
        await requireStore(organizationId, storeId);
      }

      const cursorScope = storeId
        ? `products:${organizationId}:store:${storeId}`
        : `products:${organizationId}:all`;
      const exclusiveStartKey = decodeCursor(
        cursor,
        cursorScope,
      );

      const result = storeId
        ? await getProductRepository().listProductsByStore(
            organizationId,
            storeId,
            { exclusiveStartKey },
          )
        : await getProductRepository().listProductsByOrganization(
            organizationId,
            { exclusiveStartKey },
          );

      const items = result.items.map((product) => {
        requireTenantMatch(product, organizationId);
        return toProductDto(product);
      });

      return {
        items,
        nextCursor: result.lastEvaluatedKey
          ? encodeCursor(cursorScope, result.lastEvaluatedKey)
          : null,
      };
    },

    async createProduct({
      organizationId,
      actorId,
      storeId,
      name,
      description,
    }) {
      await requireStore(organizationId, storeId);

      const productId = idFactory();
      const timestamp = clock();
      const product = {
        productId,
        organizationId,
        storeId,
        name,
        description,
        imageKey: null,
        status: PRODUCT_STATUS.ACTIVE,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const productItem = {
        ...productKey(organizationId, productId),
        ...productStoreIndex(
          organizationId,
          storeId,
          productId,
        ),
        entityType: 'Product',
        ...product,
      };

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'PRODUCT_CREATED',
        resourceType: 'PRODUCT',
        resourceId: productId,
        metadata: { storeId },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Put: {
              Item: productItem,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              Item: audit,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });

      return toProductDto(product);
    },

    async getProduct({
      organizationId,
      productId,
    }) {
      const product = await requireProduct(
        organizationId,
        productId,
      );
      const variants =
        await getProductRepository().listVariants(
          organizationId,
          productId,
        );

      for (const variant of variants) {
        requireTenantMatch(variant, organizationId);

        if (variant.productId !== productId) {
          throw new AppError({
            code: 'TENANT_MISMATCH',
            message: 'Variant does not belong to this product',
            httpStatus: 403,
          });
        }
      }

      return toProductDto(product, { variants });
    },

    async updateProduct({
      organizationId,
      productId,
      actorId,
      changes,
    }) {
      const existing = await requireProduct(
        organizationId,
        productId,
      );

      if (
        Object.prototype.hasOwnProperty.call(changes, 'imageKey')
      ) {
        await validateProductImageAssociation({
          organizationId,
          productId,
          imageKey: changes.imageKey,
        });
      }

      const timestamp = clock();
      const names = {
        '#updatedAt': 'updatedAt',
      };
      const values = {
        ':updatedAt': timestamp,
      };
      const assignments = ['#updatedAt = :updatedAt'];

      for (const field of [
        'name',
        'description',
        'imageKey',
        'status',
      ]) {
        if (Object.prototype.hasOwnProperty.call(changes, field)) {
          names[`#${field}`] = field;
          values[`:${field}`] = changes[field];
          assignments.push(`#${field} = :${field}`);
        }
      }

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'PRODUCT_UPDATED',
        resourceType: 'PRODUCT',
        resourceId: productId,
        metadata: {
          fields: Object.keys(changes),
        },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: productKey(organizationId, productId),
              UpdateExpression: `SET ${assignments.join(', ')}`,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
              ConditionExpression:
                'attribute_exists(PK) AND attribute_exists(SK)',
            },
          },
          {
            Put: {
              Item: audit,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });

      return toProductDto({
        ...existing,
        ...changes,
        updatedAt: timestamp,
      });
    },

    async deleteProduct({
      organizationId,
      productId,
      actorId,
    }) {
      const existing = await requireProduct(
        organizationId,
        productId,
      );
      const timestamp = clock();
      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'PRODUCT_DELETED',
        resourceType: 'PRODUCT',
        resourceId: productId,
        metadata: {
          previousStatus: existing.status,
        },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: productKey(organizationId, productId),
              UpdateExpression:
                'SET #status = :inactive, #updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#updatedAt': 'updatedAt',
              },
              ExpressionAttributeValues: {
                ':inactive': PRODUCT_STATUS.INACTIVE,
                ':updatedAt': timestamp,
              },
              ConditionExpression:
                'attribute_exists(PK) AND attribute_exists(SK)',
            },
          },
          {
            Put: {
              Item: audit,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });
    },

    async createVariant({
      organizationId,
      productId,
      actorId,
      name,
      price,
    }) {
      await requireProduct(organizationId, productId);

      const variantId = idFactory();
      const timestamp = clock();
      const variant = {
        variantId,
        organizationId,
        productId,
        name,
        price,
        status: VARIANT_STATUS.ACTIVE,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const variantItem = {
        ...productVariantKey(
          organizationId,
          productId,
          variantId,
        ),
        entityType: 'ProductVariant',
        ...variant,
      };

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'VARIANT_CREATED',
        resourceType: 'PRODUCT_VARIANT',
        resourceId: variantId,
        metadata: { productId },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Put: {
              Item: variantItem,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              Item: audit,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });

      return toVariantDto(variant);
    },

    async updateVariant({
      organizationId,
      productId,
      variantId,
      actorId,
      changes,
    }) {
      const existing = await requireVariant(
        organizationId,
        productId,
        variantId,
      );
      const timestamp = clock();
      const names = {
        '#updatedAt': 'updatedAt',
      };
      const values = {
        ':updatedAt': timestamp,
      };
      const assignments = ['#updatedAt = :updatedAt'];

      for (const field of ['name', 'price', 'status']) {
        if (Object.prototype.hasOwnProperty.call(changes, field)) {
          names[`#${field}`] = field;
          values[`:${field}`] = changes[field];
          assignments.push(`#${field} = :${field}`);
        }
      }

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'VARIANT_UPDATED',
        resourceType: 'PRODUCT_VARIANT',
        resourceId: variantId,
        metadata: {
          productId,
          fields: Object.keys(changes),
        },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: productVariantKey(
                organizationId,
                productId,
                variantId,
              ),
              UpdateExpression: `SET ${assignments.join(', ')}`,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
              ConditionExpression:
                'attribute_exists(PK) AND attribute_exists(SK)',
            },
          },
          {
            Put: {
              Item: audit,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });

      return toVariantDto({
        ...existing,
        ...changes,
        updatedAt: timestamp,
      });
    },

    async deleteVariant({
      organizationId,
      productId,
      variantId,
      actorId,
    }) {
      const existing = await requireVariant(
        organizationId,
        productId,
        variantId,
      );
      const timestamp = clock();
      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'VARIANT_DELETED',
        resourceType: 'PRODUCT_VARIANT',
        resourceId: variantId,
        metadata: {
          productId,
          previousStatus: existing.status,
        },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: productVariantKey(
                organizationId,
                productId,
                variantId,
              ),
              UpdateExpression:
                'SET #status = :inactive, #updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#updatedAt': 'updatedAt',
              },
              ExpressionAttributeValues: {
                ':inactive': VARIANT_STATUS.INACTIVE,
                ':updatedAt': timestamp,
              },
              ConditionExpression:
                'attribute_exists(PK) AND attribute_exists(SK)',
            },
          },
          {
            Put: {
              Item: audit,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });
    },
  };
}

module.exports = {
  createProductService,
  defaultProductImageValidator,
};
