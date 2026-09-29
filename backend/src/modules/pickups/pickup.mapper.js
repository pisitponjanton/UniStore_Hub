'use strict';

function toPickupDto(pickup) {
  if (!pickup) {
    return null;
  }

  return {
    pickupId: pickup.pickupId,
    organizationId: pickup.organizationId,
    orderId: pickup.orderId,
    token: pickup.token,
    status: pickup.status,
    receivedBy: pickup.receivedBy ?? null,
    receivedAt: pickup.receivedAt ?? null,
    createdAt: pickup.createdAt,
    updatedAt: pickup.updatedAt,
  };
}

module.exports = {
  toPickupDto,
};
