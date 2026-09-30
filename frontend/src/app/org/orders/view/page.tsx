import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { OrganizationOrderDetailRoute } from "@/modules/orders";

export const metadata: Metadata = {
  title: "รายละเอียดคำสั่งซื้อ | UniStore Hub",
};

export default function OrganizationOrderDetailPage() {
  return (
    <AuthenticatedBoundary>
      <OrganizationOrderDetailRoute />
    </AuthenticatedBoundary>
  );
}
