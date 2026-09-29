'use strict';

const { AppError } = require('../errors/app-error');
const {
  ORGANIZATION_STATUS,
} = require('../modules/organizations/organization.constants');
const {
  MEMBERSHIP_STATUS,
} = require('../modules/members/member.constants');

function requireTenantMatch(resource, organizationId) {
  if (
    !resource ||
    typeof organizationId !== 'string' ||
    organizationId.length === 0 ||
    resource.organizationId !== organizationId
  ) {
    throw new AppError({
      code: 'TENANT_MISMATCH',
      message: 'Resource does not belong to this organization',
      httpStatus: 403,
    });
  }

  return resource;
}

function requireResourceOwnership(resource, userId, ownerField = 'customerId') {
  if (
    !resource ||
    typeof userId !== 'string' ||
    userId.length === 0 ||
    resource[ownerField] !== userId
  ) {
    throw new AppError({
      code: 'RESOURCE_OWNERSHIP_REQUIRED',
      message: 'Resource ownership required',
      httpStatus: 403,
    });
  }

  return resource;
}

function requireCustomerResourceAccess({
  resource,
  organizationId,
  userId,
  ownerField = 'customerId',
}) {
  requireTenantMatch(resource, organizationId);
  requireResourceOwnership(resource, userId, ownerField);
  return resource;
}

function requireActiveMembership(membership) {
  if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
    throw new AppError({
      code: 'MEMBERSHIP_REQUIRED',
      message: 'Active organization membership required',
      httpStatus: 403,
    });
  }

  return membership;
}

function requireOrganizationRole(membership, allowedRoles) {
  requireActiveMembership(membership);

  if (
    !Array.isArray(allowedRoles) ||
    allowedRoles.length === 0 ||
    !allowedRoles.includes(membership.role)
  ) {
    throw new AppError({
      code: 'ROLE_FORBIDDEN',
      message: 'Organization role does not permit this action',
      httpStatus: 403,
    });
  }

  return membership;
}

function requireActiveOrganization(organization) {
  if (!organization || organization.status !== ORGANIZATION_STATUS.ACTIVE) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: 'Organization is not active',
      httpStatus: 403,
    });
  }

  return organization;
}

module.exports = {
  requireTenantMatch,
  requireResourceOwnership,
  requireCustomerResourceAccess,
  requireActiveMembership,
  requireOrganizationRole,
  requireActiveOrganization,
};
