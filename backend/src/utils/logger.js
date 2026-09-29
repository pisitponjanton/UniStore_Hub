'use strict';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'jwt',
  'authorization',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'presignedUrl',
  'preSignedUrl',
  'url',
]);

function sanitizeContext(context = {}) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.has(key) ? '[REDACTED]' : value,
    ]),
  );
}

function write(level, message, context) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeContext(context),
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

const logger = {
  info(message, context) {
    write('info', message, context);
  },
  warn(message, context) {
    write('warn', message, context);
  },
  error(message, context) {
    write('error', message, context);
  },
};

module.exports = {
  logger,
  sanitizeContext,
};
