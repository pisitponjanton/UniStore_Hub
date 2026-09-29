'use strict';

const path = require('node:path');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: path.resolve(process.cwd(), '.env.local'),
    quiet: true,
  });
}

function getEnv(name, options = {}) {
  const { required = false, defaultValue } = options;
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    if (required) {
      const error = new Error(`Missing required environment variable: ${name}`);
      error.code = 'CONFIG_MISSING';
      throw error;
    }

    return defaultValue;
  }

  return rawValue;
}

function parsePort(value) {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error('PORT must be an integer between 1 and 65535');
    error.code = 'CONFIG_INVALID';
    throw error;
  }

  return port;
}

function parseOrigins(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function loadConfig() {
  const nodeEnv = getEnv('NODE_ENV', { defaultValue: 'development' });

  return {
    nodeEnv,
    port: parsePort(getEnv('PORT', { defaultValue: '4000' })),
    corsAllowedOrigins: parseOrigins(
      getEnv('CORS_ALLOWED_ORIGINS', {
        defaultValue: nodeEnv === 'production' ? '' : 'http://localhost:3000',
      }),
    ),
    awsRegion: getEnv('AWS_REGION', { defaultValue: 'us-east-1' }),
    awsEndpointUrl: getEnv('AWS_ENDPOINT_URL'),
    appTableName: getEnv('APP_TABLE_NAME'),
    filesBucketName: getEnv('FILES_BUCKET_NAME'),
    notificationQueueUrl: getEnv('NOTIFICATION_QUEUE_URL'),
    jwtSecret: getEnv('JWT_SECRET'),
    jwtExpiresIn: getEnv('JWT_EXPIRES_IN', { defaultValue: '1d' }),
  };
}

const config = loadConfig();

module.exports = {
  config,
  getEnv,
  loadConfig,
};
