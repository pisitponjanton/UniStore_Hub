'use strict';

const {
  createDynamoRepository,
} = require('../../aws/dynamodb');
const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  organizationProfileKey,
} = require('../../repositories/keys');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const {
  AUDIT_ACTION,
} = require('../audit/audit.constants');
const {
  ORGANIZATION_STATUS,
} = require('../organizations/organization.constants');
const {
  toOrganizationDto,
} = require('../organizations/organization.mapper');
const {
  createOrganizationRepository,
} = require('../organizations/organization.repository');
const {
  toUserDto,
} = require('../users/user.mapper');
const {
  createUserRepository,
} = require('../users/user.repository');

function organizationNotFound() {
  return new AppError({
    code: 'ORGANIZATION_NOT_FOUND',
    message: 'Organization not found',
    httpStatus: 404,
  });
}

function invalidStatusTransition(message) {
  return new AppError({
    code: 'INVALID_STATUS_TRANSITION',
    message,
    httpStatus: 409,
  });
}

function isFirstTransactionConditionFailure(error) {
  return (
    error?.name === 'TransactionCanceledException' &&
    Array.isArray(error.CancellationReasons) &&
    error.CancellationReasons[0]?.Code ===
      'ConditionalCheckFailed'
  );
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

function incrementCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function createPlatformAdminService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;

  let repository = options.repository;
  let organizationRepository =
    options.organizationRepository;
  let userRepository = options.userRepository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getOrganizationRepository() {
    if (!organizationRepository) {
      organizationRepository =
        createOrganizationRepository({
          repository: getRepository(),
        });
    }

    return organizationRepository;
  }

  function getUserRepository() {
    if (!userRepository) {
      userRepository = createUserRepository({
        repository: getRepository(),
      });
    }

    return userRepository;
  }

  async function listAllOrganizations() {
    return collectPages(
      (exclusiveStartKey) =>
        getOrganizationRepository()
          .listPlatform({
            exclusiveStartKey,
          }),
    );
  }

  async function listAllUsers() {
    const links = await collectPages(
      (exclusiveStartKey) =>
        getUserRepository()
          .listPlatformLinksPage({
            exclusiveStartKey,
          }),
    );
    const users = [];

    for (const link of links) {
      if (
        link.entityType !==
          'PlatformUserLink' ||
        typeof link.userId !== 'string' ||
        link.userId.length === 0
      ) {
        throw new AppError({
          code: 'INTERNAL_ERROR',
          message:
            'Platform user index is inconsistent',
          httpStatus: 500,
        });
      }

      const user =
        await getUserRepository().getById(
          link.userId,
        );

      if (!user) {
        throw new AppError({
          code: 'INTERNAL_ERROR',
          message:
            'Platform user index references a missing User',
          httpStatus: 500,
        });
      }

      users.push(user);
    }

    return users;
  }

  async function transitionOrganization({
    organizationId,
    actorId,
    toStatus,
  }) {
    const existing =
      await getOrganizationRepository().getById(
        organizationId,
      );

    if (!existing) {
      throw organizationNotFound();
    }

    let action;

    if (
      toStatus ===
      ORGANIZATION_STATUS.ACTIVE
    ) {
      if (
        existing.status !==
        ORGANIZATION_STATUS.PENDING
      ) {
        throw invalidStatusTransition(
          'Organization can be approved only from PENDING',
        );
      }

      action =
        AUDIT_ACTION.ORGANIZATION_APPROVED;
    } else if (
      toStatus ===
      ORGANIZATION_STATUS.SUSPENDED
    ) {
      if (
        existing.status ===
        ORGANIZATION_STATUS.SUSPENDED
      ) {
        throw invalidStatusTransition(
          'Organization is already SUSPENDED',
        );
      }

      action =
        AUDIT_ACTION.ORGANIZATION_SUSPENDED;
    } else {
      throw invalidStatusTransition(
        'Unsupported Organization status transition',
      );
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
      action,
      resourceType: 'ORGANIZATION',
      resourceId: organizationId,
      metadata: {
        fromStatus: existing.status,
        toStatus,
      },
      createdAt: timestamp,
    };

    try {
      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: organizationProfileKey(
                organizationId,
              ),
              UpdateExpression:
                'SET #status = :toStatus, #updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#updatedAt': 'updatedAt',
                '#entityType': 'entityType',
              },
              ExpressionAttributeValues: {
                ':expectedStatus':
                  existing.status,
                ':toStatus': toStatus,
                ':updatedAt': timestamp,
                ':organizationType':
                  'Organization',
              },
              ConditionExpression:
                '#status = :expectedStatus AND #entityType = :organizationType',
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
        isFirstTransactionConditionFailure(
          error,
        )
      ) {
        throw invalidStatusTransition(
          'Organization status changed concurrently',
        );
      }

      throw error;
    }

    return toOrganizationDto({
      ...existing,
      status: toStatus,
      updatedAt: timestamp,
    });
  }

  return {
    async listOrganizations() {
      const organizations =
        await listAllOrganizations();

      return organizations.map(
        toOrganizationDto,
      );
    },

    async approveOrganization({
      organizationId,
      actorId,
    }) {
      return transitionOrganization({
        organizationId,
        actorId,
        toStatus:
          ORGANIZATION_STATUS.ACTIVE,
      });
    },

    async suspendOrganization({
      organizationId,
      actorId,
    }) {
      return transitionOrganization({
        organizationId,
        actorId,
        toStatus:
          ORGANIZATION_STATUS.SUSPENDED,
      });
    },

    async listUsers() {
      const users = await listAllUsers();
      return users.map(toUserDto);
    },

    async getSummary() {
      const [
        organizations,
        users,
      ] = await Promise.all([
        listAllOrganizations(),
        listAllUsers(),
      ]);
      const organizationsByStatus = {};
      const usersByStatus = {};

      for (const organization of organizations) {
        incrementCount(
          organizationsByStatus,
          organization.status,
        );
      }

      for (const user of users) {
        incrementCount(
          usersByStatus,
          user.status,
        );
      }

      return {
        organizationsByStatus,
        usersByStatus,
      };
    },
  };
}

module.exports = {
  organizationNotFound,
  invalidStatusTransition,
  isFirstTransactionConditionFailure,
  collectPages,
  incrementCount,
  createPlatformAdminService,
};
