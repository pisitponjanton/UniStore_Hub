import { loadTestEnv } from './env.mjs';

export function withQuery(path, params = {}) {
  const [pathname, existingQuery = ''] = String(path).split('?');
  const search = new URLSearchParams(existingQuery);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function resolveUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(baseUrl).replace(/\/+$/, '');
  const suffix = String(path).replace(/^\/+/, '');
  return `${base}/${suffix}`;
}

async function parseBody(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text === '' ? null : text;
}

export async function requestJson({
  baseUrl = loadTestEnv().apiBaseUrl,
  path,
  method = 'GET',
  token,
  body,
  headers = {},
  timeoutMs = loadTestEnv().requestTimeoutMs,
  fetchImpl = globalThis.fetch,
}) {
  if (!path) throw new TypeError('requestJson requires path');
  if (typeof fetchImpl !== 'function') throw new TypeError('requestJson requires fetch');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const requestHeaders = new Headers(headers);
  requestHeaders.set('accept', 'application/json');

  if (token) requestHeaders.set('authorization', `Bearer ${token}`);

  let requestBody;
  if (body !== undefined) {
    requestHeaders.set('content-type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  try {
    const response = await fetchImpl(resolveUrl(baseUrl, path), {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      body: await parseBody(response),
    };
  } finally {
    clearTimeout(timeout);
  }
}
