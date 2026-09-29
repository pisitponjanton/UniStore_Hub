'use strict';

const { createDynamoRepository } = require('../../aws/dynamodb');
const { AppError } = require('../../errors/app-error');
const {
  auditKey,
  membershipUserIndex,
  organizationMemberKey,
} = require('../../repositories/keys');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const {
  createUserRepository,
} = require('../users/user.repository');
const {
  MEMBERSHIP_STATUS,
  ORGANIZATION_ROLE,
} = require('./member.constants');
const { toMemberDto } = require('./member.mapper');
const { createMemberRepository } = require('./member.repository');

function memberNotFound() {
  return new AppError({
    code: 'MEMBER_NOT_FOUND',
    message: 'Organization member not found',
    httpStatus: 404,
  });
}

function lastOrganizationAdmin() {
  return new AppError({
    code: 'LAST_ORGANIZATION_ADMIN',
    message: 'Organization must keep at least one active Organization Admin',
    httpStatus: 409,
  });
}

function createMemberService(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;

  let repository = options.repository;
  let memberRepository = options.memberRepository;
  let userRepository = options.userRepository;

  function getRepository() {
    if (!repository) {
      repository = createDynamoRepository();
    }

    return repository;
  }

  function getMemberRepository() {
    if (!memberRepository) {
      memberRepository = createMemberRepository({
        repository: getRepository(),
      });
    }

    return memberRepository;
  }

  function getUserRepository() {
    if (!userRepository) {
      userRepository = createUserRepository({
        repository: getRepository(),
      });
    }

    return userRepository;
  }

  async function loadMemberDto(membership) {
    const user = await getUserRepository().getById(membership.userId);
    return toMemberDto(membership, user);
  }

  async function findOtherActiveAdmin(organizationId, excludedUserId) {
    const memberships =
      await getMemberRepository().listByOrganization(organizationId);

    return memberships.find(
      (membership) =>
        membership.userId !== excludedUserId &&
        membership.status === MEMBERSHIP_STATUS.ACTIVE &&
        membership.role === ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    );
  }

  function makeAudit({
    organizationId,
    actorId,
    action,
    resourceId,
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
      resourceType: 'ORGANIZATION_MEMBER',
      resourceId,
      metadata: metadata || {},
      createdAt: timestamp,
    };
  }

  return {
    async listMembers(organizationId) {
      const memberships =
        await getMemberRepository().listByOrganization(organizationId);

      return Promise.all(memberships.map(loadMemberDto));
    },

    async addMember({ organizationId, actorId, email, role }) {
      const user = await getUserRepository().findByEmail(email);

      if (!user) {
        throw new AppError({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          httpStatus: 404,
        });
      }

      const existing =
        await getMemberRepository().getByOrganizationAndUser(
          organizationId,
          user.userId,
        );

      if (existing?.status === MEMBERSHIP_STATUS.ACTIVE) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'User is already an active organization member',
          httpStatus: 409,
        });
      }

      const timestamp = clock();
      const membership = existing
        ? {
            ...existing,
            role,
            status: MEMBERSHIP_STATUS.ACTIVE,
            updatedAt: timestamp,
          }
        : {
            organizationId,
            userId: user.userId,
            role,
            status: MEMBERSHIP_STATUS.ACTIVE,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'MEMBER_ADDED',
        resourceId: user.userId,
        metadata: { role },
        timestamp,
      });

      if (existing) {
        await getRepository().transactWrite({
          TransactItems: [
            {
              Update: {
                Key: organizationMemberKey(organizationId, user.userId),
                UpdateExpression:
                  'SET #role = :role, #status = :active, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                  '#role': 'role',
                  '#status': 'status',
                  '#updatedAt': 'updatedAt',
                },
                ExpressionAttributeValues: {
                  ':role': role,
                  ':active': MEMBERSHIP_STATUS.ACTIVE,
                  ':inactive': MEMBERSHIP_STATUS.INACTIVE,
                  ':updatedAt': timestamp,
                },
                ConditionExpression: '#status = :inactive',
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
      } else {
        const membershipItem = {
          ...organizationMemberKey(organizationId, user.userId),
          ...membershipUserIndex(user.userId, organizationId),
          entityType: 'OrganizationMember',
          ...membership,
        };

        await getRepository().transactWrite({
          TransactItems: [
            {
              Put: {
                Item: membershipItem,
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
      }

      return toMemberDto(membership, user);
    },

    async updateRole({ organizationId, userId, actorId, role }) {
      const membership =
        await getMemberRepository().getByOrganizationAndUser(
          organizationId,
          userId,
        );

      if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
        throw memberNotFound();
      }

      let adminWitness = null;

      if (
        membership.role === ORGANIZATION_ROLE.ORGANIZATION_ADMIN &&
        role !== ORGANIZATION_ROLE.ORGANIZATION_ADMIN
      ) {
        adminWitness = await findOtherActiveAdmin(organizationId, userId);

        if (!adminWitness) {
          throw lastOrganizationAdmin();
        }
      }

      const timestamp = clock();
      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'MEMBER_ROLE_UPDATED',
        resourceId: userId,
        metadata: {
          fromRole: membership.role,
          toRole: role,
        },
        timestamp,
      });

      const transactItems = [];

      if (adminWitness) {
        transactItems.push({
          ConditionCheck: {
            Key: organizationMemberKey(
              organizationId,
              adminWitness.userId,
            ),
            ConditionExpression: '#status = :active AND #role = :admin',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#role': 'role',
            },
            ExpressionAttributeValues: {
              ':active': MEMBERSHIP_STATUS.ACTIVE,
              ':admin': ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
            },
          },
        });
      }

      transactItems.push(
        {
          Update: {
            Key: organizationMemberKey(organizationId, userId),
            UpdateExpression:
              'SET #role = :role, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#role': 'role',
              '#status': 'status',
              '#updatedAt': 'updatedAt',
            },
            ExpressionAttributeValues: {
              ':role': role,
              ':active': MEMBERSHIP_STATUS.ACTIVE,
              ':currentRole': membership.role,
              ':updatedAt': timestamp,
            },
            ConditionExpression:
              '#status = :active AND #role = :currentRole',
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

      await getRepository().transactWrite({
        TransactItems: transactItems,
      });

      const user = await getUserRepository().getById(userId);

      return toMemberDto(
        {
          ...membership,
          role,
          updatedAt: timestamp,
        },
        user,
      );
    },

    async removeMember({ organizationId, userId, actorId }) {
      const membership =
        await getMemberRepository().getByOrganizationAndUser(
          organizationId,
          userId,
        );

      if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
        throw memberNotFound();
      }

      let adminWitness = null;

      if (membership.role === ORGANIZATION_ROLE.ORGANIZATION_ADMIN) {
        adminWitness = await findOtherActiveAdmin(organizationId, userId);

        if (!adminWitness) {
          throw lastOrganizationAdmin();
        }
      }

      const timestamp = clock();
      const audit = makeAudit({
        organizationId,
        actorId,
        action: 'MEMBER_REMOVED',
        resourceId: userId,
        metadata: {
          role: membership.role,
        },
        timestamp,
      });

      const transactItems = [];

      if (adminWitness) {
        transactItems.push({
          ConditionCheck: {
            Key: organizationMemberKey(
              organizationId,
              adminWitness.userId,
            ),
            ConditionExpression: '#status = :active AND #role = :admin',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#role': 'role',
            },
            ExpressionAttributeValues: {
              ':active': MEMBERSHIP_STATUS.ACTIVE,
              ':admin': ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
            },
          },
        });
      }

      transactItems.push(
        {
          Update: {
            Key: organizationMemberKey(organizationId, userId),
            UpdateExpression:
              'SET #status = :inactive, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#role': 'role',
              '#updatedAt': 'updatedAt',
            },
            ExpressionAttributeValues: {
              ':inactive': MEMBERSHIP_STATUS.INACTIVE,
              ':active': MEMBERSHIP_STATUS.ACTIVE,
              ':currentRole': membership.role,
              ':updatedAt': timestamp,
            },
            ConditionExpression:
              '#status = :active AND #role = :currentRole',
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

      await getRepository().transactWrite({
        TransactItems: transactItems,
      });
    },
  };
}

module.exports = {
  createMemberService,
};
