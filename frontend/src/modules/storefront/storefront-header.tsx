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
          <span>UniStore Hub</span>
        </Link>

        <nav className={styles.topbarNav} aria-label="เมนูหน้าร้าน">
          <Link href="/" className={styles.topbarLink}>
            หน้าร้าน
          </Link>
          {auth.status === "authenticated" ? (
            <Link href="/my/orders/" className={styles.topbarLink}>
              คำสั่งซื้อของฉัน
            </Link>
          ) : (
            <Link href="/login/" className={styles.topbarLink}>
              เข้าสู่ระบบ
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
