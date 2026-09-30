"use client";

import Link from "next/link";
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
import type { Cursor, OrderDTO } from "@/types";
import { formatIsoDateTime, formatSatang } from "@/utils";

import styles from "./order-tracking.module.css";
import { orderService } from "./order-service";
import { myOrderHref } from "./order-tracking-helpers";
import { OrderStatusBadge } from "./order-status";

type OrdersState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | {
      status: "success";
      items: OrderDTO[];
      nextCursor: Cursor | null;
    };

export function MyOrdersView() {
  const [state, setState] = useState<OrdersState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialOrders() {
      try {
        const result = await orderService.listMyOrders({
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

        if (error instanceof ApiClientError && error.kind === "unauthorized") {
          setState({ status: "unauthorized" });
          return;
        }

        if (error instanceof ApiClientError && error.kind === "forbidden") {
          setState({ status: "forbidden" });
          return;
        }

        setState({ status: "error" });
      }
    }

    void loadInitialOrders();

    return () => controller.abort();
  }, []);

  async function handleLoadMore() {
    if (
      state.status !== "success" ||
      !state.nextCursor ||
      loadingMore
    ) {
      return;
    }

    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const result = await orderService.listMyOrders({
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

      setLoadMoreError(
        error instanceof ApiClientError
          ? error.userMessage
          : "ไม่สามารถโหลดคำสั่งซื้อเพิ่มเติมได้",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดคำสั่งซื้อของคุณ" />
          ) : null}
          {state.status === "empty" ? (
            <EmptyState
              title="ยังไม่มีคำสั่งซื้อ"
              description="เมื่อคุณสั่งสินค้าจาก Storefront คำสั่งซื้อจะปรากฏที่นี่"
              actions={<Link href="/">กลับไปเลือกสินค้า</Link>}
            />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดคำสั่งซื้อได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
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
            <span className={styles.eyebrow}>My orders</span>
            <h1 className={styles.title}>คำสั่งซื้อของฉัน</h1>
            <p className={styles.description}>
              ติดตามสถานะและยอดที่ Backend บันทึกไว้สำหรับคำสั่งซื้อของคุณ
            </p>
          </div>
          <Link href="/" className={styles.detailLink}>
            เลือกสินค้าเพิ่ม
          </Link>
        </header>

        <section className={styles.orderList} aria-label="รายการคำสั่งซื้อ">
          {state.items.map((order) => (
            <article className={styles.orderCard} key={order.orderId}>
              <div className={styles.orderPrimary}>
                <div className={styles.orderId}>{order.orderId}</div>
                <OrderStatusBadge status={order.status} />
                <div className={styles.orderMeta}>
                  สร้างเมื่อ {formatIsoDateTime(order.createdAt)}
                </div>
              </div>

              <div className={styles.orderAmount}>
                <span className={styles.amountLabel}>ยอดรวม</span>
                <span className={styles.amountValue}>
                  {formatSatang(order.total)}
                </span>
              </div>

              <Link
                href={myOrderHref(order.orderId)}
                className={styles.detailLink}
              >
                ดูรายละเอียด
              </Link>
            </article>
          ))}
        </section>

        {loadMoreError ? (
          <div className={styles.serverError} role="alert">
            {loadMoreError}
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
