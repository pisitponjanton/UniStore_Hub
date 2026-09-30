import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { OrganizationPaymentsRoute } from "@/modules/payments";

export const metadata: Metadata = {
  title: "ตรวจสอบการชำระเงิน | UniStore Hub",
};

export default function OrganizationPaymentsPage() {
  return (
    <AuthenticatedBoundary>
      <OrganizationPaymentsRoute />
    </AuthenticatedBoundary>
  );
}
