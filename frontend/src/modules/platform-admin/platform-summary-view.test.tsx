import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformSummaryDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  getSummary: vi.fn(),
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
    getSummary: mocks.getSummary,
  },
}));

import { PlatformSummaryView } from "./platform-summary-view";

const summary: PlatformSummaryDTO = {
  organizationsByStatus: {
    PENDING: 2,
    ACTIVE: 5,
    SUSPENDED: 1,
  },
  usersByStatus: {
    ACTIVE: 12,
    DISABLED: 3,
  },
};

describe("PlatformSummaryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSummary.mockResolvedValue(summary);
  });

  it("shows Platform summary counts and priority totals from the documented response", async () => {
    render(<PlatformSummaryView />);

    expect(
      await screen.findByRole("heading", {
        name: "ภาพรวม Platform",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("หน่วยงานรออนุมัติ"),
    ).toBeInTheDocument();
    expect(screen.getByText("หน่วยงานทั้งหมด")).toBeInTheDocument();
    expect(screen.getByText("ผู้ใช้ทั้งหมด")).toBeInTheDocument();
    expect(
      screen.getByText("User.platformRole = PLATFORM_ADMIN", {
        exact: false,
      }),
    ).toBeInTheDocument();

    expect(mocks.getSummary).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
    });
  });
});
