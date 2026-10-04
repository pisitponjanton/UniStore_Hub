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
    return (
      <LoadingState
        headingLevel={1}
        title="กำลังเตรียมพื้นที่ใช้งาน"
        description="กำลังตรวจสอบบัญชีและเมนูที่คุณสามารถเข้าถึงได้"
      />
    );
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
      contextLabel={membership ? "หน่วยงานปัจจุบัน" : undefined}
      contextValue={membership?.organizationId}
      contextMeta={
        membership
          ? membership.role === "ORGANIZATION_ADMIN"
            ? "สิทธิ์: ผู้ดูแลหน่วยงาน"
            : "สิทธิ์: เจ้าหน้าที่"
          : undefined
      }
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
