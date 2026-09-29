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
const {
  createProductRepository,
} = require('../products/product.repository');
const {
  createStoreRepository,
} = require('../stores/store.repository');

const PAID_ORDER_STATUSES = new Set([
  ORDER_STATUS.PAID,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.IN_PRODUCTION,
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.RECEIVED,
]);

function notFound(code, message) {
  return new AppError({
    code,
    message,
    httpStatus: 404,
  });
}

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function incrementCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function addMoney(current, value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      'Stored Order total is not a valid integer-satang amount',
    );
  }

  const total = current + value;

  if (!Number.isSafeInteger(total)) {
    throw new Error(
      'Report revenue exceeds safe integer range',
    );
  }

  return total;
}

async function collectPages(fetchPage) {
  const items = [];
  let exclusiveStartKey;

  do {
    const result = await fetchPage(
      exclusiveStartKey,
    );
    items.push(...result.items);
    exclusiveStartKey =
      result.lastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

function createReportService(options = {}) {
  let storeRepository = options.storeRepository;
  let productRepository =
    options.productRepository;
  let campaignRepository =
    options.campaignRepository;
  let orderRepository = options.orderRepository;
  let paymentRepository =
    options.paymentRepository;

  function getStoreRepository() {
    if (!storeRepository) {
      storeRepository = createStoreRepository({
        repository: options.repository,
      });
    }

    return storeRepository;
  }

  function getProductRepository() {
    if (!productRepository) {
      productRepository =
        createProductRepository({
          repository: options.repository,
        });
    }

    return productRepository;
  }

  function getCampaignRepository() {
    if (!campaignRepository) {
      campaignRepository =
        createCampaignRepository({
          repository: options.repository,
        });
    }

    return campaignRepository;
  }

  function getOrderRepository() {
    if (!orderRepository) {
      orderRepository = createOrderRepository({
        repository: options.repository,
      });
    }

    return orderRepository;
  }

  function getPaymentRepository() {
    if (!paymentRepository) {
      paymentRepository =
        createPaymentRepository({
          repository: options.repository,
        });
    }

    return paymentRepository;
  }

  async function requireStore(
    organizationId,
    storeId,
  ) {
    const store =
      await getStoreRepository().getById(
        organizationId,
        storeId,
      );

    if (!store) {
      throw notFound(
        'STORE_NOT_FOUND',
        'Store not found',
      );
    }

    requireTenantMatch(store, organizationId);
    return store;
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
      throw notFound(
        'CAMPAIGN_NOT_FOUND',
        'Campaign not found',
      );
    }

    requireTenantMatch(
      campaign,
      organizationId,
    );
    return campaign;
  }

  async function listStores(organizationId) {
    const stores =
      await getStoreRepository()
        .listByOrganization(
          organizationId,
        );

    for (const store of stores) {
      requireTenantMatch(
        store,
        organizationId,
      );
    }

    return stores;
  }

  async function listProductsByOrganization(
    organizationId,
  ) {
    const products = await collectPages(
      (exclusiveStartKey) =>
        getProductRepository()
          .listProductsByOrganization(
            organizationId,
            { exclusiveStartKey },
          ),
    );

    for (const product of products) {
      requireTenantMatch(
        product,
        organizationId,
      );
    }

    return products;
  }

  async function listProductsByStore(
    organizationId,
    storeId,
  ) {
    const products = await collectPages(
      (exclusiveStartKey) =>
        getProductRepository().listProductsByStore(
          organizationId,
          storeId,
          { exclusiveStartKey },
        ),
    );

    for (const product of products) {
      requireTenantMatch(
        product,
        organizationId,
      );

      if (product.storeId !== storeId) {
        throw new AppError({
          code: 'TENANT_MISMATCH',
          message:
            'Product does not belong to the requested Store',
          httpStatus: 403,
        });
      }
    }

    return products;
  }

  async function listCampaignsByOrganization(
    organizationId,
  ) {
    const campaigns = await collectPages(
      (exclusiveStartKey) =>
        getCampaignRepository()
          .listByOrganizationPage(
            organizationId,
            { exclusiveStartKey },
          ),
    );

    for (const campaign of campaigns) {
      requireTenantMatch(
        campaign,
        organizationId,
      );
    }

    return campaigns;
  }

  async function listCampaignsByStore(
    organizationId,
    storeId,
  ) {
    const campaigns = await collectPages(
      (exclusiveStartKey) =>
        getCampaignRepository().listByStorePage(
          organizationId,
          storeId,
          { exclusiveStartKey },
        ),
    );

    for (const campaign of campaigns) {
      requireTenantMatch(
        campaign,
        organizationId,
      );

      if (campaign.storeId !== storeId) {
        throw new AppError({
          code: 'TENANT_MISMATCH',
          message:
            'Campaign does not belong to the requested Store',
          httpStatus: 403,
        });
      }
    }

    return campaigns;
  }

  async function listOrdersByOrganization(
    organizationId,
  ) {
    const orders = await collectPages(
      (exclusiveStartKey) =>
        getOrderRepository()
          .listByOrganizationPage(
            organizationId,
            { exclusiveStartKey },
          ),
    );

    for (const order of orders) {
      requireTenantMatch(
        order,
        organizationId,
      );
    }

    return orders;
  }

  async function listOrdersForCampaigns(
    organizationId,
    campaigns,
  ) {
    const orders = [];

    for (const campaign of campaigns) {
      const links =
        await getOrderRepository()
          .listCampaignLinks(
            organizationId,
            campaign.campaignId,
          );

      for (const link of links) {
        requireTenantMatch(
          link,
          organizationId,
        );

        if (
          link.campaignId !==
          campaign.campaignId
        ) {
          throw new AppError({
            code: 'TENANT_MISMATCH',
            message:
              'CampaignOrderLink does not belong to the report Campaign',
            httpStatus: 403,
          });
        }

        const order =
          await getOrderRepository().getById(
            organizationId,
            link.orderId,
          );

        if (!order) {
          throw notFound(
            'ORDER_NOT_FOUND',
            'Order not found',
          );
        }

        requireTenantMatch(
          order,
          organizationId,
        );

        if (
          order.campaignId !==
            campaign.campaignId ||
          order.orderId !== link.orderId ||
          order.customerId !==
            link.customerId
        ) {
          throw new AppError({
            code: 'TENANT_MISMATCH',
            message:
              'Order does not match its Campaign projection',
            httpStatus: 403,
          });
        }

        orders.push(order);
      }
    }

    return orders;
  }

  async function countPendingPaymentReviews(
    organizationId,
    allowedOrderIds,
  ) {
    const payments = await collectPages(
      (exclusiveStartKey) =>
        getPaymentRepository()
          .listByOrganizationPage(
            organizationId,
            {
              status:
                PAYMENT_STATUS.PENDING_REVIEW,
              exclusiveStartKey,
            },
          ),
    );
    let count = 0;

    for (const payment of payments) {
      requireTenantMatch(
        payment,
        organizationId,
      );

      if (
        allowedOrderIds &&
        !allowedOrderIds.has(
          payment.orderId,
        )
      ) {
        continue;
      }

      count += 1;
    }

    return count;
  }

  return {
    // API contract lists campaignId/storeId as optional report filters
    // without metric-specific semantics. Treat them as narrowing selectors
    // for the report scope; campaignId implies its Store.
    async getSummary({
      organizationId,
      campaignId,
      storeId,
    }) {
      let selectedCampaign = null;
      let scopedStoreId = storeId;

      if (campaignId) {
        selectedCampaign =
          await requireCampaign(
            organizationId,
            campaignId,
          );

        if (
          storeId &&
          selectedCampaign.storeId !== storeId
        ) {
          throw validationError(
            'campaignId does not belong to storeId',
          );
        }

        scopedStoreId =
          selectedCampaign.storeId;
      }

      let stores;
      if (scopedStoreId) {
        stores = [
          await requireStore(
            organizationId,
            scopedStoreId,
          ),
        ];
      } else {
        stores = await listStores(
          organizationId,
        );
      }

      const products = scopedStoreId
        ? await listProductsByStore(
            organizationId,
            scopedStoreId,
          )
        : await listProductsByOrganization(
            organizationId,
          );

      let campaigns;
      if (selectedCampaign) {
        campaigns = [selectedCampaign];
      } else if (scopedStoreId) {
        campaigns = await listCampaignsByStore(
          organizationId,
          scopedStoreId,
        );
      } else {
        campaigns =
          await listCampaignsByOrganization(
            organizationId,
          );
      }

      const scopedByFilter =
        Boolean(campaignId || storeId);
      const orders = scopedByFilter
        ? await listOrdersForCampaigns(
            organizationId,
            campaigns,
          )
        : await listOrdersByOrganization(
            organizationId,
          );

      const campaignsByStatus = {};
      for (const campaign of campaigns) {
        incrementCount(
          campaignsByStatus,
          campaign.status,
        );
      }

      const ordersByStatus = {};
      let paidOrderCount = 0;
      let paidRevenueSatang = 0;

      for (const order of orders) {
        incrementCount(
          ordersByStatus,
          order.status,
        );

        if (
          PAID_ORDER_STATUSES.has(
            order.status,
          )
        ) {
          paidOrderCount += 1;
          paidRevenueSatang = addMoney(
            paidRevenueSatang,
            order.total,
          );
        }
      }

      const allowedOrderIds =
        scopedByFilter
          ? new Set(
              orders.map(
                (order) => order.orderId,
              ),
            )
          : null;

      const pendingPaymentReviews =
        await countPendingPaymentReviews(
          organizationId,
          allowedOrderIds,
        );

      return {
        totalStores: stores.length,
        totalProducts: products.length,
        campaignsByStatus,
        ordersByStatus,
        pendingPaymentReviews,
        paidOrderCount,
        paidRevenueSatang,
      };
    },
  };
}

module.exports = {
  PAID_ORDER_STATUSES,
  incrementCount,
  addMoney,
  collectPages,
  createReportService,
};
