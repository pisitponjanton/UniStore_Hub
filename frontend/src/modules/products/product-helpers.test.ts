import { describe, expect, it } from "vitest";

import {
  productStatusLabel,
  mergeProductUpdateResponse,
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
  it("keeps hydrated variants and imageUrl when PATCH omits joined relations", () => {
    const current = {
      productId: "product-1", organizationId: "org-1", storeId: "store-1",
      name: "กางเกง", description: "เดิม", status: "ACTIVE" as const,
      imageKey: "product-image-1", imageUrl: "https://example.test/product.jpg",
      variants: [
        { variantId: "variant-1", productId: "product-1", organizationId: "org-1",
          name: "M", price: 200000, status: "ACTIVE" as const,
          createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const patched = { ...current, name: "กางเกง 1", description: "ใหม่",
      imageUrl: null, updatedAt: "2026-01-02T00:00:00.000Z" };
    delete (patched as Partial<typeof patched>).variants;
    const merged = mergeProductUpdateResponse(current, patched);
    expect(merged.name).toBe("กางเกง 1");
    expect(merged.description).toBe("ใหม่");
    expect(merged.updatedAt).toBe(patched.updatedAt);
    expect(merged.variants).toEqual(current.variants);
    expect(merged.imageUrl).toBe(current.imageUrl);
    expect(current.name).toBe("กางเกง");
  });

  it("accepts explicit empty variants and clears media on changed imageKey", () => {
    const original = {
      productId: "product-1", organizationId: "org-1", storeId: "store-1",
      name: "Shirt", description: "", status: "ACTIVE" as const,
      imageKey: "old-key", imageUrl: "https://example.test/old",
      variants: [{ variantId:"v", organizationId:"org-1", productId:"product-1",
        name:"M", price:1000, status:"ACTIVE" as const,
        createdAt:"2026-01-01",updatedAt:"2026-01-01" }],
      createdAt:"2026-01-01",updatedAt:"2026-01-01",
    };
    const replacement = { ...original, imageKey: "new-key", imageUrl: null, variants: [] };
    expect(mergeProductUpdateResponse(original, replacement).variants).toEqual([]);
    expect(mergeProductUpdateResponse(original, replacement).imageUrl).toBeNull();
  });

});
