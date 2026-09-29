'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { AppError } = require('../../errors/app-error');
const { auditKey, storeKey } = require('../../repositories/keys');
const { requireTenantMatch } = require('../../policies/organization.policy');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const { STORE_STATUS } = require('./store.constants');
const { toStoreDto } = require('./store.mapper');
const { createStoreRepository } = require('./store.repository');

function storeNotFound() {
  return new AppError({
    code: 'STORE_NOT_FOUND',
    message: 'Store not found',
    httpStatus: 404,
  });
}

function createStoreService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;

  let repository = options.repository;
  let storeRepository = options.storeRepository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getStoreRepository() {
    if (!storeRepository) {
      storeRepository = createStoreRepository({
        repository: getRepository(),
      });
    }

    return storeRepository;
  }

  function makeAudit({
    organizationId,
    actorId,
    action,
    storeId,
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
      resourceType: 'STORE',
      resourceId: storeId,
      metadata: metadata || {},
      createdAt: timestamp,
    };
  }

  return {
    async listStores(organizationId) {
      const stores =
        await getStoreRepository().listByOrganization(organizationId);

      return stores.map((store) => {
        requireTenantMatch(store, organizationId);
        return toStoreDto(store);
      });
    },

    async createStore({ organizationId, actorId, name, description }) {
      const storeId = idFactory();
      const timestamp = clock();

      const store = {
        storeId,
        organizationId,
        name,
        description,
        status: STORE_STATUS.ACTIVE,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const storeItem = {
        ...storeKey(organizationId, storeId),
        entityType: 'Store',
        ...store,
      };

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'STORE_CREATED',
        storeId,
        metadata: {},
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Put: {
              Item: storeItem,
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

      return toStoreDto(store);
    },

    async getStore({ organizationId, storeId }) {
      const store =
        await getStoreRepository().getById(organizationId, storeId);

      if (!store) {
        throw storeNotFound();
      }

      requireTenantMatch(store, organizationId);

      return toStoreDto(store);
    },

    async updateStore({
      organizationId,
      storeId,
      actorId,
      changes,
    }) {
      const existing =
        await getStoreRepository().getById(organizationId, storeId);

      if (!existing) {
        throw storeNotFound();
      }

      requireTenantMatch(existing, organizationId);

      const timestamp = clock();
      const names = {
        '#updatedAt': 'updatedAt',
      };
      const values = {
        ':updatedAt': timestamp,
      };
      const assignments = ['#updatedAt = :updatedAt'];

      if (Object.prototype.hasOwnProperty.call(changes, 'name')) {
        names['#name'] = 'name';
        values[':name'] = changes.name;
        assignments.push('#name = :name');
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'description')) {
        names['#description'] = 'description';
        values[':description'] = changes.description;
        assignments.push('#description = :description');
      }

      if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
        names['#status'] = 'status';
        values[':status'] = changes.status;
        assignments.push('#status = :status');
      }

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'STORE_UPDATED',
        storeId,
        metadata: {
          fields: Object.keys(changes),
        },
        timestamp,
      });

      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: storeKey(organizationId, storeId),
              UpdateExpression: `SET ${assignments.join(', ')}`,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
              ConditionExpression:
                'attribute_exists(PK) AND attribute_exists(SK)',
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

      return toStoreDto({
        ...existing,
        ...changes,
        updatedAt: timestamp,
      });
    },
  };
}

module.exports = {
  createStoreService,
};
