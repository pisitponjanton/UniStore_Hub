import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { OrganizationOrdersRoute } from "@/modules/orders";

export const metadata: Metadata = {
  title: "คำสั่งซื้อของหน่วยงาน | UniStore Hub",
};

export default function OrganizationOrdersPage() {
  return (
    <AuthenticatedBoundary>
      <OrganizationOrdersRoute />
    </AuthenticatedBoundary>
  );
}
