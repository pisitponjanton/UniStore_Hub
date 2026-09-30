import type { Metadata } from "next";

import {
  AuthenticatedBoundary,
  AuthenticatedShell,
} from "@/modules/auth";
import { MyOrderView } from "@/modules/orders";

export const metadata: Metadata = {
  title: "รายละเอียดคำสั่งซื้อ | UniStore Hub",
};

export default function MyOrderPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <MyOrderView />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
