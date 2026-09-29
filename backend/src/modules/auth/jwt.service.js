'use strict';

const jwt = require('jsonwebtoken');

const { config } = require('../../config');
const { AppError } = require('../../errors/app-error');

function requireJwtSecret(secret = config.jwtSecret) {
  if (!secret) {
    const error = new Error('JWT_SECRET is required for JWT operations');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return secret;
}

function createJwtService(options = {}) {
  const secret = requireJwtSecret(options.secret);
  const expiresIn = options.expiresIn ?? config.jwtExpiresIn ?? '1d';

  return {
    expiresIn,

    issue(user) {
      return jwt.sign(
        {
          sub: user.userId,
          email: user.email,
        },
        secret,
        {
          expiresIn,
        },
      );
    },

    verify(token) {
      try {
        return jwt.verify(token, secret);
      } catch (error) {
        if (error?.name === 'TokenExpiredError') {
          throw new AppError({
            code: 'TOKEN_EXPIRED',
            message: 'Token expired',
            httpStatus: 401,
            cause: error,
          });
        }

        throw new AppError({
          code: 'TOKEN_INVALID',
          message: 'Invalid token',
          httpStatus: 401,
          cause: error,
        });
      }
    },
  };
}

module.exports = {
  createJwtService,
  requireJwtSecret,
};
