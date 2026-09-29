'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  campaignKey,
  campaignStoreIndex,
} = require('../../repositories/keys');
const {
  requireTenantMatch,
} = require('../../policies/organization.policy');
const { decodeCursor, encodeCursor } = require('../../utils/cursor');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const {
  validateCampaignDates,
} = require('../../validators/campaign.validator');
const {
  createStoreRepository,
} = require('../stores/store.repository');
const { CAMPAIGN_STATUS } = require('./campaign.constants');
const { toCampaignDto } = require('./campaign.mapper');
const {
  assertCampaignTransition,
  assertDraftCampaign,
  invalidStatusTransition,
} = require('./campaign.policy');
const {
  createCampaignRepository,
} = require('./campaign.repository');

function campaignNotFound() {
  return new AppError({
    code: 'CAMPAIGN_NOT_FOUND',
    message: 'Campaign not found',
    httpStatus: 404,
  });
}

function storeNotFound() {
  return new AppError({
    code: 'STORE_NOT_FOUND',
    message: 'Store not found',
    httpStatus: 404,
  });
}

function isConditionalConflict(error) {
  if (!error) {
    return false;
  }

  if (error.name === 'ConditionalCheckFailedException') {
    return true;
  }

  if (error.name !== 'TransactionCanceledException') {
    return false;
  }

  return Array.isArray(error.CancellationReasons) &&
    error.CancellationReasons.some(
      (reason) => reason?.Code === 'ConditionalCheckFailed',
    );
}

