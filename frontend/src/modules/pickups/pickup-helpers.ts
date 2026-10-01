import type { OrderStatus, PickupStatus } from "@/types";

export interface PickupPresentation {
  title: string;
  description: string;
  tone: "success" | "neutral";
}

export function myPickupHref(orderId: string): string {
  const params = new URLSearchParams({ orderId });
  return `/my/pickup/?${params.toString()}`;
}

export function canViewCustomerPickup(status: OrderStatus): boolean {
  return status === "READY_FOR_PICKUP" || status === "RECEIVED";
}

export function getPickupStatusLabel(status: PickupStatus): string {
  return status === "READY" ? "พร้อมรับสินค้า" : "รับสินค้าแล้ว";
}

export function getPickupPresentation(
  status: PickupStatus,
): PickupPresentation {
  return status === "READY"
    ? {
        title: "พร้อมนำ QR หรือ Token ไปรับสินค้า",
        description:
          "เมื่อถึงจุดรับสินค้า ให้แสดง QR หรือ Token ด้านล่างแก่เจ้าหน้าที่",
        tone: "success",
      }
    : {
        title: "รับสินค้าเรียบร้อยแล้ว",
        description:
          "รายการรับสินค้านี้ถูกยืนยันแล้ว ไม่ต้องนำ QR หรือ Token ไปใช้ซ้ำ",
        tone: "neutral",
      };
}

export function organizationPickupsHref(
  organizationId: string,
): string {
  const params = new URLSearchParams({ organizationId });
  return `/org/pickups/?${params.toString()}`;
}

export function canConfirmPickup(status: PickupStatus): boolean {
  return status === "READY";
}
