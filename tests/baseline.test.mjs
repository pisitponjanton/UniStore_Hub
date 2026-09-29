import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('testing harness runtime exposes required Node primitives', () => {
  assert.equal(typeof fetch, 'function');
  assert.equal(typeof AbortController, 'function');
  assert.match(
    randomUUID(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});
