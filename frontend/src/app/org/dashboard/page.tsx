import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { DashboardRoute } from "@/modules/dashboard";

export const metadata: Metadata = {
  title: "แดชบอร์ดหน่วยงาน | UniStore Hub",
};

export default function DashboardPage() {
  return (
    <AuthenticatedBoundary>
      <DashboardRoute />
    </AuthenticatedBoundary>
  );
}
