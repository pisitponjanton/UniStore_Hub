import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  approveOrganization: vi.fn(),
  suspendOrganization: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./platform-admin-service", () => ({
  platformAdminService: {
    listOrganizations: mocks.listOrganizations,
    approveOrganization: mocks.approveOrganization,
    suspendOrganization: mocks.suspendOrganization,
  },
}));

import { PlatformOrganizationsView } from "./platform-organizations-view";

function organization(
  overrides: Partial<OrganizationDTO> = {},
): OrganizationDTO {
  return {
    organizationId: "org-1",
    name: "Student Store",
    description: "Campus goods",
    status: "PENDING",
    createdBy: "user-1",
    createdAt: "2026-09-30T01:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
    ...overrides,
  };
}

function clickConfirm(label: string) {
  fireEvent.click(
    screen.getByRole("button", {
      name: label,
    }),
  );

  const buttons = screen.getAllByRole("button", {
    name: label === "อนุมัติ" ? "ยืนยันอนุมัติ" : "ยืนยันระงับ",
  });

  fireEvent.click(buttons[buttons.length - 1]!);
}

describe("PlatformOrganizationsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listOrganizations.mockResolvedValue({
      items: [organization()],
      nextCursor: null,
    });
  });

  it("shows approve and suspend only for Backend-allowed PENDING state", async () => {
    render(<PlatformOrganizationsView />);

    expect(
      await screen.findByText("Student Store"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "อนุมัติ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ระงับหน่วยงาน" }),
    ).toBeInTheDocument();
  });

  it("confirms approval and applies the Backend-returned OrganizationDTO", async () => {
    mocks.approveOrganization.mockResolvedValue(
      organization({
        status: "ACTIVE",
        updatedAt: "2026-09-30T02:00:00.000Z",
      }),
    );

    render(<PlatformOrganizationsView />);

    await screen.findByText("Student Store");
    clickConfirm("อนุมัติ");

    await waitFor(() => {
      expect(mocks.approveOrganization).toHaveBeenCalledWith(
        "org-1",
      );
    });

    expect(
      await screen.findByText(
        "อนุมัติหน่วยงาน Student Store เรียบร้อยแล้ว",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "อนุมัติ" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ระงับหน่วยงาน" }),
    ).toBeInTheDocument();
  });

  it("confirms suspension and removes further transition actions", async () => {
    mocks.suspendOrganization.mockResolvedValue(
      organization({
        status: "SUSPENDED",
        updatedAt: "2026-09-30T02:00:00.000Z",
      }),
    );

    render(<PlatformOrganizationsView />);

    await screen.findByText("Student Store");
    clickConfirm("ระงับหน่วยงาน");

    await waitFor(() => {
      expect(mocks.suspendOrganization).toHaveBeenCalledWith(
        "org-1",
      );
    });

    expect(
      await screen.findByText(
        "ระงับหน่วยงาน Student Store เรียบร้อยแล้ว",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "อนุมัติ" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "ระงับหน่วยงาน",
      }),
    ).not.toBeInTheDocument();
  });
});
