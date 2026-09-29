'use strict';

const { AppError } = require('../../errors/app-error');
const {
  requireTenantMatch,
} = require('../../policies/organization.policy');
const {
  createCampaignRepository,
} = require('../campaigns/campaign.repository');
const { ORDER_STATUS } = require('../orders/order.constants');
const {
  createOrderRepository,
} = require('../orders/order.repository');
const { PAYMENT_STATUS } = require('../payments/payment.constants');
const {
  createPaymentRepository,
} = require('../payments/payment.repository');

const PAID_LIFECYCLE_STATUSES = new Set([
  ORDER_STATUS.PAID,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.IN_PRODUCTION,
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.RECEIVED,
]);

function tenantMismatch(message) {
  return new AppError({
    code: 'TENANT_MISMATCH',
    message,
    httpStatus: 403,
  });
}

function campaignNotFound() {
  return new AppError({
    code: 'CAMPAIGN_NOT_FOUND',
    message: 'Campaign not found',
    httpStatus: 404,
  });
}

function safeAddQuantity(current, quantity) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error('Stored OrderItem quantity is invalid');
  }

  const total = current + quantity;

  if (!Number.isSafeInteger(total)) {
    throw new Error(
      'Production quantity exceeds safe integer range',
    );
  }

  return total;
}

function createProductionService(options = {}) {
  let campaignRepository = options.campaignRepository;
  let orderRepository = options.orderRepository;
  let paymentRepository = options.paymentRepository;

  function getCampaignRepository() {
    if (!campaignRepository) {
      campaignRepository = createCampaignRepository();
    }

    return campaignRepository;
  }

  function getOrderRepository() {
    if (!orderRepository) {
      orderRepository = createOrderRepository();
    }

    return orderRepository;
  }

  function getPaymentRepository() {
    if (!paymentRepository) {
      paymentRepository = createPaymentRepository();
    }

    return paymentRepository;
  }

  async function requireCampaign(
    organizationId,
    campaignId,
  ) {
    const campaign =
      await getCampaignRepository().getById(
        organizationId,
        campaignId,
      );

    if (!campaign) {
      throw campaignNotFound();
    }

    requireTenantMatch(campaign, organizationId);

    if (campaign.campaignId !== campaignId) {
      throw tenantMismatch(
        'Campaign does not match the requested resource',
      );
    }

    return campaign;
  }

  function validateCampaignLink(
    link,
    organizationId,
    campaignId,
  ) {
    requireTenantMatch(link, organizationId);

    if (link.campaignId !== campaignId) {
      throw tenantMismatch(
        'CampaignOrderLink does not belong to the requested Campaign',
      );
    }
  }

  function validateOrder(
    order,
    link,
    organizationId,
    campaignId,
  ) {
    requireTenantMatch(order, organizationId);

    if (
      order.orderId !== link.orderId ||
      order.campaignId !== campaignId ||
      order.customerId !== link.customerId
    ) {
      throw tenantMismatch(
        'Order does not match its Campaign projection',
      );
    }
  }

  function validatePayment(
    payment,
    order,
    organizationId,
  ) {
    requireTenantMatch(payment, organizationId);

    if (
      payment.orderId !== order.orderId ||
      payment.customerId !== order.customerId
    ) {
      throw tenantMismatch(
        'Payment does not belong to the expected Order',
      );
    }
  }

  function addItem(groups, item, order, organizationId) {
    requireTenantMatch(item, organizationId);

    if (item.orderId !== order.orderId) {
      throw tenantMismatch(
        'OrderItem does not belong to the expected Order',
      );
    }

    if (
      typeof item.productId !== 'string' ||
      typeof item.variantId !== 'string'
    ) {
      throw new Error(
        'Stored OrderItem product/variant reference is invalid',
      );
    }

    let product = groups.get(item.productId);

    if (!product) {
      product = {
        productId: item.productId,
        productName: item.productName,
        variants: new Map(),
      };
      groups.set(item.productId, product);
    }

    let variant = product.variants.get(item.variantId);

    if (!variant) {
      variant = {
        variantId: item.variantId,
        variantName: item.variantName,
        quantity: 0,
      };
      product.variants.set(item.variantId, variant);
    }

    variant.quantity = safeAddQuantity(
      variant.quantity,
      item.quantity,
    );
  }

  function toSummary(campaignId, groups) {
    const products = Array.from(groups.values())
      .sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )
      .map((product) => ({
        productId: product.productId,
        productName: product.productName,
        variants: Array.from(
          product.variants.values(),
        ).sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        ),
      }));

    return {
      campaignId,
      products,
    };
  }

  return {
    async getSummary({
      organizationId,
      campaignId,
    }) {
      await requireCampaign(
        organizationId,
        campaignId,
      );

      const links =
        await getOrderRepository().listCampaignLinks(
          organizationId,
          campaignId,
        );
      const groups = new Map();

      for (const link of links) {
        validateCampaignLink(
          link,
          organizationId,
          campaignId,
        );

        const order =
          await getOrderRepository().getById(
            organizationId,
            link.orderId,
          );

        if (!order) {
          throw new AppError({
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
            httpStatus: 404,
          });
        }

        validateOrder(
          order,
          link,
          organizationId,
          campaignId,
        );

        if (
          !PAID_LIFECYCLE_STATUSES.has(
            order.status,
          )
        ) {
          continue;
        }

        const payment =
          await getPaymentRepository().getByOrder(
            organizationId,
            order.orderId,
          );

        if (!payment) {
          continue;
        }

        validatePayment(
          payment,
          order,
          organizationId,
        );

        if (
          payment.status !== PAYMENT_STATUS.APPROVED
        ) {
          continue;
        }

        const items =
          await getOrderRepository().listItems(
            organizationId,
            order.orderId,
          );

        for (const item of items) {
          addItem(
            groups,
            item,
            order,
            organizationId,
          );
        }
      }

      return toSummary(campaignId, groups);
    },
  };
}

module.exports = {
  PAID_LIFECYCLE_STATUSES,
  safeAddQuantity,
  createProductionService,
};
