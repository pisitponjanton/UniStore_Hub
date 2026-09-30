"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextField,
  UnauthorizedState,
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

      setState({
        status: "success",
        items: [...state.items, ...result.items],
        nextCursor: result.nextCursor,
      });
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
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลด Audit Log" />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? (
            <ForbiddenState />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลด Audit Log ได้"
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
            <span className={styles.eyebrow}>
              Organization audit
            </span>
            <h1 className={styles.title}>
              ประวัติการทำรายการ
            </h1>
            <p className={styles.description}>
              Audit Log เป็นข้อมูลอ่านอย่างเดียวสำหรับ
              Organization Admin และใช้ตัวกรองตาม API contract
              โดยตรง
            </p>
          </div>

          <Badge tone="neutral">
            {state.items.length} รายการในหน้าปัจจุบัน
          </Badge>
        </header>

        <div className={styles.readOnlyNote}>
          หน้านี้ไม่มี action แก้ไขหรือลบ Audit Log
          และ metadata ที่แสดงเป็นข้อมูลที่ Backend ส่งกลับหลังการ sanitize
        </div>

        <form
          className={styles.filterPanel}
          onSubmit={handleFilter}
        >
          <div className={styles.filters}>
            <TextField
              id="audit-actor-id"
              label="Actor ID"
              value={draftActorId}
              onChange={(event) =>
                setDraftActorId(event.target.value)
              }
              placeholder="กรองด้วยผู้ดำเนินการ"
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
              placeholder="กรองด้วย Resource ID"
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
              disabled={filtering}
              onClick={handleClear}
            >
              ล้างตัวกรอง
            </Button>
          </div>
        </form>

        {inlineError ? (
          <div className={styles.errorBox} role="alert">
            {inlineError}
          </div>
        ) : null}

        {state.items.length === 0 ? (
          <EmptyState
            title="ไม่พบ Audit Log"
            description="ไม่มีรายการที่ตรงกับตัวกรองปัจจุบัน"
          />
        ) : (
          <Table caption="รายการ Audit Log ของหน่วยงาน">
            <TableHead>
              <TableRow>
                <TableHeaderCell>เวลา</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Actor</TableHeaderCell>
                <TableHeaderCell>Resource</TableHeaderCell>
                <TableHeaderCell>Metadata</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.items.map((item) => (
                <TableRow key={item.auditId}>
                  <TableCell>
                    {formatIsoDateTime(item.createdAt)}
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
                    <div>
                      <strong>{item.resourceType}</strong>
                    </div>
                    <span className={styles.code}>
                      {item.resourceId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <pre className={styles.metadata}>
                      {formatAuditMetadata(item.metadata)}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {state.nextCursor ? (
          <div className={styles.loadMore}>
            <Button
              variant="secondary"
              pending={loadingMore}
              pendingLabel="กำลังโหลด"
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
