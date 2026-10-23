"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";

import brandLogo from "@/assets/unistore-hub-logo.png";
import { useAuthSession } from "@/modules/auth";

import styles from "./storefront-view.module.css";

export function StorefrontHeader() {
  const auth = useAuthSession();

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link href="/" className={styles.brand} aria-label="UniStore Hub หน้าร้าน">
          <Image
            src={brandLogo}
            alt=""
            aria-hidden="true"
            width={38}
            height={38}
            sizes="38px"
            priority
            className={styles.brandMark}
          />
          <span className={styles.brandCopy}>
            <strong>UniStore Hub</strong>
          </span>
        </Link>

        <nav className={styles.topbarNav} aria-label="เมนูหน้าร้าน">
          {auth.status === "loading" ? (
            <span
              className={styles.topbarSessionStatus}
              role="status"
              aria-live="polite"
            >
              กำลังตรวจสอบบัญชี
            </span>
          ) : auth.status === "authenticated" ? (
            <Link href="/shops/" className={styles.topbarWorkspace}>
              <LayoutDashboard size={17} aria-hidden="true" />
              <span>พื้นที่ของฉัน</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
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
