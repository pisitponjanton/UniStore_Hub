import type { OrderStatus } from "@/types";

export function canCustomerCancelOrder(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_REJECTED";
}

export function myOrderHref(orderId: string): string {
  const params = new URLSearchParams({ orderId });
  return `/my/order/?${params.toString()}`;
}
