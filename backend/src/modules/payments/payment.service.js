'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { createSqsAdapter } = require('../../aws/sqs');
const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  campaignKey,
  campaignOrderLinkKey,
  orderKey,
  paymentKey,
  paymentReviewIndex,
} = require('../../repositories/keys');
const {
  requireResourceOwnership,
  requireTenantMatch,
} = require('../../policies/organization.policy');
const { decodeCursor, encodeCursor } = require('../../utils/cursor');
const { createId } = require('../../utils/id');
const { logger } = require('../../utils/logger');
const { nowIsoUtc } = require('../../utils/time');
const {
  CAMPAIGN_STATUS,
} = require('../campaigns/campaign.constants');
const {
  createCampaignRepository,
} = require('../campaigns/campaign.repository');
const {
  createPaymentSlipObjectValidator,
} = require('../files/file.validation');
const { ORDER_STATUS } = require('../orders/order.constants');
const {
  createOrderRepository,
} = require('../orders/order.repository');
const { PAYMENT_STATUS } = require('./payment.constants');
const { toPaymentDto } = require('./payment.mapper');
const {
  createPaymentRepository,
} = require('./payment.repository');

function notFound(code, message) {
  return new AppError({
    code,
    message,
    httpStatus: 404,
  });
}

function paymentNotReviewable() {
  return new AppError({
    code: 'PAYMENT_NOT_REVIEWABLE',
    message: 'Payment cannot be reviewed in the current Campaign state',
    httpStatus: 409,
  });
}

function invalidPaymentSubmission(status) {
  return new AppError({
    code: 'INVALID_STATUS_TRANSITION',
    message: `Cannot submit payment from Order status ${status}`,
    httpStatus: 409,
  });
}

function invalidPaymentReview(status) {
  return new AppError({
    code: 'INVALID_STATUS_TRANSITION',
    message: `Cannot review Payment from status ${status}`,
    httpStatus: 409,
  });
}

function campaignConditionFailed(error) {
  return (
    error?.name === 'TransactionCanceledException' &&
    Array.isArray(error.CancellationReasons) &&
    error.CancellationReasons[0]?.Code ===
      'ConditionalCheckFailed'
  );
}

function anyConditionalConflict(error) {
  if (error?.name === 'ConditionalCheckFailedException') {
    return true;
  }

  return (
    error?.name === 'TransactionCanceledException' &&
    Array.isArray(error.CancellationReasons) &&
    error.CancellationReasons.some(
      (reason) => reason?.Code === 'ConditionalCheckFailed',
    )
  );
}

