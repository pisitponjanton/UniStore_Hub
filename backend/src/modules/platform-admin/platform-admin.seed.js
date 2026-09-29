'use strict';

const { createId } = require('../../utils/id');
const { nowIsoUtc } = require('../../utils/time');
const {
  validateEmail,
  validateName,
  validatePassword,
} = require('../../validators/auth.validator');
const {
  USER_STATUS,
} = require('../auth/auth.constants');
const {
  createPasswordService,
} = require('../auth/password.service');
const {
  toUserDto,
} = require('../users/user.mapper');
const {
  createUserRepository,
} = require('../users/user.repository');
const {
  PLATFORM_ROLE,
} = require('./platform-admin.constants');

function createPlatformAdminSeeder(options = {}) {
  const idFactory = options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;
  const passwordService =
    options.passwordService ||
    createPasswordService(
      options.passwordOptions,
    );
  const userRepository =
    options.userRepository ||
    createUserRepository(
      options.userRepositoryOptions,
    );

  return {
    async seed({
      email,
      password,
      name,
    }) {
      const normalizedEmail =
        validateEmail(email);
      const validPassword =
        validatePassword(password);
      const validName = validateName(name);
      const existing =
        await userRepository.findByEmail(
          normalizedEmail,
        );
      const timestamp = clock();

      if (existing) {
        const updated =
          await userRepository
            .setPlatformRoleAndEnsureLink(
              existing,
              {
                platformRole:
                  PLATFORM_ROLE.PLATFORM_ADMIN,
                updatedAt: timestamp,
              },
            );

        return {
          created: false,
          user: toUserDto(updated),
        };
      }

      const newPasswordHash =
        await passwordService.hash(
          validPassword,
        );
      const user = {
        userId: idFactory(),
        email: normalizedEmail,
        passwordHash: newPasswordHash,
        name: validName,
        status: USER_STATUS.ACTIVE,
        platformRole:
          PLATFORM_ROLE.PLATFORM_ADMIN,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await userRepository
        .createUserWithPlatformLink(user);

      return {
        created: true,
        user: toUserDto(user),
      };
    },
  };
}

module.exports = {
  createPlatformAdminSeeder,
};
