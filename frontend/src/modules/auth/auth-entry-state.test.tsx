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

function authenticatedState(): AuthState {
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
      screen.getByRole("heading", { name: "คุณเข้าสู่ระบบอยู่แล้ว" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Student A")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "คำสั่งซื้อของฉัน" }),
    ).toHaveAttribute("href", "/my/orders");
    expect(
      screen.getByRole("link", { name: "ไปยังพื้นที่หน่วยงาน" }),
    ).toHaveAttribute("href", "/org/select");
    expect(screen.queryByText("auth-form")).not.toBeInTheDocument();
  });
});
