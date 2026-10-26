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
  authSession: { restore: mocks.restore, logout: mocks.logout },
  isDefinitiveSessionFailure: () => false,
}));
vi.mock("./staff-service", () => ({
  staffService: {
    list: mocks.list, add: mocks.add, updateRole: mocks.updateRole, remove: mocks.remove,
  },
}));
import { StaffView } from "./staff-view";

function member(
  userId: string, name: string, role: "STAFF" | "ORGANIZATION_ADMIN",
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
): OrganizationMemberDTO {
  return {
    organizationId: "org-1", userId, role, status,
    user: { userId, email: `${userId}@example.com`, name },
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };
}

describe("StaffView popup management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("protects the last active admin and keeps the member list compact", async () => {
    mocks.list.mockResolvedValue([
      member("admin-1", "Admin One", "ORGANIZATION_ADMIN"),
      member("staff-1", "Staff One", "STAFF"),
      member("inactive-1", "Inactive One", "STAFF", "INACTIVE"),
    ]);
    render(<StaffView organizationId="org-1" />);
    await screen.findByRole("heading", { name: "Admin One" });
    const row = screen.getByRole("heading", { name: "Admin One" }).closest("article");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(row as HTMLElement).queryByRole("button", { name: "นำออก" })).not.toBeInTheDocument();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "จัดการสมาชิก Admin One" }));
    const modal = screen.getByRole("dialog", { name: "จัดการสมาชิก" });
    expect(within(modal).getByText(/ผู้ดูแลหน่วยงานที่ใช้งานอยู่คนสุดท้าย/)).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "นำออกจากหน่วยงาน" })).toBeDisabled();
    fireEvent.change(within(modal).getByRole("combobox", { name: "บทบาท" }), {
      target: { value: "STAFF" },
    });
    expect(within(modal).getByRole("button", { name: "บันทึกบทบาท" })).toBeDisabled();
    expect(mocks.updateRole).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByRole("button", { name: "ปิด" }));
    fireEvent.click(screen.getByRole("button", { name: "จัดการสมาชิก Inactive One" }));
    expect(within(screen.getByRole("dialog", { name: "จัดการสมาชิก" }))
      .getByRole("button", { name: "นำออกจากหน่วยงาน" })).toBeDisabled();
  });

  it("opens a popup to add a member, normalizes the email, and refreshes the list", async () => {
    const admin = member("admin-1", "Admin One", "ORGANIZATION_ADMIN");
    const newStaff = member("staff-2", "New Staff", "STAFF");
    mocks.list.mockResolvedValueOnce([admin]).mockResolvedValueOnce([admin, newStaff]);
    mocks.add.mockResolvedValue(newStaff);
    render(<StaffView organizationId="org-1" />);
    await screen.findByRole("heading", { name: "Admin One" });
    expect(screen.queryByRole("textbox", { name: /อีเมลผู้ใช้/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มสมาชิก" }));
    const dialog = screen.getByRole("dialog", { name: "เพิ่มสมาชิก" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /อีเมลผู้ใช้/ }), {
      target: { value: "  NEW@Example.COM  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "เพิ่มสมาชิก" }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith("org-1", {
      email: "new@example.com", role: "STAFF",
    }));
    expect(await screen.findByText("New Staff")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "เพิ่มสมาชิก" })).not.toBeInTheDocument());
    expect(screen.getByText("เพิ่ม new@example.com เป็นบุคลากรแล้ว")).toBeInTheDocument();
  });

  it("focuses validation error summary inside the add popup", async () => {
    mocks.list.mockResolvedValue([member("admin-1", "Admin One", "ORGANIZATION_ADMIN")]);
    render(<StaffView organizationId="org-1" />);
    await screen.findByRole("heading", { name: "Admin One" });
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มสมาชิก" }));
    const dialog = screen.getByRole("dialog", { name: "เพิ่มสมาชิก" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /อีเมลผู้ใช้/ }), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "เพิ่มสมาชิก" }));
    expect(within(dialog).getByRole("link", { name: "กรุณาระบุอีเมลที่ถูกต้อง" }))
      .toHaveAttribute("href", "#staff-email");
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveFocus());
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("keeps role changes behind confirmation in member popup", async () => {
    const admin = member("admin-1", "Admin One", "ORGANIZATION_ADMIN");
    const staff = member("staff-1", "Staff One", "STAFF");
    mocks.list.mockResolvedValue([admin, staff]);
    mocks.updateRole.mockResolvedValue({ ...staff, role: "ORGANIZATION_ADMIN" });
    mocks.restore.mockResolvedValue({});
    render(<StaffView organizationId="org-1" />);
    await screen.findByRole("heading", { name: "Staff One" });
    fireEvent.click(screen.getByRole("button", { name: "จัดการสมาชิก Staff One" }));
    const dialog = screen.getByRole("dialog", { name: "จัดการสมาชิก" });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "บทบาท" }), {
      target: { value: "ORGANIZATION_ADMIN" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกบทบาท" }));
    expect(screen.getByRole("dialog", { name: "ยืนยันการเปลี่ยนบทบาท" })).toBeInTheDocument();
    expect(mocks.updateRole).not.toHaveBeenCalled();
  });
});
