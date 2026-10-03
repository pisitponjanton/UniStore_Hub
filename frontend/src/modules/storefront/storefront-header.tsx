"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuthSession } from "@/modules/auth";

import styles from "./storefront-view.module.css";

function isPathActive(pathname: string, paths: readonly string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function StorefrontHeader() {
  const auth = useAuthSession();
  const pathname = usePathname();
  const homeActive = pathname === "/";
  const ordersActive = isPathActive(pathname, [
    "/my/orders",
    "/my/order",
    "/my/payment",
    "/my/pickup",
  ]);
  const notificationsActive = isPathActive(pathname, ["/notifications"]);

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link href="/" className={styles.brand} aria-label="UniStore Hub หน้าร้าน">
          <span className={styles.brandMark} aria-hidden="true">
            <span />
          </span>
          <span className={styles.brandCopy}>
            <strong>UniStore Hub</strong>
            <span>Campus marketplace</span>
          </span>
        </Link>

        <nav className={styles.topbarNav} aria-label="เมนูหน้าร้าน">
          <Link
            href="/"
            className={[
              styles.topbarHome,
              homeActive ? styles.topbarLinkActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={homeActive ? "page" : undefined}
          >
            ร้านค้า
          </Link>

          {auth.status === "loading" ? (
            <span
              className={styles.topbarSessionStatus}
              role="status"
              aria-live="polite"
            >
              กำลังตรวจสอบบัญชี
            </span>
          ) : auth.status === "authenticated" ? (
            <>
              <Link
                href="/my/orders/"
                className={[
                  styles.topbarLink,
                  ordersActive ? styles.topbarLinkActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={ordersActive ? "page" : undefined}
              >
                คำสั่งซื้อของฉัน
              </Link>
              <Link
                href="/notifications/"
                className={[
                  styles.topbarLink,
                  notificationsActive ? styles.topbarLinkActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={notificationsActive ? "page" : undefined}
              >
                การแจ้งเตือน
              </Link>
            </>
          ) : (
            <>
              <Link href="/login/" className={styles.topbarLink}>
                เข้าสู่ระบบ
              </Link>
              <Link href="/register/" className={styles.topbarPrimary}>
                สมัครสมาชิก
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
