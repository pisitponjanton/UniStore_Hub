'use strict';

const bcrypt = require('bcryptjs');

const DEFAULT_BCRYPT_ROUNDS = 12;

function createPasswordService(options = {}) {
  const rounds = options.rounds ?? DEFAULT_BCRYPT_ROUNDS;

  return {
    hash(password) {
      return bcrypt.hash(password, rounds);
    },

    verify(password, passwordHash) {
      return bcrypt.compare(password, passwordHash);
    },
  };
}

module.exports = {
  DEFAULT_BCRYPT_ROUNDS,
  createPasswordService,
};
