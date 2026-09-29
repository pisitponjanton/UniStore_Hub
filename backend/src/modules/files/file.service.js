'use strict';

const { createS3Adapter } = require('../../aws/s3');
const { AppError } = require('../../errors/app-error');
const {
  requireOrganizationRole,
  requireResourceOwnership,
  requireTenantMatch,
} = require('../../policies/organization.policy');
const { createId } = require('../../utils/id');
const {
  MEMBERSHIP_STATUS,
  ORGANIZATION_ROLE,
} = require('../members/member.constants');
const {
  createMemberRepository,
} = require('../members/member.repository');
const {
  createOrderRepository,
} = require('../orders/order.repository');
const {
  createProductRepository,
} = require('../products/product.repository');
const {
  PRESIGN_EXPIRES_SECONDS,
  PRODUCT_IMAGE_MAX_BYTES,
  PAYMENT_SLIP_MAX_BYTES,
} = require('./file.constants');
const {
  assertPaymentSlipKey,
  assertProductImageKey,
  fileAccessForbidden,
  parseCanonicalFileKey,
  validateContentType,
  validateUploadedObject,
} = require('./file.validation');

function resourceNotFound(code, message) {
  return new AppError({
    code,
    message,
    httpStatus: 404,
  });
}

function createFileService(options = {}) {
  const idFactory = options.idFactory || createId;

  let s3Adapter = options.s3Adapter;
  let productRepository = options.productRepository;
  let orderRepository = options.orderRepository;
  let memberRepository = options.memberRepository;

  function getS3Adapter() {
    if (!s3Adapter) {
      s3Adapter = createS3Adapter();
    }

    return s3Adapter;
  }

  function getProductRepository() {
    if (!productRepository) {
      productRepository = createProductRepository();
    }

    return productRepository;
  }

  function getOrderRepository() {
    if (!orderRepository) {
      orderRepository = createOrderRepository();
    }

    return orderRepository;
  }

  function getMemberRepository() {
    if (!memberRepository) {
      memberRepository = createMemberRepository();
    }

    return memberRepository;
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

  async function requireOrder(organizationId, orderId) {
    const order = await getOrderRepository().getById(
      organizationId,
      orderId,
    );

    if (!order) {
      throw resourceNotFound(
        'ORDER_NOT_FOUND',
        'Order not found',
      );
    }

    requireTenantMatch(order, organizationId);
    return order;
  }

  async function requireStaffOrAdmin(organizationId, userId) {
    const membership =
      await getMemberRepository().getByOrganizationAndUser(
        organizationId,
        userId,
      );

    if (
      !membership ||
      membership.organizationId !== organizationId ||
      membership.userId !== userId ||
      membership.status !== MEMBERSHIP_STATUS.ACTIVE
    ) {
      throw fileAccessForbidden();
    }

    try {
      requireOrganizationRole(membership, [
        ORGANIZATION_ROLE.STAFF,
        ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      ]);
    } catch {
      throw fileAccessForbidden();
    }

    return membership;
  }

  async function createPutResponse({
    objectKey,
    contentType,
  }) {
    const url = await getS3Adapter().createPutUrl({
      objectKey,
      contentType,
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
    });

    return {
      objectKey,
      url,
      method: 'PUT',
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
    };
  }

  return {
    async createProductImageUploadUrl({
      organizationId,
      productId,
      contentType,
    }) {
      validateContentType(contentType);
      await requireProduct(organizationId, productId);

      const objectKey =
        `products/${organizationId}/${productId}/${idFactory()}`;

      assertProductImageKey({
        organizationId,
        productId,
        objectKey,
      });

      return createPutResponse({
        objectKey,
        contentType,
      });
    },

    async createPaymentSlipUploadUrl({
      organizationId,
      orderId,
      userId,
      contentType,
    }) {
      validateContentType(contentType);

      const order = await requireOrder(
        organizationId,
        orderId,
      );
      requireResourceOwnership(
        order,
        userId,
        'customerId',
      );

      const objectKey =
        `payments/${organizationId}/${orderId}/${idFactory()}`;

      assertPaymentSlipKey({
        organizationId,
        orderId,
        objectKey,
      });

      return createPutResponse({
        objectKey,
        contentType,
      });
    },

    async createPrivateDownloadUrl({
      organizationId,
      userId,
      objectKey,
    }) {
      const parsed = parseCanonicalFileKey(objectKey);

      if (parsed.organizationId !== organizationId) {
        throw fileAccessForbidden();
      }

      let maxBytes;

      if (parsed.kind === 'PAYMENT_SLIP') {
        const order = await requireOrder(
          organizationId,
          parsed.resourceId,
        );

        if (order.customerId !== userId) {
          await requireStaffOrAdmin(
            organizationId,
            userId,
          );
        }

        assertPaymentSlipKey({
          organizationId,
          orderId: order.orderId,
          objectKey,
        });
        maxBytes = PAYMENT_SLIP_MAX_BYTES;
      } else if (parsed.kind === 'PRODUCT_IMAGE') {
        const product = await requireProduct(
          organizationId,
          parsed.resourceId,
        );

        await requireStaffOrAdmin(
          organizationId,
          userId,
        );

        assertProductImageKey({
          organizationId,
          productId: product.productId,
          objectKey,
        });
        maxBytes = PRODUCT_IMAGE_MAX_BYTES;
      } else {
        throw fileAccessForbidden();
      }

      await validateUploadedObject({
        s3Adapter: getS3Adapter(),
        objectKey,
        maxBytes,
      });

      const url = await getS3Adapter().createGetUrl({
        objectKey,
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      });

      return {
        url,
        method: 'GET',
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      };
    },

    async createStoredProductImageUrl({
      organizationId,
      productId,
      imageKey,
    }) {
      assertProductImageKey({
        organizationId,
        productId,
        objectKey: imageKey,
      });

      return getS3Adapter().createGetUrl({
        objectKey: imageKey,
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      });
    },
  };
}

module.exports = {
  createFileService,
};
