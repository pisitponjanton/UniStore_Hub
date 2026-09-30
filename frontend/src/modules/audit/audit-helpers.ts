export function formatAuditMetadata(
  metadata: unknown,
): string {
  try {
    const serialized = JSON.stringify(metadata ?? {}, null, 2);
    return serialized ?? "{}";
  } catch {
    return "[ไม่สามารถแสดง metadata ได้]";
  }
}
