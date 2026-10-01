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
  const menuOpen = openMenuPath === pathname;

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuPath(null);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);
  function closeMenu() {
    setOpenMenuPath(null);
  }

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link href="/" className={styles.brand} onClick={closeMenu}>
            <span className={styles.brandMark} aria-hidden="true" />
            <span className={styles.brandCopy}>
              <strong>UniStore Hub</strong>
              <span>พื้นที่จัดการร้านค้า</span>
            </span>
          </Link>

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

        <div className={styles.mobileCurrent} aria-live="polite">
          <span className={styles.mobileCurrentLabel}>
            {activeNavigation?.group.label ?? "พื้นที่ใช้งาน"}
          </span>
          <strong className={styles.mobileCurrentValue}>
            {activeNavigation?.item.label ?? "หน้าใช้งาน"}
          </strong>
        </div>

        <div
          id="application-navigation"
          className={[
            styles.sidebarBody,
            menuOpen ? styles.sidebarBodyOpen : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {contextValue ? (
            <section className={styles.context} aria-label="บริบทหน่วยงาน">
              <div className={styles.contextTopline}>
                <span className={styles.contextMarker} aria-hidden="true" />
                <span className={styles.contextLabel}>
                  {contextLabel ?? "บริบทปัจจุบัน"}
                </span>
              </div>
              <strong className={styles.contextValue}>{contextValue}</strong>
              {contextMeta ? (
                <span className={styles.contextMeta}>{contextMeta}</span>
              ) : null}
            </section>
          ) : null}

          <nav className={styles.navigation} aria-label="เมนูหลัก">
            {groups.map((group) => (
              <section className={styles.group} key={group.label}>
                <h2 className={styles.groupLabel}>{group.label}</h2>
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
                          {active ? (
                            <span className={styles.navCurrent}>ปัจจุบัน</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>

          <footer className={styles.sidebarFooter}>
            <div className={styles.userBlock}>
              <span className={styles.userLabel}>บัญชีที่ใช้งาน</span>
              <div className={styles.userName}>{userName}</div>
              <div className={styles.userEmail}>{userEmail}</div>
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
              <Button variant="quiet" size="small" onClick={onLogout}>
                ออกจากระบบ
              </Button>
            </div>
          </footer>
        </div>
      </aside>

      <div
        className={styles.content}
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
