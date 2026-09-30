import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "./session";

const mocks = vi.hoisted(() => ({
  useAuthSession: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("./use-auth-session", () => ({
  useAuthSession: mocks.useAuthSession,
}));

vi.mock("./session", async () => {
  const actual =
    await vi.importActual<typeof import("./session")>("./session");

  return {
    ...actual,
    authSession: {
      logout: mocks.logout,
    },
  };
});

import {
  OrganizationBoundary,
  PlatformAdminBoundary,
} from "./access-boundary";

function authenticatedState(
  overrides: Partial<AuthState & { status: "authenticated" }> = {},
): AuthState {
  return {
    status: "authenticated",
    user: {
      userId: "user-1",
      email: "user@example.com",
      name: "User",
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
    ...overrides,
  } as AuthState;
}

describe("role-based access boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides Organization Admin UI from Staff membership", () => {
    mocks.useAuthSession.mockReturnValue(authenticatedState());

    render(
      <OrganizationBoundary
        organizationId="org-1"
        allowedRoles={["ORGANIZATION_ADMIN"]}
      >
        <div>admin-only-content</div>
      </OrganizationBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึง" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("admin-only-content"),
    ).not.toBeInTheDocument();
  });

  it("shows Organization Admin UI only when the active membership role matches", () => {
    mocks.useAuthSession.mockReturnValue(
      authenticatedState({
        memberships: [
          {
            organizationId: "org-1",
            role: "ORGANIZATION_ADMIN",
            status: "ACTIVE",
          },
        ],
      }),
    );

    render(
      <OrganizationBoundary
        organizationId="org-1"
        allowedRoles={["ORGANIZATION_ADMIN"]}
      >
        <div>admin-only-content</div>
      </OrganizationBoundary>,
    );

    expect(
      screen.getByText("admin-only-content"),
    ).toBeInTheDocument();
  });

  it("derives Platform Admin visibility only from persisted platformRole", () => {
    mocks.useAuthSession.mockReturnValue(authenticatedState());

    const { rerender } = render(
      <PlatformAdminBoundary>
        <div>platform-admin-content</div>
      </PlatformAdminBoundary>,
    );

    expect(
      screen.queryByText("platform-admin-content"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึง" }),
    ).toBeInTheDocument();

    mocks.useAuthSession.mockReturnValue(
      authenticatedState({
        user: {
          userId: "user-1",
          email: "user@example.com",
          name: "User",
          status: "ACTIVE",
          platformRole: "PLATFORM_ADMIN",
        },
      }),
    );

    rerender(
      <PlatformAdminBoundary>
        <div>platform-admin-content</div>
      </PlatformAdminBoundary>,
    );

    expect(
      screen.getByText("platform-admin-content"),
    ).toBeInTheDocument();
  });
});
