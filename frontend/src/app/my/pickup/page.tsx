import type { Metadata } from "next";

import {
  AuthenticatedBoundary,
  AuthenticatedShell,
} from "@/modules/auth";
import { MyPickupView } from "@/modules/pickups";

export const metadata: Metadata = {
  title: "รับสินค้า | UniStore Hub",
};

export default function MyPickupPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <MyPickupView />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
