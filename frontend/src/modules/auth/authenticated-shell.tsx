"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ApplicationShell, LoadingState } from "@/components";

import { buildNavigationGroups, getActiveMembership } from "./navigation";
import { organizationService } from "@/modules/organizations/organization-service";
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
  const [organizationLabel, setOrganizationLabel] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated" || !organizationId) return;
    const controller = new AbortController();
    // Display friendly information when authorized, without delaying navigation.
    void organizationService.get(organizationId, { signal: controller.signal })
      .then((organization) => {
        if (!controller.signal.aborted) {
          setOrganizationLabel({ id: organizationId, name: organization.name });
        }
      })
      .catch(() => {
        // A failed secondary label request never changes RBAC or hides the page.
      });
    return () => controller.abort();
  }, [auth.status, organizationId]);

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

  const activeMemberships = auth.memberships.filter(
    (item) => item.status === "ACTIVE",
  );
  const workAreas = [
    { id: "customer" as const, href: "/", label: "ซื้อสินค้า" },
    ...(activeMemberships.length > 0
      ? [{
          id: "organization" as const,
          href: "/org/select/",
          label: "จัดการหน่วยงาน",
        }]
      : []),
    ...(auth.user.platformRole === "PLATFORM_ADMIN"
      ? [{
          id: "platform" as const,
          href: "/platform/summary/",
          label: "ดูแลแพลตฟอร์ม",
        }]
      : []),
  ];

  return (
    <ApplicationShell
      groups={groups}
      userName={auth.user.name}
      userEmail={auth.user.email}
      contextLabel={membership ? "หน่วยงานปัจจุบัน" : undefined}
      contextValue={
        membership
          ? organizationLabel?.id === membership.organizationId
            ? organizationLabel.name
            : "หน่วยงานที่เลือก"
          : undefined
      }
      contextId={membership?.organizationId}
      contextMeta={
        membership
          ? membership.role === "ORGANIZATION_ADMIN"
            ? "สิทธิ์: ผู้ดูแลหน่วยงาน"
            : "สิทธิ์: เจ้าหน้าที่"
          : undefined
      }
      showOrganizationSwitcher={activeMemberships.length > 0}
      workAreas={workAreas}
      onLogout={() => {
        authSession.logout();
        router.push("/");
      }}
    >
      {children}
    </ApplicationShell>
  );
}
