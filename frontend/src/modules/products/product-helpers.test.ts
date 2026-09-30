import { describe, expect, it } from "vitest";

import {
  productStatusLabel,
  validateProductForm,
} from "./product-helpers";

describe("product helpers", () => {
  it("normalizes create/edit fields and requires store and name", () => {
    expect(
      validateProductForm({
        storeId: " store-1 ",
        name: " Faculty Shirt ",
        description: " Pre-order shirt ",
      }),
    ).toEqual({
      values: {
        storeId: "store-1",
        name: "Faculty Shirt",
        description: "Pre-order shirt",
      },
      errors: {},
      valid: true,
    });

    expect(
      validateProductForm({
        storeId: "",
        name: " ",
        description: "",
      }),
    ).toEqual({
      values: {
        storeId: "",
        name: "",
        description: "",
      },
      errors: {
        storeId: "กรุณาเลือกร้านค้า",
        name: "กรุณาระบุชื่อสินค้า",
      },
      valid: false,
    });
  });

  it("labels only canonical product resource states", () => {
    expect(productStatusLabel("ACTIVE")).toBe("เปิดใช้งาน");
    expect(productStatusLabel("INACTIVE")).toBe("ปิดใช้งาน");
  });
});
