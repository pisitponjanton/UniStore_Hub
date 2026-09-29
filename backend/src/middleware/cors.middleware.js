'use strict';

const { config } = require('../config');

const CORS_ALLOWED_METHODS =
  'GET,POST,PATCH,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS =
  'Authorization,Content-Type,X-Request-Id';

function appendVary(res, value) {
  const current = res.getHeader('Vary');

  if (!current) {
    res.setHeader('Vary', value);
    return;
  }

  const values = String(current)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!values.includes(value)) {
    values.push(value);
    res.setHeader('Vary', values.join(', '));
  }
}

function createCorsMiddleware(options = {}) {
  const allowedOrigins = new Set(
    options.allowedOrigins ??
      config.corsAllowedOrigins,
  );

  return function corsMiddleware(
    req,
    res,
    next,
  ) {
    const origin = req.get('origin');

    if (!origin) {
      return next();
    }

    appendVary(res, 'Origin');

    if (!allowedOrigins.has(origin)) {
      return next();
    }

    res.setHeader(
      'Access-Control-Allow-Origin',
      origin,
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      CORS_ALLOWED_METHODS,
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      CORS_ALLOWED_HEADERS,
    );

    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }

    return next();
  };
}

module.exports = {
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
  appendVary,
  createCorsMiddleware,
};
