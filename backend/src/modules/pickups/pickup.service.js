'use strict';

const crypto = require('node:crypto');

const { createDynamoRepository } = require('../../aws/dynamodb');
const { createSqsAdapter } = require('../../aws/sqs');
const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  campaignOrderLinkKey,
  orderKey,
  pickupKey,
  pickupLinkKey,
  pickupTokenIndex,
} = require('../../repositories/keys');
const {
  requireResourceOwnership,
  requireTenantMatch,
} = require('../../policies/organization.policy');
const { decodeCursor, encodeCursor } = require('../../utils/cursor');
const { createId } = require('../../utils/id');
const { logger } = require('../../utils/logger');
const { nowIsoUtc } = require('../../utils/time');
const { ORDER_STATUS } = require('../orders/order.constants');
const {
  createOrderRepository,
} = require('../orders/order.repository');
const { PICKUP_STATUS } = require('./pickup.constants');
const { toPickupDto } = require('./pickup.mapper');
const {
  createPickupRepository,
} = require('./pickup.repository');

const PICKUP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

function createPickupToken() {
  return crypto.randomBytes(16).toString('base64url');
}

function pickupNotFound() {
  return new AppError({
    code: 'PICKUP_NOT_FOUND',
    message: 'Pickup not found',
    httpStatus: 404,
  });
}

function orderNotFound() {
  return new AppError({
    code: 'ORDER_NOT_FOUND',
    message: 'Order not found',
    httpStatus: 404,
  });
}

function orderNotReady() {
  return new AppError({
    code: 'ORDER_NOT_READY_FOR_PICKUP',
    message: 'Order is not ready for pickup',
    httpStatus: 409,
  });
}

function pickupAlreadyReceived() {
  return new AppError({
    code: 'PICKUP_ALREADY_RECEIVED',
    message: 'Pickup has already been received',
    httpStatus: 409,
  });
}

function tenantMismatch(message) {
  return new AppError({
    code: 'TENANT_MISMATCH',
    message,
    httpStatus: 403,
  });
}

function invalidReadiness(message) {
  return new AppError({
    code: 'INVALID_STATUS_TRANSITION',
    message,
    httpStatus: 409,
  });
}

function validatePickupToken(token) {
  if (
    typeof token !== 'string' ||
    !PICKUP_TOKEN_PATTERN.test(token)
  ) {
    throw new Error('Stored Pickup token is invalid');
  }

  return token;
}

function validateCampaignOrderLink(
  link,
  organizationId,
  campaignId,
) {
  if (
    !link ||
    link.entityType !== 'CampaignOrderLink' ||
    link.organizationId !== organizationId ||
    link.campaignId !== campaignId ||
    link.PK !== `ORG#${organizationId}` ||
    typeof link.SK !== 'string' ||
    !link.SK.startsWith(
      `CAMPAIGN#${campaignId}#ORDER#`,
    ) ||
    typeof link.orderId !== 'string' ||
    link.orderId.length === 0 ||
    typeof link.customerId !== 'string' ||
    link.customerId.length === 0
  ) {
    throw tenantMismatch(
      'Campaign order projection does not match the active tenant',
    );
  }

  return link;
}

function validatePickupRecord(
  pickup,
  {
    organizationId,
    orderId,
    campaignId,
    customerId,
  },
) {
  requireTenantMatch(pickup, organizationId);

  if (
    pickup.orderId !== orderId ||
    (campaignId && pickup.campaignId !== campaignId) ||
    (customerId && pickup.customerId !== customerId) ||
    typeof pickup.pickupId !== 'string' ||
    pickup.pickupId.length === 0
  ) {
    throw tenantMismatch(
      'Pickup does not match the expected Order context',
    );
  }

  validatePickupToken(pickup.token);
  return pickup;
}

