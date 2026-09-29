'use strict';

const { sendSuccess } = require('../../utils/response');
const {
  validateLoginBody,
  validateRegisterBody,
} = require('../../validators/auth.validator');
const { createAuthService } = require('./auth.service');

function createAuthController(options = {}) {
  const authService = options.authService || createAuthService(options);

  return {
    async register(req, res, next) {
      try {
        const input = validateRegisterBody(req.body);
        const result = await authService.register(input);

        return sendSuccess(res, result, 201);
      } catch (error) {
        return next(error);
      }
    },

    async login(req, res, next) {
      try {
        const input = validateLoginBody(req.body);
        const result = await authService.login(input);

        return sendSuccess(res, result);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createAuthController,
};
