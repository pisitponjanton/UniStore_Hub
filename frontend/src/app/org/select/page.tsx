import type { Metadata } from "next";

import {
  AuthenticatedBoundary,
  AuthenticatedShell,
} from "@/modules/auth";
import { OrganizationSelectView } from "@/modules/organizations";

export const metadata: Metadata = {
  title: "เลือกหน่วยงาน | UniStore Hub",
};

export default function OrganizationSelectPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <OrganizationSelectView />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
