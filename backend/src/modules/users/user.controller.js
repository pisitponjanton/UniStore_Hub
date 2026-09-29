'use strict';

const { sendSuccess } = require('../../utils/response');
const { createMemberRepository } = require('../members/member.repository');

function createUserController(options = {}) {
  const memberRepository =
    options.memberRepository || createMemberRepository(options.memberRepositoryOptions);

  return {
    async getMe(req, res, next) {
      try {
        const memberships = await memberRepository.listForUser(req.user.userId);

        return sendSuccess(res, {
          user: {
            userId: req.user.userId,
            email: req.user.email,
            name: req.user.name,
            status: req.user.status,
            platformRole: req.user.platformRole ?? null,
          },
          memberships: memberships.map((membership) => ({
            organizationId: membership.organizationId,
            role: membership.role,
            status: membership.status,
          })),
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createUserController,
};
