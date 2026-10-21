import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    window.localStorage.clear();
    window.sessionStorage.clear();
    mocks.usePathname.mockReturnValue("/org/orders/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("toggles and remembers the desktop sidebar from the logo control", () => {
    const { container } = render(
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

    const shell = container.firstElementChild;
    const collapseButton = screen.getByRole("button", {
      name: "ย่อแถบนำทาง",
    });

    fireEvent.click(collapseButton);

    expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
    expect(
      screen.getByRole("button", { name: "ขยายแถบนำทาง" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem("unistoreHub.sidebarCollapsed")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "คำสั่งซื้อ" })).toHaveAttribute(
      "title",
      "คำสั่งซื้อ",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "ขยายแถบนำทาง" }),
    );

    expect(shell).not.toHaveAttribute("data-sidebar-collapsed");
  });

  it("restores the sidebar position after a lower menu item changes the page", () => {
    const groups = [
      {
        label: "Workspace",
        items: [
          { label: "Orders", href: "/org/orders/" },
          { label: "Audit", href: "/org/audit/" },
        ],
      },
    ];
    const shell = (content: string) => (
      <ApplicationShell
        groups={groups}
        userName="Staff User"
        userEmail="staff@example.com"
        onLogout={vi.fn()}
      >
        <p>{content}</p>
      </ApplicationShell>
    );

    const { unmount } = render(shell("Orders page"));
    const navigation = screen.getByRole("navigation", { name: "เมนูหลัก" });
    navigation.scrollTop = 240;
    fireEvent.scroll(navigation);
    const auditLink = screen.getByRole("link", { name: "Audit" });
    auditLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(auditLink);
    expect(window.sessionStorage.getItem("unistoreHub.sidebarScrollTop")).toBe(
      "240",
    );

    unmount();
    mocks.usePathname.mockReturnValue("/org/audit/");
    render(shell("Audit page"));

    expect(screen.getByRole("navigation", { name: "เมนูหลัก" }).scrollTop).toBe(
      240,
    );
  });

  it("opens the mobile navigation when the logo is pressed", () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: "เปิดเมนูผ่านโลโก้" }),
    );

    expect(screen.getByRole("dialog", { name: "เมนูหลัก" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ปิดเมนูผ่านโลโก้" }),
    ).toHaveAttribute("aria-expanded", "true");
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
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps focus inside the mobile navigation while it is open", () => {
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
    const { container } = render(
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
        showOrganizationSwitcher
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
    expect(
      screen.getByRole("link", { name: "เปลี่ยนหน่วยงาน" }),
    ).toHaveAttribute("href", "/org/select");
  });
});
