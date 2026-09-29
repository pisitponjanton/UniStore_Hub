'use strict';

const { createAuthService } = require('./auth.service');
const { USER_STATUS } = require('./auth.constants');
const { normalizeEmail } = require('./auth.utils');
const { createJwtService, requireJwtSecret } = require('./jwt.service');
const {
  DEFAULT_BCRYPT_ROUNDS,
  createPasswordService,
} = require('./password.service');

module.exports = {
  createAuthService,
  USER_STATUS,
  normalizeEmail,
  createJwtService,
  requireJwtSecret,
  DEFAULT_BCRYPT_ROUNDS,
  createPasswordService,
};
