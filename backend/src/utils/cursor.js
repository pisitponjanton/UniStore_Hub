'use strict';

const { AppError } = require('../errors/app-error');

const CURSOR_VERSION = 1;

function invalidCursor() {
  return new AppError({
    code: 'INVALID_CURSOR',
    message: 'Invalid cursor',
    httpStatus: 400,
  });
}

function encodeCursor(scope, state) {
  if (typeof scope !== 'string' || scope.length === 0) {
    throw invalidCursor();
  }

  if (state === undefined || state === null || typeof state !== 'object') {
    throw invalidCursor();
  }

  const payload = JSON.stringify({
    v: CURSOR_VERSION,
    scope,
    state,
  });

  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeCursor(cursor, expectedScope) {
  if (cursor === undefined || cursor === null || cursor === '') {
    return null;
  }

  if (typeof cursor !== 'string') {
    throw invalidCursor();
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded);

    if (
      payload === null ||
      typeof payload !== 'object' ||
      payload.v !== CURSOR_VERSION ||
      typeof payload.scope !== 'string' ||
      payload.scope.length === 0 ||
      payload.state === null ||
      typeof payload.state !== 'object'
    ) {
      throw invalidCursor();
    }

    if (
      typeof expectedScope === 'string' &&
      expectedScope.length > 0 &&
      payload.scope !== expectedScope
    ) {
      throw invalidCursor();
    }

    return payload.state;
  } catch (error) {
    if (error instanceof AppError && error.code === 'INVALID_CURSOR') {
      throw error;
    }

    throw invalidCursor();
  }
}

module.exports = {
  CURSOR_VERSION,
  encodeCursor,
  decodeCursor,
};
