import type { ProductDTO } from "@/types";

export interface ProductFormValues {
  storeId: string;
  name: string;
  description: string;
}

export interface ProductFormErrors {
  storeId?: string;
  name?: string;
}

export function validateProductForm(
  values: ProductFormValues,
): {
  values: ProductFormValues;
  errors: ProductFormErrors;
  valid: boolean;
} {
  const normalized = {
    storeId: values.storeId.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
  };
  const errors: ProductFormErrors = {};

  if (!normalized.storeId) {
    errors.storeId = "กรุณาเลือกร้านค้า";
  }

  if (!normalized.name) {
    errors.name = "กรุณาระบุชื่อสินค้า";
  }

  return {
    values: normalized,
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

export function productStatusLabel(
  status: "ACTIVE" | "INACTIVE",
): string {
  return status === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน";
}

/**
 * PATCH returns the Product entity without joined variants (and imageUrl=null).
 * Keep hydrated, unchanged relations in editor state until a fresh GET replaces them.
 * An explicit variants array from a full response remains authoritative, including [].
 */
export function mergeProductUpdateResponse(
  current: ProductDTO,
  updated: ProductDTO,
): ProductDTO {
  if (current.productId !== updated.productId) return updated;
  return {
    ...current,
    ...updated,
    variants: updated.variants ?? current.variants,
    imageUrl: updated.imageKey === current.imageKey && !updated.imageUrl
      ? current.imageUrl
      : updated.imageUrl,
  };
}
