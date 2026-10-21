"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import brandLogo from "@/assets/unistore-hub-logo.webp";
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

const SIDEBAR_COLLAPSED_STORAGE_KEY = "unistoreHub.sidebarCollapsed";
const SIDEBAR_SCROLL_STORAGE_KEY = "unistoreHub.sidebarScrollTop";

function BrandIdentity() {
  return (
    <>
      <Image
        src={brandLogo}
        alt=""
        width={38}
        height={38}
        className={styles.brandMark}
        aria-hidden="true"
        priority
        sizes="38px"
      />
      <span className={styles.brandCopy}>
        <strong>UniStore Hub</strong>
        <span>Campus Commerce</span>
      </span>
      <span className={styles.brandToggleHint} aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="m12.5 5-5 5 5 5" />
        </svg>
      </span>
    </>
  );
}

function NavigationIcon({ href }: { href: string }) {
  const path = href.split("?")[0] ?? href;
  let icon: ReactNode;

  if (path === "/" || path.includes("dashboard") || path.includes("summary")) {
    icon = <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>;
  } else if (path.includes("stores")) {
    icon = <><path d="M4 10v10h16V10" /><path d="M3 10 5 4h14l2 6" /><path d="M3 10c0 2 3 2 4.5 0 1.5 2 4.5 2 6 0 1.5 2 4.5 2 6 0" /><path d="M9 20v-6h6v6" /></>;
  } else if (path.includes("products")) {
    icon = <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></>;
  } else if (path.includes("campaigns")) {
    icon = <><path d="m4 13 12-5v10L4 13Z" /><path d="M16 10c2 1 2 5 0 6" /><path d="m6 14 1 6h4l-2-5" /></>;
  } else if (path.includes("payments") || path.includes("payment")) {
    icon = <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></>;
  } else if (path.includes("pickups") || path.includes("pickup")) {
    icon = <><path d="M5 8h14v12H5z" /><path d="m8 8 1-4h6l1 4" /><path d="M9 13h6" /><path d="m12 10 3 3-3 3" /></>;
  } else if (path.includes("orders") || path.includes("order")) {
    icon = <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>;
  } else if (path.includes("staff") || path.includes("users")) {
    icon = <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6" /><circle cx="17" cy="9" r="2" /><path d="M16 15c2.5 0 4 1.5 4.5 4" /></>;
  } else if (path.includes("settings") || path.includes("organizations")) {
    icon = <><path d="M4 21V7l8-4 8 4v14" /><path d="M8 10h2M14 10h2M8 14h2M14 14h2M10 21v-3h4v3" /></>;
  } else if (path.includes("audit")) {
    icon = <><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /><path d="m3 8 1 1 2-2" /></>;
  } else if (path.includes("notifications")) {
    icon = <><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20h4" /></>;
  } else {
    icon = <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></>;
  }

  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {icon}
    </svg>
  );
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarPanelRef = useRef<HTMLDivElement>(null);
  const sidebarBodyRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const menuOpen = openMenuPath === pathname;
  const shellScope = resolveShellScope(pathname);

  useEffect(() => {
    let storedPreference = false;

    try {
      storedPreference =
        window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
    } catch {
      // Storage can be unavailable in strict privacy contexts.
    }

    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(storedPreference);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const activeNavigation =
    groups
      .flatMap((group) =>
        group.items.map((item) => ({
          group,
          item,
        })),
      )
      .find(({ item }) => isNavigationItemActive(pathname, item)) ?? null;

  useLayoutEffect(() => {
    const scrollContainer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 900px)").matches
      ? sidebarBodyRef.current
      : navigationRef.current;

    if (!scrollContainer) {
      return;
    }

    try {
      const storedScrollTop = Number.parseInt(
        window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY) ?? "0",
        10,
      );
      if (Number.isFinite(storedScrollTop) && storedScrollTop > 0) {
        scrollContainer.scrollTop = storedScrollTop;
      }
    } catch {
      // Scrolling remains usable when storage is unavailable.
    }

    const saveScrollPosition = () => {
      try {
        window.sessionStorage.setItem(
          SIDEBAR_SCROLL_STORAGE_KEY,
          String(scrollContainer.scrollTop),
        );
      } catch {
        // Ignore storage failures; scrolling itself still works.
      }
    };

    scrollContainer.addEventListener("scroll", saveScrollPosition, {
      passive: true,
    });

    return () => {
      scrollContainer.removeEventListener("scroll", saveScrollPosition);
    };
  }, []);

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

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_STORAGE_KEY,
          String(next),
        );
      } catch {
        // The in-memory preference remains usable without storage.
      }

      return next;
    });
  }

  function rememberNavigationScroll() {
    const scrollContainer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 900px)").matches
      ? sidebarBodyRef.current
      : navigationRef.current;

    if (!scrollContainer) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        SIDEBAR_SCROLL_STORAGE_KEY,
        String(scrollContainer.scrollTop),
      );
    } catch {
      // The current scroll position remains usable without storage.
    }
  }

  return (
    <div
      className={styles.shell}
      data-shell-scope={shellScope}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
    >
      <a href="#main-content" className={styles.skipLink}>
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <aside className={styles.sidebar} aria-label="พื้นที่นำทาง">
        <div className={styles.sidebarTop}>
          <button
            type="button"
            className={[styles.brand, styles.desktopBrand].join(" ")}
            aria-expanded={!sidebarCollapsed}
            aria-controls="application-navigation"
            aria-label={sidebarCollapsed ? "ขยายแถบนำทาง" : "ย่อแถบนำทาง"}
            title={sidebarCollapsed ? "ขยายแถบนำทาง" : "ย่อแถบนำทาง"}
            onClick={toggleSidebar}
          >
            <BrandIdentity />
          </button>

          <button
            type="button"
            className={[styles.brand, styles.mobileBrand].join(" ")}
            aria-expanded={menuOpen}
            aria-controls="application-navigation"
            aria-label={menuOpen ? "ปิดเมนูผ่านโลโก้" : "เปิดเมนูผ่านโลโก้"}
            onClick={() => setOpenMenuPath(menuOpen ? null : pathname)}
          >
            <BrandIdentity />
          </button>

          <div className={styles.desktopScope} aria-label="พื้นที่ปัจจุบัน">
            <span className={styles.desktopScopeLabel}>
              {scopeLabel[shellScope]}
            </span>
          </div>

          <div className={styles.topAccount} aria-label="บัญชีที่ใช้งาน">
            <span className={styles.userAvatar} aria-hidden="true">
              {userName.trim().charAt(0).toUpperCase() || "U"}
            </span>
            <span className={styles.userCopy}>
              <span className={styles.userLabel}>บัญชีที่ใช้งาน</span>
              <strong className={styles.userName}>{userName}</strong>
              <span className={styles.userEmail}>{userEmail}</span>
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

          <div
            ref={sidebarBodyRef}
            className={`${styles.sidebarBody} scrollbarOnHover`}
          >
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

            {showOrganizationSwitcher ? (
              <Link
                href="/org/select/"
                className={styles.switchOrganization}
                aria-label="เปลี่ยนหน่วยงาน"
                title={sidebarCollapsed ? "เปลี่ยนหน่วยงาน" : undefined}
                onClick={closeMenu}
              >
                <svg
                  className={styles.switchOrganizationIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M7 7h12l-3-3" />
                  <path d="m19 7-3 3" />
                  <path d="M17 17H5l3 3" />
                  <path d="m5 17 3-3" />
                </svg>
                <span className={styles.switchOrganizationCopy}>
                  <span>พื้นที่ทำงาน</span>
                  <strong>เปลี่ยนหน่วยงาน</strong>
                </span>
                <svg
                  className={styles.switchOrganizationArrow}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="m8 5 5 5-5 5" />
                </svg>
              </Link>
            ) : null}

            <nav
              ref={navigationRef}
              className={styles.navigation}
              aria-label="เมนูหลัก"
            >
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
                              scroll={false}
                              className={[
                                styles.navLink,
                                active ? styles.navLinkActive : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-current={active ? "page" : undefined}
                              title={sidebarCollapsed ? item.label : undefined}
                              onClick={() => {
                                rememberNavigationScroll();
                                closeMenu();
                              }}
                            >
                              <NavigationIcon href={item.href} />
                              <span className={styles.navText}>{item.label}</span>
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
                <Button
                  variant="quiet"
                  size="small"
                  className={styles.logoutAction}
                  aria-label="ออกจากระบบ"
                  title={sidebarCollapsed ? "ออกจากระบบ" : undefined}
                  leading={
                    <svg
                      className={styles.logoutIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M10 5H5v14h5" />
                      <path d="M13 8l4 4-4 4" />
                      <path d="M17 12H9" />
                    </svg>
                  }
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
