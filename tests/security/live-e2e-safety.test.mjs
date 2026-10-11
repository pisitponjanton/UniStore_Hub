import test from 'node:test';
import assert from 'node:assert/strict';

import { assertLocalOnlyLiveE2eTarget } from '../e2e/live-e2e-helpers.mjs';

test('Live E2E safety guard accepts only canonical local API, SQS and LocalStack endpoints', () => {
  assert.doesNotThrow(() => assertLocalOnlyLiveE2eTarget(
    'http://127.0.0.1:4000/api/v1',
    {
      queueUrl: 'http://localhost:4566/000000000000/unistore-hub-notifications-local',
      endpoint: 'http://localhost:4566',
    },
  ));
});

test('Live E2E safety guard refuses non-local API and SQS endpoints', () => {
  assert.throws(
    () => assertLocalOnlyLiveE2eTarget('https://example.invalid/api/v1'),
    /Refusing destructive Live E2E/,
  );
  assert.throws(
    () => assertLocalOnlyLiveE2eTarget('http://127.0.0.1:4000/api/v1', {
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/unistore-hub-notifications-local',
      endpoint: 'http://localhost:4566',
    }),
    /SQS URL must point to the canonical local/,
  );
  assert.throws(
    () => assertLocalOnlyLiveE2eTarget('http://127.0.0.1:4000/api/v1', {
      queueUrl: 'http://localhost:4566/000000000000/another-queue',
    }),
    /SQS URL must point to the canonical local/,
  );
});

test('Live E2E safety guard refuses a non-local AWS endpoint', () => {
  assert.throws(
    () => assertLocalOnlyLiveE2eTarget('http://127.0.0.1:4000/api/v1', {
      endpoint: 'https://sqs.us-east-1.amazonaws.com',
    }),
    /AWS endpoint must point to loopback LocalStack/,
  );
});

test('Live E2E safety guard refuses non-canonical local service ports and paths', () => {
  for (const url of [
    'http://localhost:3000/api/v1',
    'http://127.0.0.1:5000/api/v1',
    'http://localhost:4000/health',
    'http://localhost:4000/api/v1/admin',
    'http://localstack:4000/api/v1',
    'http://user:pass@localhost:4000/api/v1',
    'http://localhost:4000/api/v1?token=abc',
  ]) {
    assert.throws(
      () => assertLocalOnlyLiveE2eTarget(url),
      /Refusing destructive Live E2E/,
      url,
    );
  }
});

test('Live E2E safety guard pins LocalStack port and exact queue path', () => {
  for (const endpoint of [
    'http://localhost:9999',
    'http://127.0.0.1:4000',
    'http://localhost:4566/admin',
  ]) {
    assert.throws(
      () => assertLocalOnlyLiveE2eTarget('http://localhost:4000/api/v1', { endpoint }),
      /AWS endpoint must point to loopback/,
      endpoint,
    );
  }
  for (const queueUrl of [
    'http://localhost:4567/000000000000/unistore-hub-notifications-local',
    'http://localhost:4566/000000000000/unistore-hub-notifications-local/extra',
    'http://localhost:4566/bad-id/unistore-hub-notifications-local',
  ]) {
    assert.throws(
      () => assertLocalOnlyLiveE2eTarget('http://localhost:4000/api/v1', { queueUrl }),
      /SQS URL must point to the canonical local/,
      queueUrl,
    );
  }
});