function createCampaignService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;

  let repository = options.repository;
  let campaignRepository = options.campaignRepository;
  let storeRepository = options.storeRepository;

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

  function getStoreRepository() {
    if (!storeRepository) {
      storeRepository = createStoreRepository({
        repository: getRepository(),
      });
    }

    return storeRepository;
  }

  async function requireStore(organizationId, storeId) {
    const store = await getStoreRepository().getById(
      organizationId,
      storeId,
    );

    if (!store) {
      throw storeNotFound();
    }

    requireTenantMatch(store, organizationId);
    return store;
  }

  async function requireCampaign(organizationId, campaignId) {
    const campaign = await getCampaignRepository().getById(
      organizationId,
      campaignId,
    );

    if (!campaign) {
      throw campaignNotFound();
    }

    requireTenantMatch(campaign, organizationId);
    return campaign;
  }

  function makeAudit({
    organizationId,
    actorId,
    action,
    campaignId,
    metadata,
    timestamp,
  }) {
    const auditId = idFactory();

    return {
      ...auditKey(organizationId, timestamp, auditId),
      entityType: 'AuditLog',
      auditId,
      organizationId,
      actorId,
      action,
      resourceType: 'CAMPAIGN',
      resourceId: campaignId,
      metadata: metadata || {},
      createdAt: timestamp,
    };
  }

  return {
    async listCampaigns({
      organizationId,
      storeId,
      status,
      cursor,
    }) {
      if (storeId) {
        await requireStore(organizationId, storeId);
      }

      const scope = [
        'campaigns',
        organizationId,
        storeId || 'all',
        status || 'all',
      ].join(':');
      const exclusiveStartKey = decodeCursor(cursor, scope);

      const result = storeId
        ? await getCampaignRepository().listByStorePage(
            organizationId,
            storeId,
            {
              status,
              exclusiveStartKey,
            },
          )
        : await getCampaignRepository().listByOrganizationPage(
            organizationId,
            {
              status,
              exclusiveStartKey,
            },
          );

      const items = result.items.map((campaign) => {
        requireTenantMatch(campaign, organizationId);

        if (storeId && campaign.storeId !== storeId) {
          throw new AppError({
            code: 'TENANT_MISMATCH',
            message: 'Campaign does not belong to this store',
            httpStatus: 403,
          });
        }

        return toCampaignDto(campaign);
      });

      return {
        items,
        nextCursor: result.lastEvaluatedKey
          ? encodeCursor(scope, result.lastEvaluatedKey)
          : null,
      };
    },

    async createCampaign({
      organizationId,
      actorId,
      storeId,
      name,
      openAt,
      closeAt,
      paymentDeadline,
      pickupAt,
    }) {
      await requireStore(organizationId, storeId);

      validateCampaignDates({
        openAt,
        closeAt,
        paymentDeadline,
        pickupAt,
      });

      const campaignId = idFactory();
      const timestamp = clock();
      const campaign = {
        campaignId,
        organizationId,
        storeId,
        name,
        openAt,
        closeAt,
        paymentDeadline,
        pickupAt,
        status: CAMPAIGN_STATUS.DRAFT,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const item = {
        ...campaignKey(organizationId, campaignId),
        ...campaignStoreIndex(
          organizationId,
          storeId,
          timestamp,
          campaignId,
        ),
        entityType: 'Campaign',
        ...campaign,
      };

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'CAMPAIGN_CREATED',
        campaignId,
        metadata: {
          storeId,
        },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Put: {
              Item: item,
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

      return toCampaignDto(campaign);
    },

    async getCampaign({ organizationId, campaignId }) {
      return toCampaignDto(
        await requireCampaign(organizationId, campaignId),
      );
    },

    async updateCampaign({
      organizationId,
      campaignId,
      actorId,
      changes,
    }) {
      const existing = await requireCampaign(
        organizationId,
        campaignId,
      );

      assertDraftCampaign(existing.status);

      if (
        Object.prototype.hasOwnProperty.call(changes, 'storeId')
      ) {
        await requireStore(organizationId, changes.storeId);
      }

      const merged = {
        openAt: existing.openAt ?? null,
        closeAt: existing.closeAt ?? null,
        paymentDeadline: existing.paymentDeadline ?? null,
        pickupAt: existing.pickupAt ?? null,
        ...changes,
      };

      validateCampaignDates(merged);

      const timestamp = clock();
      const names = {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      };
      const values = {
        ':draft': CAMPAIGN_STATUS.DRAFT,
        ':updatedAt': timestamp,
      };
      const assignments = ['#updatedAt = :updatedAt'];

      for (const field of [
        'storeId',
        'name',
        'openAt',
        'closeAt',
        'paymentDeadline',
        'pickupAt',
      ]) {
        if (Object.prototype.hasOwnProperty.call(changes, field)) {
          names[`#${field}`] = field;
          values[`:${field}`] = changes[field];
          assignments.push(`#${field} = :${field}`);
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(changes, 'storeId')
      ) {
        names['#gsi1pk'] = 'GSI1PK';
        values[':gsi1pk'] =
          `ORG#${organizationId}#STORE#${changes.storeId}`;
        assignments.push('#gsi1pk = :gsi1pk');
      }

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'CAMPAIGN_UPDATED',
        campaignId,
        metadata: {
          fields: Object.keys(changes),
        },
        timestamp,
      });

      try {
        await getRepository().transactWrite({
          TransactItems: [
            {
              Update: {
                Key: campaignKey(organizationId, campaignId),
                UpdateExpression:
                  `SET ${assignments.join(', ')}`,
                ExpressionAttributeNames: names,
                ExpressionAttributeValues: values,
                ConditionExpression: '#status = :draft',
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
          throw invalidStatusTransition(
            existing.status,
            CAMPAIGN_STATUS.DRAFT,
          );
        }

        throw error;
      }

      return toCampaignDto({
        ...existing,
        ...changes,
        updatedAt: timestamp,
      });
    },

    async transitionCampaign({
      organizationId,
      campaignId,
      actorId,
      toStatus,
      extraTransactItems = [],
      timestamp = clock(),
    }) {
      const existing = await requireCampaign(
        organizationId,
        campaignId,
      );

      assertCampaignTransition(existing.status, toStatus);
      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'CAMPAIGN_STATUS_CHANGED',
        campaignId,
        metadata: {
          fromStatus: existing.status,
          toStatus,
        },
        timestamp,
      });

      try {
        await getRepository().transactWrite({
          TransactItems: [
            {
              Update: {
                Key: campaignKey(organizationId, campaignId),
                UpdateExpression:
                  'SET #status = :toStatus, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#updatedAt': 'updatedAt',
                },
                ExpressionAttributeValues: {
                  ':fromStatus': existing.status,
                  ':toStatus': toStatus,
                  ':updatedAt': timestamp,
                },
                ConditionExpression: '#status = :fromStatus',
              },
            },
            ...extraTransactItems,
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
          throw invalidStatusTransition(
            existing.status,
            toStatus,
          );
        }

        throw error;
      }

      return toCampaignDto({
        ...existing,
        status: toStatus,
        updatedAt: timestamp,
      });
    },
  };
}

module.exports = {
  createCampaignService,
  isConditionalConflict,
};
