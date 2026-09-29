'use strict';

function toPaymentDto(payment) {
  if (!payment) {
    return null;
  }

  return {
    paymentId: payment.paymentId,
    organizationId: payment.organizationId,
    orderId: payment.orderId,
    customerId: payment.customerId,
    slipKey: payment.slipKey,
    status: payment.status,
    rejectReason: payment.rejectReason ?? null,
    reviewedBy: payment.reviewedBy ?? null,
    reviewedAt: payment.reviewedAt ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

module.exports = {
  toPaymentDto,
};
