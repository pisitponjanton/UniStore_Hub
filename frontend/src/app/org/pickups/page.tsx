import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { OrganizationPickupsRoute } from "@/modules/pickups";

export const metadata: Metadata = {
  title: "ยืนยันการรับสินค้า | UniStore Hub",
};

export default function OrganizationPickupsPage() {
  return (
    <AuthenticatedBoundary>
      <OrganizationPickupsRoute />
    </AuthenticatedBoundary>
  );
}
