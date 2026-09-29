'use strict';

const { AppError } = require('../errors/app-error');
const { USER_STATUS } = require('../modules/auth/auth.constants');
const {
  PLATFORM_ROLE,
} = require('../modules/platform-admin/platform-admin.constants');
const {
  createUserRepository,
} = require('../modules/users/user.repository');

function createPlatformAdminMiddleware(options = {}) {
  let userRepository = options.userRepository;

  function getUserRepository() {
    if (!userRepository) {
      userRepository = createUserRepository(
        options.userRepositoryOptions,
      );
    }

    return userRepository;
  }

  return async function platformAdminMiddleware(
    req,
    res,
    next,
  ) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError({
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
          httpStatus: 401,
        });
      }

      const user =
        await getUserRepository().getById(
          userId,
        );

      if (!user) {
        throw new AppError({
          code: 'ROLE_FORBIDDEN',
          message:
            'Platform role does not permit this action',
          httpStatus: 403,
        });
      }

      if (user.status === USER_STATUS.DISABLED) {
        throw new AppError({
          code: 'USER_DISABLED',
          message: 'User is disabled',
          httpStatus: 403,
        });
      }

      if (
        user.platformRole !==
        PLATFORM_ROLE.PLATFORM_ADMIN
      ) {
        throw new AppError({
          code: 'ROLE_FORBIDDEN',
          message:
            'Platform role does not permit this action',
          httpStatus: 403,
        });
      }

      req.user = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        status: user.status,
        platformRole: user.platformRole,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createPlatformAdminMiddleware,
};
