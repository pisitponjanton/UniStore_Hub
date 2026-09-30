import { describe, expect, it } from "vitest";

import type { OrganizationMemberDTO } from "@/types";

import {
  activeAdminCount,
  isFinalActiveAdmin,
  normalizeStaffEmail,
  staffRoleLabel,
  validateStaffEmail,
} from "./staff-helpers";

function member(
  userId: string,
  role: "STAFF" | "ORGANIZATION_ADMIN",
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
): OrganizationMemberDTO {
  return {
    organizationId: "org-1",
    userId,
    role,
    status,
    user: {
      userId,
      email: `${userId}@example.com`,
      name: userId,
    },
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };
}

describe("staff helpers", () => {
  it("normalizes and validates add-member email", () => {
    expect(normalizeStaffEmail(" Staff@Example.COM ")).toBe(
      "staff@example.com",
    );
    expect(validateStaffEmail("staff@example.com")).toBeNull();
    expect(validateStaffEmail("invalid")).toBe(
      "กรุณาระบุอีเมลที่ถูกต้อง",
    );
  });

  it("identifies only the final active Organization Admin", () => {
    const finalAdmin = member(
      "admin-1",
      "ORGANIZATION_ADMIN",
    );
    const staff = member("staff-1", "STAFF");
    const inactiveAdmin = member(
      "admin-old",
      "ORGANIZATION_ADMIN",
      "INACTIVE",
    );
    const oneAdmin = [finalAdmin, staff, inactiveAdmin];

    expect(activeAdminCount(oneAdmin)).toBe(1);
    expect(isFinalActiveAdmin(finalAdmin, oneAdmin)).toBe(true);
    expect(isFinalActiveAdmin(staff, oneAdmin)).toBe(false);

    const twoAdmins = [
      ...oneAdmin,
      member("admin-2", "ORGANIZATION_ADMIN"),
    ];

    expect(activeAdminCount(twoAdmins)).toBe(2);
    expect(isFinalActiveAdmin(finalAdmin, twoAdmins)).toBe(false);
  });

  it("labels canonical organization membership roles", () => {
    expect(staffRoleLabel("STAFF")).toBe("Staff");
    expect(staffRoleLabel("ORGANIZATION_ADMIN")).toBe(
      "Organization Admin",
    );
  });
});
