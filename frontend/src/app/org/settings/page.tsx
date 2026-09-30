import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { OrganizationSettingsRoute } from "@/modules/organizations";

export const metadata: Metadata = {
  title: "ข้อมูลหน่วยงาน | UniStore Hub",
};

export default function OrganizationSettingsPage() {
  return (
    <AuthenticatedBoundary>
      <OrganizationSettingsRoute />
    </AuthenticatedBoundary>
  );
}