function validatePickupLink(
  link,
  {
    organizationId,
    pickupId,
    orderId,
    campaignId,
    customerId,
    token,
  },
) {
  requireTenantMatch(link, organizationId);

  if (
    link.entityType !== 'PickupLink' ||
    link.pickupId !== pickupId ||
    link.orderId !== orderId ||
    (campaignId && link.campaignId !== campaignId) ||
    (customerId && link.customerId !== customerId) ||
    (token && link.token !== token) ||
    link.PK !== `ORG#${organizationId}` ||
    link.SK !== `PICKUP#${pickupId}`
  ) {
    throw tenantMismatch(
      'PickupLink does not match the expected Pickup context',
    );
  }

  return link;
}
function createPickupService(options = {}) {
  const idFactory = options.idFactory || createId;
  const tokenFactory =
    options.tokenFactory || createPickupToken;
  const clock = options.clock || nowIsoUtc;
  const log = options.logger || logger;

  let repository = options.repository;
  let pickupRepository = options.pickupRepository;
  let orderRepository = options.orderRepository;
  let sqsAdapter = options.sqsAdapter;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getPickupRepository() {
    if (!pickupRepository) {
      pickupRepository = createPickupRepository({
        repository: getRepository(),
      });
    }

    return pickupRepository;
  }

  function getOrderRepository() {
    if (!orderRepository) {
      orderRepository = createOrderRepository({
        repository: getRepository(),
      });
    }

    return orderRepository;
  }

  function getSqsAdapter() {
    if (!sqsAdapter) {
      sqsAdapter = createSqsAdapter();
    }

    return sqsAdapter;
  }

  async function loadPickupFromLink(
    organizationId,
    link,
  ) {
    validatePickupLink(link, {
      organizationId,
      pickupId: link.pickupId,
      orderId: link.orderId,
      campaignId: link.campaignId,
      customerId: link.customerId,
      token: link.token,
    });

    const pickup =
      await getPickupRepository().getByOrder(
        organizationId,
        link.orderId,
      );

    if (!pickup) {
      throw pickupNotFound();
    }

    validatePickupRecord(pickup, {
      organizationId,
      orderId: link.orderId,
      campaignId: link.campaignId,
      customerId: link.customerId,
    });

    if (
      pickup.pickupId !== link.pickupId ||
      pickup.token !== link.token ||
      pickup.status !== link.status
    ) {
      throw tenantMismatch(
        'PickupLink projection does not match canonical Pickup',
      );
    }

    return pickup;
  }

  async function prepareEligiblePickup({
    organizationId,
    campaignId,
    link,
    timestamp,
  }) {
    validateCampaignOrderLink(
      link,
      organizationId,
      campaignId,
    );

    const order = await getOrderRepository().getById(
      organizationId,
      link.orderId,
    );

    if (!order) {
      throw orderNotFound();
    }

    requireTenantMatch(order, organizationId);

    if (
      order.orderId !== link.orderId ||
      order.campaignId !== campaignId ||
      order.customerId !== link.customerId
    ) {
      throw tenantMismatch(
        'Order does not match its CampaignOrderLink',
      );
    }

    if (order.status !== ORDER_STATUS.IN_PRODUCTION) {
      throw invalidReadiness(
        'Eligible Order is no longer IN_PRODUCTION',
      );
    }

    let pickup =
      await getPickupRepository().getByOrder(
        organizationId,
        order.orderId,
      );
    let pickupLink = null;
    let pickupMissing = false;
    let linkMissing = false;

    if (!pickup) {
      const pickupId = idFactory();
      const token = tokenFactory();

      validatePickupToken(token);

      pickup = {
        ...pickupKey(
          organizationId,
          order.orderId,
        ),
        ...pickupTokenIndex(
          organizationId,
          token,
          pickupId,
          order.orderId,
        ),
        entityType: 'Pickup',
        pickupId,
        organizationId,
        orderId: order.orderId,
        campaignId,
        customerId: order.customerId,
        token,
        status: PICKUP_STATUS.READY,
        receivedBy: null,
        receivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      pickupMissing = true;
      linkMissing = true;
    } else {
      validatePickupRecord(pickup, {
        organizationId,
        orderId: order.orderId,
        campaignId,
        customerId: order.customerId,
      });

      if (pickup.status !== PICKUP_STATUS.READY) {
        throw invalidReadiness(
          'Existing Pickup is not in READY state',
        );
      }

      pickupLink =
        await getPickupRepository().getLinkById(
          organizationId,
          pickup.pickupId,
        );

      if (pickupLink) {
        validatePickupLink(pickupLink, {
          organizationId,
          pickupId: pickup.pickupId,
          orderId: order.orderId,
          campaignId,
          customerId: order.customerId,
          token: pickup.token,
        });

        if (
          pickupLink.status !== PICKUP_STATUS.READY
        ) {
          throw invalidReadiness(
            'Existing PickupLink is not in READY state',
          );
        }
      } else {
        linkMissing = true;
      }
    }

    if (!pickupLink) {
      pickupLink = {
        ...pickupLinkKey(
          organizationId,
          pickup.pickupId,
        ),
        entityType: 'PickupLink',
        organizationId,
        pickupId: pickup.pickupId,
        orderId: order.orderId,
        campaignId,
        customerId: order.customerId,
        token: pickup.token,
        status: PICKUP_STATUS.READY,
        createdAt: pickup.createdAt || timestamp,
        updatedAt: timestamp,
      };
    }

    const transactItems = [
      {
        Update: {
          Key: orderKey(
            organizationId,
            order.orderId,
          ),
          UpdateExpression:
            'SET #status = :readyForPickup, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#campaignId': 'campaignId',
            '#customerId': 'customerId',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':inProduction':
              ORDER_STATUS.IN_PRODUCTION,
            ':readyForPickup':
              ORDER_STATUS.READY_FOR_PICKUP,
            ':campaignId': campaignId,
            ':customerId': order.customerId,
            ':updatedAt': timestamp,
          },
          ConditionExpression:
            '#status = :inProduction AND #campaignId = :campaignId AND #customerId = :customerId',
        },
      },
      {
        Update: {
          Key: campaignOrderLinkKey(
            organizationId,
            campaignId,
            link.createdAt,
            order.orderId,
          ),
          UpdateExpression:
            'SET #status = :readyForPickup',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#campaignId': 'campaignId',
            '#orderId': 'orderId',
            '#customerId': 'customerId',
          },
          ExpressionAttributeValues: {
            ':inProduction':
              ORDER_STATUS.IN_PRODUCTION,
            ':readyForPickup':
              ORDER_STATUS.READY_FOR_PICKUP,
            ':campaignId': campaignId,
            ':orderId': order.orderId,
            ':customerId': order.customerId,
          },
          ConditionExpression:
            '#status = :inProduction AND #campaignId = :campaignId AND #orderId = :orderId AND #customerId = :customerId',
        },
      },
    ];

    if (pickupMissing) {
      transactItems.push({
        Put: {
          Item: pickup,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      });
    } else {
      transactItems.push({
        ConditionCheck: {
          Key: pickupKey(
            organizationId,
            order.orderId,
          ),
          ConditionExpression:
            '#status = :ready AND #pickupId = :pickupId AND #token = :token',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#pickupId': 'pickupId',
            '#token': 'token',
          },
          ExpressionAttributeValues: {
            ':ready': PICKUP_STATUS.READY,
            ':pickupId': pickup.pickupId,
            ':token': pickup.token,
          },
        },
      });
    }

    if (linkMissing) {
      transactItems.push({
        Put: {
          Item: pickupLink,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      });
    } else {
      transactItems.push({
        ConditionCheck: {
          Key: pickupLinkKey(
            organizationId,
            pickup.pickupId,
          ),
          ConditionExpression:
            '#status = :ready AND #orderId = :orderId AND #token = :token',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#orderId': 'orderId',
            '#token': 'token',
          },
          ExpressionAttributeValues: {
            ':ready': PICKUP_STATUS.READY,
            ':orderId': order.orderId,
            ':token': pickup.token,
          },
        },
      });
    }

    return {
      transactItems,
      event: {
        organizationId,
        recipientUserId: order.customerId,
        pickupId: pickup.pickupId,
      },
    };
  }

  return {
    async prepareCampaignReadiness({
      organizationId,
      campaignId,
      links,
      timestamp,
    }) {
      const transactItems = [];
      const events = [];

      for (const link of links) {
        validateCampaignOrderLink(
          link,
          organizationId,
          campaignId,
        );

        if (
          link.status !== ORDER_STATUS.IN_PRODUCTION
        ) {
          continue;
        }

        const prepared =
          await prepareEligiblePickup({
            organizationId,
            campaignId,
            link,
            timestamp,
          });

        transactItems.push(
          ...prepared.transactItems,
        );
        events.push(prepared.event);
      }

      return {
        transactItems,
        events,
      };
    },

    async publishReadyEvents(events, occurredAt) {
      for (const event of events) {
        const payload = {
          version: 1,
          eventId: idFactory(),
          type: 'READY_FOR_PICKUP',
          occurredAt,
          organizationId:
            event.organizationId,
          recipientUserId:
            event.recipientUserId,
          resourceType: 'PICKUP',
          resourceId: event.pickupId,
          data: {},
        };

        try {
          await getSqsAdapter().sendJson(payload);
        } catch (error) {
          log.warn(
            'notification_publish_failed',
            {
              eventId: payload.eventId,
              type: payload.type,
              organizationId:
                payload.organizationId,
              pickupId: event.pickupId,
              errorCode:
                error?.code ||
                error?.name ||
                'UNKNOWN',
            },
          );
        }
      }
    },

    async confirmPickup({
      organizationId,
      pickupId,
      actorId,
    }) {
      const link =
        await getPickupRepository().getLinkById(
          organizationId,
          pickupId,
        );

      if (!link) {
        throw pickupNotFound();
      }

      validatePickupLink(link, {
        organizationId,
        pickupId,
        orderId: link.orderId,
        campaignId: link.campaignId,
        customerId: link.customerId,
        token: link.token,
      });

      const pickup =
        await getPickupRepository().getByOrder(
          organizationId,
          link.orderId,
        );

      if (!pickup) {
        throw pickupNotFound();
      }

      validatePickupRecord(pickup, {
        organizationId,
        orderId: link.orderId,
        campaignId: link.campaignId,
        customerId: link.customerId,
      });

      if (
        pickup.pickupId !== pickupId ||
        pickup.token !== link.token
      ) {
        throw tenantMismatch(
          'PickupLink projection does not match canonical Pickup',
        );
      }

      if (
        pickup.status === PICKUP_STATUS.RECEIVED ||
        link.status === PICKUP_STATUS.RECEIVED
      ) {
        throw pickupAlreadyReceived();
      }

      if (
        pickup.status !== PICKUP_STATUS.READY ||
        link.status !== PICKUP_STATUS.READY
      ) {
        throw orderNotReady();
      }

      const order = await getOrderRepository().getById(
        organizationId,
        link.orderId,
      );

      if (!order) {
        throw orderNotFound();
      }

      requireTenantMatch(order, organizationId);

      if (
        order.orderId !== link.orderId ||
        order.campaignId !== link.campaignId ||
        order.customerId !== link.customerId
      ) {
        throw tenantMismatch(
          'Order does not match the Pickup context',
        );
      }

      if (
        order.status !== ORDER_STATUS.READY_FOR_PICKUP
      ) {
        throw orderNotReady();
      }

      const timestamp = clock();
      const auditId = idFactory();
      const audit = {
        ...auditKey(
          organizationId,
          timestamp,
          auditId,
        ),
        entityType: 'AuditLog',
        auditId,
        organizationId,
        actorId,
        action: 'PICKUP_CONFIRMED',
        resourceType: 'PICKUP',
        resourceId: pickupId,
        metadata: {
          orderId: order.orderId,
          campaignId: order.campaignId,
        },
        createdAt: timestamp,
      };

      try {
        await getRepository().transactWrite({
          TransactItems: [
            {
              Update: {
                Key: pickupKey(
                  organizationId,
                  order.orderId,
                ),
                UpdateExpression:
                  'SET #status = :received, #receivedBy = :receivedBy, #receivedAt = :receivedAt, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#pickupId': 'pickupId',
                  '#token': 'token',
                  '#customerId': 'customerId',
                  '#receivedBy': 'receivedBy',
                  '#receivedAt': 'receivedAt',
                  '#updatedAt': 'updatedAt',
                },
                ExpressionAttributeValues: {
                  ':ready': PICKUP_STATUS.READY,
                  ':received': PICKUP_STATUS.RECEIVED,
                  ':pickupId': pickupId,
                  ':token': pickup.token,
                  ':customerId': order.customerId,
                  ':receivedBy': actorId,
                  ':receivedAt': timestamp,
                  ':updatedAt': timestamp,
                },
                ConditionExpression:
                  '#status = :ready AND #pickupId = :pickupId AND #token = :token AND #customerId = :customerId',
              },
            },
            {
              Update: {
                Key: pickupLinkKey(
                  organizationId,
                  pickupId,
                ),
                UpdateExpression:
                  'SET #status = :received, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#orderId': 'orderId',
                  '#token': 'token',
                  '#customerId': 'customerId',
                  '#updatedAt': 'updatedAt',
                },
                ExpressionAttributeValues: {
                  ':ready': PICKUP_STATUS.READY,
                  ':received': PICKUP_STATUS.RECEIVED,
                  ':orderId': order.orderId,
                  ':token': pickup.token,
                  ':customerId': order.customerId,
                  ':updatedAt': timestamp,
                },
                ConditionExpression:
                  '#status = :ready AND #orderId = :orderId AND #token = :token AND #customerId = :customerId',
              },
            },
            {
              Update: {
                Key: orderKey(
                  organizationId,
                  order.orderId,
                ),
                UpdateExpression:
                  'SET #status = :received, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#campaignId': 'campaignId',
                  '#customerId': 'customerId',
                  '#updatedAt': 'updatedAt',
                },
                ExpressionAttributeValues: {
                  ':readyForPickup':
                    ORDER_STATUS.READY_FOR_PICKUP,
                  ':received': ORDER_STATUS.RECEIVED,
                  ':campaignId': order.campaignId,
                  ':customerId': order.customerId,
                  ':updatedAt': timestamp,
                },
                ConditionExpression:
                  '#status = :readyForPickup AND #campaignId = :campaignId AND #customerId = :customerId',
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
                  'SET #status = :received',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#campaignId': 'campaignId',
                  '#orderId': 'orderId',
                  '#customerId': 'customerId',
                },
                ExpressionAttributeValues: {
                  ':readyForPickup':
                    ORDER_STATUS.READY_FOR_PICKUP,
                  ':received': ORDER_STATUS.RECEIVED,
                  ':campaignId': order.campaignId,
                  ':orderId': order.orderId,
                  ':customerId': order.customerId,
                },
                ConditionExpression:
                  '#status = :readyForPickup AND #campaignId = :campaignId AND #orderId = :orderId AND #customerId = :customerId',
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
        if (
          error?.name === 'TransactionCanceledException' &&
          Array.isArray(error.CancellationReasons)
        ) {
          if (
            error.CancellationReasons[0]?.Code ===
              'ConditionalCheckFailed' ||
            error.CancellationReasons[1]?.Code ===
              'ConditionalCheckFailed'
          ) {
            throw pickupAlreadyReceived();
          }

          if (
            error.CancellationReasons[2]?.Code ===
              'ConditionalCheckFailed' ||
            error.CancellationReasons[3]?.Code ===
              'ConditionalCheckFailed'
          ) {
            throw orderNotReady();
          }
        }

        throw error;
      }

      return toPickupDto({
        ...pickup,
        status: PICKUP_STATUS.RECEIVED,
        receivedBy: actorId,
        receivedAt: timestamp,
        updatedAt: timestamp,
      });
    },

    async listPickups({
      organizationId,
      campaignId,
      status,
      token,
      orderId,
      cursor,
    }) {
      const scope = [
        'pickups',
        organizationId,
        campaignId || 'all-campaigns',
        status || 'all-statuses',
        token || 'all-tokens',
        orderId || 'all-orders',
      ].join(':');
      const exclusiveStartKey = decodeCursor(
        cursor,
        scope,
      );

      if (token) {
        const result =
          await getPickupRepository().listByTokenPage(
            organizationId,
            token,
            { exclusiveStartKey },
          );
        const items = [];

        for (const pickup of result.items) {
          validatePickupRecord(pickup, {
            organizationId,
            orderId: pickup.orderId,
          });

          if (pickup.token !== token) {
            throw tenantMismatch(
              'Pickup token index returned a mismatched Pickup',
            );
          }

          if (
            campaignId &&
            pickup.campaignId !== campaignId
          ) {
            continue;
          }

          if (status && pickup.status !== status) {
            continue;
          }

          if (orderId && pickup.orderId !== orderId) {
            continue;
          }

          items.push(toPickupDto(pickup));
        }

        return {
          items,
          nextCursor: result.lastEvaluatedKey
            ? encodeCursor(
                scope,
                result.lastEvaluatedKey,
              )
            : null,
        };
      }

      const result =
        await getPickupRepository().listLinksPage(
          organizationId,
          {
            campaignId,
            status,
            orderId,
            exclusiveStartKey,
          },
        );
      const items = [];

      for (const link of result.items) {
        const pickup = await loadPickupFromLink(
          organizationId,
          link,
        );
        items.push(toPickupDto(pickup));
      }

      return {
        items,
        nextCursor: result.lastEvaluatedKey
          ? encodeCursor(
              scope,
              result.lastEvaluatedKey,
            )
          : null,
      };
    },

    async getPickup({
      organizationId,
      pickupId,
    }) {
      const link =
        await getPickupRepository().getLinkById(
          organizationId,
          pickupId,
        );

      if (!link) {
        throw pickupNotFound();
      }

      return toPickupDto(
        await loadPickupFromLink(
          organizationId,
          link,
        ),
      );
    },

    async getOwnPickup({
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

      requireResourceOwnership(
        order,
        customerId,
        'customerId',
      );

      const pickup =
        await getPickupRepository().getByOrder(
          order.organizationId,
          order.orderId,
        );

      if (!pickup) {
        throw orderNotReady();
      }

      validatePickupRecord(pickup, {
        organizationId:
          order.organizationId,
        orderId: order.orderId,
        campaignId: order.campaignId,
        customerId,
      });

      if (
        ![
          ORDER_STATUS.READY_FOR_PICKUP,
          ORDER_STATUS.RECEIVED,
        ].includes(order.status)
      ) {
        throw orderNotReady();
      }

      return toPickupDto(pickup);
    },
  };
}
module.exports = {
  PICKUP_TOKEN_PATTERN,
  createPickupToken,
  pickupNotFound,
  orderNotReady,
  pickupAlreadyReceived,
  validatePickupToken,
  validateCampaignOrderLink,
  validatePickupRecord,
  validatePickupLink,
  createPickupService,
};