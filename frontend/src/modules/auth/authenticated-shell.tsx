"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ApplicationShell, LoadingState } from "@/components";

import { buildNavigationGroups, getActiveMembership } from "./navigation";
import { authSession } from "./session";
import { useAuthSession } from "./use-auth-session";

export function AuthenticatedShell({
  organizationId,
  children,
}: {
  organizationId?: string | null;
  children: ReactNode;
}) {
  const auth = useAuthSession();
  const router = useRouter();

  if (auth.status === "loading") {
    return <LoadingState title="กำลังเตรียมพื้นที่ใช้งาน" />;
  }

  if (auth.status !== "authenticated") {
    return children;
  }

  const membership = getActiveMembership(
    auth.memberships,
    organizationId,
  );

  const groups = buildNavigationGroups({
    user: auth.user,
    memberships: auth.memberships,
    organizationId,
  });

  return (
    <ApplicationShell
      groups={groups}
      userName={auth.user.name}
      userEmail={auth.user.email}
      contextLabel={membership ? "หน่วยงานที่เลือก" : undefined}
      contextValue={membership?.organizationId}
      showOrganizationSwitcher={auth.memberships.some(
        (item) => item.status === "ACTIVE",
      )}
      onLogout={() => {
        authSession.logout();
        router.push("/");
      }}
    >
      {children}
    </ApplicationShell>
  );
}
