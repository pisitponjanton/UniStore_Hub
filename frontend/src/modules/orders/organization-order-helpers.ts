import type { MembershipRole, OrderStatus } from "@/types";

export function organizationOrdersHref(
  organizationId: string,
): string {
  const params = new URLSearchParams({ organizationId });
  return `/org/orders/?${params.toString()}`;
}

export function organizationOrderHref(
  organizationId: string,
  orderId: string,
): string {
  const params = new URLSearchParams({
    organizationId,
    orderId,
  });

  return `/org/orders/view/?${params.toString()}`;
}

export function canOrganizationCancelOrder(
  role: MembershipRole | null | undefined,
  status: OrderStatus,
): boolean {
  return (
    role === "ORGANIZATION_ADMIN" &&
    (status === "PENDING_PAYMENT" ||
      status === "PAYMENT_REJECTED")
  );
}
