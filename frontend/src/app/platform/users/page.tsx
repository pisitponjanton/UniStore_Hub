import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { PlatformUsersRoute } from "@/modules/platform-admin";

export const metadata: Metadata = {
  title: "ผู้ใช้ Platform | UniStore Hub",
};

export default function PlatformUsersPage() {
  return (
    <AuthenticatedBoundary>
      <PlatformUsersRoute />
    </AuthenticatedBoundary>
  );
}
