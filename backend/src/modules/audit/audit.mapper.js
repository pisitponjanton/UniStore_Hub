'use strict';

const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'jwt',
  'authorization',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsSessionToken',
  'presignedUrl',
  'preSignedUrl',
  'url',
  'slipBinary',
  'binary',
]);

function sanitizeAuditMetadata(value) {
  if (Buffer.isBuffer(value)) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeAuditMetadata(item),
    );
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_METADATA_KEYS.has(key)
          ? '[REDACTED]'
          : sanitizeAuditMetadata(item),
      ]),
    );
  }

  return value;
}

function toAuditLogDto(audit) {
  if (!audit) {
    return null;
  }

  return {
    auditId: audit.auditId,
    organizationId: audit.organizationId,
    actorId: audit.actorId,
    action: audit.action,
    resourceType: audit.resourceType,
    resourceId: audit.resourceId,
    metadata: sanitizeAuditMetadata(
      audit.metadata ?? {},
    ),
    createdAt: audit.createdAt,
  };
}

module.exports = {
  SENSITIVE_METADATA_KEYS,
  sanitizeAuditMetadata,
  toAuditLogDto,
};
