'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const { AppError } = require('../src/errors/app-error');
const { normalizeError } = require('../src/middleware/error.middleware');
const { getEnv, loadConfig } = require('../src/config');
const { sanitizeContext } = require('../src/utils/logger');

function withEnvironment(overrides, callback) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('GET /health returns the canonical health envelope', async () => {
  const response = await request(createApp()).get('/health').expect(200);

  assert.deepEqual(response.body, {
    success: true,
    data: {
      status: 'ok',
    },
  });

  assert.equal(response.headers['x-powered-by'], undefined);
  assert.match(response.headers['x-request-id'], /^[0-9a-f-]{36}$/i);
});

test('request id middleware preserves a valid incoming request id', async () => {
  const response = await request(createApp())
    .get('/health')
    .set('x-request-id', 'test-request-123')
    .expect(200);

  assert.equal(response.headers['x-request-id'], 'test-request-123');
});

test('unknown routes use the standard error envelope', async () => {
  const response = await request(createApp()).get('/does-not-exist').expect(404);

  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Route not found',
    },
  });

  assert.equal('stack' in response.body.error, false);
  assert.equal('cause' in response.body.error, false);
});

test('malformed JSON is mapped to a safe validation error', async () => {
  const response = await request(createApp())
    .post('/api/v1/not-yet-implemented')
    .set('content-type', 'application/json')
    .send('{"broken":')
    .expect(400);

  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON request body',
    },
  });

  assert.equal(JSON.stringify(response.body).includes('SyntaxError'), false);
});

test('unexpected errors are normalized without exposing internal messages', () => {
  const normalized = normalizeError(
    new Error('database password accidentally appeared here'),
  );

  assert.ok(normalized instanceof AppError);
  assert.equal(normalized.code, 'INTERNAL_ERROR');
  assert.equal(normalized.httpStatus, 500);
  assert.equal(normalized.message, 'Internal server error');
  assert.equal(normalized.message.includes('password'), false);
});

test('operational AppError values remain stable through normalization', () => {
  const original = new AppError({
    code: 'ORDER_NOT_FOUND',
    message: 'Order not found',
    httpStatus: 404,
  });

  assert.equal(normalizeError(original), original);
});

test('logger context redacts known sensitive values', () => {
  const sanitized = sanitizeContext({
    requestId: 'request-1',
    password: 'plain-secret',
    passwordHash: 'hash-secret',
    token: 'jwt-secret',
    authorization: 'Bearer secret',
    url: 'https://signed.example/secret',
    organizationId: 'org-1',
  });

  assert.deepEqual(sanitized, {
    requestId: 'request-1',
    password: '[REDACTED]',
    passwordHash: '[REDACTED]',
    token: '[REDACTED]',
    authorization: '[REDACTED]',
    url: '[REDACTED]',
    organizationId: 'org-1',
  });
});

test('getEnv throws a stable configuration error for required missing values', () => {
  withEnvironment({ TEST_REQUIRED_CONFIG: undefined }, () => {
    assert.throws(
      () => getEnv('TEST_REQUIRED_CONFIG', { required: true }),
      (error) =>
        error.code === 'CONFIG_MISSING' &&
        error.message ===
          'Missing required environment variable: TEST_REQUIRED_CONFIG',
    );
  });
});

test('loadConfig supplies safe development defaults without AWS resource names', () => {
  withEnvironment(
    {
      NODE_ENV: 'development',
      PORT: undefined,
      CORS_ALLOWED_ORIGINS: undefined,
      AWS_ENDPOINT_URL: undefined,
      S3_BROWSER_ENDPOINT_URL: undefined,
      APP_TABLE_NAME: undefined,
      FILES_BUCKET_NAME: undefined,
      NOTIFICATION_QUEUE_URL: undefined,
      JWT_SECRET: undefined,
      JWT_EXPIRES_IN: undefined,
    },
    () => {
      const config = loadConfig();

      assert.equal(config.nodeEnv, 'development');
      assert.equal(config.port, 4000);
      assert.deepEqual(config.corsAllowedOrigins, ['http://localhost:3000']);
      assert.equal(config.awsRegion, process.env.AWS_REGION || 'us-east-1');
      assert.equal(config.awsEndpointUrl, undefined);
      assert.equal(config.s3BrowserEndpointUrl, undefined);
      assert.equal(config.appTableName, undefined);
      assert.equal(config.filesBucketName, undefined);
      assert.equal(config.notificationQueueUrl, undefined);
      assert.equal(config.jwtSecret, undefined);
      assert.equal(config.jwtExpiresIn, '1d');
    },
  );
});

test('loadConfig reads separate internal AWS and browser-facing S3 endpoints', () => {
  withEnvironment(
    {
      AWS_ENDPOINT_URL: 'http://localstack:4566',
      S3_BROWSER_ENDPOINT_URL: 'http://localhost:4566',
    },
    () => {
      const config = loadConfig();

      assert.equal(config.awsEndpointUrl, 'http://localstack:4566');
      assert.equal(
        config.s3BrowserEndpointUrl,
        'http://localhost:4566',
      );
    },
  );
});

test('loadConfig rejects an invalid local port', () => {
  withEnvironment({ PORT: 'not-a-port' }, () => {
    assert.throws(
      () => loadConfig(),
      (error) =>
        error.code === 'CONFIG_INVALID' &&
        error.message === 'PORT must be an integer between 1 and 65535',
    );
  });
});
