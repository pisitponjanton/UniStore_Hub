import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { OrderCreateView } from "@/modules/orders";

export const metadata: Metadata = {
  title: "สร้างคำสั่งซื้อ | UniStore Hub",
};

export default function NewOrderPage() {
  return (
    <AuthenticatedBoundary>
      <OrderCreateView />
    </AuthenticatedBoundary>
  );
}
