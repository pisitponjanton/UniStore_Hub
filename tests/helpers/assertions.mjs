import assert from 'node:assert/strict';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function assertHttpStatus(result, expectedStatus) {
  assert.equal(result.status, expectedStatus, `Expected HTTP ${expectedStatus}, got ${result.status}`);
}

export function assertSuccessEnvelope(body) {
  assert.equal(body?.success, true, 'Expected success=true envelope');
  assert.ok(Object.hasOwn(body, 'data'), 'Success envelope must contain data');
  return body.data;
}

export function assertListEnvelope(body) {
  const data = assertSuccessEnvelope(body);
  assert.equal(typeof data, 'object', 'Paginated list data must be an object');
  assert.ok(Array.isArray(data.items), 'Paginated list data.items must be an array');
  assert.ok(Object.hasOwn(data, 'nextCursor'), 'Paginated list data must contain nextCursor');
  return data;
}

export function assertErrorEnvelope(body, expectedCode) {
  assert.equal(body?.success, false, 'Expected success=false envelope');
  assert.equal(typeof body?.error, 'object', 'Error envelope must contain error object');
  assert.equal(typeof body.error.message, 'string', 'Error envelope must contain error.message');

  if (expectedCode !== undefined) {
    assert.equal(body.error.code, expectedCode);
  } else {
    assert.equal(typeof body.error.code, 'string', 'Error envelope must contain error.code');
  }

  return body.error;
}

export function assertUuidV4(value, label = 'id') {
  assert.match(String(value), UUID_V4, `${label} must be UUID v4`);
}

export function assertIsoUtcTimestamp(value, label = 'timestamp') {
  assert.match(String(value), ISO_UTC_MILLIS, `${label} must be ISO 8601 UTC with milliseconds`);
  assert.equal(new Date(value).toISOString(), value, `${label} must be canonical UTC ISO`);
}

export function assertIntegerSatang(value, label = 'money') {
  assert.equal(Number.isInteger(value), true, `${label} must be integer satang`);
}

export function assertNoStorageFields(value, {
  forbidden = ['PK', 'SK', 'GSI1PK', 'GSI1SK'],
} = {}) {
  const visit = (node, path = 'body') => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    for (const key of forbidden) {
      assert.equal(
        Object.hasOwn(node, key),
        false,
        `Undocumented storage field ${key} leaked at ${path}`,
      );
    }

    for (const [key, child] of Object.entries(node)) {
      visit(child, `${path}.${key}`);
    }
  };

  visit(value);
}
