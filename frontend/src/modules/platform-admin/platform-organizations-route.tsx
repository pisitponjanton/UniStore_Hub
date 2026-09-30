"use client";

import {
  AuthenticatedShell,
  PlatformAdminBoundary,
} from "@/modules/auth";

import { PlatformOrganizationsView } from "./platform-organizations-view";

export function PlatformOrganizationsRoute() {
  return (
    <PlatformAdminBoundary>
      <AuthenticatedShell>
        <PlatformOrganizationsView />
      </AuthenticatedShell>
    </PlatformAdminBoundary>
  );
}
