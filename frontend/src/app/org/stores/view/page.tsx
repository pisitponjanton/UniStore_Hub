import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthenticatedBoundary } from "@/modules/auth";
import { StoreWorkspaceRoute } from "@/modules/stores/store-workspace";
import { LoadingState } from "@/components";
export const metadata: Metadata = { title: "จัดการร้านค้า | UniStore Hub" };
export default function Page() {
  return <AuthenticatedBoundary><Suspense fallback={<LoadingState title="กำลังโหลดร้านค้า" />}>
    <StoreWorkspaceRoute />
  </Suspense></AuthenticatedBoundary>;
}
