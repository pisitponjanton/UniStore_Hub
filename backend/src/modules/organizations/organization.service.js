'use strict';

const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  membershipUserIndex,
  organizationMemberKey,
  organizationPlatformIndex,
  organizationProfileKey,
} = require('../../repositories/keys');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const {
  MEMBERSHIP_STATUS,
  ORGANIZATION_ROLE,
} = require('../members/member.constants');
const {
  createMemberRepository,
} = require('../members/member.repository');
const {
  createDynamoRepository,
} = require('../../aws/dynamodb');
const {
  ORGANIZATION_STATUS,
} = require('./organization.constants');
const {
  createOrganizationRepository,
} = require('./organization.repository');
const { toOrganizationDto } = require('./organization.mapper');

function organizationNotFound() {
  return new AppError({
    code: 'ORGANIZATION_NOT_FOUND',
    message: 'Organization not found',
    httpStatus: 404,
  });
}

function createOrganizationService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;

  let repository = options.repository;
  let organizationRepository = options.organizationRepository;
  let memberRepository = options.memberRepository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getOrganizationRepository() {
    if (!organizationRepository) {
      organizationRepository = createOrganizationRepository({
        repository: getRepository(),
      });
    }

    return organizationRepository;
  }

  function getMemberRepository() {
    if (!memberRepository) {
      memberRepository = createMemberRepository({
        repository: getRepository(),
      });
    }

    return memberRepository;
  }

  return {
    async listAccessibleOrganizations(userId) {
      const memberships = await getMemberRepository().listForUser(userId);
      const activeMemberships = memberships.filter(
        (membership) => membership.status === MEMBERSHIP_STATUS.ACTIVE,
      );

      const organizations = await Promise.all(
        activeMemberships.map((membership) =>
          getOrganizationRepository().getById(membership.organizationId),
        ),
      );

      return organizations
        .filter(Boolean)
        .map((organization) => toOrganizationDto(organization));
    },

    async createOrganization({ name, description, actorId }) {
      const organizationId = idFactory();
      const auditId = idFactory();
      const timestamp = clock();

      const organization = {
        organizationId,
        name,
        description,
        status: ORGANIZATION_STATUS.PENDING,
        createdBy: actorId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const membership = {
        organizationId,
        userId: actorId,
        role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
        status: MEMBERSHIP_STATUS.ACTIVE,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const organizationItem = {
        ...organizationProfileKey(organizationId),
        ...organizationPlatformIndex(timestamp, organizationId),
        entityType: 'Organization',
        ...organization,
      };

      const membershipItem = {
        ...organizationMemberKey(organizationId, actorId),
        ...membershipUserIndex(actorId, organizationId),
        entityType: 'OrganizationMember',
        ...membership,
      };

      const auditItem = {
        ...auditKey(organizationId, timestamp, auditId),
        entityType: 'AuditLog',
        auditId,
        organizationId,
        actorId,
        action: 'ORGANIZATION_CREATED',
        resourceType: 'ORGANIZATION',
        resourceId: organizationId,
        metadata: {},
        createdAt: timestamp,
      };

      await getRepository().transactWrite({
        TransactItems: [
          {
            Put: {
              Item: organizationItem,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              Item: membershipItem,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              Item: auditItem,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });

      return toOrganizationDto(organization);
    },

    async getOrganization(organizationId) {
      const organization =
        await getOrganizationRepository().getById(organizationId);

      if (!organization) {
        throw organizationNotFound();
      }

      return toOrganizationDto(organization);
    },

    async updateOrganization({ organizationId, actorId, changes }) {
      const existing =
        await getOrganizationRepository().getById(organizationId);

      if (!existing) {
        throw organizationNotFound();
      }

      const timestamp = clock();
      const auditId = idFactory();
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

      const auditItem = {
        ...auditKey(organizationId, timestamp, auditId),
        entityType: 'AuditLog',
        auditId,
        organizationId,
        actorId,
        action: 'ORGANIZATION_UPDATED',
        resourceType: 'ORGANIZATION',
        resourceId: organizationId,
        metadata: {
          fields: Object.keys(changes),
        },
        createdAt: timestamp,
      };

      await getRepository().transactWrite({
        TransactItems: [
          {
            Update: {
              Key: organizationProfileKey(organizationId),
              UpdateExpression: `SET ${assignments.join(', ')}`,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
              ConditionExpression:
                'attribute_exists(PK) AND attribute_exists(SK)',
            },
          },
          {
            Put: {
              Item: auditItem,
              ConditionExpression:
                'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
        ],
      });

      return toOrganizationDto({
        ...existing,
        ...changes,
        updatedAt: timestamp,
      });
    },
  };
}

module.exports = {
  createOrganizationService,
};
