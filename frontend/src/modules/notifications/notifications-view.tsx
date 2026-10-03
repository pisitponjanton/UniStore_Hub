"use client";

import { useEffect, useState } from "react";

import {
  Button,
  EmptyState,
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
import type { Cursor, NotificationDTO } from "@/types";
import { formatIsoDateTime } from "@/utils";

import { NotificationTypeBadge } from "./notification-presenters";
import {
  notificationService,
  type NotificationReadFilter,
} from "./notification-service";
import styles from "./notifications-view.module.css";

type NotificationState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | {
      status: "success";
      items: NotificationDTO[];
      nextCursor: Cursor | null;
    };

const FILTERS: Array<{
  value: NotificationReadFilter;
  label: string;
}> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "unread", label: "ยังไม่อ่าน" },
  { value: "read", label: "อ่านแล้ว" },
];

export function NotificationsView() {
  const [filter, setFilter] =
    useState<NotificationReadFilter>("all");
  const [state, setState] =
    useState<NotificationState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadNotifications() {
      try {
        const result = await notificationService.listNotifications({
          filter,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        setState(
          result.items.length === 0
            ? { status: "empty" }
            : {
                status: "success",
                items: result.items,
                nextCursor: result.nextCursor,
              },
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
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

    void loadNotifications();

    return () => controller.abort();
  }, [filter]);

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    setInlineError(null);
    setFeedback(null);

    try {
      const result = await notificationService.listNotifications({
        filter,
      });

      setState(
        result.items.length === 0
          ? { status: "empty" }
          : {
              status: "success",
              items: result.items,
              nextCursor: result.nextCursor,
            },
      );
      setFeedback(
        `อัปเดตรายการแจ้งเตือนล่าสุดแล้ว ตอนนี้แสดง ${result.items.length} รายการ`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(
        error instanceof ApiClientError
          ? error.userMessage
          : "ไม่สามารถรีเฟรชการแจ้งเตือนได้",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (
      state.status !== "success" ||
      !state.nextCursor ||
      loadingMore
    ) {
      return;
    }

    setLoadingMore(true);
    setInlineError(null);
    setFeedback(null);

    try {
      const result = await notificationService.listNotifications({
        filter,
        cursor: state.nextCursor,
      });

      const nextItems = [...state.items, ...result.items];

      setState({
        status: "success",
        items: nextItems,
        nextCursor: result.nextCursor,
      });
      setFeedback(
        `โหลดรายการเพิ่มเติมแล้ว ตอนนี้แสดง ${nextItems.length} รายการ`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(
        error instanceof ApiClientError
          ? error.userMessage
          : "ไม่สามารถโหลดการแจ้งเตือนเพิ่มเติมได้",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleMarkRead(notificationId: string) {
    if (markingId) {
      return;
    }

    setMarkingId(notificationId);
    setInlineError(null);
    setFeedback(null);

    try {
      const updated = await notificationService.markRead(notificationId);

      if (state.status !== "success") {
        return;
      }

      const nextItems =
        filter === "unread"
          ? state.items.filter(
              (item) => item.notificationId !== notificationId,
            )
          : state.items.map((item) =>
              item.notificationId === notificationId ? updated : item,
            );

      setState(
        nextItems.length === 0
          ? { status: "empty" }
          : {
              status: "success",
              items: nextItems,
              nextCursor: state.nextCursor,
            },
      );
      const markedTitle =
        state.items.find((item) => item.notificationId === notificationId)
          ?.title ?? "การแจ้งเตือน";
      setFeedback(`ทำเครื่องหมาย “${markedTitle}” ว่าอ่านแล้ว`);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setInlineError(
        error instanceof ApiClientError
          ? error.userMessage
          : "ไม่สามารถทำเครื่องหมายว่าอ่านแล้วได้",
      );
    } finally {
      setMarkingId(null);
    }
  }

  const filterControls = (
    <div className={styles.filters} role="group" aria-label="กรองการแจ้งเตือน">
      {FILTERS.map((option) => (
        <button
          key={option.value}
          className={[
            styles.filterButton,
            filter === option.value ? styles.filterButtonActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-pressed={filter === option.value}
          onClick={() => {
            if (filter !== option.value) {
              setState({ status: "loading" });
              setInlineError(null);
              setFeedback(null);
              setFilter(option.value);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (state.status === "unauthorized" || state.status === "forbidden") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "unauthorized" ? <UnauthorizedState /> : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
        </main>
      </div>
    );
  }

  const loadedCount = state.status === "success" ? state.items.length : 0;
  const unreadLoadedCount =
    state.status === "success"
      ? state.items.filter((item) => item.readAt === null).length
      : 0;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>การแจ้งเตือน</h1>
            <p className={styles.description}>
              ใช้หน้านี้เพื่อดูว่าเกิดอะไรขึ้นล่าสุด แล้วเปิดหน้าคำสั่งซื้อหรือขั้นตอนที่เกี่ยวข้องเพื่อตรวจสถานะจริง
            </p>
          </div>
          <Button
            variant="secondary"
            aria-label="รีเฟรชรายการ"
            pending={refreshing}
            pendingLabel="กำลังรีเฟรช"
            onClick={handleRefresh}
          >
            ตรวจเหตุการณ์ล่าสุด
          </Button>
        </header>

        <section className={styles.controlPanel} aria-label="ตัวกรองและภาพรวมการแจ้งเตือน">
          <div className={styles.controlBar}>
            {filterControls}
            <div className={styles.refreshNote}>
              รายการนี้ไม่อัปเดตอัตโนมัติ กดตรวจเหตุการณ์ล่าสุดเมื่ออยากดูข้อมูลรอบใหม่
            </div>
          </div>

          {state.status === "success" ? (
            <div className={styles.listSummary} aria-label="สรุปรายการที่แสดง">
              <div>
                <span className={styles.summaryLabel}>รายการที่โหลด</span>
                <strong data-numeric>{loadedCount}</strong>
              </div>
              <div>
                <span className={styles.summaryLabel}>ยังไม่อ่าน</span>
                <strong data-numeric>{unreadLoadedCount}</strong>
              </div>
              <p>
                การแจ้งเตือนบอกว่าเกิดเหตุการณ์อะไรขึ้น แต่สถานะล่าสุดให้ตรวจจากหน้าคำสั่งซื้อ การชำระเงิน หรือรับสินค้า
              </p>
            </div>
          ) : null}
        </section>

        {feedback ? (
          <div className={styles.feedback} role="status" aria-live="polite">
            {feedback}
          </div>
        ) : null}

        {state.status === "loading" ? (
          <LoadingState
            title="กำลังโหลดการแจ้งเตือน"
            description="กำลังดึงรายการล่าสุดตามตัวกรองที่เลือก"
          />
        ) : null}

        {state.status === "empty" ? (
          <EmptyState
            title="ไม่มีการแจ้งเตือน"
            description={
              filter === "all"
                ? "เมื่อมีความคืบหน้าเรื่องการชำระเงินหรือรับสินค้า ระบบจะแจ้งที่นี่"
                : "ไม่มีการแจ้งเตือนที่ตรงกับตัวกรองนี้"
            }
          />
        ) : null}

        {state.status === "error" ? (
          <ErrorState
            title="ไม่สามารถโหลดการแจ้งเตือนได้"
            description="กรุณาลองรีเฟรชรายการอีกครั้ง"
            actions={
              <Button
                variant="secondary"
                pending={refreshing}
                pendingLabel="กำลังรีเฟรช"
                onClick={handleRefresh}
              >
                ลองอีกครั้ง
              </Button>
            }
          />
        ) : null}

        {state.status === "success" ? (
          <section
            className={styles.list}
            aria-label="รายการการแจ้งเตือน"
            aria-busy={loadingMore || markingId !== null}
          >
            {state.items.map((notification) => {
              const unread = notification.readAt === null;

              return (
                <article
                  key={notification.notificationId}
                  className={[
                    styles.row,
                    unread ? styles.rowUnread : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={`${notification.title}, สถานะ ${unread ? "ยังไม่อ่าน" : "อ่านแล้ว"}`}
                >
                  <div className={styles.content}>
                    <div className={styles.topline}>
                      <NotificationTypeBadge type={notification.type} />
                      {unread ? (
                        <span className={styles.unreadMarker}>ยังไม่อ่าน</span>
                      ) : (
                        <time
                          className={styles.readMeta}
                          dateTime={notification.readAt ?? undefined}
                        >
                          อ่านแล้ว {formatIsoDateTime(notification.readAt)}
                        </time>
                      )}
                    </div>

                    <h2 className={styles.rowTitle}>{notification.title}</h2>
                    <p className={styles.message}>{notification.message}</p>

                    <div className={styles.rowMeta}>
                      <time dateTime={notification.createdAt}>
                        {formatIsoDateTime(notification.createdAt)}
                      </time>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    {unread ? (
                      <Button
                        variant="secondary"
                        size="small"
                        pending={markingId === notification.notificationId}
                        pendingLabel="กำลังบันทึก"
                        disabled={markingId !== null}
                        onClick={() =>
                          handleMarkRead(notification.notificationId)
                        }
                      >
                        ทำเครื่องหมายว่าอ่านแล้ว
                      </Button>
                    ) : (
                      <span className={styles.readState}>อ่านแล้ว</span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {inlineError ? (
          <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        {state.status === "success" && state.nextCursor ? (
          <div className={styles.loadMore}>
            <Button
              variant="secondary"
              pending={loadingMore}
              pendingLabel="กำลังโหลด"
              onClick={handleLoadMore}
            >
              โหลดเพิ่มเติม
            </Button>
            <span className={styles.loadMoreHint}>
              โหลดรายการถัดไปต่อจากรายการที่แสดงอยู่
            </span>
          </div>
        ) : null}

        <aside
          className={styles.authorityNote}
          aria-label="แหล่งอ้างอิงสถานะปัจจุบัน"
        >
          การแจ้งเตือนเป็นเพียงสัญญาณเหตุการณ์ สถานะการชำระเงินและการรับสินค้าปัจจุบันยังอ้างอิงจากหน้าคำสั่งซื้อ การชำระเงิน และการรับสินค้า
        </aside>
      </main>
    </div>
  );
}
