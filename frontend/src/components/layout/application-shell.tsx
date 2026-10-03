"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui";
import {
  isNavigationItemActive,
  type NavigationGroup,
} from "@/modules/auth/navigation";

import styles from "./application-shell.module.css";

type ShellScope = "customer" | "organization" | "platform";

function resolveShellScope(pathname: string): ShellScope {
  if (pathname.startsWith("/platform")) {
    return "platform";
  }

  if (pathname.startsWith("/org")) {
    return "organization";
  }

  return "customer";
}

const scopeLabel: Record<ShellScope, string> = {
  customer: "พื้นที่ของฉัน",
  organization: "พื้นที่หน่วยงาน",
  platform: "ผู้ดูแลแพลตฟอร์ม",
};

const scopeDescription: Record<ShellScope, string> = {
  customer: "เลือกซื้อและติดตามรายการ",
  organization: "จัดการงานและสถานะของหน่วยงาน",
  platform: "ดูแลข้อมูลระดับแพลตฟอร์ม",
};

export function ApplicationShell({
  groups,
  userName,
  userEmail,
  contextLabel,
  contextValue,
  contextMeta,
  showOrganizationSwitcher = false,
  onLogout,
  children,
}: {
  groups: readonly NavigationGroup[];
  userName: string;
  userEmail: string;
  contextLabel?: string;
  contextValue?: string;
  contextMeta?: string;
  showOrganizationSwitcher?: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarPanelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const menuOpen = openMenuPath === pathname;
  const shellScope = resolveShellScope(pathname);

  const activeNavigation =
    groups
      .flatMap((group) =>
        group.items.map((item) => ({
          group,
          item,
        })),
      )
      .find(({ item }) => isNavigationItemActive(pathname, item)) ?? null;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const sidebarPanel = sidebarPanelRef.current;
    const content = contentRef.current;
    const mobileViewport =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 900px)")
        : null;

    const contentWasInert = content?.hasAttribute("inert") ?? false;
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    function handleViewportChange(event: MediaQueryListEvent) {
      if (!event.matches) {
        setOpenMenuPath(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenMenuPath(null);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !sidebarPanel) {
        return;
      }

      const focusable = Array.from(
        sidebarPanel.querySelectorAll<HTMLElement>(focusableSelector),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !sidebarPanel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sidebarPanel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    content?.setAttribute("inert", "");
    document.addEventListener("keydown", handleKeyDown);
    mobileViewport?.addEventListener("change", handleViewportChange);
    drawerCloseRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (!contentWasInert) {
        content?.removeAttribute("inert");
      }
      document.removeEventListener("keydown", handleKeyDown);
      mobileViewport?.removeEventListener("change", handleViewportChange);
    };
  }, [menuOpen]);
  function closeMenu() {
    setOpenMenuPath(null);
  }

  return (
    <div className={styles.shell} data-shell-scope={shellScope}>
      <a href="#main-content" className={styles.skipLink}>
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <aside className={styles.sidebar} aria-label="พื้นที่นำทาง">
        <div className={styles.sidebarTop}>
          <Link href="/" className={styles.brand} onClick={closeMenu}>
            <span className={styles.brandMark} aria-hidden="true">
              <span />
            </span>
            <span className={styles.brandCopy}>
              <strong>UniStore Hub</strong>
              <span>Campus Commerce</span>
            </span>
          </Link>

          <div className={styles.desktopScope} aria-label="พื้นที่ปัจจุบัน">
            <span className={styles.desktopScopeLabel}>
              {scopeLabel[shellScope]}
            </span>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-controls="application-navigation"
            aria-label={menuOpen ? "ปิดเมนูหลัก" : "เปิดเมนูหลัก"}
            onClick={() => {
              setOpenMenuPath(menuOpen ? null : pathname);
            }}
          >
            <span className={styles.menuButtonLabel}>เมนู</span>
            <span
              className={[
                styles.menuIcon,
                menuOpen ? styles.menuIconOpen : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>

        <div className={styles.mobileCurrent} aria-label="ตำแหน่งปัจจุบัน">
          <span className={styles.mobileCurrentScope}>
            {scopeLabel[shellScope]}
          </span>
          <span className={styles.mobileCurrentDivider} aria-hidden="true" />
          <strong className={styles.mobileCurrentValue}>
            {activeNavigation?.item.label ?? "หน้าใช้งาน"}
          </strong>
        </div>

        {menuOpen ? (
          <button
            type="button"
            className={styles.mobileScrim}
            aria-label="ปิดแผงเมนู"
            tabIndex={-1}
            onClick={() => {
              closeMenu();
              menuButtonRef.current?.focus();
            }}
          />
        ) : null}

        <div
          ref={sidebarPanelRef}
          id="application-navigation"
          role={menuOpen ? "dialog" : undefined}
          aria-modal={menuOpen ? true : undefined}
          aria-label={menuOpen ? "เมนูหลัก" : undefined}
          className={[
            styles.sidebarPanel,
            menuOpen ? styles.sidebarPanelOpen : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.mobilePanelHeader}>
            <div>
              <span className={styles.mobilePanelLabel}>
                {scopeLabel[shellScope]}
              </span>
              <strong>{activeNavigation?.item.label ?? "เมนูหลัก"}</strong>
            </div>
            <button
              ref={drawerCloseRef}
              type="button"
              className={styles.drawerClose}
              aria-label="ปิดเมนูหลัก"
              onClick={() => {
                closeMenu();
                menuButtonRef.current?.focus();
              }}
            >
              <span aria-hidden="true" />
            </button>
          </div>

          <div className={styles.sidebarBody}>
            <section className={styles.workspaceSummary} aria-label="ขอบเขตการใช้งาน">
              <strong className={styles.workspaceTitle}>
                {activeNavigation?.group.label ?? scopeLabel[shellScope]}
              </strong>
              <span className={styles.workspaceDescription}>
                {contextMeta ?? scopeDescription[shellScope]}
              </span>
              {contextValue ? (
                <span className={styles.workspaceReference}>
                  <span>{contextLabel ?? "บริบทปัจจุบัน"}</span>
                  <strong>{contextValue}</strong>
                </span>
              ) : null}
            </section>

            <nav className={styles.navigation} aria-label="เมนูหลัก">
              {groups.map((group) => {
                const groupActive = activeNavigation?.group === group;

                return (
                  <section
                    className={styles.group}
                    data-active-group={groupActive || undefined}
                    key={group.label}
                  >
                    <div className={styles.groupHeading}>
                      <h2 className={styles.groupLabel}>{group.label}</h2>
                    </div>
                    <ul className={styles.groupList}>
                      {group.items.map((item) => {
                        const active = isNavigationItemActive(pathname, item);

                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={[
                                styles.navLink,
                                active ? styles.navLinkActive : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-current={active ? "page" : undefined}
                              onClick={closeMenu}
                            >
                              <span className={styles.navText}>{item.label}</span>
                              <span
                                className={styles.navState}
                                aria-hidden="true"
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </nav>

            <footer className={styles.sidebarFooter}>
              <div className={styles.userBlock}>
                <span className={styles.userAvatar} aria-hidden="true">
                  {userName.trim().charAt(0).toUpperCase() || "U"}
                </span>
                <span className={styles.userCopy}>
                  <span className={styles.userLabel}>บัญชีที่ใช้งาน</span>
                  <strong className={styles.userName}>{userName}</strong>
                  <span className={styles.userEmail}>{userEmail}</span>
                </span>
              </div>

              <div className={styles.footerActions}>
                {showOrganizationSwitcher ? (
                  <Link
                    href="/org/select/"
                    className={styles.switchOrganization}
                    onClick={closeMenu}
                  >
                    เปลี่ยนหน่วยงาน
                  </Link>
                ) : null}
                <Button
                  variant="quiet"
                  size="small"
                  onClick={() => {
                    closeMenu();
                    onLogout();
                  }}
                >
                  ออกจากระบบ
                </Button>
              </div>
            </footer>
          </div>
        </div>
      </aside>

      <div
        ref={contentRef}
        className={styles.content}
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
