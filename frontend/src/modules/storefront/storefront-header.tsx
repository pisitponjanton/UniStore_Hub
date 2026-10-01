"use client";

import Link from "next/link";

import { useAuthSession } from "@/modules/auth";

import styles from "./storefront-view.module.css";

export function StorefrontHeader() {
  const auth = useAuthSession();

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandCopy}>
            <strong>UniStore Hub</strong>
            <span>ร้านค้าในมหาวิทยาลัย</span>
          </span>
        </Link>

        <nav className={styles.topbarNav} aria-label="เมนูหน้าร้าน">
          <Link href="/" className={styles.topbarLink}>
            เลือกร้านค้า
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
              <Link href="/notifications/" className={styles.topbarLink}>
                การแจ้งเตือน
              </Link>
              <Link href="/my/orders/" className={styles.topbarPrimary}>
                คำสั่งซื้อของฉัน
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
