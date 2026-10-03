"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { LoadingState } from "@/components";

import styles from "./auth-form.module.css";
import { useAuthSession } from "./use-auth-session";

export function AuthEntryState({ children }: { children: ReactNode }) {
  const auth = useAuthSession();

  if (auth.status === "loading") {
    return (
      <div className={styles.formShell}>
        <LoadingState
          title="กำลังตรวจสอบบัญชี"
          description="กำลังตรวจสอบว่าคุณมีบัญชีที่เข้าสู่ระบบอยู่แล้วหรือไม่"
        />
      </div>
    );
  }

  if (auth.status !== "authenticated") {
    return children;
  }

  const hasOrganizationAccess = auth.memberships.some(
    (membership) => membership.status === "ACTIVE",
  );

  return (
    <div className={styles.formShell}>
      <div className={styles.headingGroup}>
        <span className={styles.formKicker}>บัญชีพร้อมใช้งาน</span>
        <h2 className={styles.title}>คุณเข้าสู่ระบบอยู่แล้ว</h2>
        <p className={styles.description}>
          เลือกปลายทางที่ต้องการได้เลย โดยไม่ต้องกรอกข้อมูลบัญชีอีกครั้ง
        </p>
      </div>

      <section className={styles.accountSummary} aria-label="บัญชีที่ใช้งาน">
        <span className={styles.accountStatus}>
          <span className={styles.accountStatusDot} aria-hidden="true" />
          เข้าสู่ระบบแล้ว
        </span>
        <div className={styles.accountIdentity}>
          <span className={styles.accountAvatar} aria-hidden="true">
            {auth.user.name.trim().charAt(0).toUpperCase() || "U"}
          </span>
          <div>
            <strong className={styles.accountName}>{auth.user.name}</strong>
            <span className={styles.accountEmail}>{auth.user.email}</span>
          </div>
        </div>
      </section>

      <nav className={styles.accountActions} aria-label="ไปยังพื้นที่ใช้งาน">
        <Link
          href="/my/orders/"
          className={styles.accountActionPrimary}
          aria-label="คำสั่งซื้อของฉัน"
        >
          <span>
            <strong>คำสั่งซื้อของฉัน</strong>
            <small>ดูสถานะ ชำระเงิน และรับสินค้า</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>

        <Link
          href="/notifications/"
          className={styles.accountActionSecondary}
          aria-label="การแจ้งเตือน"
        >
          <span>
            <strong>การแจ้งเตือน</strong>
            <small>ดูเหตุการณ์ล่าสุดจากรายการของคุณ</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>

        {hasOrganizationAccess ? (
          <Link
            href="/org/select/"
            className={styles.accountActionSecondary}
            aria-label="ไปยังพื้นที่หน่วยงาน"
          >
            <span>
              <strong>พื้นที่หน่วยงาน</strong>
              <small>เลือกหน่วยงานตามสิทธิ์ที่บัญชีได้รับ</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </nav>

      <Link href="/" className={styles.backLink}>
        กลับหน้าร้านค้า
      </Link>
    </div>
  );
}
