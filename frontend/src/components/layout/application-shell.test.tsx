import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

import { ApplicationShell } from "./application-shell";

describe("ApplicationShell accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePathname.mockReturnValue("/org/orders/");
  });

  it("exposes a skip link to the focusable main content target", () => {
    render(
      <ApplicationShell
        groups={[
          {
            label: "งานของหน่วยงาน",
            items: [{ label: "คำสั่งซื้อ", href: "/org/orders/" }],
          },
        ]}
        userName="Staff User"
        userEmail="staff@example.com"
        onLogout={vi.fn()}
      >
        <p>เนื้อหาหลัก</p>
      </ApplicationShell>,
    );

    expect(
      screen.getByRole("link", { name: "ข้ามไปยังเนื้อหาหลัก" }),
    ).toHaveAttribute("href", "#main-content");

    const mainContent = document.getElementById("main-content");
    expect(mainContent).toHaveAttribute("tabindex", "-1");
  });

  it("returns focus to the mobile menu trigger when Escape closes the disclosure", () => {
    render(
      <ApplicationShell
        groups={[
          {
            label: "งานของหน่วยงาน",
            items: [
              { label: "คำสั่งซื้อ", href: "/org/orders/" },
              { label: "รับสินค้า", href: "/org/pickups/" },
            ],
          },
        ]}
        userName="Staff User"
        userEmail="staff@example.com"
        onLogout={vi.fn()}
      >
        <p>เนื้อหาหลัก</p>
      </ApplicationShell>,
    );

    const trigger = screen.getByRole("button", {
      name: "เปิดเมนูหลัก",
    });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const pickupLink = screen.getByRole("link", {
      name: "รับสินค้า",
    });
    pickupLink.focus();
    expect(pickupLink).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
