import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthenticatedBoundary } from "@/modules/auth";
import { StoreDetailRoute } from "@/modules/stores/store-detail-route";
import { LoadingState } from "@/components";
export const metadata: Metadata = { title: "สินค้า | UniStore Hub" };
export default function Page() {
  return <AuthenticatedBoundary>
    <Suspense fallback={<LoadingState title="กำลังโหลดสินค้า" />}>
      <StoreDetailRoute type="product" />
    </Suspense>
  </AuthenticatedBoundary>;
}
