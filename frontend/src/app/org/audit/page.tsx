import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { AuditRoute } from "@/modules/audit";

export const metadata: Metadata = {
  title: "ประวัติการทำรายการ | UniStore Hub",
};

export default function AuditPage() {
  return (
    <AuthenticatedBoundary>
      <AuditRoute />
    </AuthenticatedBoundary>
  );
}
