import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("retries loading organization settings in place after a recoverable error", async () => {
    mocks.get
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(organization);

    render(<OrganizationSettingsView organizationId="org-1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "ลองโหลดอีกครั้ง" }),
    );

    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole("heading", { name: "ตั้งค่าหน่วยงาน" }),
    ).toBeInTheDocument();
  });

  it("reports invalid editable data through a focusable error summary", async () => {
    mocks.get.mockResolvedValue(organization);

    render(<OrganizationSettingsView organizationId="org-1" />);

    const name = await screen.findByLabelText(/ชื่อหน่วยงาน/);
    fireEvent.change(name, { target: { value: "" } });

    fireEvent.click(
      screen.getByRole("button", {
        name: "บันทึกการเปลี่ยนแปลง",
      }),
    );

    const summary = await screen.findByRole("alert");
    expect(
      screen.getByRole("link", { name: "กรุณาระบุชื่อหน่วยงาน" }),
    ).toHaveAttribute("href", "#organization-settings-name");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
