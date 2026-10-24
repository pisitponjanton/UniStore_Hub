"use client";

import { useEffect, useState } from "react";
import { AuthenticatedShell, OrganizationBoundary } from "@/modules/auth";
import { LoadingState } from "@/components";
import { getRequiredQueryId } from "@/utils";
import { OrganizationApplicationView } from "./organization-application-view";

export function OrganizationApplicationRoute() {
  const [organizationId, setOrganizationId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    async function resolveId() {
      const result = getRequiredQueryId(new URLSearchParams(window.location.search), "organizationId");
      await Promise.resolve();
      if (active) setOrganizationId(result.ok ? result.value : null);
    }
    void resolveId();
    return () => { active = false; };
  }, []);

  if (organizationId === undefined) return <LoadingState title="กำลังเตรียมหน้าติดตามคำขอ" />;

  return (
    <OrganizationBoundary organizationId={organizationId} allowedRoles={["ORGANIZATION_ADMIN"]}>
      <AuthenticatedShell>
        {organizationId ? <OrganizationApplicationView organizationId={organizationId} /> : null}
      </AuthenticatedShell>
    </OrganizationBoundary>
  );
}
