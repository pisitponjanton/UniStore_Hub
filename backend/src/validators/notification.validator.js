'use strict';

const { AppError } = require('../errors/app-error');

function validationError(message) {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
  });
}

function validateReadFilter(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw validationError(
    'read must be true or false',
  );
}

function validateNotificationListQuery(
  query = {},
) {
  if (
    query.cursor !== undefined &&
    typeof query.cursor !== 'string'
  ) {
    throw validationError(
      'cursor must be a string',
    );
  }

  return {
    read: validateReadFilter(
      query.read,
    ),
    cursor: query.cursor,
  };
}

module.exports = {
  validateReadFilter,
  validateNotificationListQuery,
};
