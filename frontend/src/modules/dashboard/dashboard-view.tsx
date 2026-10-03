"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
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
      return "ไม่พบแคมเปญที่ระบุในหน่วยงานนี้";
    }

    if (error.code === "STORE_NOT_FOUND") {
      return "ไม่พบร้านค้าที่ระบุในหน่วยงานนี้";
    }

    if (error.code === "VALIDATION_ERROR") {
      return "ตัวกรองแคมเปญและร้านค้าไม่สัมพันธ์กัน กรุณาตรวจสอบแล้วลองใหม่";
    }

    return error.userMessage;
  }

  return "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง";
}

function countLabel(value: number): string {
  return value.toLocaleString("th-TH");
}

function organizationHref(path: string, organizationId: string): string {
  const params = new URLSearchParams({ organizationId });
  return `${path}?${params.toString()}`;
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

  async function loadWithFilters(filters: ReportFilters) {
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
            <LoadingState
              title="กำลังโหลดแดชบอร์ดหน่วยงาน"
              description="กำลังสรุปข้อมูลร้านค้า สินค้า คำสั่งซื้อ และการชำระเงิน"
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
  const hasDraftFilters =
    Boolean(draftCampaignId.trim()) || Boolean(draftStoreId.trim());

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.pageKicker}>ศูนย์ควบคุมหน่วยงาน</span>
            <h1 className={styles.title}>ภาพรวมหน่วยงาน</h1>
            <p className={styles.description}>
              เริ่มจากงานที่ต้องดูแลก่อน แล้วใช้รายงานด้านล่างเพื่อตรวจภาพรวมของร้านค้า แคมเปญ และคำสั่งซื้อ
            </p>
          </div>

          <div className={styles.headerActions}>
            <Badge tone="info">ผู้ดูแลหน่วยงาน</Badge>
            <Link
              href={organizationHref("/org/settings/", organizationId)}
              className={styles.headerLink}
            >
              ตั้งค่าหน่วยงาน
            </Link>
          </div>
        </header>

        <section className={styles.actionBoard} aria-label="งานและตัวเลขสำคัญ">
          <article
            className={styles.actionMetric}
            data-attention={summary.pendingPaymentReviews > 0 || undefined}
          >
            <div className={styles.metricTopline}>
              <span className={styles.metricLabel}>การชำระเงินรอตรวจสอบ</span>
              <span className={styles.metricSignal}>
                {summary.pendingPaymentReviews > 0 ? "ต้องตรวจ" : "ไม่มีค้าง"}
              </span>
            </div>
            <strong className={styles.priorityValue} data-numeric>
              {countLabel(summary.pendingPaymentReviews)}
            </strong>
            <Link
              href={organizationHref("/org/payments/", organizationId)}
              className={styles.metricAction}
            >
              เปิดคิวตรวจการชำระเงิน
            </Link>
          </article>

          <article className={styles.actionMetric}>
            <div className={styles.metricTopline}>
              <span className={styles.metricLabel}>คำสั่งซื้อที่ชำระแล้ว</span>
              <span className={styles.metricSignal}>ในขอบเขตนี้</span>
            </div>
            <strong className={styles.priorityValue} data-numeric>
              {countLabel(summary.paidOrderCount)}
            </strong>
            <Link
              href={organizationHref("/org/orders/", organizationId)}
              className={styles.metricAction}
            >
              เปิดรายการคำสั่งซื้อ
            </Link>
          </article>

          <article className={styles.revenueMetric}>
            <span className={styles.metricLabel}>
              รายได้จากคำสั่งซื้อที่ชำระแล้ว
            </span>
            <strong className={styles.revenueValue} data-numeric>
              {formatSatang(summary.paidRevenueSatang)}
            </strong>
            <span className={styles.metricHint}>
              อ้างอิงยอดที่ระบบบันทึกจากคำสั่งซื้อในขอบเขตรายงานปัจจุบัน
            </span>
          </article>
        </section>

        <section className={styles.resourceStrip} aria-label="ทรัพยากรในขอบเขตที่เลือก">
          <div>
            <span className={styles.metricLabel}>ร้านค้า</span>
            <strong className={styles.resourceValue} data-numeric>
              {countLabel(summary.totalStores)}
            </strong>
            <Link href={organizationHref("/org/stores/", organizationId)}>
              จัดการร้านค้า
            </Link>
          </div>
          <div>
            <span className={styles.metricLabel}>สินค้า</span>
            <strong className={styles.resourceValue} data-numeric>
              {countLabel(summary.totalProducts)}
            </strong>
            <Link href={organizationHref("/org/products/", organizationId)}>
              จัดการสินค้า
            </Link>
          </div>
          <div className={styles.resourceContext}>
            <span className={styles.metricLabel}>ขอบเขตรายงาน</span>
            <strong>{hasFilters ? "กำลังกรองข้อมูล" : "ทั้งหน่วยงาน"}</strong>
            <span className={styles.metricHint}>
              ตัวกรองด้านล่างมีผลกับตัวเลขและสถานะในหน้านี้เท่านั้น
            </span>
          </div>
        </section>

        <section className={styles.reportScope} aria-labelledby="report-filter-title">
          <div className={styles.reportScopeHeading}>
            <div>
              <span className={styles.sectionKicker}>เจาะขอบเขตรายงาน</span>
              <h2 className={styles.sectionTitle} id="report-filter-title">
                ตัวกรองรายงาน
              </h2>
              <p className={styles.sectionDescription}>
                ระบุรหัสร้านค้าหรือแคมเปญเมื่ออยากดูตัวเลขเฉพาะส่วน หากเว้นว่างจะรวมทั้งหน่วยงาน
              </p>
            </div>
            <div className={styles.scopeSummary} aria-label="ตัวกรองที่ใช้อยู่">
              {hasFilters ? (
                <>
                  {appliedFilters.storeId ? (
                    <span>ร้านค้า: {appliedFilters.storeId}</span>
                  ) : null}
                  {appliedFilters.campaignId ? (
                    <span>แคมเปญ: {appliedFilters.campaignId}</span>
                  ) : null}
                </>
              ) : (
                <span>ทั้งหน่วยงาน</span>
              )}
            </div>
          </div>

          <form className={styles.filterPanel} onSubmit={handleFilter}>
            <div className={styles.filters}>
              <TextField
                id="dashboard-campaign-filter"
                label="รหัสแคมเปญ"
                value={draftCampaignId}
                onChange={(event) =>
                  setDraftCampaignId(event.target.value)
                }
                placeholder="เว้นว่างเพื่อรวมทุกแคมเปญ"
                disabled={filtering}
              />

              <TextField
                id="dashboard-store-filter"
                label="รหัสร้านค้า"
                value={draftStoreId}
                onChange={(event) =>
                  setDraftStoreId(event.target.value)
                }
                placeholder="เว้นว่างเพื่อรวมทุกร้านค้า"
                disabled={filtering}
              />
            </div>

            <div className={styles.filterActions}>
              <Button
                type="submit"
                pending={filtering}
                pendingLabel="กำลังโหลดรายงาน"
              >
                ใช้ตัวกรอง
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={filtering || (!hasDraftFilters && !hasFilters)}
                onClick={handleClear}
              >
                แสดงทั้งหน่วยงาน
              </Button>
            </div>
          </form>
        </section>

        {inlineError ? (
          <Notice tone="danger" role="alert" title="ใช้ตัวกรองไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        <section className={styles.statusGrid} aria-label="สถานะการดำเนินงาน">
          <article className={styles.statusPanel}>
            <div className={styles.statusPanelHeading}>
              <div>
                <span className={styles.sectionKicker}>รอบขาย</span>
                <h2 className={styles.sectionTitle}>
                  แคมเปญตามสถานะ
                </h2>
              </div>
              <Link href={organizationHref("/org/campaigns/", organizationId)}>
                จัดการแคมเปญ
              </Link>
            </div>
            <div className={styles.statusList}>
              {CAMPAIGN_STATUSES.map((status) => (
                <div className={styles.statusRow} key={status}>
                  <span className={styles.statusName}>
                    {campaignStatusLabel(status)}
                  </span>
                  <strong className={styles.statusCount} data-numeric>
                    {countLabel(
                      summary.campaignsByStatus[status] ?? 0,
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.statusPanel}>
            <div className={styles.statusPanelHeading}>
              <div>
                <span className={styles.sectionKicker}>วงจรคำสั่งซื้อ</span>
                <h2 className={styles.sectionTitle}>
                  คำสั่งซื้อตามสถานะ
                </h2>
              </div>
              <Link href={organizationHref("/org/orders/", organizationId)}>
                เปิดคำสั่งซื้อ
              </Link>
            </div>
            <div className={styles.statusList}>
              {ORDER_STATUSES.map((status) => (
                <div className={styles.statusRow} key={status}>
                  <span className={styles.statusName}>
                    {getOrderStatusLabel(status)}
                  </span>
                  <strong className={styles.statusCount} data-numeric>
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
