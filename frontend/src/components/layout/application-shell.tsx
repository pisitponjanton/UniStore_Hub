"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui";
import type { NavigationGroup } from "@/modules/auth/navigation";

import styles from "./application-shell.module.css";

function normalizePath(path: string): string {
  if (path === "/") {
    return "/";
  }

  return path.replace(/\/+$/, "");
}

function isItemActive(pathname: string, href: string): boolean {
  const hrefPath = href.split("?")[0] ?? href;
  return normalizePath(pathname) === normalizePath(hrefPath);
}

export function ApplicationShell({
  groups,
  userName,
  userEmail,
  contextLabel,
  contextValue,
  showOrganizationSwitcher = false,
  onLogout,
  children,
}: {
  groups: readonly NavigationGroup[];
  userName: string;
  userEmail: string;
  contextLabel?: string;
  contextValue?: string;
  showOrganizationSwitcher?: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span>UniStore Hub</span>
        </Link>

        {contextValue ? (
          <div className={styles.context}>
            <span className={styles.contextLabel}>
              {contextLabel ?? "บริบทปัจจุบัน"}
            </span>
            <span className={styles.contextValue}>{contextValue}</span>
          </div>
        ) : null}

        <nav className={styles.navigation} aria-label="เมนูหลัก">
          {groups.map((group) => (
            <section
              className={styles.group}
              key={group.label}
              aria-label={group.label}
            >
              <div className={styles.groupLabel} aria-hidden="true">
                {group.label}
              </div>
              <ul className={styles.groupList}>
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href);

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
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <footer className={styles.sidebarFooter}>
          <div>
            <div className={styles.userName}>{userName}</div>
            <div className={styles.userEmail}>{userEmail}</div>
          </div>
          <div className={styles.footerActions}>
            {showOrganizationSwitcher ? (
              <Link href="/org/select/" className={styles.switchOrganization}>
                เปลี่ยนหน่วยงาน
              </Link>
            ) : null}
            <Button variant="quiet" size="small" onClick={onLogout}>
              ออกจากระบบ
            </Button>
          </div>
        </footer>
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
