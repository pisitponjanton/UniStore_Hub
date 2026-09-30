import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { StoreRoute } from "@/modules/stores";

export const metadata: Metadata = {
  title: "ร้านค้า | UniStore Hub",
};

export default function StoresPage() {
  return (
    <AuthenticatedBoundary>
      <StoreRoute />
    </AuthenticatedBoundary>
  );
}
