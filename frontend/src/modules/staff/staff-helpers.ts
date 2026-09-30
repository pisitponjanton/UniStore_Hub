import type {
  MembershipRole,
  OrganizationMemberDTO,
} from "@/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateStaffEmail(email: string): string | null {
  const normalized = normalizeStaffEmail(email);

  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    !EMAIL_PATTERN.test(normalized)
  ) {
    return "กรุณาระบุอีเมลที่ถูกต้อง";
  }

  return null;
}

export function activeAdminCount(
  members: readonly OrganizationMemberDTO[],
): number {
  return members.filter(
    (member) =>
      member.status === "ACTIVE" &&
      member.role === "ORGANIZATION_ADMIN",
  ).length;
}

export function isFinalActiveAdmin(
  member: OrganizationMemberDTO,
  members: readonly OrganizationMemberDTO[],
): boolean {
  return (
    member.status === "ACTIVE" &&
    member.role === "ORGANIZATION_ADMIN" &&
    activeAdminCount(members) <= 1
  );
}

export function staffRoleLabel(role: MembershipRole): string {
  return role === "ORGANIZATION_ADMIN"
    ? "Organization Admin"
    : "Staff";
}
