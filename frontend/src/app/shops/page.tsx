import type { Metadata } from "next";

import { AuthenticatedBoundary, AuthenticatedShell } from "@/modules/auth";
import { StorefrontLanding } from "@/modules/storefront";

export const metadata: Metadata = {
  title: "เลือกร้านค้า | UniStore Hub",
};

export default function CustomerShopsPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <StorefrontLanding workspace />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
