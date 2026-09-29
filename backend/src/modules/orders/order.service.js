'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  campaignKey,
  campaignOrderLinkKey,
  customerOrderIndex,
  orderItemKey,
  orderKey,
} = require('../../repositories/keys');
const {
  requireActiveOrganization,
  requireResourceOwnership,
  requireTenantMatch,
} = require('../../policies/organization.policy');
const { decodeCursor, encodeCursor } = require('../../utils/cursor');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const {
  CAMPAIGN_STATUS,
} = require('../campaigns/campaign.constants');
const {
  createCampaignRepository,
} = require('../campaigns/campaign.repository');
const {
  createOrganizationRepository,
} = require('../organizations/organization.repository');
const {
  PRODUCT_STATUS,
  VARIANT_STATUS,
} = require('../products/product.constants');
const {
  createProductRepository,
} = require('../products/product.repository');
const { ORDER_STATUS } = require('./order.constants');
const { toOrderDto } = require('./order.mapper');
const {
  createOrderRepository,
} = require('./order.repository');

const CANCELLABLE_ORDER_STATUSES = new Set([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.PAYMENT_REJECTED,
]);

function notFound(code, message) {
  return new AppError({
    code,
    message,
    httpStatus: 404,
  });
}

function orderNotFound() {
  return notFound('ORDER_NOT_FOUND', 'Order not found');
}

function campaignNotOpen() {
  return new AppError({
    code: 'CAMPAIGN_NOT_OPEN',
    message: 'Campaign is not open for ordering',
    httpStatus: 409,
  });
}

function orderCancellationNotAllowed(status) {
  return new AppError({
    code: 'INVALID_STATUS_TRANSITION',
    message: `Cannot cancel order from ${status}`,
    httpStatus: 409,
  });
}

function isConditionalConflict(error) {
  if (!error) {
    return false;
  }

  if (error.name === 'ConditionalCheckFailedException') {
    return true;
  }

  return (
    error.name === 'TransactionCanceledException' &&
    Array.isArray(error.CancellationReasons) &&
    error.CancellationReasons.some(
      (reason) => reason?.Code === 'ConditionalCheckFailed',
    )
  );
}

function assertStoredMoney(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Stored Variant price is invalid');
  }

  return value;
}

function safeMultiplyMoney(unitPrice, quantity) {
  const totalPrice = unitPrice * quantity;

  if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
    throw new Error('Order item total exceeds safe integer range');
  }

  return totalPrice;
}

function safeAddMoney(current, amount) {
  const total = current + amount;

  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error('Order total exceeds safe integer range');
  }

  return total;
}

