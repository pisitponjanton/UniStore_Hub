'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const {
  ALLOWED_IMAGE_CONTENT_TYPES,
  PAYMENT_SLIP_MAX_BYTES,
  PRESIGN_EXPIRES_SECONDS,
  PRODUCT_IMAGE_MAX_BYTES,
} = require('../src/modules/files/file.constants');
const {
  createFileService,
} = require('../src/modules/files/file.service');
const {
  assertPaymentSlipKey,
  assertProductImageKey,
  createPaymentSlipObjectValidator,
  createProductImageAssociationValidator,
  parseCanonicalFileKey,
  validateContentType,
  validateUploadedObject,
} = require('../src/modules/files/file.validation');
const {
  MEMBERSHIP_STATUS,
  ORGANIZATION_ROLE,
} = require('../src/modules/members/member.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');

const FILE_UUID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_KEY =
  `products/org-1/product-1/${FILE_UUID}`;
const PAYMENT_KEY =
  `payments/org-1/order-1/${FILE_UUID}`;

function makeProduct(overrides = {}) {
  return {
    productId: 'product-1',
    organizationId: 'org-1',
    storeId: 'store-1',
    name: 'Faculty Shirt',
    status: 'ACTIVE',
    ...overrides,
  };
}

function makeOrder(overrides = {}) {
  return {
    orderId: 'order-1',
    organizationId: 'org-1',
    campaignId: 'campaign-1',
    customerId: 'customer-1',
    status: 'PENDING_PAYMENT',
    createdAt: '2026-09-29T10:45:00.000Z',
    ...overrides,
  };
}

function makeMembership(role, overrides = {}) {
  return {
    organizationId: 'org-1',
    userId: 'staff-1',
    role,
    status: MEMBERSHIP_STATUS.ACTIVE,
    ...overrides,
  };
}

function createS3Recorder({
  head = {
    ContentType: 'image/png',
    ContentLength: 1024,
  },
  headError,
} = {}) {
  const calls = {
    put: [],
    get: [],
    head: [],
  };

  return {
    calls,

    async createPutUrl(input) {
      calls.put.push(input);
      return 'https://signed.example/upload';
    },

    async createGetUrl(input) {
      calls.get.push(input);
      return 'https://signed.example/download';
    },

    async headObject(input) {
      calls.head.push(input);

      if (headError) {
        throw headError;
      }

      return head;
    },
  };
}

function createFileHarness(overrides = {}) {
  const s3Adapter =
    overrides.s3Adapter || createS3Recorder();

  const service = createFileService({
    s3Adapter,
    idFactory: () => FILE_UUID,
    productRepository: {
      async getProduct(organizationId, productId) {
        if (
          organizationId !== 'org-1' ||
          productId !== 'product-1'
        ) {
          return null;
        }

        return overrides.product ?? makeProduct();
      },
    },
    orderRepository: {
      async getById(organizationId, orderId) {
        if (
          organizationId !== 'org-1' ||
          orderId !== 'order-1'
        ) {
          return null;
        }

        return overrides.order ?? makeOrder();
      },
    },
    memberRepository: {
      async getByOrganizationAndUser(
        organizationId,
        userId,
      ) {
        if (overrides.membershipFactory) {
          return overrides.membershipFactory(
            organizationId,
            userId,
          );
        }

        return makeMembership(
          ORGANIZATION_ROLE.STAFF,
          {
            organizationId,
            userId,
          },
        );
      },
    },
  });

  return {
    s3Adapter,
    service,
  };
}

function createFileRouteApp({
  userId = 'admin-1',
  role = ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  fileService,
  membershipStatus = MEMBERSHIP_STATUS.ACTIVE,
} = {}) {
  return createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId,
          email: `${userId}@example.com`,
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
          userId,
          role,
          status: membershipStatus,
        };
        next();
      },
      files: {
        fileService,
      },
    },
  });
}

