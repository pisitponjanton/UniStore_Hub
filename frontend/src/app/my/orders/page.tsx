import type { Metadata } from "next";

import {
  AuthenticatedBoundary,
  AuthenticatedShell,
} from "@/modules/auth";
import { MyOrdersView } from "@/modules/orders";

export const metadata: Metadata = {
  title: "คำสั่งซื้อของฉัน | UniStore Hub",
};

export default function MyOrdersPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <MyOrdersView />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
