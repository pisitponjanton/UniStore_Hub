"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  TextField,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { campaignStatusLabel } from "@/modules/campaigns";
import { getOrderStatusLabel } from "@/modules/orders";
import { ApiClientError } from "@/services";
import {
  CAMPAIGN_STATUSES,
  ORDER_STATUSES,
  type OrganizationReportDTO,
} from "@/types";
import { formatSatang } from "@/utils";

import { dashboardService } from "./dashboard-service";
import styles from "./dashboard-view.module.css";

type DashboardState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; summary: OrganizationReportDTO };

interface ReportFilters {
  campaignId: string;
  storeId: string;
}

const EMPTY_FILTERS: ReportFilters = {
  campaignId: "",
  storeId: "",
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "CAMPAIGN_NOT_FOUND") {
      return "ไม่พบ Campaign ที่ระบุในหน่วยงานนี้";
    }

    if (error.code === "STORE_NOT_FOUND") {
      return "ไม่พบ Store ที่ระบุในหน่วยงานนี้";
    }

    if (error.code === "VALIDATION_ERROR") {
      return "ตัวกรอง Campaign และ Store ไม่สัมพันธ์กัน กรุณาตรวจสอบแล้วลองใหม่";
    }

    return error.userMessage;
  }

  return "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง";
}

function countLabel(value: number): string {
  return value.toLocaleString("th-TH");
}

export function DashboardView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, setState] = useState<DashboardState>({
    status: "loading",
  });
  const [draftCampaignId, setDraftCampaignId] = useState("");
  const [draftStoreId, setDraftStoreId] = useState("");
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>(EMPTY_FILTERS);
  const [filtering, setFiltering] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitial() {
      try {
        const summary = await dashboardService.getSummary(
          organizationId,
          { signal: controller.signal },
        );

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

    void loadInitial();

    return () => controller.abort();
  }, [organizationId]);

  async function loadWithFilters(
    filters: ReportFilters,
  ) {
    setFiltering(true);
    setInlineError(null);

    try {
      const summary = await dashboardService.getSummary(
        organizationId,
        {
          campaignId: filters.campaignId || null,
          storeId: filters.storeId || null,
        },
      );

      setAppliedFilters(filters);
      setState({ status: "success", summary });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (
        error instanceof ApiClientError &&
        error.kind === "forbidden"
      ) {
        setState({ status: "forbidden" });
        return;
      }

      setInlineError(errorMessage(error));
    } finally {
      setFiltering(false);
    }
  }

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (filtering) {
      return;
    }

    const filters = {
      campaignId: draftCampaignId.trim(),
      storeId: draftStoreId.trim(),
    };

    setDraftCampaignId(filters.campaignId);
    setDraftStoreId(filters.storeId);
    void loadWithFilters(filters);
  }

  function handleClear() {
    if (filtering) {
      return;
    }

    setDraftCampaignId("");
    setDraftStoreId("");
    void loadWithFilters(EMPTY_FILTERS);
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดแดชบอร์ดหน่วยงาน" />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? (
            <ForbiddenState />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดแดชบอร์ดได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { summary } = state;
  const hasFilters =
    Boolean(appliedFilters.campaignId) ||
    Boolean(appliedFilters.storeId);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>
              Organization dashboard
            </span>
            <h1 className={styles.title}>แดชบอร์ดหน่วยงาน</h1>
            <p className={styles.description}>
              ตัวเลขทั้งหมดมาจาก Report endpoint ของ Backend
              โดยยอดรายได้ใช้ integer satang ที่ API ยืนยันแล้ว
              และรวมเฉพาะ Order ที่เข้าสู่ paid lifecycle
            </p>
          </div>

          <Badge tone="info">Organization Admin</Badge>
        </header>

        <form
          className={styles.filterPanel}
          onSubmit={handleFilter}
        >
          <div className={styles.filters}>
            <TextField
              id="dashboard-campaign-filter"
              label="Campaign ID"
              value={draftCampaignId}
              onChange={(event) =>
                setDraftCampaignId(event.target.value)
              }
              placeholder="เว้นว่างเพื่อดูทุก Campaign"
              disabled={filtering}
            />

            <TextField
              id="dashboard-store-filter"
              label="Store ID"
              value={draftStoreId}
              onChange={(event) =>
                setDraftStoreId(event.target.value)
              }
              placeholder="เว้นว่างเพื่อดูทุก Store"
              disabled={filtering}
            />
          </div>

          <div className={styles.filterActions}>
            <Button
              type="submit"
              pending={filtering}
              pendingLabel="กำลังโหลด"
            >
              ใช้ตัวกรอง
            </Button>
            <Button
              type="button"
              variant="quiet"
              disabled={filtering}
              onClick={handleClear}
            >
              ล้างตัวกรอง
            </Button>
          </div>
        </form>

        {hasFilters ? (
          <div className={styles.scope}>
            ขอบเขตรายงาน:
            {appliedFilters.storeId
              ? ` Store ${appliedFilters.storeId}`
              : ""}
            {appliedFilters.campaignId
              ? ` Campaign ${appliedFilters.campaignId}`
              : ""}
          </div>
        ) : (
          <div className={styles.scope}>
            ขอบเขตรายงาน: ทั้งหน่วยงาน
          </div>
        )}

        {inlineError ? (
          <div className={styles.errorBox} role="alert">
            {inlineError}
          </div>
        ) : null}

        <section
          className={styles.section}
          aria-labelledby="dashboard-baseline-metrics"
        >
          <h2
            className={styles.sectionTitle}
            id="dashboard-baseline-metrics"
          >
            ตัวชี้วัดหลัก
          </h2>

          <div className={styles.metrics}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Store ในขอบเขต
              </span>
              <strong className={styles.metricValue}>
                {countLabel(summary.totalStores)}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Product ในขอบเขต
              </span>
              <strong className={styles.metricValue}>
                {countLabel(summary.totalProducts)}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Payment รอตรวจสอบ
              </span>
              <strong className={styles.metricValue}>
                {countLabel(summary.pendingPaymentReviews)}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Order ใน paid lifecycle
              </span>
              <strong className={styles.metricValue}>
                {countLabel(summary.paidOrderCount)}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                รายได้จาก paid Order
              </span>
              <strong className={styles.metricValue}>
                {formatSatang(summary.paidRevenueSatang)}
              </strong>
            </article>
          </div>
        </section>

        <section className={styles.statusGrid}>
          <article className={styles.statusPanel}>
            <h2 className={styles.sectionTitle}>
              Campaign ตามสถานะ
            </h2>
            <div className={styles.statusList}>
              {CAMPAIGN_STATUSES.map((status) => (
                <div className={styles.statusRow} key={status}>
                  <span className={styles.statusName}>
                    {campaignStatusLabel(status)}
                  </span>
                  <strong className={styles.statusCount}>
                    {countLabel(
                      summary.campaignsByStatus[status] ?? 0,
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.statusPanel}>
            <h2 className={styles.sectionTitle}>
              Order ตามสถานะ
            </h2>
            <div className={styles.statusList}>
              {ORDER_STATUSES.map((status) => (
                <div className={styles.statusRow} key={status}>
                  <span className={styles.statusName}>
                    {getOrderStatusLabel(status)}
                  </span>
                  <strong className={styles.statusCount}>
                    {countLabel(
                      summary.ordersByStatus[status] ?? 0,
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
