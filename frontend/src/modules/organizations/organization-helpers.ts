import type {
  CurrentMembershipDTO,
  MembershipRole,
  OrganizationDTO,
} from "@/types";

export interface OrganizationFormValues {
  name: string;
  description: string;
}

export interface OrganizationFormErrors {
  name?: string;
}

export function validateOrganizationForm(
  values: OrganizationFormValues,
): {
  values: OrganizationFormValues;
  errors: OrganizationFormErrors;
  valid: boolean;
} {
  const normalized = {
    name: values.name.trim(),
    description: values.description.trim(),
  };
  const errors: OrganizationFormErrors = {};

  if (!normalized.name) {
    errors.name = "กรุณาระบุชื่อหน่วยงาน";
  }

  return {
    values: normalized,
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

export function organizationLandingHref(
  organizationId: string,
  role: MembershipRole,
): string {
  const params = new URLSearchParams({ organizationId });
  const path =
    role === "ORGANIZATION_ADMIN" ? "/org/dashboard/" : "/org/orders/";

  return `${path}?${params.toString()}`;
}

export function settingsHref(organizationId: string): string {
  const params = new URLSearchParams({ organizationId });
  return `/org/settings/?${params.toString()}`;
}

export function joinAccessibleOrganizations(
  organizations: readonly OrganizationDTO[],
  memberships: readonly CurrentMembershipDTO[],
): Array<{
  organization: OrganizationDTO;
  membership: CurrentMembershipDTO;
}> {
  const byId = new Map(
    organizations.map((organization) => [
      organization.organizationId,
      organization,
    ]),
  );

  return memberships
    .filter((membership) => membership.status === "ACTIVE")
    .flatMap((membership) => {
      const organization = byId.get(membership.organizationId);

      return organization
        ? [{ organization, membership }]
        : [];
    });
}
