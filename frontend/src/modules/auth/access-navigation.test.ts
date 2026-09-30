import { describe, expect, it, vi } from "vitest";

import * as sessionStorageHelpers from "@/lib/session-storage";
import { ApiClientError } from "@/services";
import type {
  CurrentMembershipDTO,
  CurrentUserSessionDTO,
} from "@/types";

import {
  classifyApiAccessFailure,
  rememberActiveOrganizationId,
  resolveOrganizationAccess,
  restoreActiveOrganizationId,
} from "./access";
import {
  buildNavigationGroups,
  buildOrganizationNavigation,
  buildPlatformNavigation,
} from "./navigation";

const memberships: CurrentMembershipDTO[] = [
  {
    organizationId: "org-admin",
    role: "ORGANIZATION_ADMIN",
    status: "ACTIVE",
  },
  {
    organizationId: "org-staff",
    role: "STAFF",
    status: "ACTIVE",
  },
  {
    organizationId: "org-inactive",
    role: "STAFF",
    status: "INACTIVE",
  },
];

const session: CurrentUserSessionDTO = {
  user: {
    userId: "user-1",
    email: "user@example.com",
    name: "User",
    status: "ACTIVE",
    platformRole: null,
  },
  memberships,
};

describe("organization access", () => {
  it("allows only an active membership and applies optional role constraints", () => {
    expect(
      resolveOrganizationAccess(session, "org-admin", [
        "ORGANIZATION_ADMIN",
      ]).status,
    ).toBe("allowed");

    expect(
      resolveOrganizationAccess(session, "org-staff", [
        "ORGANIZATION_ADMIN",
      ]),
    ).toEqual({ status: "forbidden", reason: "ROLE_FORBIDDEN" });

    expect(resolveOrganizationAccess(session, "org-inactive")).toEqual({
      status: "forbidden",
      reason: "INACTIVE_MEMBERSHIP",
    });
  });

  it("treats a missing organization id as invalid navigation context", () => {
    expect(resolveOrganizationAccess(session, null)).toEqual({
      status: "missing",
    });
  });

  it("restores only an accessible remembered organization", () => {
    vi.spyOn(sessionStorageHelpers, "readActiveOrganizationId").mockReturnValue(
      "org-admin",
    );
    expect(restoreActiveOrganizationId(memberships)).toBe("org-admin");
  });

  it("refuses to remember an inaccessible organization", () => {
    const write = vi.spyOn(
      sessionStorageHelpers,
      "writeActiveOrganizationId",
    );

    expect(
      rememberActiveOrganizationId("org-missing", memberships),
    ).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("role-aware navigation", () => {
  it("keeps production and management links away from Staff navigation", () => {
    const group = buildOrganizationNavigation("org-staff", "STAFF");
    const labels = group.items.map((item) => item.label);

    expect(labels).toEqual([
      "คำสั่งซื้อ",
      "ตรวจสอบการชำระเงิน",
      "รับสินค้า",
    ]);
    expect(labels).not.toContain("สรุปการผลิต");
  });

  it("provides the complete Organization Admin navigation set", () => {
    const group = buildOrganizationNavigation(
      "org-admin",
      "ORGANIZATION_ADMIN",
    );
    const labels = group.items.map((item) => item.label);

    expect(labels).toContain("แดชบอร์ด");
    expect(labels).toContain("บุคลากร");
    expect(labels).toContain("สรุปการผลิต");
    expect(labels).toContain("ประวัติการทำรายการ");
  });

  it("derives Platform Admin navigation only from user.platformRole", () => {
    expect(buildPlatformNavigation(session.user)).toBeNull();

    expect(
      buildPlatformNavigation({
        ...session.user,
        platformRole: "PLATFORM_ADMIN",
      })?.items.map((item) => item.href),
    ).toEqual([
      "/platform/summary/",
      "/platform/organizations/",
      "/platform/users/",
    ]);
  });

  it("combines customer, organization, and platform groups without treating membership as platform authority", () => {
    const groups = buildNavigationGroups({
      user: {
        ...session.user,
        platformRole: "PLATFORM_ADMIN",
      },
      memberships,
      organizationId: "org-staff",
    });

    expect(groups.map((group) => group.label)).toEqual([
      "บัญชีของฉัน",
      "งานของหน่วยงาน",
      "Platform Admin",
    ]);
  });
});

describe("API access failures", () => {
  it("distinguishes unauthorized from forbidden responses", () => {
    expect(
      classifyApiAccessFailure(
        new ApiClientError({
          status: 401,
          code: "TOKEN_EXPIRED",
          kind: "unauthorized",
        }),
      ),
    ).toBe("unauthorized");

    expect(
      classifyApiAccessFailure(
        new ApiClientError({
          status: 403,
          code: "FORBIDDEN",
          kind: "forbidden",
        }),
      ),
    ).toBe("forbidden");
  });
});
