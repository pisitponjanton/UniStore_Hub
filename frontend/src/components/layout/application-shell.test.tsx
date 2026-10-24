import type { ReactElement } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

import { ApplicationShell } from "./application-shell";

function renderWithTheme(element: ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

describe("ApplicationShell accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePathname.mockReturnValue("/org/orders/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes a skip link to the focusable main content target", () => {
    renderWithTheme(
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

    const brandLink = screen.getByRole("link", { name: /^UniStore Hub$/ });
    expect(brandLink).toHaveAttribute("href", "/");
    expect(brandLink).toHaveTextContent("UniStore Hub");
    expect(brandLink.querySelector("img")).toHaveAttribute("alt", "");
    expect(brandLink.querySelector("img")).toHaveAttribute("aria-hidden", "true");

    const mainContent = document.getElementById("main-content");
    expect(mainContent).toHaveAttribute("tabindex", "-1");
  });

  it("keeps a technical organization identifier collapsed in accessible details", () => {
    renderWithTheme(
      <ApplicationShell
        groups={[{
          label: "งานของหน่วยงาน",
          items: [{ label: "คำสั่งซื้อ", href: "/org/orders/" }],
        }]}
        userName="User"
        userEmail="user@example.com"
        contextLabel="หน่วยงานปัจจุบัน"
        contextValue="IT Club"
        contextId="org-technical-id-1234"
        onLogout={vi.fn()}
      >
        <p>พื้นที่ทำงาน</p>
      </ApplicationShell>,
    );
    expect(screen.getByText("IT Club")).toBeInTheDocument();
    const details = screen.getByText("ดูรหัสหน่วยงาน").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(within(details!).getByText("org-technical-id-1234")).toBeInTheDocument();
  });

  it("returns focus to the mobile menu trigger when Escape closes the disclosure", () => {
    renderWithTheme(
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
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps focus inside the mobile navigation while it is open", () => {
    renderWithTheme(
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
        <button type="button">ปุ่มในเนื้อหา</button>
      </ApplicationShell>,
    );

    const mainContent = document.getElementById("main-content");
    const trigger = screen.getByRole("button", { name: "เปิดเมนูหลัก" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "เมนูหลัก" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(mainContent).toHaveAttribute("inert");

    const scrim = screen.getByRole("button", { name: "ปิดแผงเมนู" });
    expect(scrim).toHaveAttribute("tabindex", "-1");
    expect(scrim).not.toHaveAttribute("aria-hidden");

    const closeButton = within(dialog).getByRole("button", {
      name: "ปิดเมนูหลัก",
    });
    const logoutButton = within(dialog).getByRole("button", {
      name: "ออกจากระบบ",
    });
    expect(closeButton).toHaveFocus();

    logoutButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(logoutButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mainContent).not.toHaveAttribute("inert");
  });

  it("releases the mobile dialog state when the viewport becomes desktop-sized", () => {
    let changeListener: ((event: MediaQueryListEvent) => void) | null = null;

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => {
        const mediaQuery = {
          matches: true,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(
            (
              type: string,
              listener: (event: MediaQueryListEvent) => void,
            ) => {
              if (type === "change") {
                changeListener = listener;
              }
            },
          ),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };

        return mediaQuery as unknown as MediaQueryList;
      }),
    );

    renderWithTheme(
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
        <button type="button">ปุ่มในเนื้อหา</button>
      </ApplicationShell>,
    );

    const mainContent = document.getElementById("main-content");
    const trigger = screen.getByRole("button", { name: "เปิดเมนูหลัก" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "เมนูหลัก" })).toBeInTheDocument();
    expect(mainContent).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      changeListener?.({ matches: false } as MediaQueryListEvent);
    });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(mainContent).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the mobile navigation before logging out", () => {
    const onLogout = vi.fn();

    renderWithTheme(
      <ApplicationShell
        groups={[
          {
            label: "งานของหน่วยงาน",
            items: [{ label: "คำสั่งซื้อ", href: "/org/orders/" }],
          },
        ]}
        userName="Staff User"
        userEmail="staff@example.com"
        onLogout={onLogout}
      >
        <p>เนื้อหาหลัก</p>
      </ApplicationShell>,
    );

    const trigger = screen.getByRole("button", { name: "เปิดเมนูหลัก" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "เมนูหลัก" })).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog", { name: "เมนูหลัก" })).getByRole(
        "button",
        { name: "ออกจากระบบ" },
      ),
    );

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("marks the active destination and exposes organization context without changing route authority", () => {
    const { container } = renderWithTheme(
      <ApplicationShell
        groups={[
          {
            label: "บัญชีของฉัน",
            items: [{ label: "หน้าร้านค้า", href: "/" }],
          },
          {
            label: "งานของหน่วยงาน",
            items: [{ label: "คำสั่งซื้อ", href: "/org/orders/?organizationId=org-1" }],
          },
        ]}
        userName="Staff User"
        userEmail="staff@example.com"
        contextLabel="หน่วยงานปัจจุบัน"
        contextValue="org-1"
        contextMeta="สิทธิ์: เจ้าหน้าที่"
        onLogout={vi.fn()}
      >
        <p>เนื้อหาหลัก</p>
      </ApplicationShell>,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-shell-scope",
      "organization",
    );
    expect(screen.getByRole("link", { name: "คำสั่งซื้อ" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText(/org-1/)).toBeInTheDocument();
    expect(screen.getByText("สิทธิ์: เจ้าหน้าที่")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "เปลี่ยนหน่วยงาน" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ออกจากระบบ" })).toBeInTheDocument();
  });
  it("shows only the logout action at the bottom of the selector sidebar", () => {
    mocks.usePathname.mockReturnValue("/org/select/");
    renderWithTheme(
      <ApplicationShell
        groups={[{ label: "หน่วยงาน", items: [{ label: "เปิดร้าน / สมัครหน่วยงาน", href: "/org/select/" }] }]}
        userName="Organization User"
        userEmail="admin@example.com"
        onLogout={vi.fn()}
      >
        <p>เลือกหน่วยงาน</p>
      </ApplicationShell>,
    );
    expect(screen.queryByRole("link", { name: "เปลี่ยนหน่วยงาน" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ออกจากระบบ" })).toBeInTheDocument();
  });

  it("shows only permitted workspace areas and keeps the current area identifiable", () => {
    mocks.usePathname.mockReturnValue("/platform/summary/");
    renderWithTheme(
      <ApplicationShell
        groups={[{
          label: "ผู้ดูแลแพลตฟอร์ม",
          items: [{ label: "ภาพรวมระบบ", href: "/platform/summary/" }],
        }]}
        workAreas={[
          { id: "customer", href: "/", label: "ซื้อสินค้า" },
          { id: "platform", href: "/platform/summary/", label: "ดูแลแพลตฟอร์ม" },
        ]}
        userName="Platform User"
        userEmail="platform@example.com"
        onLogout={vi.fn()}
      >
        <p>ข้อมูลภาพรวม</p>
      </ApplicationShell>,
    );

    const workspaceNav = screen.getByRole("navigation", { name: "เปลี่ยนพื้นที่ใช้งาน" });
    expect(within(workspaceNav).getAllByRole("link")).toHaveLength(1);
    expect(within(workspaceNav).getByRole("link", { name: "ดูแลแพลตฟอร์ม" }))
      .toHaveAttribute("aria-current", "location");
    expect(within(workspaceNav).queryByRole("link", { name: "จัดการหน่วยงาน" }))
      .not.toBeInTheDocument();
    expect(within(workspaceNav).queryByRole("link", { name: "ซื้อสินค้า" }))
      .not.toBeInTheDocument();
    expect(screen.getAllByLabelText("เปลี่ยนธีม")).toHaveLength(1);
    const header = document.querySelector('[aria-label="ตำแหน่งในระบบ"]');
    expect(header).toContainElement(screen.getByLabelText("เปลี่ยนธีม"));
    expect(document.querySelector("footer")).not.toContainElement(screen.getByLabelText("เปลี่ยนธีม"));
    expect(screen.getByRole("link", { name: "ภาพรวมระบบ" }))
      .toHaveAttribute("aria-current", "page");
  });

});
