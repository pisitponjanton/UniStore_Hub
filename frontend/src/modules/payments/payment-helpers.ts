import type {
  OrderStatus,
  PaymentStatus,
} from "@/types";

export type PaymentStateTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface PaymentStatePresentation {
  title: string;
  description: string;
  tone: PaymentStateTone;
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่ผ่านการตรวจสอบ",
};

export function canSubmitPaymentSlip(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_REJECTED";
}

export function myPaymentHref(orderId: string): string {
  const params = new URLSearchParams({ orderId });
  return `/my/payment/?${params.toString()}`;
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  return paymentStatusLabels[status];
}

export function paymentOrderStateMessage(status: OrderStatus): string {
  return getPaymentStatePresentation(status).description;
}

export function getPaymentStatePresentation(
  status: OrderStatus,
): PaymentStatePresentation {
  switch (status) {
    case "PENDING_PAYMENT":
      return {
        title: "ยังไม่ได้ส่งหลักฐาน",
        description: "คำสั่งซื้อนี้ยังรอหลักฐานการชำระเงิน",
        tone: "warning",
      };
    case "PAYMENT_REVIEW":
      return {
        title: "รอตรวจสอบการชำระเงิน",
        description: "ส่งหลักฐานแล้วและกำลังรอเจ้าหน้าที่ตรวจสอบ",
        tone: "info",
      };
    case "PAYMENT_REJECTED":
      return {
        title: "ต้องส่งหลักฐานใหม่",
        description: "หลักฐานการชำระเงินถูกปฏิเสธ สามารถส่งหลักฐานใหม่ได้",
        tone: "danger",
      };
    case "PAID":
    case "CONFIRMED":
    case "IN_PRODUCTION":
    case "READY_FOR_PICKUP":
    case "RECEIVED":
      return {
        title: "ชำระเงินผ่านแล้ว",
        description: "การชำระเงินของคำสั่งซื้อนี้ผ่านการอนุมัติแล้ว",
        tone: "success",
      };
    case "CANCELLED":
      return {
        title: "คำสั่งซื้อถูกยกเลิก",
        description: "คำสั่งซื้อนี้ถูกยกเลิกแล้ว",
        tone: "neutral",
      };
  }
}

export function formatUploadFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;

  if (kib < 1024) {
    return `${kib.toFixed(kib >= 100 ? 0 : 1)} KiB`;
  }

  const mib = kib / 1024;
  return `${mib.toFixed(mib >= 10 ? 1 : 2)} MiB`;
}
