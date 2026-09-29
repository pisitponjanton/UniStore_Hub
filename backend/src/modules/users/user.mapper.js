'use strict';

function toUserDto(user) {
  if (!user) {
    return null;
  }

  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    status: user.status,
    platformRole: user.platformRole ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = {
  toUserDto,
};
