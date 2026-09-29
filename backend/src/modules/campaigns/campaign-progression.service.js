'use strict';

const { AppError } = require('../../errors/app-error');
const { orderKey } = require('../../repositories/keys');
const { nowIsoUtc } = require('../../utils/time');
const { ORDER_STATUS } = require('../orders/order.constants');
const {
  createOrderRepository,
} = require('../orders/order.repository');
const {
  createPickupService,
} = require('../pickups/pickup.service');
const { CAMPAIGN_STATUS } = require('./campaign.constants');
const {
  assertCampaignTransition,
  invalidStatusTransition,
} = require('./campaign.policy');
const {
  createCampaignService,
} = require('./campaign.service');

const CANCELLATION_BLOCKING_ORDER_STATUSES = new Set([
  ORDER_STATUS.PAYMENT_REVIEW,
  ORDER_STATUS.PAID,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.IN_PRODUCTION,
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.RECEIVED,
]);

const CANCELLABLE_ORDER_STATUSES = new Set([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.PAYMENT_REJECTED,
]);

const COMPLETION_BLOCKING_ORDER_STATUSES = new Set([
  ORDER_STATUS.PAID,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.IN_PRODUCTION,
  ORDER_STATUS.READY_FOR_PICKUP,
]);

function paymentNotReviewable() {
  return new AppError({
    code: 'PAYMENT_NOT_REVIEWABLE',
    message:
      'Campaign cannot start production while a payment remains under review',
    httpStatus: 409,
  });
}

function validateCampaignOrderLink(
  link,
  organizationId,
  campaignId,
) {
  const expectedPk = `ORG#${organizationId}`;
  const expectedSkPrefix =
    `CAMPAIGN#${campaignId}#ORDER#`;

  if (
    !link ||
    link.entityType !== 'CampaignOrderLink' ||
    link.organizationId !== organizationId ||
    link.campaignId !== campaignId ||
    link.PK !== expectedPk ||
    typeof link.SK !== 'string' ||
    !link.SK.startsWith(expectedSkPrefix) ||
    typeof link.orderId !== 'string' ||
    link.orderId.length === 0
  ) {
    throw new AppError({
      code: 'TENANT_MISMATCH',
      message:
        'Campaign order projection does not match the active tenant',
      httpStatus: 403,
    });
  }

  return link;
}

function buildOrderAndLinkStatusUpdates({
  organizationId,
  campaignId,
  link,
  fromStatus,
  toStatus,
  timestamp,
}) {
  validateCampaignOrderLink(
    link,
    organizationId,
    campaignId,
  );

  return [
    {
      Update: {
        Key: orderKey(organizationId, link.orderId),
        UpdateExpression:
          'SET #status = :toStatus, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#campaignId': 'campaignId',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':fromStatus': fromStatus,
          ':toStatus': toStatus,
          ':campaignId': campaignId,
          ':updatedAt': timestamp,
        },
        ConditionExpression:
          '#status = :fromStatus AND #campaignId = :campaignId',
      },
    },
    {
      Update: {
        Key: {
          PK: link.PK,
          SK: link.SK,
        },
        UpdateExpression:
          'SET #status = :toStatus',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#campaignId': 'campaignId',
          '#orderId': 'orderId',
        },
        ExpressionAttributeValues: {
          ':fromStatus': fromStatus,
          ':toStatus': toStatus,
          ':campaignId': campaignId,
          ':orderId': link.orderId,
        },
        ConditionExpression:
          '#status = :fromStatus AND #campaignId = :campaignId AND #orderId = :orderId',
      },
    },
  ];
}

