import type {
  CurrentMembershipDTO,
  CurrentUserDTO,
  MembershipRole,
} from "@/types";

export interface NavigationItem {
  label: string;
  href: string;
  activePaths?: string[];
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

function normalizeNavigationPath(path: string): string {
  if (path === "/") {
    return "/";
  }

  return path.replace(/\/+$/, "");
}

export function isNavigationItemActive(
  pathname: string,
  item: NavigationItem,
): boolean {
  const currentPath = normalizeNavigationPath(pathname);
  const hrefPath = item.href.split("?")[0] ?? item.href;
  const candidates = [hrefPath, ...(item.activePaths ?? [])];

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeNavigationPath(candidate);

    if (normalizedCandidate === "/") {
      return currentPath === "/";
    }

    return (
      currentPath === normalizedCandidate ||
      currentPath.startsWith(`${normalizedCandidate}/`)
    );
  });
}

function withOrganization(path: string, organizationId: string): string {
  const params = new URLSearchParams({ organizationId });
  return `${path}?${params.toString()}`;
}

function organizationOperationalItems(
  organizationId: string,
): NavigationItem[] {
  return [
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
      {
        label: "คำสั่งซื้อของฉัน",
        href: "/my/orders/",
        activePaths: ["/my/order/", "/my/payment/", "/my/pickup/"],
      },
      { label: "การแจ้งเตือน", href: "/notifications/" },
    ],
  };
}

export function buildOrganizationNavigation(
  organizationId: string,
  role: MembershipRole,
): NavigationGroup {
  const operationalItems = organizationOperationalItems(organizationId);

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

export function buildOrganizationNavigationGroups(
  organizationId: string,
  role: MembershipRole,
): NavigationGroup[] {
  if (role === "STAFF") {
    return [buildOrganizationNavigation(organizationId, role)];
  }

  return [
    {
      label: "หน่วยงาน",
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
      ],
    },
    {
      label: "ร้านค้าและแคมเปญ",
      items: [
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
      ],
    },
    {
      label: "งานปฏิบัติการ",
      items: [
        ...organizationOperationalItems(organizationId),
        {
          label: "สรุปการผลิต",
          href: withOrganization("/org/production/", organizationId),
        },
      ],
    },
    {
      label: "ตรวจสอบ",
      items: [
        {
          label: "ประวัติการทำรายการ",
          href: withOrganization("/org/audit/", organizationId),
        },
      ],
    },
  ];
}

export function buildPlatformNavigation(
  user: CurrentUserDTO,
): NavigationGroup | null {
  if (user.platformRole !== "PLATFORM_ADMIN") {
    return null;
  }

  return {
    label: "ผู้ดูแลแพลตฟอร์ม",
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
      ...buildOrganizationNavigationGroups(
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