test('canonical file keys require exact resource prefixes and UUID v4 object ids', () => {
  assert.deepEqual(parseCanonicalFileKey(PRODUCT_KEY), {
    kind: 'PRODUCT_IMAGE',
    organizationId: 'org-1',
    resourceId: 'product-1',
    objectId: FILE_UUID,
    objectKey: PRODUCT_KEY,
  });

  assert.deepEqual(parseCanonicalFileKey(PAYMENT_KEY), {
    kind: 'PAYMENT_SLIP',
    organizationId: 'org-1',
    resourceId: 'order-1',
    objectId: FILE_UUID,
    objectKey: PAYMENT_KEY,
  });

  assert.doesNotThrow(() =>
    assertProductImageKey({
      organizationId: 'org-1',
      productId: 'product-1',
      objectKey: PRODUCT_KEY,
    }),
  );

  assert.doesNotThrow(() =>
    assertPaymentSlipKey({
      organizationId: 'org-1',
      orderId: 'order-1',
      objectKey: PAYMENT_KEY,
    }),
  );

  for (const objectKey of [
    'products/org-1/product-1/not-a-uuid',
    `products/org-2/product-1/${FILE_UUID}`,
    `products/org-1/product-other/${FILE_UUID}`,
  ]) {
    assert.throws(
      () =>
        assertProductImageKey({
          organizationId: 'org-1',
          productId: 'product-1',
          objectKey,
        }),
      (error) =>
        error.code === 'FILE_ACCESS_FORBIDDEN' &&
        error.httpStatus === 403,
    );
  }

  for (const objectKey of [
    'payments/org-1/order-1/not-a-uuid',
    `payments/org-2/order-1/${FILE_UUID}`,
    `payments/org-1/order-other/${FILE_UUID}`,
    `other/org-1/order-1/${FILE_UUID}`,
    `payments/org-1/order-1/${FILE_UUID}/extra`,
  ]) {
    assert.throws(
      () =>
        assertPaymentSlipKey({
          organizationId: 'org-1',
          orderId: 'order-1',
          objectKey,
        }),
      (error) =>
        error.code === 'FILE_ACCESS_FORBIDDEN' &&
        error.httpStatus === 403,
    );
  }
});

