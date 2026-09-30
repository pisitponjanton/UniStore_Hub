'use strict';

const { AppError } = require('../errors/app-error');
const {
  USER_STATUS,
} = require('../modules/auth/auth.constants');
const {
  MEMBERSHIP_STATUS,
} = require('../modules/members/member.constants');
const {
  createMemberRepository,
} = require('../modules/members/member.repository');
const {
  createOrganizationRepository,
} = require('../modules/organizations/organization.repository');
const {
  PLATFORM_ROLE,
} = require('../modules/platform-admin/platform-admin.constants');
const {
  createUserRepository,
} = require('../modules/users/user.repository');
const {
  requireActiveMembership,
  requireActiveOrganization,
  requireOrganizationRole,
  requireTenantMatch,
} = require('../policies/organization.policy');

function createOrganizationContextMiddleware(options = {}) {
  let organizationRepository = options.organizationRepository;

  function getOrganizationRepository() {
    if (!organizationRepository) {
      organizationRepository = createOrganizationRepository(
        options.organizationRepositoryOptions,
      );
    }

    return organizationRepository;
  }

  return async function organizationContextMiddleware(req, res, next) {
    try {
      const organizationId = req.params.organizationId;

      if (typeof organizationId !== 'string' || organizationId.length === 0) {
        throw new AppError({
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          httpStatus: 404,
        });
      }

      const organization =
        await getOrganizationRepository().getById(organizationId);

      if (!organization) {
        throw new AppError({
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          httpStatus: 404,
        });
      }

      requireTenantMatch(organization, organizationId);
      req.organization = organization;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function createOrganizationMembershipMiddleware(options = {}) {
  let memberRepository = options.memberRepository;

  function getMemberRepository() {
    if (!memberRepository) {
      memberRepository = createMemberRepository(options.memberRepositoryOptions);
    }

    return memberRepository;
  }

  return async function organizationMembershipMiddleware(req, res, next) {
    try {
      if (!req.user?.userId || !req.organization?.organizationId) {
        throw new AppError({
          code: 'MEMBERSHIP_REQUIRED',
          message: 'Active organization membership required',
          httpStatus: 403,
        });
      }

      const membership =
        await getMemberRepository().getByOrganizationAndUser(
          req.organization.organizationId,
          req.user.userId,
        );

      requireActiveMembership(membership);
      requireTenantMatch(membership, req.organization.organizationId);

      req.membership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function createOrganizationProfileAccessMiddleware(
  options = {},
) {
  const allowedOrganizationRoles =
    options.allowedOrganizationRoles || [];
  let memberRepository = options.memberRepository;
  let userRepository = options.userRepository;

  function getMemberRepository() {
    if (!memberRepository) {
      memberRepository = createMemberRepository(
        options.memberRepositoryOptions,
      );
    }

    return memberRepository;
  }

  function getUserRepository() {
    if (!userRepository) {
      userRepository = createUserRepository(
        options.userRepositoryOptions,
      );
    }

    return userRepository;
  }

  return async function organizationProfileAccessMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const userId = req.user?.userId;
      const organizationId =
        req.organization?.organizationId;

      if (!userId) {
        throw new AppError({
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
          httpStatus: 401,
        });
      }

      if (!organizationId) {
        throw new AppError({
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          httpStatus: 404,
        });
      }

      const membership =
        await getMemberRepository().getByOrganizationAndUser(
          organizationId,
          userId,
        );

      if (membership) {
        requireTenantMatch(
          membership,
          organizationId,
        );

        if (
          membership.status ===
            MEMBERSHIP_STATUS.ACTIVE &&
          allowedOrganizationRoles.includes(
            membership.role,
          )
        ) {
          req.membership = membership;
          return next();
        }
      }

      const persistedUser =
        await getUserRepository().getById(userId);

      if (
        persistedUser?.status ===
        USER_STATUS.DISABLED
      ) {
        throw new AppError({
          code: 'USER_DISABLED',
          message: 'User is disabled',
          httpStatus: 403,
        });
      }

      if (
        persistedUser?.platformRole ===
        PLATFORM_ROLE.PLATFORM_ADMIN
      ) {
        req.user = {
          userId: persistedUser.userId,
          email: persistedUser.email,
          name: persistedUser.name,
          status: persistedUser.status,
          platformRole:
            persistedUser.platformRole,
          createdAt: persistedUser.createdAt,
          updatedAt: persistedUser.updatedAt,
        };


        return next();
      }

      if (membership) {
        requireOrganizationRole(
          membership,
          allowedOrganizationRoles,
        );
      }

      requireActiveMembership(membership);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireOrganizationRoles(...allowedRoles) {
  return function organizationRoleMiddleware(req, res, next) {
    try {
      requireOrganizationRole(req.membership, allowedRoles);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireOperationalOrganization(req, res, next) {
  try {
    requireActiveOrganization(req.organization);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrganizationContextMiddleware,
  createOrganizationMembershipMiddleware,
  createOrganizationProfileAccessMiddleware,
  requireOrganizationRoles,
  requireOperationalOrganization,
};
