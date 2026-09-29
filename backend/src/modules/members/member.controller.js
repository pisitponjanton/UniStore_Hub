'use strict';

const { sendList, sendSuccess } = require('../../utils/response');
const {
  validateAddMemberBody,
  validateUpdateMemberBody,
} = require('../../validators/member.validator');
const { createMemberService } = require('./member.service');

function createMemberController(options = {}) {
  const memberService =
    options.memberService || createMemberService(options);

  return {
    async list(req, res, next) {
      try {
        const items = await memberService.listMembers(
          req.params.organizationId,
        );

        return sendList(res, items, null);
      } catch (error) {
        return next(error);
      }
    },

    async add(req, res, next) {
      try {
        const input = validateAddMemberBody(req.body);
        const member = await memberService.addMember({
          organizationId: req.params.organizationId,
          actorId: req.user.userId,
          ...input,
        });

        return sendSuccess(res, member, 201);
      } catch (error) {
        return next(error);
      }
    },

    async updateRole(req, res, next) {
      try {
        const input = validateUpdateMemberBody(req.body);
        const member = await memberService.updateRole({
          organizationId: req.params.organizationId,
          userId: req.params.userId,
          actorId: req.user.userId,
          role: input.role,
        });

        return sendSuccess(res, member);
      } catch (error) {
        return next(error);
      }
    },

    async remove(req, res, next) {
      try {
        await memberService.removeMember({
          organizationId: req.params.organizationId,
          userId: req.params.userId,
          actorId: req.user.userId,
        });

        return res.status(204).send();
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createMemberController,
};
