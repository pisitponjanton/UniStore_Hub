"use client";

import { useEffect, useState } from "react";

import { LoadingState } from "@/components";
import {
  AuthenticatedShell,
  OrganizationBoundary,
} from "@/modules/auth";
import { getRequiredQueryId } from "@/utils";

import { OrganizationOrderDetailView } from "./organization-order-detail-view";

type RouteIds =
  | undefined
  | null
  | {
      organizationId: string;
      orderId: string;
    };

export function OrganizationOrderDetailRoute() {
  const [routeIds, setRouteIds] = useState<RouteIds>(undefined);

  useEffect(() => {
    let active = true;

    async function resolveRouteIds() {
      const params = new URLSearchParams(window.location.search);
      const organizationId = getRequiredQueryId(
        params,
        "organizationId",
      );
      const orderId = getRequiredQueryId(params, "orderId");

      await Promise.resolve();

      if (!active) {
        return;
      }

      if (!organizationId.ok || !orderId.ok) {
        setRouteIds(null);
        return;
      }

      setRouteIds({
        organizationId: organizationId.value,
        orderId: orderId.value,
      });
    }

    void resolveRouteIds();

    return () => {
      active = false;
    };
  }, []);

  if (routeIds === undefined) {
    return <LoadingState title="กำลังเตรียมรายละเอียดคำสั่งซื้อ" />;
  }

  const organizationId = routeIds?.organizationId ?? null;

  return (
    <OrganizationBoundary
      organizationId={organizationId}
      allowedRoles={["STAFF", "ORGANIZATION_ADMIN"]}
    >
      <AuthenticatedShell organizationId={organizationId}>
        {routeIds ? (
          <OrganizationOrderDetailView
            organizationId={routeIds.organizationId}
            orderId={routeIds.orderId}
          />
        ) : null}
      </AuthenticatedShell>
    </OrganizationBoundary>
  );
}
