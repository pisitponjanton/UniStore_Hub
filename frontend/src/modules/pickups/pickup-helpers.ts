import type { OrderStatus, PickupStatus } from "@/types";

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


export function organizationPickupsHref(
  organizationId: string,
): string {
  const params = new URLSearchParams({ organizationId });
  return `/org/pickups/?${params.toString()}`;
}

export function canConfirmPickup(status: PickupStatus): boolean {
  return status === "READY";
}
