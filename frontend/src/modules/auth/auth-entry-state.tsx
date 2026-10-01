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
          description="กำลังตรวจสอบว่าคุณมี Session ที่ใช้งานอยู่หรือไม่"
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
        <h2 className={styles.title}>คุณเข้าสู่ระบบอยู่แล้ว</h2>
        <p className={styles.description}>
          ไปยังงานที่ต้องการได้เลย โดยไม่ต้องกรอกข้อมูลบัญชีอีกครั้ง
        </p>
      </div>

      <div className={styles.accountSummary}>
        <span className={styles.accountLabel}>บัญชีที่ใช้งาน</span>
        <strong className={styles.accountName}>{auth.user.name}</strong>
        <span className={styles.accountEmail}>{auth.user.email}</span>
      </div>

      <div className={styles.accountActions}>
        <Link href="/my/orders/" className={styles.accountActionPrimary}>
          คำสั่งซื้อของฉัน
        </Link>
        <Link href="/notifications/" className={styles.accountActionSecondary}>
          การแจ้งเตือน
        </Link>
        {hasOrganizationAccess ? (
          <Link href="/org/select/" className={styles.accountActionSecondary}>
            ไปยังพื้นที่หน่วยงาน
          </Link>
        ) : null}
      </div>

      <Link href="/" className={styles.backLink}>
        กลับหน้าร้านค้า
      </Link>
    </div>
  );
}