test('allowed upload MIME types are exactly JPEG, PNG and WebP', () => {
  assert.deepEqual(ALLOWED_IMAGE_CONTENT_TYPES, [
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  for (const contentType of ALLOWED_IMAGE_CONTENT_TYPES) {
    assert.equal(
      validateContentType(contentType),
      contentType,
    );
  }

  for (const contentType of [
    'image/gif',
    'application/pdf',
    'image/png; charset=utf-8',
    '',
    null,
  ]) {
    assert.throws(
      () => validateContentType(contentType),
      (error) =>
        error.code === 'VALIDATION_ERROR' &&
        error.httpStatus === 400,
    );
  }
});

test('Product Image upload URL uses canonical key, signed Content-Type and 900-second expiry', async () => {
  const { service, s3Adapter } = createFileHarness();

  const result =
    await service.createProductImageUploadUrl({
      organizationId: 'org-1',
      productId: 'product-1',
      contentType: 'image/png',
    });

  assert.deepEqual(result, {
    objectKey: PRODUCT_KEY,
    url: 'https://signed.example/upload',
    method: 'PUT',
    expiresInSeconds: 900,
  });
  assert.equal(PRESIGN_EXPIRES_SECONDS, 900);
  assert.deepEqual(s3Adapter.calls.put, [
    {
      objectKey: PRODUCT_KEY,
      contentType: 'image/png',
      expiresInSeconds: 900,
    },
  ]);
});

test('Payment Slip upload URL requires the Customer who owns the tenant Order', async () => {
  const { service, s3Adapter } = createFileHarness();

  const result =
    await service.createPaymentSlipUploadUrl({
      organizationId: 'org-1',
      orderId: 'order-1',
      userId: 'customer-1',
      contentType: 'image/jpeg',
    });

  assert.deepEqual(result, {
    objectKey: PAYMENT_KEY,
    url: 'https://signed.example/upload',
    method: 'PUT',
    expiresInSeconds: 900,
  });

  await assert.rejects(
    service.createPaymentSlipUploadUrl({
      organizationId: 'org-1',
      orderId: 'order-1',
      userId: 'customer-other',
      contentType: 'image/jpeg',
    }),
    (error) =>
      error.code === 'RESOURCE_OWNERSHIP_REQUIRED' &&
      error.httpStatus === 403,
  );

  assert.equal(s3Adapter.calls.put.length, 1);
});

test('unsupported MIME is rejected before any S3 signing call', async () => {
  const { service, s3Adapter } = createFileHarness();

  await assert.rejects(
    service.createProductImageUploadUrl({
      organizationId: 'org-1',
      productId: 'product-1',
      contentType: 'image/gif',
    }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.httpStatus === 400,
  );

  await assert.rejects(
    service.createPaymentSlipUploadUrl({
      organizationId: 'org-1',
      orderId: 'order-1',
      userId: 'customer-1',
      contentType: 'application/pdf',
    }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.httpStatus === 400,
  );

  assert.equal(s3Adapter.calls.put.length, 0);
});

test('S3 HEAD validation accepts exact size limits and rejects one byte over', async () => {
  await assert.doesNotReject(
    validateUploadedObject({
      s3Adapter: createS3Recorder({
        head: {
          ContentType: 'image/webp',
          ContentLength: PRODUCT_IMAGE_MAX_BYTES,
        },
      }),
      objectKey: PRODUCT_KEY,
      maxBytes: PRODUCT_IMAGE_MAX_BYTES,
    }),
  );

  await assert.doesNotReject(
    validateUploadedObject({
      s3Adapter: createS3Recorder({
        head: {
          ContentType: 'image/png',
          ContentLength: PAYMENT_SLIP_MAX_BYTES,
        },
      }),
      objectKey: PAYMENT_KEY,
      maxBytes: PAYMENT_SLIP_MAX_BYTES,
    }),
  );

  for (const [objectKey, maxBytes] of [
    [PRODUCT_KEY, PRODUCT_IMAGE_MAX_BYTES],
    [PAYMENT_KEY, PAYMENT_SLIP_MAX_BYTES],
  ]) {
    await assert.rejects(
      validateUploadedObject({
        s3Adapter: createS3Recorder({
          head: {
            ContentType: 'image/png',
            ContentLength: maxBytes + 1,
          },
        }),
        objectKey,
        maxBytes,
      }),
      (error) =>
        error.code === 'VALIDATION_ERROR' &&
        error.httpStatus === 400,
    );
  }
});

test('S3 HEAD validation rejects missing objects, unsupported MIME and invalid size metadata', async () => {
  const missing = new Error('not found');
  missing.name = 'NotFound';
  missing.$metadata = {
    httpStatusCode: 404,
  };

  await assert.rejects(
    validateUploadedObject({
      s3Adapter: createS3Recorder({
        headError: missing,
      }),
      objectKey: PRODUCT_KEY,
      maxBytes: PRODUCT_IMAGE_MAX_BYTES,
    }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.httpStatus === 400,
  );

  await assert.rejects(
    validateUploadedObject({
      s3Adapter: createS3Recorder({
        head: {
          ContentType: 'image/gif',
          ContentLength: 100,
        },
      }),
      objectKey: PRODUCT_KEY,
      maxBytes: PRODUCT_IMAGE_MAX_BYTES,
    }),
    (error) => error.code === 'VALIDATION_ERROR',
  );

  for (const contentLength of [
    -1,
    1.25,
    '100',
    undefined,
  ]) {
    await assert.rejects(
      validateUploadedObject({
        s3Adapter: createS3Recorder({
          head: {
            ContentType: 'image/png',
            ContentLength: contentLength,
          },
        }),
        objectKey: PAYMENT_KEY,
        maxBytes: PAYMENT_SLIP_MAX_BYTES,
      }),
      (error) => error.code === 'VALIDATION_ERROR',
    );
  }
});

test('Product image association performs S3 HEAD before imageKey is accepted', async () => {
  const s3Adapter = createS3Recorder({
    head: {
      ContentType: 'image/jpeg',
      ContentLength: PRODUCT_IMAGE_MAX_BYTES,
    },
  });
  const validateAssociation =
    createProductImageAssociationValidator({
      s3Adapter,
    });

  const metadata = await validateAssociation({
    organizationId: 'org-1',
    productId: 'product-1',
    imageKey: PRODUCT_KEY,
  });

  assert.deepEqual(metadata, {
    contentType: 'image/jpeg',
    contentLength: PRODUCT_IMAGE_MAX_BYTES,
  });
  assert.deepEqual(s3Adapter.calls.head, [
    {
      objectKey: PRODUCT_KEY,
    },
  ]);

  await assert.rejects(
    validateAssociation({
      organizationId: 'org-1',
      productId: 'product-other',
      imageKey: PRODUCT_KEY,
    }),
    (error) =>
      error.code === 'FILE_ACCESS_FORBIDDEN' &&
      error.httpStatus === 403,
  );
});

test('Payment slip validator performs S3 HEAD before slipKey is accepted', async () => {
  const s3Adapter = createS3Recorder({
    head: {
      ContentType: 'image/png',
      ContentLength: PAYMENT_SLIP_MAX_BYTES,
    },
  });
  const validateSlip =
    createPaymentSlipObjectValidator({
      s3Adapter,
    });

  const metadata = await validateSlip({
    organizationId: 'org-1',
    orderId: 'order-1',
    slipKey: PAYMENT_KEY,
  });

  assert.deepEqual(metadata, {
    contentType: 'image/png',
    contentLength: PAYMENT_SLIP_MAX_BYTES,
  });
  assert.deepEqual(s3Adapter.calls.head, [
    {
      objectKey: PAYMENT_KEY,
    },
  ]);
});

test('Customer can download only a Payment Slip for an Order they own', async () => {
  const { service, s3Adapter } = createFileHarness();

  const result =
    await service.createPrivateDownloadUrl({
      organizationId: 'org-1',
      userId: 'customer-1',
      objectKey: PAYMENT_KEY,
    });

  assert.deepEqual(result, {
    url: 'https://signed.example/download',
    method: 'GET',
    expiresInSeconds: 900,
  });
  assert.deepEqual(s3Adapter.calls.get, [
    {
      objectKey: PAYMENT_KEY,
      expiresInSeconds: 900,
    },
  ]);

  const forbidden = createFileHarness({
    membershipFactory() {
      return null;
    },
  });

  await assert.rejects(
    forbidden.service.createPrivateDownloadUrl({
      organizationId: 'org-1',
      userId: 'customer-other',
      objectKey: PAYMENT_KEY,
    }),
    (error) =>
      error.code === 'FILE_ACCESS_FORBIDDEN' &&
      error.httpStatus === 403,
  );

  assert.equal(forbidden.s3Adapter.calls.get.length, 0);
});

test('active Staff/Admin can download tenant Payment Slips; inactive members cannot', async () => {
  for (const role of [
    ORGANIZATION_ROLE.STAFF,
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  ]) {
    const { service, s3Adapter } = createFileHarness({
      membershipFactory(organizationId, userId) {
        return makeMembership(role, {
          organizationId,
          userId,
        });
      },
    });

    const result =
      await service.createPrivateDownloadUrl({
        organizationId: 'org-1',
        userId: 'staff-1',
        objectKey: PAYMENT_KEY,
      });

    assert.equal(result.method, 'GET');
    assert.equal(result.expiresInSeconds, 900);
    assert.equal(s3Adapter.calls.get.length, 1);
  }

  const inactive = createFileHarness({
    membershipFactory(organizationId, userId) {
      return makeMembership(
        ORGANIZATION_ROLE.STAFF,
        {
          organizationId,
          userId,
          status: MEMBERSHIP_STATUS.INACTIVE,
        },
      );
    },
  });

  await assert.rejects(
    inactive.service.createPrivateDownloadUrl({
      organizationId: 'org-1',
      userId: 'staff-1',
      objectKey: PAYMENT_KEY,
    }),
    (error) =>
      error.code === 'FILE_ACCESS_FORBIDDEN' &&
      error.httpStatus === 403,
  );

  assert.equal(inactive.s3Adapter.calls.get.length, 0);
});

test('private download rejects arbitrary and cross-tenant keys before signing', async () => {
  const { service, s3Adapter } = createFileHarness();

  const attempts = [
    {
      objectKey:
        `payments/org-2/order-1/${FILE_UUID}`,
      expected: ['FILE_ACCESS_FORBIDDEN'],
    },
    {
      objectKey:
        `payments/org-1/order-other/${FILE_UUID}`,
      expected: ['ORDER_NOT_FOUND'],
    },
    {
      objectKey:
        `products/org-2/product-1/${FILE_UUID}`,
      expected: ['FILE_ACCESS_FORBIDDEN'],
    },
    {
      objectKey:
        `products/org-1/product-other/${FILE_UUID}`,
      expected: ['PRODUCT_NOT_FOUND'],
    },
    {
      objectKey: 'payments/org-1/order-1/not-a-uuid',
      expected: ['FILE_ACCESS_FORBIDDEN'],
    },
    {
      objectKey:
        `unknown/org-1/order-1/${FILE_UUID}`,
      expected: ['FILE_ACCESS_FORBIDDEN'],
    },
  ];

  for (const attempt of attempts) {
    await assert.rejects(
      service.createPrivateDownloadUrl({
        organizationId: 'org-1',
        userId: 'customer-1',
        objectKey: attempt.objectKey,
      }),
      (error) => attempt.expected.includes(error.code),
    );
  }

  assert.equal(s3Adapter.calls.get.length, 0);
});

test('stored Storefront Product image signing accepts only its canonical Product key', async () => {
  const { service, s3Adapter } = createFileHarness();

  const url =
    await service.createStoredProductImageUrl({
      organizationId: 'org-1',
      productId: 'product-1',
      imageKey: PRODUCT_KEY,
    });

  assert.equal(url, 'https://signed.example/download');
  assert.deepEqual(s3Adapter.calls.get, [
    {
      objectKey: PRODUCT_KEY,
      expiresInSeconds: 900,
    },
  ]);

  await assert.rejects(
    service.createStoredProductImageUrl({
      organizationId: 'org-1',
      productId: 'product-1',
      imageKey: PAYMENT_KEY,
    }),
    (error) =>
      error.code === 'FILE_ACCESS_FORBIDDEN' &&
      error.httpStatus === 403,
  );
});

test('Product image upload URL route is Organization Admin protected', async () => {
  let serviceCalls = 0;
  const fileService = {
    async createProductImageUploadUrl(input) {
      serviceCalls += 1;
      assert.deepEqual(input, {
        organizationId: 'org-1',
        productId: 'product-1',
        contentType: 'image/png',
      });

      return {
        objectKey: PRODUCT_KEY,
        url: 'https://signed.example/upload',
        method: 'PUT',
        expiresInSeconds: 900,
      };
    },
  };

  const response = await request(
    createFileRouteApp({
      fileService,
    }),
  )
    .post(
      '/api/v1/organizations/org-1/products/product-1/image-upload-url',
    )
    .send({
      contentType: 'image/png',
    })
    .expect(200);

  assert.equal(response.body.data.method, 'PUT');
  assert.equal(
    response.body.data.expiresInSeconds,
    900,
  );
  assert.equal(serviceCalls, 1);

  const denied = await request(
    createFileRouteApp({
      fileService,
      role: ORGANIZATION_ROLE.STAFF,
      userId: 'staff-1',
    }),
  )
    .post(
      '/api/v1/organizations/org-1/products/product-1/image-upload-url',
    )
    .send({
      contentType: 'image/png',
    })
    .expect(403);

  assert.equal(
    denied.body.error.code,
    'ROLE_FORBIDDEN',
  );
  assert.equal(serviceCalls, 1);
});

test('Payment Slip upload URL route does not require Organization membership', async () => {
  let seen;
  const fileService = {
    async createPaymentSlipUploadUrl(input) {
      seen = input;

      return {
        objectKey: PAYMENT_KEY,
        url: 'https://signed.example/upload',
        method: 'PUT',
        expiresInSeconds: 900,
      };
    },
  };

  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'customer-1',
          email: 'customer@example.com',
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
        next(
          new Error(
            'membership must not be required for Payment Slip upload',
          ),
        );
      },
      files: {
        fileService,
      },
    },
  });

  await request(app)
    .post(
      '/api/v1/organizations/org-1/orders/order-1/payment-slip-upload-url',
    )
    .send({
      contentType: 'image/png',
    })
    .expect(200);

  assert.deepEqual(seen, {
    organizationId: 'org-1',
    orderId: 'order-1',
    userId: 'customer-1',
    contentType: 'image/png',
  });
});

test('documented file API does not proxy raw binary upload bodies', async () => {
  let serviceCalls = 0;
  const fileService = {
    async createProductImageUploadUrl() {
      serviceCalls += 1;
      throw new Error('must not sign a raw binary request');
    },
  };

  const response = await request(
    createFileRouteApp({
      fileService,
    }),
  )
    .post(
      '/api/v1/organizations/org-1/products/product-1/image-upload-url',
    )
    .set('Content-Type', 'image/png')
    .send(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    .expect(400);

  assert.equal(
    response.body.error.code,
    'VALIDATION_ERROR',
  );
  assert.equal(serviceCalls, 0);
});
