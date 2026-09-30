import { describe, expect, it } from "vitest";

import {
  canApproveOrganization,
  canSuspendOrganization,
  platformOrganizationStatusLabel,
  platformUserStatusLabel,
} from "./platform-admin-helpers";

describe("platform admin helpers", () => {
  it("matches Backend Organization transition rules", () => {
    expect(canApproveOrganization("PENDING")).toBe(true);
    expect(canApproveOrganization("ACTIVE")).toBe(false);
    expect(canApproveOrganization("SUSPENDED")).toBe(false);

    expect(canSuspendOrganization("PENDING")).toBe(true);
    expect(canSuspendOrganization("ACTIVE")).toBe(true);
    expect(canSuspendOrganization("SUSPENDED")).toBe(false);
  });

  it("provides readable canonical status labels", () => {
    expect(platformOrganizationStatusLabel("PENDING")).toBe(
      "รออนุมัติ",
    );
    expect(platformOrganizationStatusLabel("ACTIVE")).toBe(
      "ใช้งาน",
    );
    expect(platformOrganizationStatusLabel("SUSPENDED")).toBe(
      "ระงับ",
    );
    expect(platformUserStatusLabel("ACTIVE")).toBe("ใช้งาน");
    expect(platformUserStatusLabel("DISABLED")).toBe(
      "ปิดใช้งาน",
    );
  });
});
