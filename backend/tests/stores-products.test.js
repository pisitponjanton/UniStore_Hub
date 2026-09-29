'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const {
  createProductRepository,
} = require('../src/modules/products/product.repository');
const {
  createProductService,
  defaultProductImageValidator,
} = require('../src/modules/products/product.service');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('../src/modules/products/product.constants');
const {
  createStoreService,
} = require('../src/modules/stores/store.service');
const {
  STORE_STATUS,
} = require('../src/modules/stores/store.constants');
const {
  validatePrice,
} = require('../src/validators/product.validator');
const {
  ORGANIZATION_ROLE,
  MEMBERSHIP_STATUS,
} = require('../src/modules/members/member.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');

const FIXED_TIME = '2026-09-29T10:00:00.000Z';

function createRepositoryRecorder(queryResponse = {}) {
  const transactions = [];
  const queries = [];

  return {
    transactions,
    queries,

    async transactWrite(input) {
      transactions.push(input);
      return {};
    },

    async query(input) {
      queries.push(input);
      return {
        items: queryResponse.items ?? [],
        lastEvaluatedKey: queryResponse.lastEvaluatedKey ?? null,
        count:
          queryResponse.count ??
          (queryResponse.items ? queryResponse.items.length : 0),
      };
    },
  };
}

function createIdFactory(ids) {
  let index = 0;

  return () => {
    const value = ids[index];
    index += 1;
    return value;
  };
}

