'use strict';

const { AppError } = require('../errors/app-error');
const {
  createMemberRepository,
} = require('../modules/members/member.repository');
const {
  createOrganizationRepository,
} = require('../modules/organizations/organization.repository');
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
  requireOrganizationRoles,
  requireOperationalOrganization,
};
