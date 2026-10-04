import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  listAccessible: vi.fn(),
  create: vi.fn(),
  restore: vi.fn(),
  logout: vi.fn(),
  remember: vi.fn(),
  useAuthSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    restore: mocks.restore,
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
  rememberActiveOrganizationId: mocks.remember,
  useAuthSession: mocks.useAuthSession,
}));

vi.mock("./organization-service", () => ({
  organizationService: {
    listAccessible: mocks.listAccessible,
    create: mocks.create,
  },
}));

import { OrganizationSelectView } from "./organization-select-view";

function organization(
  organizationId: string,
  name: string,
): OrganizationDTO {
  return {
    organizationId,
    name,
    description: `${name} description`,
    status: "ACTIVE",
    createdBy: "user-1",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };
}

describe("OrganizationSelectView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.remember.mockReturnValue(true);
    mocks.useAuthSession.mockReturnValue({
      status: "authenticated",
      user: {
        userId: "user-1",
        email: "admin@example.com",
        name: "Admin",
        status: "ACTIVE",
        platformRole: null,
      },
      memberships: [
        {
          organizationId: "org-1",
          role: "ORGANIZATION_ADMIN",
          status: "ACTIVE",
        },
      ],
    });
  });

  it("shows only organizations backed by an active membership and routes by role", async () => {
    mocks.listAccessible.mockResolvedValue([
      organization("org-1", "IT Club"),
      organization("org-2", "Other Club"),
    ]);

    render(<OrganizationSelectView />);

    expect(await screen.findByText("IT Club")).toBeInTheDocument();
    expect(screen.queryByText("Other Club")).not.toBeInTheDocument();
    expect(screen.getByText("ผู้ดูแลหน่วยงาน")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "เข้าใช้งาน IT Club" }),
    );

    expect(mocks.remember).toHaveBeenCalledWith(
      "org-1",
      expect.any(Array),
    );
    expect(mocks.push).toHaveBeenCalledWith(
      "/org/dashboard/?organizationId=org-1",
    );
  });

  it("retries loading accessible organizations in place after a recoverable error", async () => {
    mocks.listAccessible
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([organization("org-1", "IT Club")]);

    render(<OrganizationSelectView />);

    fireEvent.click(
      await screen.findByRole("button", { name: "ลองโหลดอีกครั้ง" }),
    );

    expect(mocks.listAccessible).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("IT Club")).toBeInTheDocument();
  });

  it("shows a focusable validation summary before creating an unnamed organization", async () => {
    mocks.listAccessible.mockResolvedValue([
      organization("org-1", "IT Club"),
    ]);

    render(<OrganizationSelectView />);

    await screen.findByText("IT Club");

    fireEvent.click(
      screen.getByRole("button", { name: "สร้างหน่วยงาน" }),
    );

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("link", { name: "กรุณาระบุชื่อหน่วยงาน" }),
    ).toHaveAttribute("href", "#organization-name");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
