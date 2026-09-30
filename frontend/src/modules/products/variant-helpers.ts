import { parseThbToSatang } from "@/utils";

export interface VariantFormValues {
  name: string;
  priceThb: string;
}

export interface VariantFormErrors {
  name?: string;
  priceThb?: string;
}

function priceErrorMessage(
  reason:
    | "REQUIRED"
    | "INVALID_FORMAT"
    | "TOO_MANY_DECIMALS"
    | "OUT_OF_RANGE",
): string {
  switch (reason) {
    case "REQUIRED":
      return "กรุณาระบุราคา";
    case "TOO_MANY_DECIMALS":
      return "ราคาใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง";
    case "OUT_OF_RANGE":
      return "ราคามีค่ามากเกินกว่าที่ระบบรองรับ";
    case "INVALID_FORMAT":
      return "กรุณาระบุราคาเป็นตัวเลข THB ที่ถูกต้อง";
  }
}

export function validateVariantForm(
  values: VariantFormValues,
): {
  values: { name: string; price: number } | null;
  errors: VariantFormErrors;
  valid: boolean;
} {
  const name = values.name.trim();
  const errors: VariantFormErrors = {};

  if (!name) {
    errors.name = "กรุณาระบุชื่อ Variant";
  }

  const parsedPrice = parseThbToSatang(values.priceThb);

  if (!parsedPrice.ok) {
    errors.priceThb = priceErrorMessage(parsedPrice.reason);
  }

  if (Object.keys(errors).length > 0 || !parsedPrice.ok) {
    return {
      values: null,
      errors,
      valid: false,
    };
  }

  return {
    values: {
      name,
      price: parsedPrice.satang,
    },
    errors: {},
    valid: true,
  };
}

export function variantStatusLabel(
  status: "ACTIVE" | "INACTIVE",
): string {
  return status === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน";
}
