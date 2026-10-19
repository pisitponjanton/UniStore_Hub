import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrganizationAdminNav } from "./organization-admin-nav";

describe("OrganizationAdminNav", () => {
  it("keeps current organization context and marks the active management area", () => {
    render(<OrganizationAdminNav organizationId="org/!?" current="dashboard" />);
    const nav = screen.getByRole("navigation", { name: "พื้นที่จัดการหน่วยงาน" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("ภาพรวมงาน");
    expect(screen.getByRole("link", { name: "สมาชิกและสิทธิ์" }))
      .toHaveAttribute("href", "/org/staff?organizationId=org%2F%21%3F");
    expect(screen.getByRole("link", { name: "ข้อมูลหน่วยงาน" }))
      .toHaveAttribute("href", "/org/settings?organizationId=org%2F%21%3F");
    expect(screen.getByRole("link", { name: "เปลี่ยนหน่วยงาน" }))
      .toHaveAttribute("href", "/org/select");
  });
  it("does not link to a different organization from the current management area", () => {
    render(<OrganizationAdminNav organizationId="tenant2" current="staff" />);
    expect(screen.getByRole("link", { name: "ภาพรวมงาน" }))
      .toHaveAttribute("href", "/org/dashboard?organizationId=tenant2");
    expect(screen.queryByRole("link", { name: "สมาชิกและสิทธิ์" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "พื้นที่จัดการหน่วยงาน" }))
      .toHaveTextContent("เปลี่ยนหน่วยงาน");
  });
});
