import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./organization-service", () => ({
  organizationService: {
    get: mocks.get,
    update: mocks.update,
  },
}));

import { OrganizationSettingsView } from "./organization-settings-view";

const organization: OrganizationDTO = {
  organizationId: "org-1",
  name: "IT Club Store",
  description: "Student club merchandise",
  status: "PENDING",
  createdBy: "user-1",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

describe("OrganizationSettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the organization and saves only editable organization fields", async () => {
    mocks.get.mockResolvedValue(organization);
    mocks.update.mockResolvedValue({
      ...organization,
      name: "Updated Club Store",
      description: "Updated description",
      updatedAt: "2026-09-29T11:00:00.000Z",
    });

    render(<OrganizationSettingsView organizationId="org-1" />);

    const name = await screen.findByLabelText(/ชื่อหน่วยงาน/);
    const description = screen.getByLabelText(/คำอธิบาย/);

    fireEvent.change(name, {
      target: { value: "Updated Club Store" },
    });
    fireEvent.change(description, {
      target: { value: "Updated description" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "บันทึกการเปลี่ยนแปลง",
      }),
    );

    expect(mocks.update).toHaveBeenCalledWith("org-1", {
      name: "Updated Club Store",
      description: "Updated description",
    });

    expect(
      await screen.findByText("ข้อมูลหน่วยงานถูกอัปเดตเรียบร้อย"),
    ).toBeInTheDocument();
    expect(screen.getByText("รออนุมัติ")).toBeInTheDocument();
  });
});
