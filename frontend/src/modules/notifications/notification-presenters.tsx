import { Badge } from "@/components";
import type { NotificationType } from "@/types";

const labels: Record<NotificationType, string> = {
  PAYMENT_APPROVED: "อนุมัติการชำระเงิน",
  PAYMENT_REJECTED: "ปฏิเสธการชำระเงิน",
  READY_FOR_PICKUP: "พร้อมรับสินค้า",
};

const tones: Record<
  NotificationType,
  "info" | "success" | "warning" | "danger" | "neutral"
> = {
  PAYMENT_APPROVED: "success",
  PAYMENT_REJECTED: "danger",
  READY_FOR_PICKUP: "info",
};

export function getNotificationTypeLabel(
  type: NotificationType,
): string {
  return labels[type];
}

export function NotificationTypeBadge({
  type,
}: {
  type: NotificationType;
}) {
  return <Badge tone={tones[type]}>{labels[type]}</Badge>;
}
