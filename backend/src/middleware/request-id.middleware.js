'use strict';

const { randomUUID } = require('node:crypto');

const MAX_REQUEST_ID_LENGTH = 128;

function requestIdMiddleware(req, res, next) {
  const incomingRequestId = req.get('x-request-id');
  const requestId =
    typeof incomingRequestId === 'string' &&
    incomingRequestId.length > 0 &&
    incomingRequestId.length <= MAX_REQUEST_ID_LENGTH
      ? incomingRequestId
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}

module.exports = {
  requestIdMiddleware,
};
