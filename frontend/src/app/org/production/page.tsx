import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { ProductionRoute } from "@/modules/production";

export const metadata: Metadata = {
  title: "สรุปการผลิต | UniStore Hub",
};

export default function ProductionPage() {
  return (
    <AuthenticatedBoundary>
      <ProductionRoute />
    </AuthenticatedBoundary>
  );
}
