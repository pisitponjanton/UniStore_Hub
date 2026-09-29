'use strict';

function toMemberDto(membership, user) {
  if (!membership) {
    return null;
  }

  return {
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    user: user
      ? {
          userId: user.userId,
          email: user.email,
          name: user.name,
        }
      : null,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}

module.exports = {
  toMemberDto,
};