function createPaymentService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;
  const log = options.logger || logger;
  const validatePaymentSlipObject =
    options.validatePaymentSlipObject ||
    createPaymentSlipObjectValidator({
      s3Adapter: options.s3Adapter,
    });

  let repository = options.repository;
  let orderRepository = options.orderRepository;
  let campaignRepository = options.campaignRepository;
  let paymentRepository = options.paymentRepository;
  let sqsAdapter = options.sqsAdapter;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getOrderRepository() {
    if (!orderRepository) {
      orderRepository = createOrderRepository({
        repository: getRepository(),
      });
    }

    return orderRepository;
  }

  function getCampaignRepository() {
    if (!campaignRepository) {
      campaignRepository = createCampaignRepository({
        repository: getRepository(),
      });
    }

    return campaignRepository;
  }

  function getPaymentRepository() {
    if (!paymentRepository) {
      paymentRepository = createPaymentRepository({
        repository: getRepository(),
      });
    }

    return paymentRepository;
  }

  function getSqsAdapter() {
    if (!sqsAdapter) {
      sqsAdapter = createSqsAdapter();
    }

    return sqsAdapter;
  }

  async function requireOwnedOrder(
    organizationId,
    orderId,
    customerId,
  ) {
    const order = await getOrderRepository().getById(
      organizationId,
      orderId,
    );

    if (!order) {
      throw notFound('ORDER_NOT_FOUND', 'Order not found');
    }

    requireTenantMatch(order, organizationId);
    requireResourceOwnership(
      order,
      customerId,
      'customerId',
    );

    return order;
  }

  async function requireOrder(organizationId, orderId) {
    const order = await getOrderRepository().getById(
      organizationId,
      orderId,
    );

    if (!order) {
      throw notFound('ORDER_NOT_FOUND', 'Order not found');
    }

    requireTenantMatch(order, organizationId);
    return order;
  }

  async function requirePayment(
    organizationId,
    paymentId,
  ) {
    const payment =
      await getPaymentRepository().findById(
        organizationId,
        paymentId,
      );

    if (!payment) {
      throw notFound(
        'PAYMENT_NOT_FOUND',
        'Payment not found',
      );
    }

    requireTenantMatch(payment, organizationId);
    return payment;
  }

  async function requireReviewableCampaign(
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

    requireTenantMatch(campaign, organizationId);

    if (
      ![
        CAMPAIGN_STATUS.OPEN,
        CAMPAIGN_STATUS.CLOSED,
      ].includes(campaign.status)
    ) {
      throw paymentNotReviewable();
    }

    return campaign;
  }

  function makeAudit({
    organizationId,
    actorId,
    action,
    paymentId,
    orderId,
    campaignId,
    metadata = {},
    timestamp,
  }) {
    const auditId = idFactory();

    return {
      ...auditKey(
        organizationId,
        timestamp,
        auditId,
      ),
      entityType: 'AuditLog',
      auditId,
      organizationId,
      actorId,
      action,
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      metadata: {
        orderId,
        campaignId,
        ...metadata,
      },
      createdAt: timestamp,
    };
  }

  async function publishPaymentEventSafely({
    type,
    organizationId,
    customerId,
    paymentId,
    occurredAt,
  }) {
    const event = {
      version: 1,
      eventId: idFactory(),
      type,
      occurredAt,
      organizationId,
      recipientUserId: customerId,
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      data: {},
    };

    try {
      await getSqsAdapter().sendJson(event);
    } catch (error) {
      log.warn('notification_publish_failed', {
        eventId: event.eventId,
        type,
        organizationId,
        paymentId,
        errorCode: error?.code || error?.name || 'UNKNOWN',
      });
    }
  }

  async function transactSubmission({
    order,
    customerId,
    slipKey,
    existingPayment,
  }) {
    const organizationId = order.organizationId;
    const timestamp = clock();
    const isResubmission = Boolean(existingPayment);
    const paymentId = existingPayment
      ? existingPayment.paymentId
      : idFactory();

    const expectedOrderStatus = isResubmission
      ? ORDER_STATUS.PAYMENT_REJECTED
      : ORDER_STATUS.PENDING_PAYMENT;

    if (order.status !== expectedOrderStatus) {
      throw invalidPaymentSubmission(order.status);
    }

    if (
      isResubmission &&
      existingPayment.status !== PAYMENT_STATUS.REJECTED
    ) {
      throw invalidPaymentSubmission(order.status);
    }

    const audit = makeAudit({
      organizationId,
      actorId: customerId,
      action: 'PAYMENT_SUBMITTED',
      paymentId,
      orderId: order.orderId,
      campaignId: order.campaignId,
      metadata: {
        resubmission: isResubmission,
      },
      timestamp,
    });

    const transaction = [
      {
        ConditionCheck: {
          Key: campaignKey(
            organizationId,
            order.campaignId,
          ),
          ConditionExpression:
            '#status IN (:open, :closed) AND #organizationId = :organizationId',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#organizationId': 'organizationId',
          },
          ExpressionAttributeValues: {
            ':open': CAMPAIGN_STATUS.OPEN,
            ':closed': CAMPAIGN_STATUS.CLOSED,
            ':organizationId': organizationId,
          },
        },
      },
    ];

    if (isResubmission) {
      const reviewIndex = paymentReviewIndex(
        organizationId,
        PAYMENT_STATUS.PENDING_REVIEW,
        existingPayment.createdAt,
        paymentId,
      );

      transaction.push({
        Update: {
          Key: paymentKey(
            organizationId,
            order.orderId,
            paymentId,
          ),
          UpdateExpression:
            'SET #slipKey = :slipKey, #status = :pendingReview, #gsi1pk = :gsi1pk, #gsi1sk = :gsi1sk, #updatedAt = :updatedAt REMOVE #rejectReason, #reviewedBy, #reviewedAt',
          ExpressionAttributeNames: {
            '#slipKey': 'slipKey',
            '#status': 'status',
            '#gsi1pk': 'GSI1PK',
            '#gsi1sk': 'GSI1SK',
            '#updatedAt': 'updatedAt',
            '#rejectReason': 'rejectReason',
            '#reviewedBy': 'reviewedBy',
            '#reviewedAt': 'reviewedAt',
            '#organizationId': 'organizationId',
            '#orderId': 'orderId',
            '#customerId': 'customerId',
          },
          ExpressionAttributeValues: {
            ':slipKey': slipKey,
            ':rejected': PAYMENT_STATUS.REJECTED,
            ':pendingReview':
              PAYMENT_STATUS.PENDING_REVIEW,
            ':gsi1pk': reviewIndex.GSI1PK,
            ':gsi1sk': reviewIndex.GSI1SK,
            ':updatedAt': timestamp,
            ':organizationId': organizationId,
            ':orderId': order.orderId,
            ':customerId': customerId,
          },
          ConditionExpression:
            '#status = :rejected AND #organizationId = :organizationId AND #orderId = :orderId AND #customerId = :customerId',
        },
      });
    } else {
      const payment = {
        ...paymentKey(
          organizationId,
          order.orderId,
          paymentId,
        ),
        ...paymentReviewIndex(
          organizationId,
          PAYMENT_STATUS.PENDING_REVIEW,
          timestamp,
          paymentId,
        ),
        entityType: 'Payment',
        paymentId,
        organizationId,
        orderId: order.orderId,
        customerId,
        slipKey,
        status: PAYMENT_STATUS.PENDING_REVIEW,
        rejectReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      transaction.push({
        Put: {
          Item: payment,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      });
    }

    transaction.push(
      {
        Update: {
          Key: orderKey(
            organizationId,
            order.orderId,
          ),
          UpdateExpression:
            'SET #status = :paymentReview, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#campaignId': 'campaignId',
            '#customerId': 'customerId',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':expectedStatus': expectedOrderStatus,
            ':paymentReview': ORDER_STATUS.PAYMENT_REVIEW,
            ':campaignId': order.campaignId,
            ':customerId': customerId,
            ':updatedAt': timestamp,
          },
          ConditionExpression:
            '#status = :expectedStatus AND #campaignId = :campaignId AND #customerId = :customerId',
        },
      },
      {
        Update: {
          Key: campaignOrderLinkKey(
            organizationId,
            order.campaignId,
            order.createdAt,
            order.orderId,
          ),
          UpdateExpression:
            'SET #status = :paymentReview',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#campaignId': 'campaignId',
            '#orderId': 'orderId',
            '#customerId': 'customerId',
          },
          ExpressionAttributeValues: {
            ':expectedStatus': expectedOrderStatus,
            ':paymentReview': ORDER_STATUS.PAYMENT_REVIEW,
            ':campaignId': order.campaignId,
            ':orderId': order.orderId,
            ':customerId': customerId,
          },
          ConditionExpression:
            '#status = :expectedStatus AND #campaignId = :campaignId AND #orderId = :orderId AND #customerId = :customerId',
        },
      },
      {
        Put: {
          Item: audit,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
    );

    try {
      await getRepository().transactWrite({
        TransactItems: transaction,
      });
    } catch (error) {
      if (campaignConditionFailed(error)) {
        throw paymentNotReviewable();
      }

      if (anyConditionalConflict(error)) {
        throw invalidPaymentSubmission(order.status);
      }

      throw error;
    }

    const payment = isResubmission
      ? {
          ...existingPayment,
          slipKey,
          status: PAYMENT_STATUS.PENDING_REVIEW,
          rejectReason: null,
          reviewedBy: null,
          reviewedAt: null,
          updatedAt: timestamp,
        }
      : {
          paymentId,
          organizationId,
          orderId: order.orderId,
          customerId,
          slipKey,
          status: PAYMENT_STATUS.PENDING_REVIEW,
          rejectReason: null,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

    return toPaymentDto(payment);
  }

  async function loadReviewContext(
    organizationId,
    paymentId,
  ) {
    const payment = await requirePayment(
      organizationId,
      paymentId,
    );

    if (payment.status !== PAYMENT_STATUS.PENDING_REVIEW) {
      throw invalidPaymentReview(payment.status);
    }

    const order = await requireOrder(
      organizationId,
      payment.orderId,
    );

    if (
      order.customerId !== payment.customerId ||
      order.status !== ORDER_STATUS.PAYMENT_REVIEW
    ) {
      throw invalidPaymentReview(payment.status);
    }

    const campaign = await requireReviewableCampaign(
      organizationId,
      order.campaignId,
    );

    return {
      payment,
      order,
      campaign,
    };
  }

  async function reviewPayment({
    organizationId,
    paymentId,
    reviewerId,
    action,
    reason,
  }) {
    const {
      payment,
      order,
      campaign,
    } = await loadReviewContext(
      organizationId,
      paymentId,
    );

    const timestamp = clock();
    const approved = action === 'APPROVE';
    const paymentStatus = approved
      ? PAYMENT_STATUS.APPROVED
      : PAYMENT_STATUS.REJECTED;
    const orderStatus = approved
      ? (
          campaign.status === CAMPAIGN_STATUS.OPEN
            ? ORDER_STATUS.PAID
            : ORDER_STATUS.CONFIRMED
        )
      : ORDER_STATUS.PAYMENT_REJECTED;
    const auditAction = approved
      ? 'PAYMENT_APPROVED'
      : 'PAYMENT_REJECTED';

    const paymentIndex = paymentReviewIndex(
      organizationId,
      paymentStatus,
      payment.createdAt,
      payment.paymentId,
    );

    const paymentNames = {
      '#status': 'status',
      '#reviewedBy': 'reviewedBy',
      '#reviewedAt': 'reviewedAt',
      '#updatedAt': 'updatedAt',
      '#gsi1pk': 'GSI1PK',
      '#gsi1sk': 'GSI1SK',
      '#organizationId': 'organizationId',
      '#orderId': 'orderId',
      '#customerId': 'customerId',
    };
    const paymentValues = {
      ':pendingReview': PAYMENT_STATUS.PENDING_REVIEW,
      ':reviewStatus': paymentStatus,
      ':reviewedBy': reviewerId,
      ':reviewedAt': timestamp,
      ':updatedAt': timestamp,
      ':gsi1pk': paymentIndex.GSI1PK,
      ':gsi1sk': paymentIndex.GSI1SK,
      ':organizationId': organizationId,
      ':orderId': order.orderId,
      ':customerId': order.customerId,
    };

    let paymentUpdateExpression =
      'SET #status = :reviewStatus, #reviewedBy = :reviewedBy, #reviewedAt = :reviewedAt, #updatedAt = :updatedAt, #gsi1pk = :gsi1pk, #gsi1sk = :gsi1sk';

    if (approved) {
      paymentNames['#rejectReason'] = 'rejectReason';
      paymentUpdateExpression += ' REMOVE #rejectReason';
    } else {
      paymentNames['#rejectReason'] = 'rejectReason';
      paymentValues[':rejectReason'] = reason;
      paymentUpdateExpression +=
        ', #rejectReason = :rejectReason';
    }

    const audit = makeAudit({
      organizationId,
      actorId: reviewerId,
      action: auditAction,
      paymentId: payment.paymentId,
      orderId: order.orderId,
      campaignId: order.campaignId,
      metadata: approved ? {} : { reason },
      timestamp,
    });

    try {
      await getRepository().transactWrite({
        TransactItems: [
          {
            ConditionCheck: {
              Key: campaignKey(
                organizationId,
                order.campaignId,
              ),
              ConditionExpression:
                '#status = :campaignStatus AND #organizationId = :organizationId',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#organizationId': 'organizationId',
              },
              ExpressionAttributeValues: {
                ':campaignStatus': campaign.status,
                ':organizationId': organizationId,
              },
            },
          },
          {
            Update: {
              Key: paymentKey(
                organizationId,
                order.orderId,
                payment.paymentId,
              ),
              UpdateExpression: paymentUpdateExpression,
              ExpressionAttributeNames: paymentNames,
              ExpressionAttributeValues: paymentValues,
              ConditionExpression:
                '#status = :pendingReview AND #organizationId = :organizationId AND #orderId = :orderId AND #customerId = :customerId',
            },
          },
          {
            Update: {
              Key: orderKey(
                organizationId,
                order.orderId,
              ),
              UpdateExpression:
                'SET #status = :orderStatus, #updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#campaignId': 'campaignId',
                '#customerId': 'customerId',
                '#updatedAt': 'updatedAt',
              },
              ExpressionAttributeValues: {
                ':paymentReview': ORDER_STATUS.PAYMENT_REVIEW,
                ':orderStatus': orderStatus,
                ':campaignId': order.campaignId,
                ':customerId': order.customerId,
                ':updatedAt': timestamp,
              },
              ConditionExpression:
                '#status = :paymentReview AND #campaignId = :campaignId AND #customerId = :customerId',
            },
          },
          {
            Update: {
              Key: campaignOrderLinkKey(
                organizationId,
                order.campaignId,
                order.createdAt,
                order.orderId,
              ),
              UpdateExpression:
                'SET #status = :orderStatus',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#campaignId': 'campaignId',
                '#orderId': 'orderId',
                '#customerId': 'customerId',
              },
              ExpressionAttributeValues: {
                ':paymentReview': ORDER_STATUS.PAYMENT_REVIEW,
                ':orderStatus': orderStatus,
                ':campaignId': order.campaignId,
                ':orderId': order.orderId,
                ':customerId': order.customerId,
              },
              ConditionExpression:
                '#status = :paymentReview AND #campaignId = :campaignId AND #orderId = :orderId AND #customerId = :customerId',
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
      if (campaignConditionFailed(error)) {
        throw paymentNotReviewable();
      }

      if (anyConditionalConflict(error)) {
        throw invalidPaymentReview(payment.status);
      }

      throw error;
    }

    const reviewedPayment = toPaymentDto({
      ...payment,
      status: paymentStatus,
      rejectReason: approved ? null : reason,
      reviewedBy: reviewerId,
      reviewedAt: timestamp,
      updatedAt: timestamp,
    });

    await publishPaymentEventSafely({
      type: auditAction,
      organizationId,
      customerId: order.customerId,
      paymentId: payment.paymentId,
      occurredAt: timestamp,
    });

    return reviewedPayment;
  }

  return {
    async submitPayment({
      organizationId,
      orderId,
      customerId,
      slipKey,
    }) {
      const order = await requireOwnedOrder(
        organizationId,
        orderId,
        customerId,
      );

      await validatePaymentSlipObject({
        organizationId,
        orderId,
        slipKey,
      });

      await requireReviewableCampaign(
        organizationId,
        order.campaignId,
      );

      const existingPayment =
        await getPaymentRepository().getByOrder(
          organizationId,
          orderId,
        );

      if (existingPayment) {
        requireTenantMatch(
          existingPayment,
          organizationId,
        );
      }

      if (
        existingPayment &&
        (
          existingPayment.orderId !== orderId ||
          existingPayment.customerId !== customerId
        )
      ) {
        throw new AppError({
          code: 'TENANT_MISMATCH',
          message:
            'Payment does not belong to the authorized Order',
          httpStatus: 403,
        });
      }

      return transactSubmission({
        order,
        customerId,
        slipKey,
        existingPayment,
      });
    },

    async listPayments({
      organizationId,
      status,
      campaignId,
      orderId,
      cursor,
    }) {
      const scope = [
        'payments',
        organizationId,
        status || 'all-statuses',
        campaignId || 'all-campaigns',
        orderId || 'all-orders',
      ].join(':');
      const exclusiveStartKey = decodeCursor(
        cursor,
        scope,
      );

      const result =
        await getPaymentRepository().listByOrganizationPage(
          organizationId,
          {
            status,
            exclusiveStartKey,
          },
        );

      const items = [];

      for (const payment of result.items) {
        requireTenantMatch(payment, organizationId);

        if (orderId && payment.orderId !== orderId) {
          continue;
        }

        if (campaignId) {
          const order = await requireOrder(
            organizationId,
            payment.orderId,
          );

          if (order.campaignId !== campaignId) {
            continue;
          }
        }

        items.push(toPaymentDto(payment));
      }

      return {
        items,
        nextCursor: result.lastEvaluatedKey
          ? encodeCursor(scope, result.lastEvaluatedKey)
          : null,
      };
    },

    async getPayment({
      organizationId,
      paymentId,
    }) {
      return toPaymentDto(
        await requirePayment(
          organizationId,
          paymentId,
        ),
      );
    },

    async approvePayment({
      organizationId,
      paymentId,
      reviewerId,
    }) {
      return reviewPayment({
        organizationId,
        paymentId,
        reviewerId,
        action: 'APPROVE',
      });
    },

    async rejectPayment({
      organizationId,
      paymentId,
      reviewerId,
      reason,
    }) {
      return reviewPayment({
        organizationId,
        paymentId,
        reviewerId,
        action: 'REJECT',
        reason,
      });
    },
  };
}

module.exports = {
  createPaymentService,
  paymentNotReviewable,
  invalidPaymentSubmission,
  invalidPaymentReview,
  campaignConditionFailed,
  anyConditionalConflict,
};
