import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
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
    listUsers: mocks.listUsers,
  },
}));

import { PlatformUsersView } from "./platform-users-view";

const users: UserDTO[] = [
  {
    userId: "user-admin",
    email: "admin@example.com",
    name: "Platform Admin One",
    status: "ACTIVE",
    platformRole: "PLATFORM_ADMIN",
    createdAt: "2026-09-30T01:00:00.000Z",
    updatedAt: "2026-09-30T02:00:00.000Z",
  },
  {
    userId: "user-disabled",
    email: "disabled@example.com",
    name: "Disabled User",
    status: "DISABLED",
    platformRole: null,
    createdAt: "2026-09-29T01:00:00.000Z",
    updatedAt: "2026-09-29T02:00:00.000Z",
  },
];

describe("PlatformUsersView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listUsers.mockResolvedValue({
      items: users,
      nextCursor: null,
    });
  });

  it("renders persisted user status and platformRole as a read-only list", async () => {
    render(<PlatformUsersView />);

    expect(
      await screen.findByText("Platform Admin One"),
    ).toBeInTheDocument();
    expect(screen.getByText("Disabled User")).toBeInTheDocument();
    expect(
      screen.getAllByText("Platform Admin").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("ไม่มี Platform role"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("รายการนี้เป็น read-only"),
    ).toBeInTheDocument();

    expect(mocks.listUsers).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
    });
  });
});
