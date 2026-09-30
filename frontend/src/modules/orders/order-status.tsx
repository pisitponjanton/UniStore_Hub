import { Badge } from "@/components";
import type { OrderStatus } from "@/types";

const labels: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "รอชำระเงิน",
  PAYMENT_REVIEW: "รอตรวจสอบการชำระเงิน",
  PAID: "ชำระเงินแล้ว",
  PAYMENT_REJECTED: "การชำระเงินถูกปฏิเสธ",
  CONFIRMED: "ยืนยันคำสั่งซื้อ",
  IN_PRODUCTION: "กำลังผลิต",
  READY_FOR_PICKUP: "พร้อมรับสินค้า",
  RECEIVED: "รับสินค้าแล้ว",
  CANCELLED: "ยกเลิก",
};

const tones: Record<
  OrderStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  PENDING_PAYMENT: "warning",
  PAYMENT_REVIEW: "info",
  PAID: "success",
  PAYMENT_REJECTED: "danger",
  CONFIRMED: "info",
  IN_PRODUCTION: "info",
  READY_FOR_PICKUP: "success",
  RECEIVED: "neutral",
  CANCELLED: "neutral",
};

export function getOrderStatusLabel(status: OrderStatus): string {
  return labels[status];
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}
