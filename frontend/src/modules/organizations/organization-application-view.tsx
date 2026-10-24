"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const lastSuccess = useRef<OrganizationDTO | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const organization = await organizationService.get(organizationId, { signal: controller.signal });
        if (!controller.signal.aborted) {
          lastSuccess.current = organization;
          setRefreshError(null);
          setState({ status: "success", organization });
        }
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
        const message = error instanceof ApiClientError ? error.userMessage : "ไม่สามารถตรวจสอบสถานะหน่วยงานได้";
        // Preserve the last known status when a manual refresh fails.
        if (attempt > 0 && lastSuccess.current?.organizationId === organizationId) {
          setRefreshError(message);
        } else {
          setState({ status: "error", message });
        }
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
    setRefreshError(null);
    setAttempt(value => value + 1);
  }

  const organization = state.status === "success" ? state.organization : null;
  const currentStatus = organization?.status;
  const isActive = currentStatus === "ACTIVE";
  const isPending = currentStatus === "PENDING";

  return (
    <div className={styles.page} data-page="organization-application">
      <main className={styles.applicationMain}>
        <header className={styles.applicationHeader}>
          <div className={styles.applicationHeading}>
            <h1 id="application-title">สถานะคำขอหน่วยงาน</h1>
            <p>{organization?.name ?? "ติดตามสถานะคำขอของคุณ"}</p>
          </div>
          <button
            type="button"
            className={styles.applicationRefresh}
            aria-label={refreshing ? "กำลังรีเฟรชสถานะ" : "รีเฟรชสถานะ"}
            title={refreshing ? "กำลังรีเฟรชสถานะ" : "รีเฟรชสถานะ"}
            aria-busy={refreshing || undefined}
            onClick={refresh}
            disabled={refreshing || state.status === "loading"}
          >
            <RefreshCw
              size={20}
              strokeWidth={2}
              aria-hidden="true"
              className={refreshing ? styles.applicationRefreshSpinning : undefined}
            />
          </button>
        </header>

        {state.status === "loading" ? (
          <div className={styles.applicationState}>
            <LoadingState title="กำลังตรวจสอบคำขอ" description="กำลังดึงสถานะหน่วยงานล่าสุดจากระบบ" />
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className={styles.applicationState}>
            <ErrorState
              title="ตรวจสอบสถานะไม่สำเร็จ"
              description={state.message}
              actions={<Button onClick={refresh} pending={refreshing}>ลองอีกครั้ง</Button>}
            />
          </div>
        ) : null}

        {organization ? (
          <section className={styles.applicationStatus} aria-label="สถานะคำขอ" aria-live="polite">
            <div className={styles.applicationStatusLine}>
              <Badge tone={isActive ? "success" : isPending ? "warning" : "danger"}>
                {isActive ? "อนุมัติแล้ว" : isPending ? "รออนุมัติ" : "ถูกระงับ"}
              </Badge>
              {isPending ? <span>ส่งคำขอเรียบร้อยแล้ว</span> : null}
            </div>
            <div className={styles.applicationStatusCopy}>
              <h2>{isActive ? "พร้อมเปิดร้าน" : isPending ? "กำลังรอการตรวจสอบ" : "ไม่สามารถใช้งานหน่วยงานได้"}</h2>
              <p>
                {isActive
                  ? "คำขอได้รับอนุมัติแล้ว คุณสามารถเข้าไปจัดการร้านค้าและสินค้าได้"
                  : isPending
                    ? "ผู้ดูแลแพลตฟอร์มกำลังตรวจสอบคำขอ เมื่อได้รับอนุมัติแล้วจึงจะสามารถเปิดร้านได้"
                    : "หน่วยงานนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลแพลตฟอร์มเพื่อสอบถามรายละเอียด"}
              </p>
            </div>
            {refreshError ? (
              <p className={styles.applicationRefreshError} role="alert">{refreshError} กรุณาลองรีเฟรชอีกครั้ง</p>
            ) : null}
            {isActive ? (
              <Link
                className={styles.applicationPrimary}
                href={organizationLandingHref(organizationId, "ORGANIZATION_ADMIN")}
              >
                เข้าสู่ Dashboard หน่วยงาน
                <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" />
              </Link>
            ) : null}
          </section>
        ) : null}

        <Link href="/org/select/" className={styles.applicationBack}>
          <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
          กลับไปหน่วยงานของฉัน
        </Link>
      </main>
    </div>
  );
}
