"use client";

import { AsyncPageFallback } from "@/components/ui/async-page";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  Button,
  EmptyState,
  Notice,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type {
  AuditLogDTO,
  Cursor,
} from "@/types";
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
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | {
      status: "success";
      items: AuditLogDTO[];
      nextCursor: Cursor | null;
    };

const EMPTY_FILTERS: AuditFilters = {
  actorId: "",
  action: "",
  resourceType: "",
  resourceId: "",
};

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.userMessage
    : "ไม่สามารถโหลด Audit Log ได้ กรุณาลองใหม่อีกครั้ง";
}

export function AuditView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [state, setState] = useState<AuditState>({
    status: "loading",
  });

  const [draftActorId, setDraftActorId] = useState("");
  const [draftAction, setDraftAction] = useState("");
  const [draftResourceType, setDraftResourceType] =
    useState("");
  const [draftResourceId, setDraftResourceId] = useState("");
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(EMPTY_FILTERS);
  const [filtering, setFiltering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(
    null,
  );
  const [listFeedback, setListFeedback] = useState<string | null>(null);
  const [filterFeedbackRevision, setFilterFeedbackRevision] = useState(0);
  const successFeedbackRef = useRef<HTMLParagraphElement>(null);
  const errorFeedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filtering || filterFeedbackRevision === 0) return;
    const target = inlineError ? errorFeedbackRef.current : successFeedbackRef.current;
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [filtering, filterFeedbackRevision, inlineError]);


  useEffect(() => {
    const controller = new AbortController();

    async function loadInitial() {
      try {
        const result = await auditService.list(
          organizationId,
          {
            signal: controller.signal,
          },
        );

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            items: result.items,
            nextCursor: result.nextCursor,
          });
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

  async function loadWithFilters(filters: AuditFilters) {
    setFiltering(true);
    setInlineError(null);

    try {
      const result = await auditService.list(
        organizationId,
        {
          actorId: filters.actorId || null,
          action: filters.action || null,
          resourceType: filters.resourceType || null,
          resourceId: filters.resourceId || null,
        },
      );

      setAppliedFilters(filters);
      setState({
        status: "success",
        items: result.items,
        nextCursor: result.nextCursor,
      });
      const filtered =
        Boolean(filters.actorId) ||
        Boolean(filters.action) ||
        Boolean(filters.resourceType) ||
        Boolean(filters.resourceId);
      setListFeedback(
        filtered
          ? `แสดง ${result.items.length.toLocaleString("th-TH")} เหตุการณ์ตามตัวกรอง`
          : `แสดง Audit Log ทั้งหมดที่โหลด ${result.items.length.toLocaleString("th-TH")} รายการ`,
      );
      setFilterFeedbackRevision(revision => revision + 1);
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
      setFilterFeedbackRevision(revision => revision + 1);
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
      actorId: draftActorId.trim(),
      action: draftAction.trim(),
      resourceType: draftResourceType.trim(),
      resourceId: draftResourceId.trim(),
    };

    setDraftActorId(filters.actorId);
    setDraftAction(filters.action);
    setDraftResourceType(filters.resourceType);
    setDraftResourceId(filters.resourceId);
    void loadWithFilters(filters);
  }

  function handleClear() {
    if (filtering) {
      return;
    }

    setDraftActorId("");
    setDraftAction("");
    setDraftResourceType("");
    setDraftResourceId("");
    void loadWithFilters(EMPTY_FILTERS);
  }

  async function loadMore() {
    if (
      state.status !== "success" ||
      !state.nextCursor ||
      loadingMore
    ) {
      return;
    }

    setLoadingMore(true);
    setInlineError(null);

    try {
      const result = await auditService.list(
        organizationId,
        {
          actorId: appliedFilters.actorId || null,
          action: appliedFilters.action || null,
          resourceType: appliedFilters.resourceType || null,
          resourceId: appliedFilters.resourceId || null,
          cursor: state.nextCursor,
        },
      );

      const nextItems = [...state.items, ...result.items];

      setState({
        status: "success",
        items: nextItems,
        nextCursor: result.nextCursor,
      });
      setListFeedback(
        `โหลดเพิ่มเติมแล้ว ตอนนี้แสดง ${nextItems.length.toLocaleString("th-TH")} Audit Log`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <AsyncPageFallback
            status={state.status}
            pageTitle="ประวัติการทำรายการ"
            pageDescription="ติดตามกิจกรรมและการเปลี่ยนแปลงของหน่วยงาน"
            loadingTitle="กำลังโหลดประวัติการทำรายการ"
            errorTitle="ไม่สามารถโหลดประวัติการทำรายการได้"
            backHref="/org/select/"
            backLabel="กลับไปพื้นที่ทำงาน"
          />
        </main>
      </div>
    );
  }

  const hasFilters =
    Boolean(appliedFilters.actorId) ||
    Boolean(appliedFilters.action) ||
    Boolean(appliedFilters.resourceType) ||
    Boolean(appliedFilters.resourceId);
  const hasDraftFilters =
    Boolean(draftActorId.trim()) ||
    Boolean(draftAction.trim()) ||
    Boolean(draftResourceType.trim()) ||
    Boolean(draftResourceId.trim());

  const directoryMatches = searchLoadedItems(state.items, directoryQuery, item => [item.action, item.actorId, item.resourceType, item.resourceId]);
  const directoryVisible = visibleLoadedItems(directoryMatches, directoryLimit);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.readOnlyBadge}>อ่านอย่างเดียว</span>
            <h1 className={styles.title}>ประวัติการทำรายการ</h1>
            <p className={styles.description}>
              ตรวจสอบว่าใครทำอะไรกับข้อมูลใดและเมื่อไร โดยรายการนี้เป็นประวัติแบบอ่านอย่างเดียว
            </p>
          </div>
          <div className={styles.headerCount}>
            <strong>{state.items.length.toLocaleString("th-TH")}</strong>
            <span>รายการที่โหลด</span>
          </div>
        </header>

        <nav className={styles.auditShortcuts} aria-label="การสำรวจ Audit Log">
          <a href="#audit-list-title">ดูเหตุการณ์ล่าสุดที่โหลด</a>
          <a href="#audit-filter-title">ตัวกรองขั้นสูง (ค้นหาจากเซิร์ฟเวอร์)</a>
        </nav>
        <Notice tone="neutral" title="Audit Log เป็นข้อมูลอ่านอย่างเดียว">
          หน้านี้ไม่มี action แก้ไขหรือลบ Audit Log และ metadata ที่แสดงคือข้อมูลที่ระบบส่งกลับสำหรับรายการนั้น
        </Notice>



        {listFeedback ? (
          <p
            id="audit-search-success"
            ref={successFeedbackRef}
            tabIndex={-1}
            className={`${styles.listFeedback} ${styles.focusableFeedback}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {listFeedback}
          </p>
        ) : null}

        {inlineError ? (
          <div
            id="audit-search-error"
            ref={errorFeedbackRef}
            tabIndex={-1}
            className={styles.focusableFeedback}
          >
            <Notice tone="danger" role="alert" title="โหลดรายการไม่สำเร็จ">
              {inlineError}
            </Notice>
          </div>
        ) : null}

        <section
          className={styles.section}
          aria-labelledby="audit-list-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="audit-list-title">
                เหตุการณ์ที่บันทึกไว้
              </h2>
              <p className={styles.sectionDescription}>
                รายการเรียงตามผลลัพธ์ที่ API ส่งกลับและใช้ cursor สำหรับโหลดต่อ
              </p>
            </div>
            <span className={styles.sectionMeta}>
              {state.items.length.toLocaleString("th-TH")} รายการ
            </span>
          </div>

          <LoadedDirectoryControls
            id="audit-directory-search"
            label="ค้นหากิจกรรมที่โหลด"
            query={directoryQuery}
            onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
            loadedCount={state.items.length}
            matchingCount={directoryMatches.length}
            visibleCount={directoryVisible.length}
            onShowMore={() => setDirectoryLimit(limit => limit + 24)}
          />

          {state.items.length === 0 ? (
            <EmptyState
              title="ไม่พบ Audit Log"
              description={
                hasFilters
                  ? "ไม่มีเหตุการณ์ที่ตรงกับตัวกรองปัจจุบัน"
                  : "หน่วยงานนี้ยังไม่มี Audit Log"
              }
            />
          ) : (
            <Table
              caption="รายการ Audit Log ของหน่วยงาน"
              density="compact"
              className={styles.auditTable}
            >
              <TableHead>
                <TableRow>
                  <TableHeaderCell>เวลา</TableHeaderCell>
                  <TableHeaderCell>การทำรายการ</TableHeaderCell>
                  <TableHeaderCell>Actor</TableHeaderCell>
                  <TableHeaderCell>Resource</TableHeaderCell>
                  <TableHeaderCell>Metadata</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {directoryVisible.map((item) => (
                  <TableRow key={item.auditId}>
                    <TableCell>
                      <time className={styles.time} dateTime={item.createdAt}>
                        {formatIsoDateTime(item.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <span className={styles.action}>
                        {item.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.code}>
                        {item.actorId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className={styles.resource}>
                        <strong>{item.resourceType}</strong>
                        <span className={styles.code}>
                          {item.resourceId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <details className={styles.metadataDetails}>
                        <summary>
                          ดู metadata ของ {item.resourceType} {item.resourceId}
                        </summary>
                        <pre className={styles.metadata}>
                          {formatAuditMetadata(item.metadata)}
                        </pre>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section
          className={styles.filterPanel}
          aria-labelledby="audit-filter-title"
        >
          <div className={styles.filterHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="audit-filter-title">
                ค้นหาเหตุการณ์
              </h2>
              <p className={styles.sectionDescription}>
                กรองด้วยผู้ดำเนินการ Action หรือ Resource เพื่อเจาะจงเหตุการณ์ที่ต้องตรวจสอบ
              </p>
            </div>

            <div
              className={styles.appliedFilters}
              role="group"
              aria-label="ตัวกรองที่ใช้อยู่"
            >
              {hasFilters ? (
                <>
                  {appliedFilters.actorId ? (
                    <span>Actor: {appliedFilters.actorId}</span>
                  ) : null}
                  {appliedFilters.action ? (
                    <span>การทำรายการ: {appliedFilters.action}</span>
                  ) : null}
                  {appliedFilters.resourceType ? (
                    <span>Type: {appliedFilters.resourceType}</span>
                  ) : null}
                  {appliedFilters.resourceId ? (
                    <span>Resource: {appliedFilters.resourceId}</span>
                  ) : null}
                </>
              ) : (
                <span>แสดงทุกเหตุการณ์</span>
              )}
            </div>
          </div>

          <form
            className={styles.filterForm}
            onSubmit={handleFilter}
            aria-busy={filtering}
          >
            <div className={styles.filters}>
              <TextField
                id="audit-actor-id"
                label="Actor ID"
                value={draftActorId}
                onChange={(event) =>
                  setDraftActorId(event.target.value)
                }
                placeholder="ผู้ดำเนินการ"
                disabled={filtering}
              />

              <TextField
                id="audit-action"
                label="Action"
                value={draftAction}
                onChange={(event) =>
                  setDraftAction(event.target.value)
                }
                placeholder="เช่น PAYMENT_APPROVED"
                disabled={filtering}
              />

              <TextField
                id="audit-resource-type"
                label="Resource Type"
                value={draftResourceType}
                onChange={(event) =>
                  setDraftResourceType(event.target.value)
                }
                placeholder="เช่น PAYMENT"
                disabled={filtering}
              />

              <TextField
                id="audit-resource-id"
                label="Resource ID"
                value={draftResourceId}
                onChange={(event) =>
                  setDraftResourceId(event.target.value)
                }
                placeholder="เช่น payment-..."
                disabled={filtering}
              />
            </div>

            <div className={styles.filterActions}>
              <Button
                type="submit"
                pending={filtering}
                pendingLabel="กำลังค้นหา"
              >
                ค้นหา / กรอง
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={
                  filtering || (!hasFilters && !hasDraftFilters)
                }
                onClick={handleClear}
              >
                แสดงทั้งหมด
              </Button>
            </div>
          </form>
        </section>

        {state.nextCursor ? (
          <div className={styles.loadMore}>
            <Button
              variant="secondary"
              pending={loadingMore}
              pendingLabel="กำลังโหลดเพิ่มเติม"
              onClick={() => {
                void loadMore();
              }}
            >
              โหลดเพิ่มเติม
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
