import { describe, expect, it } from "vitest";

import {
  validateVariantForm,
  variantStatusLabel,
} from "./variant-helpers";

describe("variant helpers", () => {
  it("normalizes THB decimal input into integer satang", () => {
    expect(
      validateVariantForm({
        name: "  Size M  ",
        priceThb: "250.50",
      }),
    ).toEqual({
      values: {
        name: "Size M",
        price: 25050,
      },
      errors: {},
      valid: true,
    });
  });

  it("rejects empty names and prices with more than two decimal places", () => {
    expect(
      validateVariantForm({
        name: " ",
        priceThb: "250.555",
      }),
    ).toEqual({
      values: null,
      errors: {
        name: "กรุณาระบุชื่อ Variant",
        priceThb: "ราคาใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง",
      },
      valid: false,
    });
  });

  it("labels only canonical Variant states", () => {
    expect(variantStatusLabel("ACTIVE")).toBe("เปิดใช้งาน");
    expect(variantStatusLabel("INACTIVE")).toBe("ปิดใช้งาน");
  });
});
