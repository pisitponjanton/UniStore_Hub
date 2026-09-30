import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { PlatformOrganizationsRoute } from "@/modules/platform-admin";

export const metadata: Metadata = {
  title: "จัดการหน่วยงาน Platform | UniStore Hub",
};

export default function PlatformOrganizationsPage() {
  return (
    <AuthenticatedBoundary>
      <PlatformOrganizationsRoute />
    </AuthenticatedBoundary>
  );
}
