"use client";

import {
  AuthenticatedShell,
  PlatformAdminBoundary,
} from "@/modules/auth";

import { PlatformSummaryView } from "./platform-summary-view";

export function PlatformSummaryRoute() {
  return (
    <PlatformAdminBoundary>
      <AuthenticatedShell>
        <PlatformSummaryView />
      </AuthenticatedShell>
    </PlatformAdminBoundary>
  );
}
