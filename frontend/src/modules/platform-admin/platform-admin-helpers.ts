import type {
  OrganizationStatus,
  UserStatus,
} from "@/types";

export function platformOrganizationStatusLabel(
  status: OrganizationStatus,
): string {
  switch (status) {
    case "PENDING":
      return "รออนุมัติ";
    case "ACTIVE":
      return "ใช้งาน";
    case "SUSPENDED":
      return "ระงับ";
  }
}

export function platformOrganizationStatusTone(
  status: OrganizationStatus,
): "info" | "success" | "danger" {
  switch (status) {
    case "PENDING":
      return "info";
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "danger";
  }
}

export function platformUserStatusLabel(
  status: UserStatus,
): string {
  return status === "ACTIVE" ? "ใช้งาน" : "ปิดใช้งาน";
}

export function platformUserStatusTone(
  status: UserStatus,
): "success" | "danger" {
  return status === "ACTIVE" ? "success" : "danger";
}

export function canApproveOrganization(
  status: OrganizationStatus,
): boolean {
  return status === "PENDING";
}

export function canSuspendOrganization(
  status: OrganizationStatus,
): boolean {
  return status !== "SUSPENDED";
}
