import { describe, expect, it } from "vitest";

import type {
  CurrentMembershipDTO,
  OrganizationDTO,
} from "@/types";

import {
  joinAccessibleOrganizations,
  organizationLandingHref,
  settingsHref,
  validateOrganizationForm,
} from "./organization-helpers";

const organizations: OrganizationDTO[] = [
  {
    organizationId: "org-admin",
    name: "Admin Org",
    description: "",
    status: "ACTIVE",
    createdBy: "user-1",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  },
  {
    organizationId: "org-staff",
    name: "Staff Org",
    description: "",
    status: "PENDING",
    createdBy: "user-2",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  },
  {
    organizationId: "platform-only",
    name: "Platform Result",
    description: "",
    status: "ACTIVE",
    createdBy: "user-3",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  },
];

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
    organizationId: "inactive-org",
    role: "ORGANIZATION_ADMIN",
    status: "INACTIVE",
  },
];

describe("organization helpers", () => {
  it("keeps selection constrained to active memberships even if list API contains extra platform results", () => {
    expect(
      joinAccessibleOrganizations(organizations, memberships).map(
        ({ organization }) => organization.organizationId,
      ),
    ).toEqual(["org-admin", "org-staff"]);
  });

  it("routes admins and staff to their role-appropriate organization surfaces", () => {
    expect(
      organizationLandingHref("org 1", "ORGANIZATION_ADMIN"),
    ).toBe("/org/dashboard/?organizationId=org+1");
    expect(organizationLandingHref("org 1", "STAFF")).toBe(
      "/org/orders/?organizationId=org+1",
    );
    expect(settingsHref("org 1")).toBe(
      "/org/settings/?organizationId=org+1",
    );
  });

  it("normalizes the organization form and requires a non-empty name", () => {
    expect(
      validateOrganizationForm({
        name: "  IT Club  ",
        description: "  Student goods  ",
      }),
    ).toEqual({
      values: {
        name: "IT Club",
        description: "Student goods",
      },
      errors: {},
      valid: true,
    });

    expect(
      validateOrganizationForm({
        name: "   ",
        description: "",
      }).valid,
    ).toBe(false);
  });
});
