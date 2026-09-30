import type { ResourceStatus } from "@/types";

export interface StoreFormValues {
  name: string;
  description: string;
}

export interface StoreFormErrors {
  name?: string;
}

export function validateStoreForm(
  values: StoreFormValues,
): {
  values: StoreFormValues;
  errors: StoreFormErrors;
  valid: boolean;
} {
  const normalized = {
    name: values.name.trim(),
    description: values.description.trim(),
  };
  const errors: StoreFormErrors = {};

  if (!normalized.name) {
    errors.name = "กรุณาระบุชื่อร้านค้า";
  }

  return {
    values: normalized,
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

export function storeStatusLabel(status: ResourceStatus): string {
  return status === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน";
}

export function toggledStoreStatus(
  status: ResourceStatus,
): ResourceStatus {
  return status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
}
