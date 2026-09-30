import { describe, expect, it } from "vitest";

import {
  storeStatusLabel,
  toggledStoreStatus,
  validateStoreForm,
} from "./store-helpers";

describe("store helpers", () => {
  it("normalizes store form values and requires a name", () => {
    expect(
      validateStoreForm({
        name: "  Main Store  ",
        description: "  Faculty merchandise  ",
      }),
    ).toEqual({
      values: {
        name: "Main Store",
        description: "Faculty merchandise",
      },
      errors: {},
      valid: true,
    });

    expect(
      validateStoreForm({
        name: "   ",
        description: "",
      }),
    ).toEqual({
      values: {
        name: "",
        description: "",
      },
      errors: {
        name: "กรุณาระบุชื่อร้านค้า",
      },
      valid: false,
    });
  });

  it("maps canonical store status without inventing other values", () => {
    expect(storeStatusLabel("ACTIVE")).toBe("เปิดใช้งาน");
    expect(storeStatusLabel("INACTIVE")).toBe("ปิดใช้งาน");
    expect(toggledStoreStatus("ACTIVE")).toBe("INACTIVE");
    expect(toggledStoreStatus("INACTIVE")).toBe("ACTIVE");
  });
});
