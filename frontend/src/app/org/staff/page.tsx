import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { StaffRoute } from "@/modules/staff";

export const metadata: Metadata = {
  title: "บุคลากร | UniStore Hub",
};

export default function StaffPage() {
  return (
    <AuthenticatedBoundary>
      <StaffRoute />
    </AuthenticatedBoundary>
  );
}
