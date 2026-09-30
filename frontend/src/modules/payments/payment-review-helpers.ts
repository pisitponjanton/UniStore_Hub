import type { PaymentStatus } from "@/types";

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "รอตรวจสอบ";
    case "APPROVED":
      return "อนุมัติแล้ว";
    case "REJECTED":
      return "ปฏิเสธแล้ว";
  }
}

export function validateRejectReason(value: string): {
  value: string;
  error?: string;
  valid: boolean;
} {
  const normalized = value.trim();

  if (!normalized) {
    return {
      value: "",
      error: "กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน",
      valid: false,
    };
  }

  return {
    value: normalized,
    valid: true,
  };
}
