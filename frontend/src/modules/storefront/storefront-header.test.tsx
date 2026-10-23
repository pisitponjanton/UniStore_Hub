import { render, screen, within } from "@testing-library/react";
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

  it("shows only login and register for public guests", () => {
    render(<StorefrontHeader />);

    const nav = screen.getByRole("navigation", { name: "เมนูหน้าร้าน" });
    expect(within(nav).getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveAttribute("href", "/login");
    expect(within(nav).getByRole("link", { name: "สมัครสมาชิก" })).toHaveAttribute("href", "/register");
    expect(within(nav).queryByRole("link", { name: "ร้านค้า" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "พื้นที่ของฉัน" })).not.toBeInTheDocument();
  });

  it("shows the approved image logo without changing the home link name or destination", () => {
    render(<StorefrontHeader />);
    const home = screen.getByRole("link", { name: "UniStore Hub หน้าร้าน" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveTextContent("UniStore Hub");
    const logo = home.querySelector("img");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("alt", "");
    expect(logo).toHaveAttribute("aria-hidden", "true");
    expect(logo?.getAttribute("src")).toContain("unistore-hub-logo");
  });

  it("shows one workspace shortcut for authenticated users without duplicate links", () => {
    mocks.useAuthSession.mockReturnValue({ status: "authenticated" });

    render(<StorefrontHeader />);

    const nav = screen.getByRole("navigation", { name: "เมนูหน้าร้าน" });
    expect(within(nav).getAllByRole("link")).toHaveLength(1);
    const shortcut = within(nav).getByRole("link", { name: "พื้นที่ของฉัน" });
    expect(shortcut).toHaveAttribute("href", "/shops");
    expect(shortcut.querySelectorAll("svg")).toHaveLength(2);
    expect(within(nav).queryByRole("link", { name: "คำสั่งซื้อของฉัน" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "การแจ้งเตือน" })).not.toBeInTheDocument();
  });

  it("does not flash guest links while the session is loading", () => {
    mocks.useAuthSession.mockReturnValue({ status: "loading" });
    render(<StorefrontHeader />);

    expect(screen.getByRole("status")).toHaveTextContent("กำลังตรวจสอบบัญชี");
    expect(screen.getByRole("navigation", { name: "เมนูหน้าร้าน" }).querySelector("a")).toBeNull();
  });
});
