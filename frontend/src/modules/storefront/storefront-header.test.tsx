import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useAuthSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("@/modules/auth", () => ({
  useAuthSession: mocks.useAuthSession,
}));

import { StorefrontHeader } from "./storefront-header";

describe("StorefrontHeader navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePathname.mockReturnValue("/");
    mocks.useAuthSession.mockReturnValue({ status: "unauthenticated" });
  });

  it("marks the storefront destination as current on the landing page", () => {
    render(<StorefrontHeader />);

    expect(screen.getByRole("link", { name: "ร้านค้า" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "สมัครสมาชิก" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("uses current-page semantics for authenticated order navigation", () => {
    mocks.usePathname.mockReturnValue("/my/payment/");
    mocks.useAuthSession.mockReturnValue({ status: "authenticated" });

    render(<StorefrontHeader />);

    expect(
      screen.getByRole("link", { name: "คำสั่งซื้อของฉัน" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "การแจ้งเตือน" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "ร้านค้า" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
