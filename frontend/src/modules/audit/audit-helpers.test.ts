import { describe, expect, it } from "vitest";

import { formatAuditMetadata } from "./audit-helpers";

describe("audit helpers", () => {
  it("renders Backend-provided metadata without changing its fields", () => {
    expect(
      formatAuditMetadata({
        orderId: "order-1",
        reason: "reviewed",
      }),
    ).toBe(
      JSON.stringify(
        {
          orderId: "order-1",
          reason: "reviewed",
        },
        null,
        2,
      ),
    );
  });

  it("falls back safely when metadata cannot be serialized", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(formatAuditMetadata(circular)).toBe(
      "[ไม่สามารถแสดง metadata ได้]",
    );
  });
});
