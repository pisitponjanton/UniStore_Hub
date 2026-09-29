'use strict';

function nowIsoUtc() {
  return new Date().toISOString();
}

function isIsoUtcTimestamp(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const parsed = new Date(value);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value &&
    value.endsWith('Z')
  );
}

module.exports = {
  nowIsoUtc,
  isIsoUtcTimestamp,
};
