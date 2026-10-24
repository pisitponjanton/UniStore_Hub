import type { Metadata } from "next";
import { AuthenticatedBoundary } from "@/modules/auth";
import { OrganizationApplicationRoute } from "@/modules/organizations";

export const metadata: Metadata = {
  title: "สถานะสมัครหน่วยงาน | UniStore Hub",
};

export default function OrganizationApplicationPage() {
  return (
    <AuthenticatedBoundary>
      <OrganizationApplicationRoute />
    </AuthenticatedBoundary>
  );
}
