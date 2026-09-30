"use client";

import { useEffect, useState } from "react";

import {
  Button,
  EmptyState,
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
import type { Cursor, NotificationDTO } from "@/types";
import { formatIsoDateTime } from "@/utils";

import {
  notificationService,
  type NotificationReadFilter,
} from "./notification-service";
import { NotificationTypeBadge } from "./notification-presenters";
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
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

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

    try {
      const result = await notificationService.listNotifications({
        filter,
        cursor: state.nextCursor,
      });

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
              setFilter(option.value);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดการแจ้งเตือน" />
          ) : null}
          {state.status === "empty" ? (
            <>
              {filterControls}
              <EmptyState
                title="ไม่มีการแจ้งเตือน"
                description={
                  filter === "all"
                    ? "เมื่อมีความคืบหน้าเรื่องการชำระเงินหรือรับสินค้า ระบบจะแจ้งที่นี่"
                    : "ไม่มีการแจ้งเตือนที่ตรงกับตัวกรองนี้"
                }
              />
            </>
          ) : null}
          {state.status === "unauthorized" ? <UnauthorizedState /> : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดการแจ้งเตือนได้"
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
            <span className={styles.eyebrow}>Notifications</span>
            <h1 className={styles.title}>การแจ้งเตือน</h1>
            <p className={styles.description}>
              ดูการอัปเดตเกี่ยวกับการชำระเงินและการรับสินค้า
              โดยข้อมูลสถานะจริงยังอ้างอิงจาก Order, Payment และ Pickup ของ Backend
            </p>
          </div>
          {filterControls}
        </header>

        <section className={styles.list} aria-label="รายการการแจ้งเตือน">
          {state.items.map((notification) => {
            const unread = notification.readAt === null;

            return (
              <article
                key={notification.notificationId}
                className={[
                  styles.card,
                  unread ? styles.cardUnread : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.content}>
                  <div className={styles.topline}>
                    <NotificationTypeBadge type={notification.type} />
                    {unread ? (
                      <span className={styles.unreadMarker}>ยังไม่อ่าน</span>
                    ) : (
                      <span className={styles.meta}>
                        อ่านแล้ว {formatIsoDateTime(notification.readAt)}
                      </span>
                    )}
                  </div>

                  <h2 className={styles.cardTitle}>
                    {notification.title}
                  </h2>
                  <p className={styles.message}>{notification.message}</p>
                  <span className={styles.meta}>
                    {formatIsoDateTime(notification.createdAt)}
                  </span>
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
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        {inlineError ? (
          <div className={styles.inlineError} role="alert">
            {inlineError}
          </div>
        ) : null}

        {state.nextCursor ? (
          <div className={styles.loadMore}>
            <Button
              variant="secondary"
              pending={loadingMore}
              pendingLabel="กำลังโหลด"
              onClick={handleLoadMore}
            >
              โหลดเพิ่มเติม
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
