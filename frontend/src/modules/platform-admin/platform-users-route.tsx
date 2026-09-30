"use client";

import {
  AuthenticatedShell,
  PlatformAdminBoundary,
} from "@/modules/auth";

import { PlatformUsersView } from "./platform-users-view";

export function PlatformUsersRoute() {
  return (
    <PlatformAdminBoundary>
      <AuthenticatedShell>
        <PlatformUsersView />
      </AuthenticatedShell>
    </PlatformAdminBoundary>
  );
}
