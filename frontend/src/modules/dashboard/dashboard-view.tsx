"use client";


import { PageLoadingRows, PageStateHeading } from "@/components/ui/async-page";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, SlidersHorizontal, ArrowUpRight } from "lucide-react";

import {
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draftCampaignId, setDraftCampaignId] = useState("");
  const [draftStoreId, setDraftStoreId] = useState("");
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPlacement, setFilterPlacement] = useState<"top" | "bottom">("bottom");
  const [filterMaxHeight, setFilterMaxHeight] = useState(400);
  const [filterLeftOffset, setFilterLeftOffset] = useState(0);
  const filterAreaRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const [filtering, setFiltering] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!filterOpen) return;

    // Focus the first field when opening the anchored panel.
    filterAreaRef.current?.querySelector<HTMLInputElement>("input")?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !filterAreaRef.current?.contains(event.target)) {
        setFilterOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setFilterOpen(false);
      filterToggleRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [filterOpen]);

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
  }, [organizationId, loadAttempt]);

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
      setFilterOpen(false);
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

  function toggleFilter() {
    if (filterOpen) {
      setFilterOpen(false);
      return;
    }
    const rect = filterToggleRef.current?.getBoundingClientRect();
    const above = Math.max(0, (rect?.top ?? 0) - 16);
    const below = Math.max(0, window.innerHeight - (rect?.bottom ?? 0) - 16);
    const placement = below < 360 && above > below ? "top" : "bottom";
    const popoverWidth = Math.min(350, window.innerWidth - 32);
    const idealLeft = (rect?.right ?? popoverWidth + 16) - popoverWidth;
    const clampedLeft = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, idealLeft));
    setFilterLeftOffset(clampedLeft - (rect?.left ?? 0));
    setFilterPlacement(placement);
    setFilterMaxHeight(Math.max(120, (placement === "top" ? above : below) - 9));
    setFilterOpen(true);
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
          <PageStateHeading title="ภาพรวมหน่วยงาน" description="ข้อมูลล่าสุดและงานที่ต้องดำเนินการ" />
          {state.status === "loading" ? <PageLoadingRows /> : null}
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
              description="ลองดึงรายงานล่าสุดของหน่วยงานนี้อีกครั้ง"
              actions={
                <Button
                  onClick={() => {
                    setState({ status: "loading" });
                    setLoadAttempt((attempt) => attempt + 1);
                  }}
                >
                  ลองโหลดอีกครั้ง
                </Button>
              }
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
  const visibleCampaignStatuses = CAMPAIGN_STATUSES.filter(status =>
    (summary.campaignsByStatus[status] ?? 0) > 0
  );
  const visibleOrderStatuses = ORDER_STATUSES.filter(status =>
    (summary.ordersByStatus[status] ?? 0) > 0
  );

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header} data-has-attention={summary.pendingPaymentReviews > 0 || undefined}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>ภาพรวมหน่วยงาน</h1>
            <p className={styles.description}>
              {summary.pendingPaymentReviews > 0
                ? "มีรายการชำระเงินรอการตรวจสอบ ตรวจสอบงานค้างก่อนดำเนินการอื่น"
                : "สรุปคำสั่งซื้อ รายได้ และงานของหน่วยงาน"}
            </p>
          </div>

        </header>

        <section className={styles.summaryStrip} aria-label="งานและตัวเลขสำคัญ">
          <div className={styles.summaryMetric} data-attention={summary.pendingPaymentReviews > 0 || undefined}>
            <span className={styles.summaryLabel}>รอตรวจชำระเงิน</span>
            <strong className={styles.summaryValue} data-numeric>{countLabel(summary.pendingPaymentReviews)}</strong>
            <Link href={organizationHref("/org/payments/", organizationId)} className={styles.summaryLink}>
              เปิดคิวตรวจการชำระเงิน <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.summaryMetric}>
            <span className={styles.summaryLabel}>คำสั่งซื้อที่ชำระแล้ว</span>
            <strong className={styles.summaryValue} data-numeric>{countLabel(summary.paidOrderCount)}</strong>
            <Link href={organizationHref("/org/orders/", organizationId)} className={styles.summaryLink}>
              เปิดรายการคำสั่งซื้อ <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.summaryMetric}>
            <span className={styles.summaryLabel}>รายได้จากคำสั่งซื้อที่ชำระแล้ว</span>
            <strong className={styles.summaryValue} data-numeric>{formatSatang(summary.paidRevenueSatang)}</strong>
            <span className={styles.summaryHelper}>ยอดในขอบเขตรายงานปัจจุบัน</span>
          </div>
        </section>

        <div className={styles.reportToolbar}>
          <div className={styles.reportContext}>
            <span>ร้านค้า <strong data-numeric>{countLabel(summary.totalStores)}</strong></span>
            <span className={styles.resourceDivider} aria-hidden="true">·</span>
            <span>สินค้า <strong data-numeric>{countLabel(summary.totalProducts)}</strong></span>
          </div>
          <div className={styles.reportTools}>
            <span className={styles.reportScopeValue} role="status" aria-live="polite" aria-atomic="true" aria-label="ขอบเขตรายงานที่ใช้อยู่">
              {hasFilters ? (
                <>
                  {appliedFilters.storeId ? <span>ร้านค้า: {appliedFilters.storeId}</span> : null}
                  {appliedFilters.campaignId ? <span>แคมเปญ: {appliedFilters.campaignId}</span> : null}
                </>
              ) : <span>ทั้งหน่วยงาน</span>}
            </span>
            <div className={styles.filterPopoverAnchor} ref={filterAreaRef}>
              <button
                ref={filterToggleRef}
                type="button"
                className={styles.filterToggle}
                onClick={toggleFilter}
                aria-controls={filterOpen ? "dashboard-report-filter-panel" : undefined}
                aria-expanded={filterOpen}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                ตัวกรอง
                <ChevronDown size={15} aria-hidden="true" className={filterOpen ? styles.filterChevronOpen : undefined} />
              </button>
              {filterOpen ? (
                <section
                  id="dashboard-report-filter-panel"
                  className={styles.reportFilter}
                  data-side={filterPlacement}
                  style={{ maxHeight: filterMaxHeight, left: filterLeftOffset }}
                  role="dialog"
                  aria-modal="false"
                  aria-label="กรองรายงาน"
                >
                  <h2 className={styles.filterTitle}>กรองรายงาน</h2>
                  <form className={styles.filterForm} onSubmit={handleFilter} aria-busy={filtering}>
                    <div className={styles.filters}>
                      <TextField
                        id="dashboard-campaign-filter"
                        label="รหัสแคมเปญ"
                        value={draftCampaignId}
                        onChange={event => setDraftCampaignId(event.target.value)}
                        placeholder="ทุกแคมเปญ"
                        disabled={filtering}
                      />
                      <TextField
                        id="dashboard-store-filter"
                        label="รหัสร้านค้า"
                        value={draftStoreId}
                        onChange={event => setDraftStoreId(event.target.value)}
                        placeholder="ทุกร้านค้า"
                        disabled={filtering}
                      />
                    </div>
                    {inlineError ? (
                      <p role="alert" className={styles.filterError}>{inlineError}</p>
                    ) : null}
                    <div className={styles.filterActions}>
                      <Button type="button" variant="secondary" disabled={filtering || (!hasDraftFilters && !hasFilters)} onClick={handleClear}>ล้างค่า</Button>
                      <Button type="submit" pending={filtering} pendingLabel="กำลังโหลดรายงาน">ใช้ตัวกรอง</Button>
                    </div>
                  </form>
                </section>
              ) : null}
            </div>
          </div>
        </div>

        {inlineError && !filterOpen ? (
          <Notice tone="danger" role="alert" title="ใช้ตัวกรองไม่สำเร็จ">{inlineError}</Notice>
        ) : null}

        <section className={styles.statusGrid} aria-label="สถานะการดำเนินงาน">
          <article className={styles.statusSection}>
            <div className={styles.statusHeading}>
              <h2>แคมเปญ</h2>
              <Link href={organizationHref("/org/campaigns/", organizationId)}>
                จัดการแคมเปญ <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {visibleCampaignStatuses.length ? (
              <dl className={styles.statusList}>
                {visibleCampaignStatuses.map(status => (
                  <div className={styles.statusRow} key={status}>
                    <dt>{campaignStatusLabel(status)}</dt>
                    <dd data-numeric>{countLabel(summary.campaignsByStatus[status] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.emptySummary}>ยังไม่มีแคมเปญ</p>
            )}
          </article>

          <article className={styles.statusSection}>
            <div className={styles.statusHeading}>
              <h2>คำสั่งซื้อ</h2>
              <Link href={organizationHref("/org/orders/", organizationId)}>
                เปิดคำสั่งซื้อ <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {visibleOrderStatuses.length ? (
              <dl className={styles.statusList}>
                {visibleOrderStatuses.map(status => (
                  <div className={styles.statusRow} key={status}>
                    <dt>{getOrderStatusLabel(status)}</dt>
                    <dd data-numeric>{countLabel(summary.ordersByStatus[status] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.emptySummary}>ยังไม่มีคำสั่งซื้อ</p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
