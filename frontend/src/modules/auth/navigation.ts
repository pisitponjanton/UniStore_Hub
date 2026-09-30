import type {
  CurrentMembershipDTO,
  CurrentUserDTO,
  MembershipRole,
} from "@/types";

export interface NavigationItem {
  label: string;
  href: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

function withOrganization(path: string, organizationId: string): string {
  const params = new URLSearchParams({ organizationId });
  return `${path}?${params.toString()}`;
}

export function getActiveMembership(
  memberships: readonly CurrentMembershipDTO[],
  organizationId: string | null | undefined,
): CurrentMembershipDTO | null {
  if (!organizationId) {
    return null;
  }

  return (
    memberships.find(
      (membership) =>
        membership.organizationId === organizationId &&
        membership.status === "ACTIVE",
    ) ?? null
  );
}

export function buildCustomerNavigation(): NavigationGroup {
  return {
    label: "บัญชีของฉัน",
    items: [
      { label: "หน้าร้านค้า", href: "/" },
      { label: "คำสั่งซื้อของฉัน", href: "/my/orders/" },
      { label: "การแจ้งเตือน", href: "/notifications/" },
    ],
  };
}

export function buildOrganizationNavigation(
  organizationId: string,
  role: MembershipRole,
): NavigationGroup {
  const operationalItems: NavigationItem[] = [
    {
      label: "คำสั่งซื้อ",
      href: withOrganization("/org/orders/", organizationId),
    },
    {
      label: "ตรวจสอบการชำระเงิน",
      href: withOrganization("/org/payments/", organizationId),
    },
    {
      label: "รับสินค้า",
      href: withOrganization("/org/pickups/", organizationId),
    },
  ];

  if (role === "STAFF") {
    return {
      label: "งานของหน่วยงาน",
      items: operationalItems,
    };
  }

  return {
    label: "จัดการหน่วยงาน",
    items: [
      {
        label: "แดชบอร์ด",
        href: withOrganization("/org/dashboard/", organizationId),
      },
      {
        label: "ข้อมูลหน่วยงาน",
        href: withOrganization("/org/settings/", organizationId),
      },
      {
        label: "บุคลากร",
        href: withOrganization("/org/staff/", organizationId),
      },
      {
        label: "ร้านค้า",
        href: withOrganization("/org/stores/", organizationId),
      },
      {
        label: "สินค้า",
        href: withOrganization("/org/products/", organizationId),
      },
      {
        label: "แคมเปญ",
        href: withOrganization("/org/campaigns/", organizationId),
      },
      ...operationalItems,
      {
        label: "สรุปการผลิต",
        href: withOrganization("/org/production/", organizationId),
      },
      {
        label: "ประวัติการทำรายการ",
        href: withOrganization("/org/audit/", organizationId),
      },
    ],
  };
}

export function buildPlatformNavigation(
  user: CurrentUserDTO,
): NavigationGroup | null {
  if (user.platformRole !== "PLATFORM_ADMIN") {
    return null;
  }

  return {
    label: "Platform Admin",
    items: [
      { label: "ภาพรวมระบบ", href: "/platform/summary/" },
      { label: "หน่วยงาน", href: "/platform/organizations/" },
      { label: "ผู้ใช้", href: "/platform/users/" },
    ],
  };
}

export function buildNavigationGroups({
  user,
  memberships,
  organizationId,
}: {
  user: CurrentUserDTO;
  memberships: readonly CurrentMembershipDTO[];
  organizationId?: string | null;
}): NavigationGroup[] {
  const groups: NavigationGroup[] = [buildCustomerNavigation()];
  const membership = getActiveMembership(memberships, organizationId);

  if (membership) {
    groups.push(
      buildOrganizationNavigation(
        membership.organizationId,
        membership.role,
      ),
    );
  }

  const platform = buildPlatformNavigation(user);

  if (platform) {
    groups.push(platform);
  }

  return groups;
}
