import type { OrderStatus } from "@/types";

export function canSubmitPaymentSlip(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_REJECTED";
}

export function myPaymentHref(orderId: string): string {
  const params = new URLSearchParams({ orderId });
  return `/my/payment/?${params.toString()}`;
}

export function paymentOrderStateMessage(status: OrderStatus): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "คำสั่งซื้อนี้ยังรอหลักฐานการชำระเงิน";
    case "PAYMENT_REVIEW":
      return "ส่งหลักฐานแล้วและกำลังรอเจ้าหน้าที่ตรวจสอบ";
    case "PAYMENT_REJECTED":
      return "หลักฐานการชำระเงินถูกปฏิเสธ สามารถส่งหลักฐานใหม่ได้";
    case "PAID":
    case "CONFIRMED":
    case "IN_PRODUCTION":
    case "READY_FOR_PICKUP":
    case "RECEIVED":
      return "การชำระเงินของคำสั่งซื้อนี้ผ่านการอนุมัติแล้ว";
    case "CANCELLED":
      return "คำสั่งซื้อนี้ถูกยกเลิกแล้ว";
  }
}
