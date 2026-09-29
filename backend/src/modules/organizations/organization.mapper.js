'use strict';

function toOrganizationDto(organization) {
  if (!organization) {
    return null;
  }

  return {
    organizationId: organization.organizationId,
    name: organization.name,
    description: organization.description,
    status: organization.status,
    createdBy: organization.createdBy,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

module.exports = {
  toOrganizationDto,
};
