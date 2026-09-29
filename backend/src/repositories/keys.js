'use strict';

function required(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} is required`);
  }

  return value;
}

function userProfileKey(userId) {
  return {
    PK: `USER#${required(userId, 'userId')}`,
    SK: 'PROFILE',
  };
}

function userEmailIndex(normalizedEmail, userId) {
  return {
    GSI1PK: `EMAIL#${required(normalizedEmail, 'normalizedEmail')}`,
    GSI1SK: `USER#${required(userId, 'userId')}`,
  };
}

function platformUserLinkKey(createdAt, userId) {
  return {
    PK: 'PLATFORM#USERS',
    SK: `USER#${required(createdAt, 'createdAt')}#${required(userId, 'userId')}`,
  };
}

function organizationProfileKey(organizationId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: 'PROFILE',
  };
}

function organizationPlatformIndex(createdAt, organizationId) {
  return {
    GSI1PK: 'ORGS',
    GSI1SK: `CREATED#${required(createdAt, 'createdAt')}#ORG#${required(organizationId, 'organizationId')}`,
  };
}

function organizationMemberKey(organizationId, userId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `MEMBER#${required(userId, 'userId')}`,
  };
}

function membershipUserIndex(userId, organizationId) {
  return {
    GSI1PK: `USER#${required(userId, 'userId')}`,
    GSI1SK: `ORG#${required(organizationId, 'organizationId')}`,
  };
}

function storeKey(organizationId, storeId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `STORE#${required(storeId, 'storeId')}`,
  };
}

function productKey(organizationId, productId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `PRODUCT#${required(productId, 'productId')}`,
  };
}

function productStoreIndex(organizationId, storeId, productId) {
  return {
    GSI1PK: `ORG#${required(organizationId, 'organizationId')}#STORE#${required(storeId, 'storeId')}`,
    GSI1SK: `PRODUCT#${required(productId, 'productId')}`,
  };
}

function productVariantKey(organizationId, productId, variantId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `PRODUCT#${required(productId, 'productId')}#VARIANT#${required(variantId, 'variantId')}`,
  };
}

function campaignKey(organizationId, campaignId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `CAMPAIGN#${required(campaignId, 'campaignId')}`,
  };
}

function campaignStoreIndex(organizationId, storeId, createdAt, campaignId) {
  return {
    GSI1PK: `ORG#${required(organizationId, 'organizationId')}#STORE#${required(storeId, 'storeId')}`,
    GSI1SK: `CAMPAIGN#${required(createdAt, 'createdAt')}#${required(campaignId, 'campaignId')}`,
  };
}

function orderKey(organizationId, orderId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `ORDER#${required(orderId, 'orderId')}`,
  };
}

function customerOrderIndex(customerId, createdAt, orderId) {
  return {
    GSI1PK: `USER#${required(customerId, 'customerId')}`,
    GSI1SK: `ORDER#${required(createdAt, 'createdAt')}#${required(orderId, 'orderId')}`,
  };
}

function campaignOrderLinkKey(organizationId, campaignId, createdAt, orderId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `CAMPAIGN#${required(campaignId, 'campaignId')}#ORDER#${required(createdAt, 'createdAt')}#${required(orderId, 'orderId')}`,
  };
}

function orderChildPartition(organizationId, orderId) {
  return `ORG#${required(organizationId, 'organizationId')}#ORDER#${required(orderId, 'orderId')}`;
}

function orderItemKey(organizationId, orderId, orderItemId) {
  return {
    PK: orderChildPartition(organizationId, orderId),
    SK: `ITEM#${required(orderItemId, 'orderItemId')}`,
  };
}

function paymentKey(organizationId, orderId, paymentId) {
  return {
    PK: orderChildPartition(organizationId, orderId),
    SK: `PAYMENT#${required(paymentId, 'paymentId')}`,
  };
}

function paymentReviewIndex(organizationId, status, createdAt, paymentId) {
  return {
    GSI1PK: `ORG#${required(organizationId, 'organizationId')}`,
    GSI1SK: `PAYMENT#${required(status, 'status')}#${required(createdAt, 'createdAt')}#${required(paymentId, 'paymentId')}`,
  };
}

function pickupKey(organizationId, orderId) {
  return {
    PK: orderChildPartition(organizationId, orderId),
    SK: 'PICKUP',
  };
}

function pickupLinkKey(organizationId, pickupId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `PICKUP#${required(pickupId, 'pickupId')}`,
  };
}

function pickupTokenIndex(organizationId, token, pickupId, orderId) {
  return {
    GSI1PK: `ORG#${required(organizationId, 'organizationId')}#PICKUP_TOKEN#${required(token, 'token')}`,
    GSI1SK: `PICKUP#${required(pickupId, 'pickupId')}#ORDER#${required(orderId, 'orderId')}`,
  };
}

function auditKey(organizationId, createdAt, auditId) {
  return {
    PK: `ORG#${required(organizationId, 'organizationId')}`,
    SK: `AUDIT#${required(createdAt, 'createdAt')}#${required(auditId, 'auditId')}`,
  };
}

function notificationKey(userId, createdAt, notificationId) {
  return {
    PK: `USER#${required(userId, 'userId')}`,
    SK: `NOTIFICATION#${required(createdAt, 'createdAt')}#${required(notificationId, 'notificationId')}`,
  };
}

module.exports = {
  userProfileKey,
  userEmailIndex,
  platformUserLinkKey,
  organizationProfileKey,
  organizationPlatformIndex,
  organizationMemberKey,
  membershipUserIndex,
  storeKey,
  productKey,
  productStoreIndex,
  productVariantKey,
  campaignKey,
  campaignStoreIndex,
  orderKey,
  customerOrderIndex,
  campaignOrderLinkKey,
  orderChildPartition,
  orderItemKey,
  paymentKey,
  paymentReviewIndex,
  pickupKey,
  pickupLinkKey,
  pickupTokenIndex,
  auditKey,
  notificationKey,
};
