import {
  clearActiveOrganizationId,
  readActiveOrganizationId,
  writeActiveOrganizationId,
} from "@/lib";
import { ApiClientError } from "@/services";
import type {
  CurrentMembershipDTO,
  CurrentUserSessionDTO,
  MembershipRole,
} from "@/types";

export type OrganizationAccessResult =
  | {
      status: "allowed";
      membership: CurrentMembershipDTO;
    }
  | {
      status: "missing";
    }
  | {
      status: "forbidden";
      reason: "NO_MEMBERSHIP" | "INACTIVE_MEMBERSHIP" | "ROLE_FORBIDDEN";
    };

export type ApiAccessFailure =
  | "unauthorized"
  | "forbidden"
  | null;

export function resolveOrganizationAccess(
  session: CurrentUserSessionDTO,
  organizationId: string | null | undefined,
  allowedRoles?: readonly MembershipRole[],
): OrganizationAccessResult {
  if (!organizationId?.trim()) {
    return { status: "missing" };
  }

  const membership = session.memberships.find(
    (item) => item.organizationId === organizationId,
  );

  if (!membership) {
    return { status: "forbidden", reason: "NO_MEMBERSHIP" };
  }

  if (membership.status !== "ACTIVE") {
    return { status: "forbidden", reason: "INACTIVE_MEMBERSHIP" };
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return { status: "forbidden", reason: "ROLE_FORBIDDEN" };
  }

  return { status: "allowed", membership };
}

export function restoreActiveOrganizationId(
  memberships: readonly CurrentMembershipDTO[],
): string | null {
  const stored = readActiveOrganizationId();

  if (!stored) {
    return null;
  }

  const isAccessible = memberships.some(
    (membership) =>
      membership.organizationId === stored &&
      membership.status === "ACTIVE",
  );

  if (!isAccessible) {
    clearActiveOrganizationId();
    return null;
  }

  return stored;
}

export function rememberActiveOrganizationId(
  organizationId: string,
  memberships: readonly CurrentMembershipDTO[],
): boolean {
  const isAccessible = memberships.some(
    (membership) =>
      membership.organizationId === organizationId &&
      membership.status === "ACTIVE",
  );

  if (!isAccessible) {
    return false;
  }

  writeActiveOrganizationId(organizationId);
  return true;
}

export function classifyApiAccessFailure(error: unknown): ApiAccessFailure {
  if (!(error instanceof ApiClientError)) {
    return null;
  }

  if (error.kind === "unauthorized") {
    return "unauthorized";
  }

  if (error.kind === "forbidden") {
    return "forbidden";
  }

  return null;
}

export function isDefinitiveSessionFailure(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.code === "TOKEN_INVALID" || error.code === "TOKEN_EXPIRED")
  );
}
