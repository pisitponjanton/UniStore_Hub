"use client";

import Link from "next/link";

import { ForbiddenState, LoadingState, UnauthorizedState, Button } from "@/components";

import { getUnauthenticatedExit } from "./return-route";
import { useCurrentLoginHref, useCurrentReturnPath } from "./use-auth-navigation-context";

import styles from "./auth-recovery.module.css";

export function OrderAccessRecovery({ state }: { state: "loading" | "unauthorized" | "forbidden" }) {
  const returnPath = useCurrentReturnPath();
  const loginHref = useCurrentLoginHref();
  const exit = getUnauthenticatedExit(returnPath);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>UniStore Hub</Link>
        <Link href="/" className={styles.headerReturn}>ดูร้านค้าทั้งหมด</Link>
      </header>
      <main className={styles.main} aria-label="ทำรายการสั่งซื้อต่อ">
        <div className={styles.content}>
          <span className={styles.eyebrow}>CHECKOUT / ตรวจสอบคำสั่งซื้อ</span>
          {state === "loading" ? (
            <LoadingState headingLevel={1} title="กำลังตรวจสอบบัญชี"
              description="ระบบกำลังตรวจสอบการเข้าสู่ระบบก่อนเปิดหน้าสั่งซื้อ กรุณารอสักครู่" />
          ) : state === "unauthorized" ? (
            <UnauthorizedState headingLevel={1} actions={
              <>
                <Link href={loginHref}><Button>เข้าสู่ระบบเพื่อทำรายการต่อ</Button></Link>
                <Link href={exit.href} className={styles.secondaryAction}>{exit.label}</Link>
              </>
            } />
          ) : (
            <ForbiddenState headingLevel={1} actions={
              <>
                <Link href={exit.href}><Button variant="secondary">{exit.label}</Button></Link>
                <Link href="/" className={styles.secondaryAction}>ดูร้านค้าทั้งหมด</Link>
              </>
            } />
          )}
          {state !== "loading" ? (
            <p className={styles.explanation}>
              {state === "forbidden"
                ? "บัญชีนี้ไม่สามารถเปิดรายการดังกล่าวได้ ลองตรวจสอบสินค้าและรอบขายที่ยังเปิดให้ใช้งาน หรือเปลี่ยนไปใช้บัญชีที่มีสิทธิ์"
                : "ยังไม่ได้เข้าสู่ระบบ คุณสามารถเข้าสู่ระบบเพื่อดำเนินการต่อ หรือกลับไปดูสินค้าก่อนได้โดยไม่ต้องเข้าสู่ระบบ"}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
