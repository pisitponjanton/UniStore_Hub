import { fireEvent, render, screen } from "@testing-library/react";
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

  it("keeps a meaningful page heading visible while the API is loading", () => {
    mocks.listUsers.mockImplementation(() => new Promise(() => {}));
    render(<PlatformUsersView />);

    expect(screen.getByRole("heading", {
      name: "ผู้ใช้ระดับ Platform",
      level: 1,
    })).toBeInTheDocument();
    expect(screen.getByText("กำลังโหลดผู้ใช้ทั้งหมด")).toBeInTheDocument();
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
    expect(
      screen.getByLabelText("ขอบเขตสิทธิ์ Platform Admin"),
    ).toHaveTextContent("รายการผู้ใช้ระดับ Platform แบบอ่านอย่างเดียว");

    const times = document.querySelectorAll("time");
    expect(times).toHaveLength(4);
    expect(times[0]).toHaveAttribute(
      "datetime",
      "2026-09-30T01:00:00.000Z",
    );

    expect(mocks.listUsers).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
    });
  });
  it("searches 300+ loaded users, filters by actual Platform role, without exposing edit actions", async () => {
    const many: UserDTO[] = Array.from({ length: 328 }, (_, index) => ({
      ...users[0]!,
      userId: "user-" + index,
      name: index === 327 ? "Target Operator" : "Test User " + index,
      email: "operator" + index + "@example.com",
      platformRole: index === 327 ? "PLATFORM_ADMIN" : null,
      status: index % 2 === 0 ? "ACTIVE" : "DISABLED",
    }));
    mocks.listUsers.mockResolvedValueOnce({ items: many, nextCursor: null });
    render(<PlatformUsersView />);
    await screen.findByText("Test User 0");
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(24);
    const search = screen.getByRole("searchbox", { name: "ค้นหาผู้ใช้ที่โหลดแล้ว" });
    fireEvent.change(search, { target: { value: "target operator" } });
    expect(screen.getByText("Target Operator")).toBeInTheDocument();
    expect(screen.queryByText("Test User 0")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Platform Admin 1/ }));
    expect(screen.getByText("Target Operator")).toBeInTheDocument();
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /ระงับ|ลบผู้ใช้|แก้ไขสิทธิ์/ })).not.toBeInTheDocument();
    expect(mocks.listUsers).toHaveBeenCalledTimes(1);
  });

});
