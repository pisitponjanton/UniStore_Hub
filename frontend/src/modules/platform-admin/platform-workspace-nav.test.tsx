import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformWorkspaceNav } from "./platform-workspace-nav";

describe("PlatformWorkspaceNav", () => {
  it("marks the active page and links only to real Platform Admin destinations", () => {
    render(<PlatformWorkspaceNav current="summary" />);
    expect(screen.getByRole("navigation", { name: "ส่วนจัดการ Platform" })
      .querySelector('[aria-current="page"]')).toHaveTextContent("ภาพรวมระบบ");
    expect(screen.queryByRole("link", { name: "ภาพรวมระบบ" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "หน่วยงาน" }))
      .toHaveAttribute("href", "/platform/organizations");
    expect(screen.getByRole("link", { name: "ผู้ใช้" }))
      .toHaveAttribute("href", "/platform/users");
  });
  it("does not imply organization-scoped privileges or a user editing endpoint", () => {
    render(<PlatformWorkspaceNav current="users" />);
    expect(screen.queryByRole("link", { name: "ผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ภาพรวมระบบ" }))
      .toHaveAttribute("href", "/platform/summary");
    expect(screen.queryByRole("link", { name: /แก้ไขผู้ใช้/ })).not.toBeInTheDocument();
  });
});