function makeStore(overrides = {}) {
  return {
    storeId: 'store-1',
    organizationId: 'org-1',
    name: 'Main Store',
    description: 'Faculty merchandise',
    status: STORE_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeProduct(overrides = {}) {
  return {
    productId: 'product-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt',
    description: 'Pre-order shirt',
    imageKey: null,
    status: PRODUCT_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeVariant(overrides = {}) {
  return {
    variantId: 'variant-1',
    organizationId: 'org-1',
    productId: 'product-1',
    name: 'Size M',
    price: 25000,
    status: VARIANT_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

test('store creation is tenant-scoped and writes STORE_CREATED audit atomically', async () => {
  const repository = createRepositoryRecorder();
  const service = createStoreService({
    repository,
    idFactory: createIdFactory(['store-created', 'audit-store']),
    clock: () => FIXED_TIME,
  });

  const result = await service.createStore({
    organizationId: 'org-1',
    actorId: 'admin-1',
    name: 'Main Store',
    description: 'Faculty merchandise',
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 2);

  const store = items[0].Put.Item;
  assert.equal(store.PK, 'ORG#org-1');
  assert.equal(store.SK, 'STORE#store-created');
  assert.equal(store.organizationId, 'org-1');
  assert.equal(store.status, STORE_STATUS.ACTIVE);

  const audit = items[1].Put.Item;
  assert.equal(audit.action, 'STORE_CREATED');
  assert.equal(audit.resourceType, 'STORE');
  assert.equal(audit.resourceId, 'store-created');
  assert.equal(audit.organizationId, 'org-1');

  assert.equal(result.organizationId, 'org-1');
  assert.equal(result.storeId, 'store-created');
  assert.equal('PK' in result, false);
  assert.equal('SK' in result, false);
});

test('store list rejects repository data from another tenant', async () => {
  const service = createStoreService({
    storeRepository: {
      async listByOrganization() {
        return [
          makeStore({
            organizationId: 'org-other',
          }),
        ];
      },
    },
  });

  await assert.rejects(
    service.listStores('org-1'),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

test('store update changes only Store and Audit records in one transaction', async () => {
  const repository = createRepositoryRecorder();
  const service = createStoreService({
    repository,
    storeRepository: {
      async getById(organizationId, storeId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(storeId, 'store-1');
        return makeStore();
      },
    },
    idFactory: createIdFactory(['audit-update-store']),
    clock: () => FIXED_TIME,
  });

  const result = await service.updateStore({
    organizationId: 'org-1',
    storeId: 'store-1',
    actorId: 'admin-1',
    changes: {
      description: 'Updated',
      status: STORE_STATUS.INACTIVE,
    },
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 2);
  assert.deepEqual(items[0].Update.Key, {
    PK: 'ORG#org-1',
    SK: 'STORE#store-1',
  });
  assert.equal(
    items[0].Update.ExpressionAttributeValues[':status'],
    STORE_STATUS.INACTIVE,
  );
  assert.equal(items[1].Put.Item.action, 'STORE_UPDATED');
  assert.deepEqual(items[1].Put.Item.metadata.fields, [
    'description',
    'status',
  ]);
  assert.equal(result.status, STORE_STATUS.INACTIVE);
});

test('product repository lists by Store through tenant-qualified GSI1 and does not scan', async () => {
  const repository = createRepositoryRecorder({
    items: [makeProduct()],
  });
  const productRepository = createProductRepository({ repository });

  assert.equal(productRepository.scan, undefined);

  const result = await productRepository.listProductsByStore(
    'org-1',
    'store-1',
  );

  assert.equal(result.items.length, 1);
  assert.equal(repository.queries.length, 1);
  assert.deepEqual(repository.queries[0], {
    IndexName: 'GSI1',
    KeyConditionExpression:
      'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :productPrefix)',
    ExpressionAttributeValues: {
      ':gsi1pk': 'ORG#org-1#STORE#store-1',
      ':productPrefix': 'PRODUCT#',
    },
  });
});

test('product creation requires the Store to belong to the same Organization', async () => {
  const repository = createRepositoryRecorder();
  const service = createProductService({
    repository,
    storeRepository: {
      async getById(organizationId, storeId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(storeId, 'store-1');
        return makeStore({
          organizationId: 'org-other',
        });
      },
    },
  });

  await assert.rejects(
    service.createProduct({
      organizationId: 'org-1',
      actorId: 'admin-1',
      storeId: 'store-1',
      name: 'Faculty Shirt',
      description: 'Pre-order shirt',
    }),
    (error) => error.code === 'TENANT_MISMATCH',
  );

  assert.equal(repository.transactions.length, 0);
});

test('product creation writes canonical Product GSI and PRODUCT_CREATED audit', async () => {
  const repository = createRepositoryRecorder();
  const service = createProductService({
    repository,
    storeRepository: {
      async getById() {
        return makeStore();
      },
    },
    idFactory: createIdFactory(['product-created', 'audit-product']),
    clock: () => FIXED_TIME,
  });

  const result = await service.createProduct({
    organizationId: 'org-1',
    actorId: 'admin-1',
    storeId: 'store-1',
    name: 'Faculty Shirt',
    description: 'Pre-order shirt',
  });

  const items = repository.transactions[0].TransactItems;
  const product = items[0].Put.Item;

  assert.equal(product.PK, 'ORG#org-1');
  assert.equal(product.SK, 'PRODUCT#product-created');
  assert.equal(product.GSI1PK, 'ORG#org-1#STORE#store-1');
  assert.equal(product.GSI1SK, 'PRODUCT#product-created');
  assert.equal(product.status, PRODUCT_STATUS.ACTIVE);
  assert.equal(product.imageKey, null);

  assert.equal(items[1].Put.Item.action, 'PRODUCT_CREATED');
  assert.deepEqual(items[1].Put.Item.metadata, {
    storeId: 'store-1',
  });

  assert.equal(result.imageKey, null);
  assert.equal(result.imageUrl, null);
  assert.equal('PK' in result, false);
});

test('product detail includes only variants for the requested Product and tenant', async () => {
  const service = createProductService({
    productRepository: {
      async getProduct() {
        return makeProduct();
      },
      async listVariants(organizationId, productId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(productId, 'product-1');
        return [
          makeVariant(),
          makeVariant({
            variantId: 'variant-2',
            name: 'Size L',
            price: 27000,
          }),
        ];
      },
    },
  });

  const result = await service.getProduct({
    organizationId: 'org-1',
    productId: 'product-1',
  });

  assert.equal(result.productId, 'product-1');
  assert.equal(result.variants.length, 2);
  assert.deepEqual(
    result.variants.map((variant) => variant.price),
    [25000, 27000],
  );
});

test('product detail rejects a Variant that points at another Product', async () => {
  const service = createProductService({
    productRepository: {
      async getProduct() {
        return makeProduct();
      },
      async listVariants() {
        return [
          makeVariant({
            productId: 'product-other',
          }),
        ];
      },
    },
  });

  await assert.rejects(
    service.getProduct({
      organizationId: 'org-1',
      productId: 'product-1',
    }),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );
});

test('management Product DTO keeps imageKey but never exposes storage keys', async () => {
  const service = createProductService({
    productRepository: {
      async getProduct() {
        return {
          ...makeProduct({
            imageKey: 'products/org-1/product-1/file-1',
          }),
          PK: 'ORG#org-1',
          SK: 'PRODUCT#product-1',
          GSI1PK: 'ORG#org-1#STORE#store-1',
          GSI1SK: 'PRODUCT#product-1',
        };
      },
      async listVariants() {
        return [];
      },
    },
  });

  const result = await service.getProduct({
    organizationId: 'org-1',
    productId: 'product-1',
  });

  assert.equal(
    result.imageKey,
    'products/org-1/product-1/file-1',
  );
  assert.equal(result.imageUrl, null);
  assert.equal('PK' in result, false);
  assert.equal('SK' in result, false);
  assert.equal('GSI1PK' in result, false);
});

test('product image association hook receives the canonical tenant/product context', async () => {
  const repository = createRepositoryRecorder();
  const validations = [];
  const service = createProductService({
    repository,
    productRepository: {
      async getProduct() {
        return makeProduct();
      },
    },
    validateProductImageAssociation: async (input) => {
      validations.push(input);
    },
    idFactory: createIdFactory(['audit-image']),
    clock: () => FIXED_TIME,
  });

  await service.updateProduct({
    organizationId: 'org-1',
    productId: 'product-1',
    actorId: 'admin-1',
    changes: {
      imageKey: 'products/org-1/product-1/image-uuid',
    },
  });

  assert.deepEqual(validations, [
    {
      organizationId: 'org-1',
      productId: 'product-1',
      imageKey: 'products/org-1/product-1/image-uuid',
    },
  ]);
  assert.equal(
    repository.transactions[0].TransactItems[1].Put.Item.action,
    'PRODUCT_UPDATED',
  );
});
test('default product image validator rejects arbitrary or cross-tenant keys', () => {
  assert.doesNotThrow(() =>
    defaultProductImageValidator({
      organizationId: 'org-1',
      productId: 'product-1',
      imageKey:
        'products/org-1/product-1/11111111-1111-4111-8111-111111111111',
    }),
  );

  assert.throws(
    () =>
      defaultProductImageValidator({
        organizationId: 'org-1',
        productId: 'product-1',
        imageKey:
          'products/org-other/product-1/11111111-1111-4111-8111-111111111111',
      }),
    (error) =>
      error.code === 'FILE_ACCESS_FORBIDDEN' &&
      error.httpStatus === 403,
  );
});

test('Product delete is soft deactivate and does not delete or rewrite historical OrderItem data', async () => {
  const repository = createRepositoryRecorder();
  const historicalOrderItem = Object.freeze({
    productId: 'product-1',
    variantId: 'variant-1',
    productName: 'Original Shirt',
    variantName: 'Size M',
    unitPrice: 25000,
    quantity: 2,
    totalPrice: 50000,
  });
  const snapshotBefore = JSON.stringify(historicalOrderItem);
  const service = createProductService({
    repository,
    productRepository: {
      async getProduct() {
        return makeProduct();
      },
    },
    idFactory: createIdFactory(['audit-delete-product']),
    clock: () => FIXED_TIME,
  });

  await service.deleteProduct({
    organizationId: 'org-1',
    productId: 'product-1',
    actorId: 'admin-1',
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 2);
  assert.deepEqual(items[0].Update.Key, {
    PK: 'ORG#org-1',
    SK: 'PRODUCT#product-1',
  });
  assert.equal(
    items[0].Update.ExpressionAttributeValues[':inactive'],
    PRODUCT_STATUS.INACTIVE,
  );
  assert.equal(items[1].Put.Item.action, 'PRODUCT_DELETED');
  assert.equal(
    items.some((item) =>
      JSON.stringify(item).includes('ORDER#')),
    false,
  );
  assert.equal(JSON.stringify(historicalOrderItem), snapshotBefore);
});

test('Variant price validation requires a safe integer satang value', () => {
  assert.equal(validatePrice(25000), 25000);

  for (const invalidPrice of [
    250.5,
    '25000',
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(
      () => validatePrice(invalidPrice),
      (error) =>
        error.code === 'VALIDATION_ERROR' &&
        error.httpStatus === 400,
    );
  }
});

test('Variant creation requires an existing tenant-scoped Product and writes exact variant key', async () => {
  const repository = createRepositoryRecorder();
  const service = createProductService({
    repository,
    productRepository: {
      async getProduct(organizationId, productId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(productId, 'product-1');
        return makeProduct();
      },
    },
    idFactory: createIdFactory(['variant-created', 'audit-variant']),
    clock: () => FIXED_TIME,
  });

  const result = await service.createVariant({
    organizationId: 'org-1',
    productId: 'product-1',
    actorId: 'admin-1',
    name: 'Size M',
    price: 25000,
  });

  const items = repository.transactions[0].TransactItems;
  const variant = items[0].Put.Item;
  assert.equal(variant.PK, 'ORG#org-1');
  assert.equal(
    variant.SK,
    'PRODUCT#product-1#VARIANT#variant-created',
  );
  assert.equal(variant.price, 25000);
  assert.equal(variant.status, VARIANT_STATUS.ACTIVE);
  assert.equal(items[1].Put.Item.action, 'VARIANT_CREATED');
  assert.equal(result.price, 25000);
});

test('Variant update rejects a Variant that belongs to another Product', async () => {
  const repository = createRepositoryRecorder();
  const service = createProductService({
    repository,
    productRepository: {
      async getVariant() {
        return makeVariant({
          productId: 'product-other',
        });
      },
    },
  });

  await assert.rejects(
    service.updateVariant({
      organizationId: 'org-1',
      productId: 'product-1',
      variantId: 'variant-1',
      actorId: 'admin-1',
      changes: {
        price: 27000,
      },
    }),
    (error) =>
      error.code === 'VARIANT_NOT_FOUND' &&
      error.httpStatus === 404,
  );

  assert.equal(repository.transactions.length, 0);
});

test('Variant update changes current catalog data without touching historical OrderItem snapshots', async () => {
  const repository = createRepositoryRecorder();
  const historicalOrderItem = Object.freeze({
    productId: 'product-1',
    variantId: 'variant-1',
    productName: 'Faculty Shirt',
    variantName: 'Size M',
    unitPrice: 25000,
    quantity: 1,
    totalPrice: 25000,
  });
  const snapshotBefore = JSON.stringify(historicalOrderItem);
  const service = createProductService({
    repository,
    productRepository: {
      async getVariant() {
        return makeVariant();
      },
    },
    userRepository: {},
    idFactory: createIdFactory(['audit-update-variant']),
    clock: () => FIXED_TIME,
  });

  const result = await service.updateVariant({
    organizationId: 'org-1',
    productId: 'product-1',
    variantId: 'variant-1',
    actorId: 'admin-1',
    changes: {
      name: 'Size Large',
      price: 27000,
    },
  });

  const items = repository.transactions[0].TransactItems;
  assert.deepEqual(items[0].Update.Key, {
    PK: 'ORG#org-1',
    SK: 'PRODUCT#product-1#VARIANT#variant-1',
  });
  assert.equal(
    items[0].Update.ExpressionAttributeValues[':price'],
    27000,
  );
  assert.equal(items[1].Put.Item.action, 'VARIANT_UPDATED');
  assert.equal(
    items.some((item) =>
      JSON.stringify(item).includes('ORDER#')),
    false,
  );
  assert.equal(JSON.stringify(historicalOrderItem), snapshotBefore);
  assert.equal(result.price, 27000);
});

test('Variant delete is soft deactivate and writes VARIANT_DELETED audit', async () => {
  const repository = createRepositoryRecorder();
  const service = createProductService({
    repository,
    productRepository: {
      async getVariant() {
        return makeVariant();
      },
    },
    idFactory: createIdFactory(['audit-delete-variant']),
    clock: () => FIXED_TIME,
  });

  await service.deleteVariant({
    organizationId: 'org-1',
    productId: 'product-1',
    variantId: 'variant-1',
    actorId: 'admin-1',
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(
    items[0].Update.ExpressionAttributeValues[':inactive'],
    VARIANT_STATUS.INACTIVE,
  );
  assert.equal(items[1].Put.Item.action, 'VARIANT_DELETED');
  assert.equal(
    items.some((item) =>
      JSON.stringify(item).includes('Delete'),
    ),
    false,
  );
});

test('Store and Product management routes reject STAFF role even when request body claims admin', async () => {
  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'staff-1',
          email: 'staff@example.com',
          status: 'ACTIVE',
        };
        next();
      },
      organizationContextMiddleware(req, res, next) {
        req.organization = {
          organizationId: req.params.organizationId,
          status: ORGANIZATION_STATUS.ACTIVE,
        };
        next();
      },
      membershipMiddleware(req, res, next) {
        req.membership = {
          organizationId: req.params.organizationId,
          userId: 'staff-1',
          role: ORGANIZATION_ROLE.STAFF,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        next();
      },
      stores: {
        storeService: {
          async listStores() {
            throw new Error('must not reach Store service');
          },
        },
      },
      products: {
        productService: {
          async listProducts() {
            throw new Error('must not reach Product service');
          },
        },
      },
    },
  });

  for (const path of [
    '/api/v1/organizations/org-1/stores',
    '/api/v1/organizations/org-1/products',
  ]) {
    const response = await request(app)
      .get(path)
      .set('authorization', 'Bearer ignored')
      .send({
        role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      })
      .expect(403);

    assert.equal(response.body.error.code, 'ROLE_FORBIDDEN');
  }
});

test('catalog mutations are blocked while Organization is not ACTIVE', async () => {
  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'admin-1',
          email: 'admin@example.com',
          status: 'ACTIVE',
        };
        next();
      },
      organizationContextMiddleware(req, res, next) {
        req.organization = {
          organizationId: req.params.organizationId,
          status: ORGANIZATION_STATUS.PENDING,
        };
        next();
      },
      membershipMiddleware(req, res, next) {
        req.membership = {
          organizationId: req.params.organizationId,
          userId: 'admin-1',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        next();
      },
      stores: {
        storeService: {
          async createStore() {
            throw new Error('must not reach Store service');
          },
        },
      },
      products: {
        productService: {
          async createProduct() {
            throw new Error('must not reach Product service');
          },
        },
      },
    },
  });

  const storeResponse = await request(app)
    .post('/api/v1/organizations/org-1/stores')
    .set('authorization', 'Bearer ignored')
    .send({
      name: 'Main Store',
      description: 'Faculty merchandise',
    })
    .expect(403);

  assert.equal(storeResponse.body.error.code, 'FORBIDDEN');

  const productResponse = await request(app)
    .post('/api/v1/organizations/org-1/products')
    .set('authorization', 'Bearer ignored')
    .send({
      storeId: 'store-1',
      name: 'Faculty Shirt',
      description: 'Pre-order shirt',
    })
    .expect(403);

  assert.equal(productResponse.body.error.code, 'FORBIDDEN');
});