function createOrderService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;

  let repository = options.repository;
  let campaignRepository = options.campaignRepository;
  let productRepository = options.productRepository;
  let orderRepository = options.orderRepository;
  let organizationRepository = options.organizationRepository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getCampaignRepository() {
    if (!campaignRepository) {
      campaignRepository = createCampaignRepository({
        repository: getRepository(),
      });
    }

    return campaignRepository;
  }

  function getProductRepository() {
    if (!productRepository) {
      productRepository = createProductRepository({
        repository: getRepository(),
      });
    }

    return productRepository;
  }

  function getOrderRepository() {
    if (!orderRepository) {
      orderRepository = createOrderRepository({
        repository: getRepository(),
      });
    }

    return orderRepository;
  }

  function getOrganizationRepository() {
    if (!organizationRepository) {
      organizationRepository = createOrganizationRepository({
        repository: getRepository(),
      });
    }

    return organizationRepository;
  }

  async function requireOpenCampaign(
    organizationId,
    campaignId,
  ) {
    const campaign = await getCampaignRepository().getById(
      organizationId,
      campaignId,
    );

    if (!campaign) {
      throw notFound(
        'CAMPAIGN_NOT_FOUND',
        'Campaign not found',
      );
    }

    requireTenantMatch(campaign, organizationId);

    if (campaign.status !== CAMPAIGN_STATUS.OPEN) {
      throw campaignNotOpen();
    }

    return campaign;
  }

  async function resolveOrderItem({
    organizationId,
    campaign,
    input,
    orderId,
    timestamp,
  }) {
    const product = await getProductRepository().getProduct(
      organizationId,
      input.productId,
    );

    if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
      throw notFound(
        'PRODUCT_NOT_FOUND',
        'Product not found',
      );
    }

    requireTenantMatch(product, organizationId);

    if (product.storeId !== campaign.storeId) {
      throw new AppError({
        code: 'TENANT_MISMATCH',
        message: 'Product does not belong to the Campaign store',
        httpStatus: 403,
      });
    }

    const variant = await getProductRepository().getVariant(
      organizationId,
      product.productId,
      input.variantId,
    );

    if (
      !variant ||
      variant.status !== VARIANT_STATUS.ACTIVE ||
      variant.productId !== product.productId
    ) {
      throw notFound(
        'VARIANT_NOT_FOUND',
        'Product variant not found',
      );
    }

    requireTenantMatch(variant, organizationId);

    const unitPrice = assertStoredMoney(variant.price);
    const totalPrice = safeMultiplyMoney(
      unitPrice,
      input.quantity,
    );

    return {
      orderItemId: idFactory(),
      organizationId,
      orderId,
      productId: product.productId,
      variantId: variant.variantId,
      productName: product.name,
      variantName: variant.name,
      unitPrice,
      quantity: input.quantity,
      totalPrice,
      createdAt: timestamp,
    };
  }

  async function loadOrderItems(order) {
    const items = await getOrderRepository().listItems(
      order.organizationId,
      order.orderId,
    );

    return items.map((item) => {
      requireTenantMatch(item, order.organizationId);

      if (item.orderId !== order.orderId) {
        throw new AppError({
          code: 'TENANT_MISMATCH',
          message: 'Order item does not belong to this order',
          httpStatus: 403,
        });
      }

      return item;
    });
  }

  async function loadOrderDto(order) {
    if (!order) {
      throw orderNotFound();
    }

    const items = await loadOrderItems(order);
    return toOrderDto(order, items);
  }

  async function requireOrder(organizationId, orderId) {
    const order = await getOrderRepository().getById(
      organizationId,
      orderId,
    );

    if (!order) {
      throw orderNotFound();
    }

    requireTenantMatch(order, organizationId);
    return order;
  }

  async function requireOperationalOrderOrganization(order) {
    const organization =
      await getOrganizationRepository().getById(
        order.organizationId,
      );

    requireTenantMatch(
      organization,
      order.organizationId,
    );
    requireActiveOrganization(organization);
  }

  async function cancelLoadedOrder({
    order,
    actorId,
    expectedCustomerId,
  }) {
    if (
      !CANCELLABLE_ORDER_STATUSES.has(order.status)
    ) {
      throw orderCancellationNotAllowed(order.status);
    }

    if (expectedCustomerId) {
      requireResourceOwnership(
        order,
        expectedCustomerId,
        'customerId',
      );
    }

    await requireOperationalOrderOrganization(order);

    const timestamp = clock();
    const auditId = idFactory();
    const campaignLinkKey = campaignOrderLinkKey(
      order.organizationId,
      order.campaignId,
      order.createdAt,
      order.orderId,
    );

    const orderNames = {
      '#status': 'status',
      '#campaignId': 'campaignId',
      '#updatedAt': 'updatedAt',
    };
    const orderValues = {
      ':fromStatus': order.status,
      ':cancelled': ORDER_STATUS.CANCELLED,
      ':campaignId': order.campaignId,
      ':updatedAt': timestamp,
    };
    const orderConditions = [
      '#status = :fromStatus',
      '#campaignId = :campaignId',
    ];

    if (expectedCustomerId) {
      orderNames['#customerId'] = 'customerId';
      orderValues[':customerId'] = expectedCustomerId;
      orderConditions.push('#customerId = :customerId');
    }

    const audit = {
      ...auditKey(
        order.organizationId,
        timestamp,
        auditId,
      ),
      entityType: 'AuditLog',
      auditId,
      organizationId: order.organizationId,
      actorId,
      action: 'ORDER_CANCELLED',
      resourceType: 'ORDER',
      resourceId: order.orderId,
      metadata: {
        campaignId: order.campaignId,
        fromStatus: order.status,
      },
      createdAt: timestamp,
    };

    try {
      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: orderKey(
                order.organizationId,
                order.orderId,
              ),
              UpdateExpression:
                'SET #status = :cancelled, #updatedAt = :updatedAt',
              ExpressionAttributeNames: orderNames,
              ExpressionAttributeValues: orderValues,
              ConditionExpression:
                orderConditions.join(' AND '),
            },
          },
          {
            Update: {
              Key: campaignLinkKey,
              UpdateExpression:
                'SET #status = :cancelled',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#campaignId': 'campaignId',
                '#orderId': 'orderId',
              },
              ExpressionAttributeValues: {
                ':fromStatus': order.status,
                ':cancelled': ORDER_STATUS.CANCELLED,
                ':campaignId': order.campaignId,
                ':orderId': order.orderId,
              },
              ConditionExpression:
                '#status = :fromStatus AND #campaignId = :campaignId AND #orderId = :orderId',
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
    } catch (error) {
      if (isConditionalConflict(error)) {
        throw orderCancellationNotAllowed(order.status);
      }

      throw error;
    }

    return loadOrderDto({
      ...order,
      status: ORDER_STATUS.CANCELLED,
      updatedAt: timestamp,
    });
  }

  return {
    async createOrder({
      organizationId,
      customerId,
      campaignId,
      items,
    }) {
      const campaign = await requireOpenCampaign(
        organizationId,
        campaignId,
      );
      const orderId = idFactory();
      const timestamp = clock();

      const orderItems = [];
      let subtotal = 0;

      for (const input of items) {
        const orderItem = await resolveOrderItem({
          organizationId,
          campaign,
          input,
          orderId,
          timestamp,
        });

        subtotal = safeAddMoney(
          subtotal,
          orderItem.totalPrice,
        );
        orderItems.push(orderItem);
      }

      const total = subtotal;
      const order = {
        orderId,
        organizationId,
        campaignId,
        customerId,
        status: ORDER_STATUS.PENDING_PAYMENT,
        subtotal,
        total,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const orderItemRecords = orderItems.map((orderItem) => ({
        ...orderItemKey(
          organizationId,
          orderId,
          orderItem.orderItemId,
        ),
        entityType: 'OrderItem',
        ...orderItem,
      }));

      const campaignOrderLink = {
        ...campaignOrderLinkKey(
          organizationId,
          campaignId,
          timestamp,
          orderId,
        ),
        entityType: 'CampaignOrderLink',
        organizationId,
        campaignId,
        orderId,
        customerId,
        status: ORDER_STATUS.PENDING_PAYMENT,
        createdAt: timestamp,
      };

      const auditId = idFactory();
      const audit = {
        ...auditKey(organizationId, timestamp, auditId),
        entityType: 'AuditLog',
        auditId,
        organizationId,
        actorId: customerId,
        action: 'ORDER_CREATED',
        resourceType: 'ORDER',
        resourceId: orderId,
        metadata: {
          campaignId,
        },
        createdAt: timestamp,
      };

      const orderRecord = {
        ...orderKey(organizationId, orderId),
        ...customerOrderIndex(
          customerId,
          timestamp,
          orderId,
        ),
        entityType: 'Order',
        ...order,
      };

      try {
        await getRepository().transactWrite({
          TransactItems: [
            {
              ConditionCheck: {
                Key: campaignKey(
                  organizationId,
                  campaignId,
                ),
                ConditionExpression:
                  '#status = :open AND #organizationId = :organizationId',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#organizationId': 'organizationId',
                },
                ExpressionAttributeValues: {
                  ':open': CAMPAIGN_STATUS.OPEN,
                  ':organizationId': organizationId,
                },
              },
            },
            {
              Put: {
                Item: orderRecord,
                ConditionExpression:
                  'attribute_not_exists(PK) AND attribute_not_exists(SK)',
              },
            },
            ...orderItemRecords.map((item) => ({
              Put: {
                Item: item,
                ConditionExpression:
                  'attribute_not_exists(PK) AND attribute_not_exists(SK)',
              },
            })),
            {
              Put: {
                Item: campaignOrderLink,
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
      } catch (error) {
        if (isConditionalConflict(error)) {
          throw campaignNotOpen();
        }

        throw error;
      }

      return toOrderDto(order, orderItems);
    },

    async listOrganizationOrders({
      organizationId,
      campaignId,
      status,
      customerId,
      cursor,
    }) {
      const scope = [
        'orders',
        'organization',
        organizationId,
        campaignId || 'all-campaigns',
        status || 'all-statuses',
        customerId || 'all-customers',
      ].join(':');
      const exclusiveStartKey = decodeCursor(
        cursor,
        scope,
      );

      let result;
      let orders;

      if (campaignId) {
        result =
          await getOrderRepository().listCampaignLinksPage(
            organizationId,
            campaignId,
            {
              status,
              customerId,
              exclusiveStartKey,
            },
          );

        orders = await Promise.all(
          result.items.map(async (link) => {
            requireTenantMatch(link, organizationId);

            if (link.campaignId !== campaignId) {
              throw new AppError({
                code: 'TENANT_MISMATCH',
                message:
                  'Campaign order link does not belong to this Campaign',
                httpStatus: 403,
              });
            }

            const order =
              await getOrderRepository().getById(
                organizationId,
                link.orderId,
              );

            if (!order) {
              throw orderNotFound();
            }

            requireTenantMatch(order, organizationId);

            if (
              order.campaignId !== campaignId ||
              order.customerId !== link.customerId
            ) {
              throw new AppError({
                code: 'TENANT_MISMATCH',
                message:
                  'Order projection does not match tenant resource',
                httpStatus: 403,
              });
            }

            return order;
          }),
        );
      } else {
        result =
          await getOrderRepository().listByOrganizationPage(
            organizationId,
            {
              status,
              customerId,
              exclusiveStartKey,
            },
          );
        orders = result.items;

        for (const order of orders) {
          requireTenantMatch(order, organizationId);
        }
      }

      const items = await Promise.all(
        orders.map(loadOrderDto),
      );

      return {
        items,
        nextCursor: result.lastEvaluatedKey
          ? encodeCursor(scope, result.lastEvaluatedKey)
          : null,
      };
    },

    async getOrganizationOrder({
      organizationId,
      orderId,
    }) {
      return loadOrderDto(
        await requireOrder(organizationId, orderId),
      );
    },

    async listOwnOrders({
      customerId,
      cursor,
    }) {
      const scope = `orders:customer:${customerId}`;
      const exclusiveStartKey = decodeCursor(
        cursor,
        scope,
      );
      const result =
        await getOrderRepository().listByCustomerPage(
          customerId,
          { exclusiveStartKey },
        );

      for (const order of result.items) {
        requireResourceOwnership(
          order,
          customerId,
          'customerId',
        );
      }

      const items = await Promise.all(
        result.items.map(loadOrderDto),
      );

      return {
        items,
        nextCursor: result.lastEvaluatedKey
          ? encodeCursor(scope, result.lastEvaluatedKey)
          : null,
      };
    },

    async getOwnOrder({ customerId, orderId }) {
      const order =
        await getOrderRepository().findOwnedById(
          customerId,
          orderId,
        );

      if (!order) {
        throw orderNotFound();
      }

      requireResourceOwnership(
        order,
        customerId,
        'customerId',
      );

      return loadOrderDto(order);
    },

    async cancelOwnOrder({
      customerId,
      orderId,
    }) {
      const order =
        await getOrderRepository().findOwnedById(
          customerId,
          orderId,
        );

      if (!order) {
        throw orderNotFound();
      }

      return cancelLoadedOrder({
        order,
        actorId: customerId,
        expectedCustomerId: customerId,
      });
    },

    async cancelOrganizationOrder({
      organizationId,
      orderId,
      actorId,
    }) {
      const order = await requireOrder(
        organizationId,
        orderId,
      );

      return cancelLoadedOrder({
        order,
        actorId,
      });
    },
  };
}

module.exports = {
  CANCELLABLE_ORDER_STATUSES,
  createOrderService,
  isConditionalConflict,
  assertStoredMoney,
  safeMultiplyMoney,
  safeAddMoney,
};