function createCampaignProgressionService(options = {}) {
  const clock = options.clock || nowIsoUtc;
  const campaignService =
    options.campaignService ||
    createCampaignService(options);

  let orderRepository = options.orderRepository;
  let pickupService = options.pickupService;

  function getOrderRepository() {
    if (!orderRepository) {
      orderRepository = createOrderRepository({
        repository: options.repository,
      });
    }

    return orderRepository;
  }

  function getPickupService() {
    if (!pickupService) {
      pickupService = createPickupService({
        repository: options.repository,
        orderRepository: getOrderRepository(),
        pickupRepository: options.pickupRepository,
        sqsAdapter: options.sqsAdapter,
        logger: options.logger,
        idFactory: options.idFactory,
        tokenFactory: options.tokenFactory,
      });
    }

    return pickupService;
  }
  async function loadCampaignAndLinks(
    organizationId,
    campaignId,
    toStatus,
  ) {
    const campaign = await campaignService.getCampaign({
      organizationId,
      campaignId,
    });

    assertCampaignTransition(campaign.status, toStatus);

    const links =
      await getOrderRepository().listCampaignLinks(
        organizationId,
        campaignId,
      );

    for (const link of links) {
      validateCampaignOrderLink(
        link,
        organizationId,
        campaignId,
      );
    }

    return {
      campaign,
      links,
    };
  }

  return {
    async closeCampaign({
      organizationId,
      campaignId,
      actorId,
    }) {
      const { links } = await loadCampaignAndLinks(
        organizationId,
        campaignId,
        CAMPAIGN_STATUS.CLOSED,
      );
      const timestamp = clock();
      const extraTransactItems = links
        .filter((link) => link.status === ORDER_STATUS.PAID)
        .flatMap((link) =>
          buildOrderAndLinkStatusUpdates({
            organizationId,
            campaignId,
            link,
            fromStatus: ORDER_STATUS.PAID,
            toStatus: ORDER_STATUS.CONFIRMED,
            timestamp,
          }),
        );

      return campaignService.transitionCampaign({
        organizationId,
        campaignId,
        actorId,
        toStatus: CAMPAIGN_STATUS.CLOSED,
        extraTransactItems,
        timestamp,
      });
    },

    async startProduction({
      organizationId,
      campaignId,
      actorId,
    }) {
      const { links } = await loadCampaignAndLinks(
        organizationId,
        campaignId,
        CAMPAIGN_STATUS.PRODUCING,
      );

      if (
        links.some(
          (link) =>
            link.status === ORDER_STATUS.PAYMENT_REVIEW,
        )
      ) {
        throw paymentNotReviewable();
      }

      const timestamp = clock();
      const extraTransactItems = links
        .filter(
          (link) =>
            link.status === ORDER_STATUS.CONFIRMED,
        )
        .flatMap((link) =>
          buildOrderAndLinkStatusUpdates({
            organizationId,
            campaignId,
            link,
            fromStatus: ORDER_STATUS.CONFIRMED,
            toStatus: ORDER_STATUS.IN_PRODUCTION,
            timestamp,
          }),
        );

      return campaignService.transitionCampaign({
        organizationId,
        campaignId,
        actorId,
        toStatus: CAMPAIGN_STATUS.PRODUCING,
        extraTransactItems,
        timestamp,
      });
    },

    async cancelCampaign({
      organizationId,
      campaignId,
      actorId,
    }) {
      const { campaign, links } =
        await loadCampaignAndLinks(
          organizationId,
          campaignId,
          CAMPAIGN_STATUS.CANCELLED,
        );

      const blockingOrder = links.find((link) =>
        CANCELLATION_BLOCKING_ORDER_STATUSES.has(
          link.status,
        ),
      );

      if (blockingOrder) {
        throw invalidStatusTransition(
          campaign.status,
          CAMPAIGN_STATUS.CANCELLED,
        );
      }

      const timestamp = clock();
      const extraTransactItems = links
        .filter((link) =>
          CANCELLABLE_ORDER_STATUSES.has(link.status),
        )
        .flatMap((link) =>
          buildOrderAndLinkStatusUpdates({
            organizationId,
            campaignId,
            link,
            fromStatus: link.status,
            toStatus: ORDER_STATUS.CANCELLED,
            timestamp,
          }),
        );

      return campaignService.transitionCampaign({
        organizationId,
        campaignId,
        actorId,
        toStatus: CAMPAIGN_STATUS.CANCELLED,
        extraTransactItems,
        timestamp,
      });
    },

    async readyForPickup({
      organizationId,
      campaignId,
      actorId,
    }) {
      const { links } = await loadCampaignAndLinks(
        organizationId,
        campaignId,
        CAMPAIGN_STATUS.READY_FOR_PICKUP,
      );
      const timestamp = clock();
      const prepared =
        await getPickupService().prepareCampaignReadiness({
          organizationId,
          campaignId,
          links,
          timestamp,
        });

      const campaign =
        await campaignService.transitionCampaign({
          organizationId,
          campaignId,
          actorId,
          toStatus: CAMPAIGN_STATUS.READY_FOR_PICKUP,
          extraTransactItems: prepared.transactItems,
          timestamp,
        });

      await getPickupService().publishReadyEvents(
        prepared.events,
        timestamp,
      );

      return campaign;
    },

    async completeCampaign({
      organizationId,
      campaignId,
      actorId,
    }) {
      const { campaign, links } =
        await loadCampaignAndLinks(
          organizationId,
          campaignId,
          CAMPAIGN_STATUS.COMPLETED,
        );

      const incompletePaidOrder = links.find((link) =>
        COMPLETION_BLOCKING_ORDER_STATUSES.has(
          link.status,
        ),
      );

      if (incompletePaidOrder) {
        throw invalidStatusTransition(
          campaign.status,
          CAMPAIGN_STATUS.COMPLETED,
        );
      }

      return campaignService.transitionCampaign({
        organizationId,
        campaignId,
        actorId,
        toStatus: CAMPAIGN_STATUS.COMPLETED,
        timestamp: clock(),
      });
    },
  };
}

module.exports = {
  CANCELLATION_BLOCKING_ORDER_STATUSES,
  CANCELLABLE_ORDER_STATUSES,
  COMPLETION_BLOCKING_ORDER_STATUSES,
  validateCampaignOrderLink,
  buildOrderAndLinkStatusUpdates,
  createCampaignProgressionService,
};
