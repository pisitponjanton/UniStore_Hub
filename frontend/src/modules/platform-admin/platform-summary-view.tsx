"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  ErrorState,
  ForbiddenState,
  LoadingState,
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
  platformUserStatusLabel,
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
            <LoadingState title="กำลังโหลดภาพรวม Platform" />
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>Platform admin</span>
            <h1 className={styles.title}>ภาพรวมระบบ</h1>
            <p className={styles.description}>
              ภาพรวมนี้ใช้ข้อมูลจาก /platform/summary โดยตรง
              และสิทธิ์ Platform Admin มาจาก persisted User.platformRole
              ไม่ได้อนุมานจากสมาชิกของหน่วยงาน
            </p>
          </div>

          <Badge tone="info">PLATFORM_ADMIN</Badge>
        </header>

        <section
          className={styles.section}
          aria-labelledby="organization-summary"
        >
          <h2
            className={styles.sectionTitle}
            id="organization-summary"
          >
            หน่วยงานตามสถานะ
          </h2>

          <div className={styles.metrics}>
            {ORGANIZATION_STATUSES.map((status) => (
              <article
                className={styles.metricCard}
                key={status}
              >
                <span className={styles.metricLabel}>
                  {platformOrganizationStatusLabel(status)}
                </span>
                <strong className={styles.metricValue}>
                  {count(
                    state.summary.organizationsByStatus[status],
                  )}
                </strong>
              </article>
            ))}
          </div>
        </section>

        <section
          className={styles.section}
          aria-labelledby="user-summary"
        >
          <h2 className={styles.sectionTitle} id="user-summary">
            ผู้ใช้ตามสถานะ
          </h2>

          <div className={styles.metrics}>
            {USER_STATUSES.map((status) => (
              <article
                className={styles.metricCard}
                key={status}
              >
                <span className={styles.metricLabel}>
                  {platformUserStatusLabel(status)}
                </span>
                <strong className={styles.metricValue}>
                  {count(state.summary.usersByStatus[status])}
                </strong>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
