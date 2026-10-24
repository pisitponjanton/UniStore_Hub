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

  it("keeps a small directory free of redundant search, count card and creation form", async () => {
    mocks.listAccessible.mockResolvedValue([{ ...organization("org-1", "IT Club"), status: "PENDING" }]);
    render(<OrganizationSelectView />);
    expect(await screen.findByRole("heading", { name: "หน่วยงานของฉัน" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "หน่วยงาน (1)" })).toBeInTheDocument();
    expect(screen.getByText("กำลังรอการตรวจสอบจากผู้ดูแลแพลตฟอร์ม")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ดูสถานะคำขอ IT Club" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "ค้นหาหน่วยงานที่เข้าถึงได้" })).not.toBeInTheDocument();
    expect(screen.queryByText("เข้าถึงได้")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "ชื่อหน่วยงาน" })).not.toBeInTheDocument();
    const open = screen.getByRole("button", { name: "สร้างหน่วยงาน" });
    expect(screen.queryByRole("dialog", { name: "สร้างหน่วยงาน" })).not.toBeInTheDocument();
    fireEvent.click(open);
    const dialog = await screen.findByRole("dialog", { name: "สร้างหน่วยงาน" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "สร้างหน่วยงาน" })).not.toBeInTheDocument());
    expect(screen.queryByRole("textbox", { name: "ชื่อหน่วยงาน" })).not.toBeInTheDocument();
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

  it("focuses the invalid name with one inline message before creating an organization", async () => {
    mocks.listAccessible.mockResolvedValue([
      organization("org-1", "IT Club"),
    ]);

    render(<OrganizationSelectView />);

    await screen.findByText("IT Club");

    const open = screen.getByRole("button", { name: "สร้างหน่วยงาน" });
    fireEvent.click(open);
    expect(await screen.findByRole("dialog", { name: "สร้างหน่วยงาน" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอ" }));

    const field = screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-describedby", "organization-name-error");
    expect(field).toHaveFocus();
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("กรุณาระบุชื่อหน่วยงาน");
    expect(error).toHaveAttribute("id", "organization-name-error");
    expect(error.querySelector("svg.lucide-circle-alert")).toBeInTheDocument();
    expect(screen.queryByText("กรุณาตรวจสอบข้อมูล")).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("searches accessible organization #145 without rendering 145 cards or leaking unowned organizations", async () => {
    const orgs = Array.from({ length: 145 }, (_, index) =>
      organization("org-" + index, index === 144 ? "Final KMITL Club" : "Campus Club " + index));
    mocks.listAccessible.mockResolvedValue([...orgs, organization("private-1", "Private Organization")]);
    mocks.useAuthSession.mockReturnValue({
      status: "authenticated",
      user: {
        userId: "user-1", email: "admin@example.com", name: "Admin",
        status: "ACTIVE", platformRole: null,
      },
      memberships: orgs.map(org => ({
        organizationId: org.organizationId,
        role: "ORGANIZATION_ADMIN",
        status: "ACTIVE",
      })),
    });
    render(<OrganizationSelectView />);
    await screen.findByText("Campus Club 0");
    expect(screen.getByRole("heading", { name: "หน่วยงาน (145)" })).toBeInTheDocument();
    expect(screen.queryByText("Final KMITL Club")).not.toBeInTheDocument();
    expect(screen.queryByText("Private Organization")).not.toBeInTheDocument();
    const input = screen.getByRole("searchbox", { name: "ค้นหาหน่วยงานที่เข้าถึงได้" });
    fireEvent.change(input, { target: { value: "final kmitl" } });
    expect(screen.getByText("Final KMITL Club")).toBeInTheDocument();
    expect(screen.queryByText("Campus Club 0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เข้าใช้งาน Final KMITL Club" }));
    expect(mocks.push).toHaveBeenCalledWith("/org/dashboard/?organizationId=org-144");
    expect(mocks.remember).not.toHaveBeenCalledWith("private-1", expect.any(Array));
  });



  it("prioritizes a first organization's signup for a customer with no membership", async () => {
    mocks.useAuthSession.mockReturnValue({
      status: "authenticated",
      user: { userId: "user-1", name: "Buyer", email: "buyer@example.com", status: "ACTIVE", platformRole: null },
      memberships: [],
    });
    mocks.listAccessible.mockResolvedValue([]);
    render(<OrganizationSelectView />);
    expect(await screen.findByRole("heading", { name: "สมัครเปิดร้านสำหรับหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ข้อมูลหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ขั้นตอนการเปิดร้าน" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "เลือกพื้นที่เพื่อเริ่มงาน" })).not.toBeInTheDocument();
  });

  it("keeps a neutral loading layout until authorization resolves, without flashing the wrong form", async () => {
    let finishLoading!: (organizations: OrganizationDTO[]) => void;
    mocks.listAccessible.mockImplementation(() => new Promise<OrganizationDTO[]>(resolve => { finishLoading = resolve; }));
    mocks.useAuthSession.mockReturnValue({
      status: "authenticated",
      user: { userId: "user-1", name: "Buyer", email: "buyer@example.com", status: "ACTIVE", platformRole: null },
      memberships: [],
    });
    const { container } = render(<OrganizationSelectView />);
    expect(container.querySelector('[data-page="organization-entry"][data-loading="loading"]')).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "พื้นที่หน่วยงาน" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "วันนี้จะทำงานกับหน่วยงานไหน?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "ชื่อหน่วยงาน" })).not.toBeInTheDocument();
    finishLoading([]);
    expect(await screen.findByRole("heading", { name: "สมัครเปิดร้านสำหรับหน่วยงาน" })).toBeVisible();
    expect(container.querySelector('[data-onboarding="true"]')).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not validate untouched blur and shows one inline error after invalid submit", async () => {
    mocks.listAccessible.mockResolvedValue([]);
    mocks.useAuthSession.mockReturnValue({
      status: "authenticated",
      user: { userId: "user-1", name: "Buyer", email: "buyer@example.com", status: "ACTIVE", platformRole: null },
      memberships: [],
    });
    render(<OrganizationSelectView />);
    const field = await screen.findByRole("textbox", { name: "ชื่อหน่วยงาน" });
    fireEvent.focus(field);
    fireEvent.blur(field);
    expect(field).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: "  " } });
    fireEvent.blur(field);
    expect(field).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("id", "organization-name-error");
    expect(error).toHaveTextContent("กรุณาระบุชื่อหน่วยงาน");
    fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอสมัครหน่วยงาน" }));
    expect(field).toHaveFocus();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("กรุณาตรวจสอบข้อมูล")).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "ชมรมไอที" } });
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("routes a newly created pending organization to an approval status page", async () => {
    const created = { ...organization("org-new", "ชมรมไอที"), status: "PENDING" as const };
    mocks.listAccessible.mockResolvedValue([]);
    mocks.useAuthSession.mockReturnValue({
      status: "authenticated",
      user: { userId: "user-1", name: "Buyer", email: "buyer@example.com", status: "ACTIVE", platformRole: null },
      memberships: [],
    });
    mocks.create.mockResolvedValue(created);
    mocks.restore.mockResolvedValue({
      status: "authenticated",
      memberships: [{ organizationId: "org-new", role: "ORGANIZATION_ADMIN", status: "ACTIVE" }],
      user: { userId: "user-1", platformRole: null },
    });
    render(<OrganizationSelectView />);
    await screen.findByRole("heading", { name: "สมัครเปิดร้านสำหรับหน่วยงาน" });
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อหน่วยงาน" }), { target: { value: "ชมรมไอที" } });
    fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอสมัครหน่วยงาน" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/org/application/?organizationId=org-new"));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: "ชมรมไอที" }));
  });

  it("directs a pending organization admin to status, not the dashboard", async () => {
    mocks.listAccessible.mockResolvedValue([{ ...organization("org-1", "ชมรมไอที"), status: "PENDING" }]);
    render(<OrganizationSelectView />);
    fireEvent.click(await screen.findByRole("button", { name: "ดูสถานะคำขอ ชมรมไอที" }));
    expect(mocks.push).toHaveBeenCalledWith("/org/application/?organizationId=org-1");
  });
});
