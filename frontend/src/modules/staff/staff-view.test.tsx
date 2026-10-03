import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationMemberDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  updateRole: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
  authSession: {
    restore: mocks.restore,
    logout: mocks.logout,
  },
  isDefinitiveSessionFailure: () => false,
}));

vi.mock("./staff-service", () => ({
  staffService: {
    list: mocks.list,
    add: mocks.add,
    updateRole: mocks.updateRole,
    remove: mocks.remove,
  },
}));

import { StaffView } from "./staff-view";

function member(
  userId: string,
  name: string,
  role: "STAFF" | "ORGANIZATION_ADMIN",
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
): OrganizationMemberDTO {
  return {
    organizationId: "org-1",
    userId,
    role,
    status,
    user: {
      userId,
      email: `${userId}@example.com`,
      name,
    },
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };
}

describe("StaffView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces the final-admin guard and keeps its destructive action disabled", async () => {
    mocks.list.mockResolvedValue([
      member("admin-1", "Admin One", "ORGANIZATION_ADMIN"),
      member("staff-1", "Staff One", "STAFF"),
    ]);

    render(<StaffView organizationId="org-1" />);

    expect(
      await screen.findByText(
        "สมาชิกคนนี้เป็นผู้ดูแลหน่วยงานที่ใช้งานอยู่คนสุดท้าย จึงไม่สามารถลดสิทธิ์หรือนำออกได้",
      ),
    ).toBeInTheDocument();

    const adminCard = screen
      .getByRole("heading", { name: "Admin One" })
      .closest("article");

    expect(adminCard).not.toBeNull();
    expect(
      within(adminCard as HTMLElement).getByRole("button", {
        name: "นำออก",
      }),
    ).toBeDisabled();
    expect(screen.getAllByText("ผู้ดูแลหน่วยงาน").length).toBeGreaterThan(0);
    expect(screen.getAllByText("เจ้าหน้าที่").length).toBeGreaterThan(0);
  });

  it("normalizes an email before adding a member and refreshes the list", async () => {
    const admin = member("admin-1", "Admin One", "ORGANIZATION_ADMIN");
    const newStaff = member("staff-2", "New Staff", "STAFF");

    mocks.list
      .mockResolvedValueOnce([admin])
      .mockResolvedValueOnce([admin, newStaff]);
    mocks.add.mockResolvedValue(newStaff);

    render(<StaffView organizationId="org-1" />);

    await screen.findByRole("heading", { name: "Admin One" });

    fireEvent.change(screen.getByRole("textbox", { name: /อีเมลผู้ใช้/ }), {
      target: { value: "  NEW@Example.COM  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "เพิ่มสมาชิก" }),
    );

    await waitFor(() => {
      expect(mocks.add).toHaveBeenCalledWith("org-1", {
        email: "new@example.com",
        role: "STAFF",
      });
    });

    expect(await screen.findByText("New Staff")).toBeInTheDocument();
    expect(
      screen.getByText("เพิ่ม new@example.com เป็นบุคลากรแล้ว"),
    ).toBeInTheDocument();
  });

  it("focuses a validation summary when an invalid member email is submitted", async () => {
    mocks.list.mockResolvedValue([
      member("admin-1", "Admin One", "ORGANIZATION_ADMIN"),
    ]);

    render(<StaffView organizationId="org-1" />);

    await screen.findByRole("heading", { name: "Admin One" });

    fireEvent.change(screen.getByRole("textbox", { name: /อีเมลผู้ใช้/ }), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "เพิ่มสมาชิก" }),
    );

    const summary = await screen.findByRole("alert");
    expect(
      screen.getByRole("link", { name: "กรุณาระบุอีเมลที่ถูกต้อง" }),
    ).toHaveAttribute("href", "#staff-email");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(mocks.add).not.toHaveBeenCalled();
  });
});
