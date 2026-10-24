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
    expect(await screen.findByRole("heading", { name: "สถานะคำขอของ ชมรมไอที" })).toBeInTheDocument();
    expect(screen.getByText("รอการอนุมัติ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("org-1", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("reveals the dashboard only after a fresh ACTIVE API result", async () => {
    mocks.get.mockResolvedValueOnce(record("PENDING")).mockResolvedValueOnce(record("ACTIVE"));
    render(<OrganizationApplicationView organizationId="org-1" />);
    await screen.findByText("รอการอนุมัติ");
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบสถานะล่าสุด" }));
    expect(await screen.findByRole("link", { name: /เข้าสู่ Dashboard/ })).toHaveAttribute("href", "/org/dashboard?organizationId=org-1");
    expect(screen.getByText("อนุมัติแล้ว")).toBeInTheDocument();
  });

  it("shows suspended state with no dashboard entry", async () => {
    mocks.get.mockResolvedValue(record("SUSPENDED"));
    render(<OrganizationApplicationView organizationId="org-1" />);
    expect(await screen.findByText("ถูกระงับ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
  });

  it("offers retry on a failed status fetch", async () => {
    mocks.get.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(record("PENDING"));
    render(<OrganizationApplicationView organizationId="org-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "ลองอีกครั้ง" }));
    await waitFor(() => expect(screen.getByText("รอการอนุมัติ")).toBeInTheDocument());
  });
});
