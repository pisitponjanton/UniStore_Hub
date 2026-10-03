"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import {
  ORGANIZATION_STATUSES,
  USER_STATUSES,
  type PlatformSummaryDTO,
} from "@/types";

import {
  platformOrganizationStatusLabel,
  platformOrganizationStatusTone,
  platformUserStatusLabel,
  platformUserStatusTone,
} from "./platform-admin-helpers";
import { platformAdminService } from "./platform-admin-service";
import styles from "./platform-admin.module.css";

type SummaryState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; summary: PlatformSummaryDTO };

function count(value: number | undefined): string {
  return (value ?? 0).toLocaleString("th-TH");
}

function sumCounts(values: Record<string, number | undefined>): number {
  return Object.values(values).reduce<number>(
    (total, value) => total + (value ?? 0),
    0,
  );
}
export function PlatformSummaryView() {
  const [state, setState] = useState<SummaryState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        const summary = await platformAdminService.getSummary({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setState({ status: "success", summary });
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          return;
        }

        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }

        if (error instanceof ApiClientError) {
          if (error.kind === "unauthorized") {
            setState({ status: "unauthorized" });
            return;
          }

          if (error.kind === "forbidden") {
            setState({ status: "forbidden" });
            return;
          }
        }

        setState({ status: "error" });
      }
    }

    void loadSummary();

    return () => controller.abort();
  }, []);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดภาพรวม Platform"
              description="กำลังสรุปสถานะหน่วยงานและผู้ใช้"
            />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? (
            <ForbiddenState />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดภาพรวม Platform ได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          ) : null}
        </main>
      </div>
    );
  }

  const organizationTotal = sumCounts(
    state.summary.organizationsByStatus,
  );
  const userTotal = sumCounts(state.summary.usersByStatus);
  const pendingOrganizations =
    state.summary.organizationsByStatus.PENDING ?? 0;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.pageKicker}>ขอบเขตระดับ Platform</span>
            <h1 className={styles.title}>ภาพรวม Platform</h1>
            <p className={styles.description}>
              ตรวจสถานะหน่วยงานและผู้ใช้จากข้อมูลระดับ Platform
              เพื่อเห็นงานที่ต้องตัดสินใจก่อนเข้าไปจัดการรายละเอียด
            </p>
          </div>

          <Badge tone="info">Platform Admin</Badge>
        </header>

        <Notice tone="neutral" title="ขอบเขตสิทธิ์ Platform">
          หน้านี้ใช้สิทธิ์จาก User.platformRole = PLATFORM_ADMIN
          โดยตรง ไม่ได้อนุมานจากบทบาทภายในหน่วยงาน
        </Notice>

        <section
          className={styles.priorityStrip}
          aria-label="ตัวชี้วัด Platform ที่สำคัญ"
        >
          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>หน่วยงานรออนุมัติ</span>
            <strong className={styles.priorityValue}>
              {count(pendingOrganizations)}
            </strong>
            <span className={styles.metricHint}>
              รายการที่ต้องตรวจสอบก่อนอนุมัติหรือระงับ
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>หน่วยงานทั้งหมด</span>
            <strong className={styles.priorityValue}>
              {count(organizationTotal)}
            </strong>
            <span className={styles.metricHint}>
              รวมทุกสถานะที่ Platform Summary ส่งกลับ
            </span>
          </article>

          <article className={styles.priorityItem}>
            <span className={styles.metricLabel}>ผู้ใช้ทั้งหมด</span>
            <strong className={styles.priorityValue}>
              {count(userTotal)}
            </strong>
            <span className={styles.metricHint}>
              รวมผู้ใช้ทุกสถานะใน Platform Summary
            </span>
          </article>
        </section>

        <section
          className={styles.section}
          aria-labelledby="organization-summary"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2
                className={styles.sectionTitle}
                id="organization-summary"
              >
                หน่วยงานตามสถานะ
              </h2>
              <p className={styles.sectionDescription}>
                ใช้สถานะนี้เพื่อแยกหน่วยงานที่รอการตัดสินใจ อนุมัติแล้ว
                หรือถูกระงับ
              </p>
            </div>
          </div>

          <div className={styles.statusLedger}>
            {ORGANIZATION_STATUSES.map((status) => (
              <div className={styles.statusRow} key={status}>
                <div className={styles.statusCopy}>
                  <Badge
                    tone={platformOrganizationStatusTone(status)}
                  >
                    {platformOrganizationStatusLabel(status)}
                  </Badge>
                  <span className={styles.code}>{status}</span>
                </div>
                <strong className={styles.statusCount}>
                  {count(
                    state.summary.organizationsByStatus[status],
                  )}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section
          className={styles.section}
          aria-labelledby="user-summary"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="user-summary">
                ผู้ใช้ตามสถานะ
              </h2>
              <p className={styles.sectionDescription}>
                แสดงสถานะผู้ใช้ตามข้อมูลที่ Platform Summary ส่งกลับ
              </p>
            </div>
          </div>

          <div className={styles.statusLedger}>
            {USER_STATUSES.map((status) => (
              <div className={styles.statusRow} key={status}>
                <div className={styles.statusCopy}>
                  <Badge tone={platformUserStatusTone(status)}>
                    {platformUserStatusLabel(status)}
                  </Badge>
                  <span className={styles.code}>{status}</span>
                </div>
                <strong className={styles.statusCount}>
                  {count(state.summary.usersByStatus[status])}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
