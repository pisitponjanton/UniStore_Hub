"use client";

import { useEffect, useState } from "react";

import { LoadingState } from "@/components";
import {
  AuthenticatedShell,
  OrganizationBoundary,
} from "@/modules/auth";
import { getRequiredQueryId } from "@/utils";

import { normalizeCampaignId } from "./production-helpers";
import { ProductionSummaryView } from "./production-summary-view";

type RouteContext =
  | undefined
  | null
  | {
      organizationId: string;
      campaignId: string | null;
    };

export function ProductionRoute() {
  const [context, setContext] =
    useState<RouteContext>(undefined);

  useEffect(() => {
    let active = true;

    async function resolveContext() {
      const params = new URLSearchParams(window.location.search);
      const organizationId = getRequiredQueryId(
        params,
        "organizationId",
      );

      await Promise.resolve();

      if (!active) {
        return;
      }

      if (!organizationId.ok) {
        setContext(null);
        return;
      }

      setContext({
        organizationId: organizationId.value,
        campaignId: normalizeCampaignId(
          params.get("campaignId"),
        ),
      });
    }

    void resolveContext();

    return () => {
      active = false;
    };
  }, []);

  if (context === undefined) {
    return <LoadingState title="กำลังเตรียมสรุปการผลิต" />;
  }

  const organizationId = context?.organizationId ?? null;

  return (
    <OrganizationBoundary
      organizationId={organizationId}
      allowedRoles={["ORGANIZATION_ADMIN"]}
    >
      <AuthenticatedShell organizationId={organizationId}>
        {context ? (
          <ProductionSummaryView
            organizationId={context.organizationId}
            initialCampaignId={context.campaignId}
          />
        ) : null}
      </AuthenticatedShell>
    </OrganizationBoundary>
  );
}
