"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorState, LoadingState } from "@/components";
import { authSession, isDefinitiveSessionFailure } from "@/modules/auth";
import type { OrganizationDTO } from "@/types";
import { ApiClientError } from "@/services";
import { organizationLandingHref } from "./organization-helpers";
import { organizationService } from "./organization-service";
import styles from "./organization-view.module.css";

type ApplicationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; organization: OrganizationDTO };

export function OrganizationApplicationView({ organizationId }: { organizationId: string }) {
  const [state, setState] = useState<ApplicationState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const organization = await organizationService.get(organizationId, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ status: "success", organization });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
        setState({
          status: "error",
          message: error instanceof ApiClientError ? error.userMessage : "ไม่สามารถตรวจสอบสถานะหน่วยงานได้",
        });
      } finally {
        if (!controller.signal.aborted) setRefreshing(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, attempt]);

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setAttempt(value => value + 1);
  }

  return (
    <div className={styles.page} data-page="organization-application">
      <main className={styles.applicationMain}>
        <Link href="/org/select/" className={styles.applicationBack}>← กลับไปหน่วยงานของฉัน</Link>
        {state.status === "loading" ? <LoadingState title="กำลังตรวจสอบคำขอ" description="กำลังดึงสถานะหน่วยงานล่าสุดจากระบบ" /> : null}
        {state.status === "error" ? (
          <ErrorState title="ตรวจสอบสถานะไม่สำเร็จ" description={state.message} actions={<Button onClick={refresh}>ลองอีกครั้ง</Button>} />
        ) : null}
        {state.status === "success" ? (
          <section className={styles.applicationCard} aria-labelledby="application-title">
            <span className={styles.applicationEyebrow}>คำขอเปิดร้าน / สมัครหน่วยงาน</span>
            <h1 id="application-title">สถานะคำขอของ {state.organization.name}</h1>
            <Badge tone={state.organization.status === "ACTIVE" ? "success" : state.organization.status === "PENDING" ? "warning" : "danger"}>
              {state.organization.status === "ACTIVE" ? "อนุมัติแล้ว" : state.organization.status === "PENDING" ? "รอการอนุมัติ" : "ถูกระงับ"}
            </Badge>
            {state.organization.status === "PENDING" ? (
              <div className={styles.applicationMessage}>
                <strong>ส่งคำขอหน่วยงานเรียบร้อยแล้ว</strong>
                <p>ผู้ดูแลแพลตฟอร์มจะตรวจสอบคำขอก่อนเปิดใช้งานร้านค้า ระหว่างนี้ยังไม่สามารถเริ่มเปิดขายได้ คุณสามารถกลับมาตรวจสอบสถานะในหน้านี้ได้ทุกเมื่อ</p>
              </div>
            ) : state.organization.status === "ACTIVE" ? (
              <div className={styles.applicationMessage}>
                <strong>หน่วยงานได้รับการอนุมัติแล้ว</strong>
                <p>คุณสามารถเข้าสู่พื้นที่ผู้ดูแล เพื่อสร้างร้านค้า เพิ่มสินค้า และตั้งค่ารอบพรีออเดอร์ได้</p>
              </div>
            ) : (
              <div className={styles.applicationMessage}>
                <strong>หน่วยงานนี้ถูกระงับการใช้งาน</strong>
                <p>ยังไม่สามารถเปิดร้านหรือรับคำสั่งซื้อได้ กรุณาติดต่อผู้ดูแลแพลตฟอร์มเพื่อตรวจสอบรายละเอียด</p>
              </div>
            )}
            <div className={styles.applicationActions}>
              {state.organization.status === "ACTIVE" ? (
                <Link className={styles.applicationPrimary} href={organizationLandingHref(organizationId, "ORGANIZATION_ADMIN")}>เข้าสู่ Dashboard หน่วยงาน →</Link>
              ) : null}
              <Button variant="secondary" pending={refreshing} pendingLabel="กำลังตรวจสอบสถานะ" onClick={refresh}>ตรวจสอบสถานะล่าสุด</Button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
