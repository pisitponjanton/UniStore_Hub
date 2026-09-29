'use strict';

const { AppError } = require('../../errors/app-error');
const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const { createUserRepository } = require('../users/user.repository');
const { toUserDto } = require('../users/user.mapper');
const { USER_STATUS } = require('./auth.constants');
const { normalizeEmail } = require('./auth.utils');
const { createJwtService } = require('./jwt.service');
const { createPasswordService } = require('./password.service');

function invalidCredentials() {
  return new AppError({
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    httpStatus: 401,
  });
}

function createAuthService(options = {}) {
  const userRepository =
    options.userRepository || createUserRepository(options.userRepositoryOptions);
  const passwordService =
    options.passwordService || createPasswordService(options.passwordOptions);
  let jwtService = options.jwtService;

  function getJwtService() {
    if (!jwtService) {
      jwtService = createJwtService(options.jwtOptions);
    }

    return jwtService;
  }

  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;

  return {
    async register({ email, password, name }) {
      const normalizedEmail = normalizeEmail(email);
      const existingUser = await userRepository.findByEmail(normalizedEmail);

      if (existingUser) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Email is already registered',
          httpStatus: 409,
        });
      }

      const timestamp = clock();
      const passwordHash = await passwordService.hash(password);
      const user = {
        userId: idFactory(),
        email: normalizedEmail,
        passwordHash,
        name,
        status: USER_STATUS.ACTIVE,
        platformRole: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await userRepository.createUserWithPlatformLink(user);

      const jwt = getJwtService();

      return {
        user: toUserDto(user),
        token: jwt.issue(user),
        expiresIn: jwt.expiresIn,
      };
    },

    async login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = await userRepository.findByEmail(normalizedEmail);

      if (!user) {
        throw invalidCredentials();
      }

      if (user.status === USER_STATUS.DISABLED) {
        throw new AppError({
          code: 'USER_DISABLED',
          message: 'User is disabled',
          httpStatus: 403,
        });
      }

      const passwordMatches = await passwordService.verify(
        password,
        user.passwordHash,
      );

      if (!passwordMatches) {
        throw invalidCredentials();
      }

      const jwt = getJwtService();

      return {
        user: toUserDto(user),
        token: jwt.issue(user),
        expiresIn: jwt.expiresIn,
      };
    },
  };
}

module.exports = {
  createAuthService,
};
