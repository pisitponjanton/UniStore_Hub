const DEFAULTS = Object.freeze({
  apiBaseUrl: 'http://localhost:4000/api/v1',
  backendBaseUrl: 'http://localhost:4000',
  frontendBaseUrl: 'http://localhost:3000',
  awsEndpointUrl: 'http://localhost:4566',
  awsRegion: 'us-east-1',
  appTableName: 'unistore-hub-dev-local',
  filesBucketName: 'unistore-hub-files-local',
  requestTimeoutMs: 5000,
});

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}

function positiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

export function loadTestEnv(overrides = {}, source = process.env) {
  const backendBaseUrl = trimTrailingSlash(
    overrides.backendBaseUrl ?? source.TEST_BACKEND_BASE_URL ?? DEFAULTS.backendBaseUrl,
  );

  const apiBaseUrl = trimTrailingSlash(
    overrides.apiBaseUrl ??
      source.TEST_API_BASE_URL ??
      `${backendBaseUrl}/api/v1`,
  );

  const frontendBaseUrl = trimTrailingSlash(
    overrides.frontendBaseUrl ??
      source.TEST_FRONTEND_BASE_URL ??
      DEFAULTS.frontendBaseUrl,
  );

  return Object.freeze({
    apiBaseUrl,
    backendBaseUrl,
    healthUrl: trimTrailingSlash(
      overrides.healthUrl ?? source.TEST_HEALTH_URL ?? `${backendBaseUrl}/health`,
    ),
    frontendBaseUrl,
    awsEndpointUrl: trimTrailingSlash(
      overrides.awsEndpointUrl ??
        source.TEST_AWS_ENDPOINT_URL ??
        source.AWS_ENDPOINT_URL ??
        DEFAULTS.awsEndpointUrl,
    ),
    awsRegion:
      overrides.awsRegion ??
      source.TEST_AWS_REGION ??
      source.AWS_REGION ??
      DEFAULTS.awsRegion,
    appTableName:
      overrides.appTableName ??
      source.TEST_APP_TABLE_NAME ??
      source.APP_TABLE_NAME ??
      DEFAULTS.appTableName,
    filesBucketName:
      overrides.filesBucketName ??
      source.TEST_FILES_BUCKET_NAME ??
      source.FILES_BUCKET_NAME ??
      DEFAULTS.filesBucketName,
    notificationQueueUrl:
      overrides.notificationQueueUrl ??
      source.TEST_NOTIFICATION_QUEUE_URL ??
      source.NOTIFICATION_QUEUE_URL ??
      null,
    requestTimeoutMs: positiveInteger(
      overrides.requestTimeoutMs ?? source.TEST_REQUEST_TIMEOUT_MS,
      DEFAULTS.requestTimeoutMs,
    ),
    fixtureSeed:
      overrides.fixtureSeed ??
      source.TEST_FIXTURE_SEED ??
      'local',
  });
}

export function isLoopbackUrl(value) {
  const url = new URL(value);
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

export const testEnvDefaults = DEFAULTS;
