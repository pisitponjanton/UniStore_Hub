import type { Metadata } from "next";

import {
  AuthenticatedBoundary,
  AuthenticatedShell,
} from "@/modules/auth";
import { StorefrontCatalog } from "@/modules/storefront";

export const metadata: Metadata = {
  title: "หน้าร้านค้า | UniStore Hub",
};

export default function StoresPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <StorefrontCatalog />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
