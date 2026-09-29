'use strict';

function toOrderItemDto(item) {
  if (!item) {
    return null;
  }

  return {
    orderItemId: item.orderItemId,
    productId: item.productId,
    variantId: item.variantId,
    productName: item.productName,
    variantName: item.variantName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    totalPrice: item.totalPrice,
  };
}

function toOrderDto(order, items = []) {
  if (!order) {
    return null;
  }

  return {
    orderId: order.orderId,
    organizationId: order.organizationId,
    campaignId: order.campaignId,
    customerId: order.customerId,
    status: order.status,
    subtotal: order.subtotal,
    total: order.total,
    items: items.map(toOrderItemDto),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

module.exports = {
  toOrderItemDto,
  toOrderDto,
};
