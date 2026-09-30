"use client";

import { useEffect, useState } from "react";

import { LoadingState } from "@/components";
import {
  AuthenticatedShell,
  OrganizationBoundary,
} from "@/modules/auth";
import { getRequiredQueryId } from "@/utils";

import { StaffView } from "./staff-view";

export function StaffRoute() {
  const [organizationId, setOrganizationId] = useState<
    string | null | undefined
  >(undefined);

  useEffect(() => {
    let active = true;

    async function resolveOrganizationId() {
      const params = new URLSearchParams(window.location.search);
      const result = getRequiredQueryId(params, "organizationId");

      await Promise.resolve();

      if (active) {
        setOrganizationId(result.ok ? result.value : null);
      }
    }

    void resolveOrganizationId();

    return () => {
      active = false;
    };
  }, []);

  if (organizationId === undefined) {
    return <LoadingState title="กำลังเตรียมข้อมูลบุคลากร" />;
  }

  return (
    <OrganizationBoundary
      organizationId={organizationId}
      allowedRoles={["ORGANIZATION_ADMIN"]}
    >
      <AuthenticatedShell organizationId={organizationId}>
        {organizationId ? (
          <StaffView organizationId={organizationId} />
        ) : null}
      </AuthenticatedShell>
    </OrganizationBoundary>
  );
}
