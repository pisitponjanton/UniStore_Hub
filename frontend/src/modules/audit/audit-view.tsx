"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2, Copy, CreditCard, Filter, History,
  Package, Search, Store, Users, X,
} from "lucide-react";
import { AsyncPageFallback } from "@/components/ui/async-page";
import { searchLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";
import { Button, Dialog, EmptyState, Notice, TextField } from "@/components";
import { authSession, isDefinitiveSessionFailure } from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { AuditLogDTO, Cursor } from "@/types";
import { formatIsoDateTime } from "@/utils";
import { formatAuditMetadata } from "./audit-helpers";
import { auditService } from "./audit-service";
import styles from "./audit-view.module.css";

interface AuditFilters {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
}

type AuditState =
  | { status: "loading" | "unauthorized" | "forbidden" | "error" }
  | { status: "success"; items: AuditLogDTO[]; nextCursor: Cursor | null };

const PAGE_SIZE = 10;

const EMPTY_FILTERS: AuditFilters = {
  actorId: "", action: "", resourceType: "", resourceId: "",
};

const FILTER_LABELS: { key: keyof AuditFilters; label: string }[] = [
  { key: "actorId", label: "ผู้ดำเนินการ" },
  { key: "action", label: "การทำรายการ" },
  { key: "resourceType", label: "ประเภทข้อมูล" },
  { key: "resourceId", label: "รหัสรายการ" },
];

const ACTION_LABELS: Record<string, string> = {
  ORGANIZATION_CREATED: "สร้างหน่วยงาน",
  ORGANIZATION_APPROVED: "อนุมัติหน่วยงาน",
  ORGANIZATION_UPDATED: "แก้ไขหน่วยงาน",
  ORGANIZATION_SUSPENDED: "ระงับหน่วยงาน",
  STORE_CREATED: "สร้างร้านค้า",
  STORE_UPDATED: "แก้ไขร้านค้า",
  STORE_DELETED: "ลบร้านค้า",
  PRODUCT_CREATED: "สร้างสินค้า",
  PRODUCT_UPDATED: "แก้ไขสินค้า",
  PRODUCT_DELETED: "ลบสินค้า",
  VARIANT_CREATED: "สร้างตัวเลือกสินค้า",
  VARIANT_UPDATED: "แก้ไขตัวเลือกสินค้า",
  VARIANT_DELETED: "ลบตัวเลือกสินค้า",
  CAMPAIGN_CREATED: "สร้างแคมเปญ",
  CAMPAIGN_UPDATED: "แก้ไขแคมเปญ",
  PAYMENT_APPROVED: "อนุมัติการชำระเงิน",
  PAYMENT_REJECTED: "ปฏิเสธการชำระเงิน",
  PICKUP_CONFIRMED: "ยืนยันการรับสินค้า",
};

function activityLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function shortId(id: string) {
  return id.length > 15 ? id.slice(0, 8) + "…" : id;
}

function ActivityIcon({ type }: { type: string }) {
  const props = { size: 18, "aria-hidden": true as const };
  if (type === "STORE") return <Store {...props} />;
  if (["PRODUCT", "PRODUCT_VARIANT", "VARIANT"].includes(type)) return <Package {...props} />;
  if (type === "PAYMENT") return <CreditCard {...props} />;
  if (type === "ORGANIZATION" || type === "MEMBERSHIP" || type === "USER") return <Users {...props} />;
  if (type === "PICKUP") return <CheckCircle2 {...props} />;
  return <History {...props} />;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.userMessage
    : "ไม่สามารถโหลด Audit Log ได้ กรุณาลองใหม่อีกครั้ง";
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return <div className={styles.copyValue}>
    <code title={value}>{value}</code>
    <button type="button" onClick={() => void copy()} aria-label={`คัดลอก${label}`}
      title={copied ? "คัดลอกแล้ว" : `คัดลอก${label}`}>
      {copied ? <CheckCircle2 size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  </div>;
}

export function AuditView({ organizationId }: { organizationId: string }) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [state, setState] = useState<AuditState>({ status: "loading" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<AuditLogDTO | null>(null);
  const [draftActorId, setDraftActorId] = useState("");
  const [draftAction, setDraftAction] = useState("");
  const [draftResourceType, setDraftResourceType] = useState("");
  const [draftResourceId, setDraftResourceId] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [filtering, setFiltering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [listFeedback, setListFeedback] = useState<string | null>(null);
  const [filterFeedbackRevision, setFilterFeedbackRevision] = useState(0);
  const successFeedbackRef = useRef<HTMLParagraphElement>(null);
  const filterErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filterFeedbackRevision === 0 || filtering) return;
    const frame = requestAnimationFrame(() => {
      const target = filterError ? filterErrorRef.current : successFeedbackRef.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [filterFeedbackRevision, filtering, filterError]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadInitial() {
      try {
        const result = await auditService.list(organizationId, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setState({ status: "success", items: result.items, nextCursor: result.nextCursor });
        }
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        if (isDefinitiveSessionFailure(error)) {
          authSession.logout(); return;
        }
        if (error instanceof ApiClientError) {
          if (error.kind === "unauthorized") { setState({ status: "unauthorized" }); return; }
          if (error.kind === "forbidden") { setState({ status: "forbidden" }); return; }
        }
        setState({ status: "error" });
      }
    }
    void loadInitial();
    return () => controller.abort();
  }, [organizationId]);

  function draftFilters(): AuditFilters {
    return {
      actorId: draftActorId.trim(),
      action: draftAction.trim(),
      resourceType: draftResourceType.trim(),
      resourceId: draftResourceId.trim(),
    };
  }

  function setDrafts(filters: AuditFilters) {
    setDraftActorId(filters.actorId);
    setDraftAction(filters.action);
    setDraftResourceType(filters.resourceType);
    setDraftResourceId(filters.resourceId);
  }

  async function loadWithFilters(filters: AuditFilters) {
    if (filtering) return;
    if (loadingMore) return;
    setFiltering(true);
    setFilterError(null);
    setInlineError(null);
    try {
      const result = await auditService.list(organizationId, {
        actorId: filters.actorId || null,
        action: filters.action || null,
        resourceType: filters.resourceType || null,
        resourceId: filters.resourceId || null,
      });
      setAppliedFilters(filters);
      setDrafts(filters);
      setState({ status: "success", items: result.items, nextCursor: result.nextCursor });
      setDirectoryQuery("");
      setPageNumber(1);
      const filtered = Object.values(filters).some(Boolean);
      setListFeedback(filtered
        ? `แสดง ${result.items.length.toLocaleString("th-TH")} เหตุการณ์ตามตัวกรอง`
        : `แสดง Audit Log ทั้งหมดที่โหลด ${result.items.length.toLocaleString("th-TH")} รายการ`);
      setFilterOpen(false);
      setFilterFeedbackRevision(revision => revision + 1);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
      if (error instanceof ApiClientError && error.kind === "forbidden") {
        setState({ status: "forbidden" }); return;
      }
      setFilterOpen(true);
      setFilterError(errorMessage(error));
      setFilterFeedbackRevision(revision => revision + 1);
    } finally {
      setFiltering(false);
    }
  }

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadWithFilters(draftFilters());
  }

  function handleClear() {
    if (filtering || loadingMore) return;
    setDrafts(EMPTY_FILTERS);
    void loadWithFilters(EMPTY_FILTERS);
  }

  async function goToPage(targetPage: number) {
    if (state.status !== "success" || loadingMore || filtering || targetPage < 1) return;
    const matchCount = directoryQuery.trim()
      ? searchLoadedItems(state.items, directoryQuery, item => [
          item.action, activityLabel(item.action), item.actorId, item.resourceType, item.resourceId,
        ]).length
      : state.items.length;
    const needsMore = !directoryQuery.trim() && state.nextCursor &&
      targetPage * PAGE_SIZE > matchCount;
    if (!needsMore) {
      if ((targetPage - 1) * PAGE_SIZE < matchCount) setPageNumber(targetPage);
      return;
    }

    // The backend uses opaque cursors and may return chunks larger or smaller
    // than ten. Fetch only when the requested page is not fully in memory.
    setLoadingMore(true);
    setInlineError(null);
    let nextItems = state.items;
    let cursor: Cursor | null = state.nextCursor;
    try {
      const seenCursors = new Set<string>();
      while (cursor && nextItems.length < targetPage * PAGE_SIZE) {
        if (seenCursors.has(cursor)) throw new Error("Repeated audit cursor");
        seenCursors.add(cursor);
        const result = await auditService.list(organizationId, {
          actorId: appliedFilters.actorId || null,
          action: appliedFilters.action || null,
          resourceType: appliedFilters.resourceType || null,
          resourceId: appliedFilters.resourceId || null,
          cursor,
        });
        nextItems = [...nextItems, ...result.items];
        cursor = result.nextCursor;
      }
      setState({ status: "success", items: nextItems, nextCursor: cursor });
      if ((targetPage - 1) * PAGE_SIZE < nextItems.length) {
        setPageNumber(targetPage);
      }
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) { authSession.logout(); return; }
      setInlineError(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status !== "success") {
    return <div className={styles.page}><main className={styles.stateWrap}>
      <AsyncPageFallback
        status={state.status}
        pageTitle="ประวัติการทำรายการ"
        pageDescription="ติดตามกิจกรรมและการเปลี่ยนแปลงของหน่วยงาน"
        loadingTitle="กำลังโหลดประวัติการทำรายการ"
        errorTitle="ไม่สามารถโหลดประวัติการทำรายการได้"
        backHref="/org/select/" backLabel="กลับไปพื้นที่ทำงาน"
      />
    </main></div>;
  }

  const hasFilters = Object.values(appliedFilters).some(Boolean);
  const hasDraftFilters = Object.values(draftFilters()).some(Boolean);
  const directoryMatches = searchLoadedItems(state.items, directoryQuery, item => [
    item.action, activityLabel(item.action), item.actorId, item.resourceType, item.resourceId,
  ]);
  const directoryVisible = directoryMatches.slice(
    (pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE,
  );
  const knownPageCount = Math.max(1, Math.ceil(directoryMatches.length / PAGE_SIZE));
  // When there is an unvisited server cursor, expose only the next reachable page.
  const pageCount = knownPageCount + (
    !directoryQuery.trim() && state.nextCursor && directoryMatches.length % PAGE_SIZE === 0 ? 1 : 0
  );
  const canGoNext = pageNumber < pageCount;
  const firstPageButton = Math.max(1, Math.min(pageNumber - 2, pageCount - 4));
  const pageButtons = Array.from(
    { length: Math.min(5, pageCount - firstPageButton + 1) },
    (_, index) => firstPageButton + index,
  );
  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  return <div className={styles.page}>
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>ประวัติการทำรายการ</h1>
          <p className={styles.description}>ตรวจสอบกิจกรรมและการเปลี่ยนแปลงภายในหน่วยงาน</p>
        </div>
        <p className={styles.headerCount}>{state.items.length.toLocaleString("th-TH")} รายการที่โหลด</p>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <Search size={18} aria-hidden="true" />
          <span className={styles.srOnly}>ค้นหากิจกรรมที่โหลด</span>
          <input id="audit-directory-search" type="search" autoComplete="off"
            value={directoryQuery}
            disabled={loadingMore}
            placeholder="ค้นหาเหตุการณ์ที่โหลดแล้ว..."
            onChange={event => { setDirectoryQuery(event.target.value); setPageNumber(1); }}
          />
          {directoryQuery ? <button type="button" aria-label="ล้างคำค้นหา" disabled={loadingMore} onClick={() => {
            setDirectoryQuery(""); setPageNumber(1);
          }}><X size={16} aria-hidden="true" /></button> : null}
        </label>
        <Button variant="secondary" disabled={loadingMore} onClick={() => {
          setDrafts(appliedFilters);
          setFilterError(null);
          setFilterOpen(true);
        }} leading={<Filter size={17} aria-hidden="true" />}>
          ตัวกรอง{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>
      <p className={styles.searchHint}>ค้นหาภายในรายการที่โหลดแล้ว · ตัวกรองค้นหาจากเซิร์ฟเวอร์</p>
      {hasFilters ? <div className={styles.activeFilters} role="group" aria-label="ตัวกรองที่ใช้อยู่">
        {FILTER_LABELS.map(({ key, label }) => appliedFilters[key] ? (
          <button key={key} type="button" title={`ล้าง ${label}`}
            disabled={filtering || loadingMore}
            onClick={() => void loadWithFilters({ ...appliedFilters, [key]: "" })}>
            <strong>{label}:</strong> <span>{appliedFilters[key]}</span>
            <X size={14} aria-hidden="true" />
          </button>
        ) : null)}
        <button className={styles.clearAllFilters} type="button" disabled={filtering || loadingMore}
          onClick={handleClear}>ล้างทั้งหมด</button>
      </div> : null}

      {listFeedback ? <p id="audit-search-success" ref={successFeedbackRef} tabIndex={-1}
        className={styles.feedback} role="status" aria-live="polite">{listFeedback}</p> : null}
      {inlineError ? <div id="audit-search-error" tabIndex={-1} className={styles.feedback}>
        <Notice tone="danger" role="alert" title="โหลดรายการไม่สำเร็จ">{inlineError}</Notice>
      </div> : null}

      <section className={styles.section} aria-labelledby="audit-list-title">
        <div className={styles.listHeading}>
          <h2 id="audit-list-title">กิจกรรมล่าสุด</h2>
          <span>{directoryMatches.length ? `รายการ ${((pageNumber - 1) * PAGE_SIZE + 1).toLocaleString("th-TH")}–${((pageNumber - 1) * PAGE_SIZE + directoryVisible.length).toLocaleString("th-TH")} จาก ${directoryMatches.length.toLocaleString("th-TH")} ที่โหลดแล้ว` : "0 รายการ"} · หน้าละ 10 รายการ</span>
        </div>
        {directoryMatches.length === 0 ? <EmptyState
          title={state.items.length === 0 ? "ไม่พบ Audit Log" : "ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง"}
          description={state.items.length === 0
            ? hasFilters ? "ไม่มีเหตุการณ์ที่ตรงกับตัวกรองปัจจุบัน" : "หน่วยงานนี้ยังไม่มี Audit Log"
            : "ลองเปลี่ยนคำค้นหา หรือล้างคำค้นหาเพื่อดูรายการเดิม"}
        /> : (
          <div className={styles.activityList} role="list" aria-label="รายการ Audit Log ของหน่วยงาน">
            {directoryVisible.map(item => (
              <article key={item.auditId} className={styles.activityRow} role="listitem">
                <span className={styles.activityIcon}><ActivityIcon type={item.resourceType} /></span>
                <div className={styles.activityInfo}>
                  <div className={styles.activityHeading}>
                    <h3>{activityLabel(item.action)}</h3>
                    <span className={styles.resourceType}>{item.resourceType}</span>
                  </div>
                  <p>
                    <time dateTime={item.createdAt}>{formatIsoDateTime(item.createdAt)}</time>
                    <span aria-hidden="true"> · </span>
                    <span title={item.actorId}>ผู้ดำเนินการ {shortId(item.actorId)}</span>
                  </p>
                </div>
                <button type="button" className={styles.detailButton}
                  aria-label={`ดูรายละเอียด ${item.action} ${item.auditId}`}
                  onClick={() => setDetailItem(item)}>ดูรายละเอียด</button>
              </article>
            ))}
          </div>
        )}
        {directoryMatches.length > 0 && (pageCount > 1 || pageNumber > 1) ? (
          <nav className={styles.pagination} aria-label="แบ่งหน้าประวัติการทำรายการ">
            <button type="button" className={styles.pageControl}
              disabled={pageNumber === 1 || loadingMore}
              onClick={() => void goToPage(pageNumber - 1)}>ก่อนหน้า</button>
            <div className={styles.pageNumbers}>
              {pageButtons.map(number => (
                <button key={number} type="button"
                  className={[styles.pageControl, number === pageNumber ? styles.pageActive : ""].join(" ")}
                  aria-label={`หน้า ${number}`}
                  aria-current={number === pageNumber ? "page" : undefined}
                  disabled={loadingMore}
                  onClick={() => void goToPage(number)}>{number}</button>
              ))}
            </div>
            <button type="button" className={styles.pageControl}
              disabled={!canGoNext || loadingMore}
              onClick={() => void goToPage(pageNumber + 1)}>ถัดไป</button>
            {loadingMore ? <span className={styles.pageLoading} role="status">กำลังโหลดหน้า...</span> : null}
          </nav>
        ) : null}
      </section>
    </main>

    <Dialog open={filterOpen} onOpenChange={open => { if (!filtering) {
      setFilterOpen(open);
      if (!open) { setDrafts(appliedFilters); setFilterError(null); }
    } }} title="ตัวกรองเหตุการณ์" description="ค้นหาจากเซิร์ฟเวอร์ด้วยเงื่อนไขที่เลือก"
      contentClassName={styles.filterDialog}
      footer={<div className={styles.dialogActions}>
        <Button type="button" variant="secondary" disabled={filtering || (!hasFilters && !hasDraftFilters)}
          onClick={handleClear}>แสดงทั้งหมด</Button>
        <Button type="submit" form="audit-server-filter-form" pending={filtering}
          pendingLabel="กำลังค้นหา">ค้นหา / กรอง</Button>
      </div>}>
      <form id="audit-server-filter-form" className={styles.filterForm}
        onSubmit={handleFilter} aria-busy={filtering}>
        {filterError ? <div id="audit-search-error" ref={filterErrorRef}
          tabIndex={-1} className={styles.feedback}>
          <Notice tone="danger" role="alert" title="โหลดรายการไม่สำเร็จ">{filterError}</Notice>
        </div> : null}
        <TextField id="audit-actor-id" label="ผู้ดำเนินการ (Actor ID)" value={draftActorId}
          placeholder="Actor ID" disabled={filtering}
          onChange={event => setDraftActorId(event.target.value)} />
        <TextField id="audit-action" label="การทำรายการ (Action)" value={draftAction}
          placeholder="เช่น PAYMENT_APPROVED" disabled={filtering}
          onChange={event => setDraftAction(event.target.value)} />
        <TextField id="audit-resource-type" label="ประเภทข้อมูล (Resource Type)" value={draftResourceType}
          placeholder="เช่น PAYMENT" disabled={filtering}
          onChange={event => setDraftResourceType(event.target.value)} />
        <TextField id="audit-resource-id" label="รหัสรายการ (Resource ID)" value={draftResourceId}
          placeholder="เช่น payment-..." disabled={filtering}
          onChange={event => setDraftResourceId(event.target.value)} />
      </form>
    </Dialog>

    <Dialog open={Boolean(detailItem)} onOpenChange={open => { if (!open) setDetailItem(null); }}
      title="รายละเอียดเหตุการณ์"
      description={detailItem ? formatIsoDateTime(detailItem.createdAt) : undefined}
      contentClassName={styles.detailDialog}
      footer={<div className={styles.dialogActions}>
        <Button type="button" variant="secondary" onClick={() => setDetailItem(null)}>ปิด</Button>
      </div>}>
      {detailItem ? <div className={styles.detailContent}>
        <div className={styles.detailGrid}>
          <div><span>การทำรายการ</span><strong>{activityLabel(detailItem.action)}</strong></div>
          <div><span>ประเภทข้อมูล</span><strong>{detailItem.resourceType}</strong></div>
        </div>
        <div className={styles.detailField}>
          <span>Action Code</span><CopyValue label=" Action Code" value={detailItem.action} />
        </div>
        <div className={styles.detailField}>
          <span>ผู้ดำเนินการ (Actor ID)</span><CopyValue label=" Actor ID" value={detailItem.actorId} />
        </div>
        <div className={styles.detailField}>
          <span>Resource ID</span><CopyValue label=" Resource ID" value={detailItem.resourceId} />
        </div>
        <div className={styles.detailField}>
          <span>Audit ID</span><CopyValue label=" Audit ID" value={detailItem.auditId} />
        </div>
        <div className={styles.metadataHeading}>
          <h3>Metadata</h3>
          <button type="button" onClick={() => {
            void navigator.clipboard.writeText(formatAuditMetadata(detailItem.metadata)).catch(() => undefined);
          }}><Copy size={15} aria-hidden="true" /> คัดลอก JSON</button>
        </div>
        <pre className={styles.metadata}>{formatAuditMetadata(detailItem.metadata)}</pre>
      </div> : null}
    </Dialog>
  </div>;
}
