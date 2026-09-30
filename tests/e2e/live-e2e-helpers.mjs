import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../..');

function buildApiUrl(baseUrl, route) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  if (
    normalizedBase.endsWith('/api/v1') &&
    route.startsWith('/api/v1/')
  ) {
    return `${normalizedBase}${route.slice('/api/v1'.length)}`;
  }
  return `${normalizedBase}${route}`;
}

export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKxkAAAAASUVORK5CYII=',
  'base64',
);

export async function missingRepoFiles(relativePaths) {
  const missing = [];
  for (const relativePath of relativePaths) {
    try {
      await access(path.join(repoRoot, relativePath));
    } catch {
      missing.push(relativePath);
    }
  }
  return missing;
}

export async function apiJson(baseUrl, route, {
  method = 'GET',
  token,
  body,
  expectedStatus,
} = {}) {
  const response = await fetch(buildApiUrl(baseUrl, route), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  const raw = await response.text();
  let parsed = null;
  if (raw) parsed = JSON.parse(raw);

  if (expectedStatus !== undefined) {
    assert.equal(
      response.status,
      expectedStatus,
      `${method} ${route} expected ${expectedStatus}, got ${response.status}: ${raw}`,
    );
  } else {
    assert.ok(
      response.status >= 200 && response.status < 300,
      `${method} ${route} failed with ${response.status}: ${raw}`,
    );
  }

  if (response.status !== 204) {
    assert.equal(parsed?.success, true, `${method} ${route} must return success envelope`);
  }

  return {
    status: response.status,
    body: parsed,
    data: parsed?.data,
  };
}

export async function registerAndLogin(baseUrl, { email, password, name }) {
  await apiJson(baseUrl, '/api/v1/auth/register', {
    method: 'POST',
    body: { email, password, name },
    expectedStatus: 201,
  });

  const login = await apiJson(baseUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
    expectedStatus: 200,
  });

  assert.equal(typeof login.data?.token, 'string');
  assert.ok(login.data.token.length > 0);
  return login.data;
}

export async function uploadPaymentSlip(baseUrl, {
  organizationId,
  orderId,
  customerToken,
}) {
  const upload = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/orders/${orderId}/payment-slip-upload-url`,
    {
      method: 'POST',
      token: customerToken,
      body: { contentType: 'image/png' },
      expectedStatus: 200,
    },
  );

  assert.equal(upload.data.method, 'PUT');
  assert.equal(upload.data.expiresInSeconds, 900);
  assert.match(
    upload.data.objectKey,
    new RegExp(`^payments/${organizationId}/${orderId}/`),
  );

  const putResponse = await fetch(upload.data.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: tinyPng,
    signal: AbortSignal.timeout(15000),
  });
  const putBody = await putResponse.text();

  assert.ok(
    putResponse.ok,
    `Pre-signed Payment Slip PUT failed: ${putResponse.status}: ${putBody}`,
  );

  return upload.data.objectKey;
}

export async function waitForNotification(baseUrl, token, {
  type,
  resourceId,
  attempts = 20,
}) {
  for (let i = 0; i < attempts; i += 1) {
    const response = await apiJson(baseUrl, '/api/v1/notifications?read=false', {
      token,
      expectedStatus: 200,
    });

    const items = response.data?.items || [];
    const match = items.find(
      (item) =>
        item.type === type &&
        (resourceId === undefined || item.resourceId === resourceId),
    );
    if (match) return match;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  assert.fail(`${type} notification did not arrive within polling window`);
}

export async function listAuditItems(baseUrl, token, organizationId, query) {
  const search = new URLSearchParams(query);
  const response = await apiJson(
    baseUrl,
    `/api/v1/organizations/${organizationId}/audit-logs?${search.toString()}`,
    {
      token,
      expectedStatus: 200,
    },
  );

  return response.data?.items || [];
}


export async function apiError(baseUrl, route, {
  method = 'GET',
  token,
  body,
  allowedStatuses = [403, 404],
} = {}) {
  const response = await fetch(buildApiUrl(baseUrl, route), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  const raw = await response.text();
  let parsed = null;
  if (raw) parsed = JSON.parse(raw);

  assert.ok(
    allowedStatuses.includes(response.status),
    `${method} ${route} expected one of ${allowedStatuses.join(', ')}, got ${response.status}: ${raw}`,
  );
  assert.equal(parsed?.success, false, `${method} ${route} must return error envelope`);
  assert.equal(typeof parsed?.error?.code, 'string');
  assert.equal(typeof parsed?.error?.message, 'string');

  return {
    status: response.status,
    body: parsed,
    error: parsed?.error,
  };
}

export async function markNotificationRead(baseUrl, token, notificationId) {
  return apiJson(
    baseUrl,
    `/api/v1/notifications/${notificationId}/read`,
    {
      method: 'PATCH',
      token,
      expectedStatus: 200,
    },
  );
}
