import { describe, expect, it } from "vitest";

import {
  formatIsoDateTime,
  formatSatang,
  getApiErrorMessage,
  getRequiredQueryId,
  isApiErrorCode,
  parseRequiredQueryId,
  parseThbToSatang,
  PAYMENT_SLIP_MAX_BYTES,
  PRODUCT_IMAGE_MAX_BYTES,
  satangToThbInput,
  validateUploadCandidate,
} from ".";

describe("money utilities", () => {
  it("normalizes THB decimals to integer satang without floating-point output", () => {
    expect(parseThbToSatang("2500.50")).toEqual({ ok: true, satang: 250050 });
    expect(parseThbToSatang("100")).toEqual({ ok: true, satang: 10000 });
    expect(parseThbToSatang("0.05")).toEqual({ ok: true, satang: 5 });
  });

  it("rejects more than two decimal places", () => {
    expect(parseThbToSatang("12.345")).toEqual({
      ok: false,
      reason: "TOO_MANY_DECIMALS",
    });
  });

  it("formats satang for display and form editing", () => {
    expect(formatSatang(250050)).toBe("฿2,500.50");
    expect(satangToThbInput(5)).toBe("0.05");
  });

  it("keeps conversion inside safe integer boundaries", () => {
    expect(parseThbToSatang("-1")).toEqual({
      ok: false,
      reason: "INVALID_FORMAT",
    });
    expect(() => formatSatang(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      RangeError,
    );
    expect(() => satangToThbInput(-1)).toThrow(RangeError);
  });
});

describe("query utilities", () => {
  it("treats ids as opaque non-empty strings", () => {
    expect(parseRequiredQueryId(" order_123 ")).toEqual({
      ok: true,
      value: "order_123",
    });
    expect(parseRequiredQueryId("   ")).toEqual({
      ok: false,
      reason: "INVALID",
    });
    expect(parseRequiredQueryId(null)).toEqual({
      ok: false,
      reason: "MISSING",
    });
  });

  it("rejects control characters and reads the requested query key only", () => {
    expect(parseRequiredQueryId("order\n123")).toEqual({
      ok: false,
      reason: "INVALID",
    });

    const searchParams = new URLSearchParams(
      "organizationId=org-1&orderId=order-1",
    );

    expect(
      getRequiredQueryId(searchParams, "organizationId"),
    ).toEqual({
      ok: true,
      value: "org-1",
    });
    expect(
      getRequiredQueryId(searchParams, "missingId"),
    ).toEqual({
      ok: false,
      reason: "MISSING",
    });
  });
});

describe("upload utilities", () => {
  it("enforces the documented MIME and size limits", () => {
    expect(
      validateUploadCandidate(
        { type: "image/png", size: PRODUCT_IMAGE_MAX_BYTES },
        "productImage",
      ).ok,
    ).toBe(true);

    expect(
      validateUploadCandidate(
        { type: "image/webp", size: PAYMENT_SLIP_MAX_BYTES + 1 },
        "paymentSlip",
      ),
    ).toMatchObject({ ok: false, reason: "FILE_TOO_LARGE" });

    expect(
      validateUploadCandidate(
        { type: "application/pdf", size: 1024 },
        "paymentSlip",
      ),
    ).toMatchObject({ ok: false, reason: "UNSUPPORTED_TYPE" });
  });
});

describe("timestamp and API error helpers", () => {
  it("formats ISO timestamps without changing the raw DTO value", () => {
    const value = "2026-09-28T14:30:00.000Z";
    const formatted = formatIsoDateTime(value, {
      locale: "en-GB",
      timeZone: "UTC",
    });

    expect(formatted).toContain("28 Sept 2026");
    expect(value).toBe("2026-09-28T14:30:00.000Z");
  });

  it("maps stable API error codes to user-facing messages", () => {
    expect(getApiErrorMessage("INVALID_CREDENTIALS")).toBe(
      "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    );
    expect(getApiErrorMessage("PICKUP_ALREADY_RECEIVED")).toBe(
      "คำสั่งซื้อนี้ถูกรับสินค้าแล้ว",
    );
    expect(isApiErrorCode("LAST_ORGANIZATION_ADMIN")).toBe(true);
  });

  it("uses the caller fallback for unknown API error codes", () => {
    expect(isApiErrorCode("NOT_A_REAL_CODE")).toBe(false);
    expect(
      getApiErrorMessage(
        "NOT_A_REAL_CODE",
        "ไม่สามารถดำเนินการได้",
      ),
    ).toBe("ไม่สามารถดำเนินการได้");
  });
});
