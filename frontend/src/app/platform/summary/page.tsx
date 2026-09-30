import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { PlatformSummaryRoute } from "@/modules/platform-admin";

export const metadata: Metadata = {
  title: "ภาพรวม Platform | UniStore Hub",
};

export default function PlatformSummaryPage() {
  return (
    <AuthenticatedBoundary>
      <PlatformSummaryRoute />
    </AuthenticatedBoundary>
  );
}
