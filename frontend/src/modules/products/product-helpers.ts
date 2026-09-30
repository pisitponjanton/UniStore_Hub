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
