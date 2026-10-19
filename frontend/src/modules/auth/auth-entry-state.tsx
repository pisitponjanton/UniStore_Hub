"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { LoadingState } from "@/components";
import { WorkspaceIcon } from "@/components/layout/workspace-icon";

import styles from "./auth-form.module.css";
import { describeAuthReturnDestination } from "./return-route";
import { useAuthNavigationContext } from "./use-auth-navigation-context";
import { useAuthSession } from "./use-auth-session";

export function AuthEntryState({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  const navigation = useAuthNavigationContext();

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

  if (auth.status !== "authenticated") return children;

  const hasOrganizationAccess = auth.memberships.some(
    (membership) => membership.status === "ACTIVE",
  );
  const hasPlatformAccess = auth.user.platformRole === "PLATFORM_ADMIN";
  const primaryDestination = navigation.hasReturnContext
    ? navigation.returnPath
    : "/my/orders/";
  const primaryTitle = navigation.hasReturnContext
    ? describeAuthReturnDestination(navigation.returnPath)
    : "คำสั่งซื้อของฉัน";
  const primaryDescription = navigation.hasReturnContext
    ? "กลับไปยังขั้นตอนเดิมที่คุณเปิดไว้ โดยใช้บัญชีที่เข้าสู่ระบบแล้ว"
    : "ดูสถานะ ชำระเงิน และรับสินค้าของคุณ";

  return (
    <div className={styles.formShell}>
      <div className={styles.headingGroup}>
        <h2 className={styles.title}>พร้อมใช้งานแล้ว</h2>
        <p className={styles.description}>
          คุณเข้าสู่ระบบอยู่แล้ว เลือกสิ่งที่จะทำต่อได้ทันทีโดยไม่ต้องกรอกข้อมูลซ้ำ
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
        <Link href={primaryDestination} className={styles.accountActionPrimary} aria-label={primaryTitle}>
          <span>
            <strong>{primaryTitle}</strong>
            <small>{primaryDescription}</small>
          </span>
          <WorkspaceIcon name="chevron" size={20} />
        </Link>

        {navigation.hasReturnContext ? (
          <Link href="/my/orders/" className={styles.accountActionSecondary} aria-label="คำสั่งซื้อของฉัน">
            <span>
              <strong>คำสั่งซื้อของฉัน</strong>
              <small>ดูรายการของคุณและสถานะล่าสุด</small>
            </span>
            <WorkspaceIcon name="orders" size={20} />
          </Link>
        ) : null}

        <Link href="/notifications/" className={styles.accountActionSecondary} aria-label="การแจ้งเตือน">
          <span>
            <strong>การแจ้งเตือน</strong>
            <small>ดูรายการที่ต้องติดตามล่าสุด</small>
          </span>
          <WorkspaceIcon name="notifications" size={20} />
        </Link>

        {hasOrganizationAccess ? (
          <Link href="/org/select/" className={styles.accountActionSecondary} aria-label="จัดการหน่วยงาน">
            <span>
              <strong>จัดการหน่วยงาน</strong>
              <small>เลือกหน่วยงานที่บัญชีนี้มีสิทธิ์ทำงาน</small>
            </span>
            <WorkspaceIcon name="organization" size={20} />
          </Link>
        ) : null}

        {hasPlatformAccess ? (
          <Link href="/platform/summary/" className={styles.accountActionSecondary} aria-label="ดูแลแพลตฟอร์ม">
            <span>
              <strong>ดูแลแพลตฟอร์ม</strong>
              <small>ตรวจงานส่วนกลางตามสิทธิ์ผู้ดูแลระบบ</small>
            </span>
            <WorkspaceIcon name="platform" size={20} />
          </Link>
        ) : null}
      </nav>

      <Link href="/" className={styles.backLink}>กลับหน้าร้านค้า</Link>
    </div>
  );
}
