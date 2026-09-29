'use strict';

const { AppError } = require('../errors/app-error');
const { createJwtService } = require('../modules/auth/jwt.service');
const { USER_STATUS } = require('../modules/auth/auth.constants');
const { createUserRepository } = require('../modules/users/user.repository');

function authRequired() {
  return new AppError({
    code: 'AUTH_REQUIRED',
    message: 'Authentication required',
    httpStatus: 401,
  });
}

function tokenInvalid() {
  return new AppError({
    code: 'TOKEN_INVALID',
    message: 'Invalid token',
    httpStatus: 401,
  });
}

function createAuthMiddleware(options = {}) {
  let jwtService = options.jwtService;
  let userRepository = options.userRepository;

  function getJwtService() {
    if (!jwtService) {
      jwtService = createJwtService(options.jwtOptions);
    }

    return jwtService;
  }

  function getUserRepository() {
    if (!userRepository) {
      userRepository = createUserRepository(options.userRepositoryOptions);
    }

    return userRepository;
  }

  return async function authMiddleware(req, res, next) {
    try {
      const authorization = req.get('authorization');

      if (!authorization) {
        throw authRequired();
      }

      const [scheme, token, ...extra] = authorization.trim().split(/\s+/);

      if (
        scheme?.toLowerCase() !== 'bearer' ||
        !token ||
        extra.length > 0
      ) {
        throw authRequired();
      }

      const claims = getJwtService().verify(token);

      if (typeof claims?.sub !== 'string' || claims.sub.length === 0) {
        throw tokenInvalid();
      }

      const user = await getUserRepository().getById(claims.sub);

      if (!user) {
        throw tokenInvalid();
      }

      if (user.status === USER_STATUS.DISABLED) {
        throw new AppError({
          code: 'USER_DISABLED',
          message: 'User is disabled',
          httpStatus: 403,
        });
      }

      req.auth = {
        userId: user.userId,
        email: user.email,
        claims,
      };

      req.user = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        status: user.status,
        platformRole: user.platformRole ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  createAuthMiddleware,
};
