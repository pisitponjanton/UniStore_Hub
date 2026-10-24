import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("./organization-service", () => ({
  organizationService: { get: mocks.get },
}));
vi.mock("@/modules/auth", () => ({
  authSession: { logout: mocks.logout },
  isDefinitiveSessionFailure: () => false,
}));

import { OrganizationApplicationView } from "./organization-application-view";

function record(status: OrganizationDTO["status"]): OrganizationDTO {
  return {
    organizationId: "org-1", name: "ชมรมไอที", description: "สำหรับนักศึกษา",
    status, createdBy: "user-1",
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
  };
}

describe("Organization application status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows true pending state without allowing access to the dashboard", async () => {
    mocks.get.mockResolvedValue(record("PENDING"));
    render(<OrganizationApplicationView organizationId="org-1" />);
    expect(await screen.findByRole("heading", { name: "สถานะคำขอหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByText("รออนุมัติ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("org-1", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("reveals the dashboard only after a fresh ACTIVE API result", async () => {
    mocks.get.mockResolvedValueOnce(record("PENDING")).mockResolvedValueOnce(record("ACTIVE"));
    render(<OrganizationApplicationView organizationId="org-1" />);
    await screen.findByText("รออนุมัติ");
    fireEvent.click(screen.getByRole("button", { name: "รีเฟรชสถานะ" }));
    expect(await screen.findByRole("link", { name: /เข้าสู่ Dashboard/ })).toHaveAttribute("href", "/org/dashboard?organizationId=org-1");
    expect(screen.getByText("อนุมัติแล้ว")).toBeInTheDocument();
  });

  it("shows suspended state with no dashboard entry", async () => {
    mocks.get.mockResolvedValue(record("SUSPENDED"));
    render(<OrganizationApplicationView organizationId="org-1" />);
    expect(await screen.findByText("ถูกระงับ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
  });

  it("uses an icon-only refresh control without redundant status cards", async () => {
    mocks.get.mockResolvedValue(record("PENDING"));
    const { container } = render(<OrganizationApplicationView organizationId="org-1" />);
    expect(await screen.findByRole("heading", { name: "สถานะคำขอหน่วยงาน" })).toBeVisible();
    await screen.findByText("รออนุมัติ");
    expect(screen.getByText("ชมรมไอที")).toBeVisible();
    expect(screen.getByRole("region", { name: "สถานะคำขอ" })).toHaveTextContent("กำลังรอการตรวจสอบ");
    expect(container.querySelector("[class*=applicationCard]")).not.toBeInTheDocument();
    expect(container.querySelector("[class*=applicationMessage]")).not.toBeInTheDocument();
    const refresh = screen.getByRole("button", { name: "รีเฟรชสถานะ" });
    expect(refresh).toHaveAttribute("title", "รีเฟรชสถานะ");
    expect(refresh.querySelector("svg.lucide-refresh-cw")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กลับไปหน่วยงานของฉัน" })).toHaveAttribute("href", "/org/select");
  });

  it("preserves the last known status and disables repeated clicks during refresh failures", async () => {
    let rejectRefresh!: (reason: Error) => void;
    mocks.get
      .mockResolvedValueOnce(record("PENDING"))
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectRefresh = reject; }));
    render(<OrganizationApplicationView organizationId="org-1" />);
    await screen.findByText("รออนุมัติ");
    fireEvent.click(screen.getByRole("button", { name: "รีเฟรชสถานะ" }));
    const busy = screen.getByRole("button", { name: "กำลังรีเฟรชสถานะ" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("รออนุมัติ")).toBeInTheDocument();
    fireEvent.click(busy);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    rejectRefresh(new Error("offline"));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("ไม่สามารถตรวจสอบสถานะหน่วยงานได้");
    expect(screen.getByText("รออนุมัติ")).toBeInTheDocument();
    expect(screen.queryByText("ตรวจสอบสถานะไม่สำเร็จ")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "รีเฟรชสถานะ" })).not.toBeDisabled();
  });

  it("offers retry on a failed status fetch", async () => {
    mocks.get.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(record("PENDING"));
    render(<OrganizationApplicationView organizationId="org-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "ลองอีกครั้ง" }));
    await waitFor(() => expect(screen.getByText("รออนุมัติ")).toBeInTheDocument());
  });
});
