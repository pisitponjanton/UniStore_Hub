import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "./session";

const mocks = vi.hoisted(() => ({
  useAuthSession: vi.fn(),
}));

vi.mock("./use-auth-session", () => ({
  useAuthSession: mocks.useAuthSession,
}));

import { AuthEntryState } from "./auth-entry-state";

function authenticatedState(): Extract<AuthState, { status: "authenticated" }> {
  return {
    status: "authenticated",
    user: {
      userId: "user-1",
      email: "student@example.com",
      name: "Student A",
      status: "ACTIVE",
      platformRole: null,
    },
    memberships: [
      {
        organizationId: "org-1",
        role: "STAFF",
        status: "ACTIVE",
      },
    ],
  };
}

describe("AuthEntryState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/login/");
  });

  it("keeps the auth form available for anonymous users", () => {
    mocks.useAuthSession.mockReturnValue({ status: "anonymous" });

    render(
      <AuthEntryState>
        <div>auth-form</div>
      </AuthEntryState>,
    );

    expect(screen.getByText("auth-form")).toBeInTheDocument();
  });

  it("shows a session check instead of flashing the auth form while restoring", () => {
    mocks.useAuthSession.mockReturnValue({ status: "loading" });

    render(
      <AuthEntryState>
        <div>auth-form</div>
      </AuthEntryState>,
    );

    expect(
      screen.getByRole("heading", { name: "กำลังตรวจสอบบัญชี" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("auth-form")).not.toBeInTheDocument();
  });

  it("routes an authenticated user toward customer and organization work", () => {
    mocks.useAuthSession.mockReturnValue(authenticatedState());

    render(
      <AuthEntryState>
        <div>auth-form</div>
      </AuthEntryState>,
    );

    expect(
      screen.getByRole("heading", { name: "พร้อมใช้งานแล้ว" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Student A")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "คำสั่งซื้อของฉัน" }),
    ).toHaveAttribute("href", "/my/orders");
    expect(
      screen.getByRole("link", { name: /จัดการหน่วยงาน/ }),
    ).toHaveAttribute("href", "/org/select");
    expect(screen.queryByText("auth-form")).not.toBeInTheDocument();
  });

  it("makes an existing safe returnTo the primary next action without exposing unrelated roles", () => {
    mocks.useAuthSession.mockReturnValue({
      ...authenticatedState(),
      memberships: [],
    });
    window.history.replaceState(
      null, "",
      "/login/?returnTo=%2Forders%2Fnew%2F%3FcampaignId%3Dpreorder-test",
    );

    render(<AuthEntryState><div>auth-form</div></AuthEntryState>);

    expect(screen.getByRole("link", { name: /กลับไปตรวจสอบคำสั่งซื้อ/ }))
      .toHaveAttribute("href", "/orders/new?campaignId=preorder-test");
    expect(screen.getByRole("link", { name: /คำสั่งซื้อของฉัน/ }))
      .toHaveAttribute("href", "/my/orders");
    expect(screen.queryByRole("link", { name: /จัดการหน่วยงาน/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ดูแลแพลตฟอร์ม/ })).not.toBeInTheDocument();
  });

  it("shows the platform workspace only with PLATFORM_ADMIN and organization only with active membership", () => {
    mocks.useAuthSession.mockReturnValue({
      ...authenticatedState(),
      user: { ...authenticatedState().user, platformRole: "PLATFORM_ADMIN" },
      memberships: [{ organizationId: "org-1", role: "STAFF", status: "INACTIVE" }],
    });
    render(<AuthEntryState><div>auth-form</div></AuthEntryState>);
    expect(screen.getByRole("link", { name: /ดูแลแพลตฟอร์ม/ }))
      .toHaveAttribute("href", "/platform/summary");
    expect(screen.queryByRole("link", { name: /จัดการหน่วยงาน/ })).not.toBeInTheDocument();
  });

  it("does not expose an external returnTo destination in an authenticated action", () => {
    mocks.useAuthSession.mockReturnValue(authenticatedState());
    window.history.replaceState(null, "", "/register/?returnTo=https%3A%2F%2Fevil.example%2F");
    render(<AuthEntryState><div>auth-form</div></AuthEntryState>);
    expect(screen.getByRole("link", { name: /คำสั่งซื้อของฉัน/ }))
      .toHaveAttribute("href", "/my/orders");
    expect(screen.queryByRole("link", { name: /กลับไปทำรายการต่อ/ })).not.toBeInTheDocument();
  });
});
