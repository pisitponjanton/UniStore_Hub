"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
import type { Cursor, OrderDTO } from "@/types";
import { formatIsoDateTime, formatSatang } from "@/utils";

import styles from "./order-tracking.module.css";
import { orderService } from "./order-service";
import {
  getCustomerOrderGuidance,
  myOrderHref,
} from "./order-tracking-helpers";
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
  const [loadAttempt, setLoadAttempt] = useState(0);
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
  }, [loadAttempt]);

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

  const attentionCount = useMemo(() => {
    if (state.status !== "success") {
      return 0;
    }

    return state.items.filter(
      (order) => getCustomerOrderGuidance(order.status).action !== null,
    ).length;
  }, [state]);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <h1 className={styles.stateHeading}>คำสั่งซื้อของฉัน</h1>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดคำสั่งซื้อของคุณ"
              description="กำลังดึงสถานะล่าสุดของคำสั่งซื้อ"
            />
          ) : null}
          {state.status === "empty" ? (
            <EmptyState
              title="ยังไม่มีคำสั่งซื้อ"
              description="เมื่อสั่งสินค้าจากหน้าร้าน คำสั่งซื้อและขั้นตอนถัดไปจะปรากฏที่นี่"
              actions={<Link href="/">เลือกสินค้า</Link>}
            />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดคำสั่งซื้อได้"
              description="ลองดึงสถานะล่าสุดอีกครั้ง หรือกลับไปเลือกสินค้าจากหน้าร้าน"
              actions={
                <>
                  <Button
                    onClick={() => {
                      setState({ status: "loading" });
                      setLoadAttempt((attempt) => attempt + 1);
                    }}
                  >
                    ลองโหลดอีกครั้ง
                  </Button>
                  <Link href="/">กลับหน้าร้าน</Link>
                </>
              }
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
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>คำสั่งซื้อของฉัน</h1>
            <p className={styles.description}>
              เริ่มจากรายการที่ต้องทำต่อ แล้วค่อยเปิดดูรายละเอียดของแต่ละคำสั่งซื้อ
            </p>
          </div>
          <Link href="/" className={styles.headerAction}>
            เลือกสินค้าเพิ่ม
          </Link>
        </header>

        <section
          className={styles.orderOverview}
          aria-label="ภาพรวมคำสั่งซื้อที่โหลดอยู่"
        >
          <div
            className={styles.overviewPrimary}
            data-has-attention={attentionCount > 0 || undefined}
          >
            <span className={styles.summaryLabel}>รายการที่ต้องทำต่อ</span>
            <strong data-numeric>{attentionCount}</strong>
          </div>
          <p className={styles.overviewDescription}>
            {attentionCount > 0
              ? "รายการที่มีขั้นตอนให้คุณดำเนินการจะถูกทำให้เห็นเด่นขึ้นด้านล่าง"
              : "ยังไม่มีคำสั่งซื้อที่ต้องดำเนินการจากคุณในรายการที่โหลดอยู่"}
          </p>
          <div
            className={styles.overviewLoaded}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={styles.summaryLabel}>รายการที่แสดง</span>
            <strong data-numeric>{state.items.length} รายการ</strong>
          </div>
        </section>

        <section className={styles.orderLedger} aria-label="รายการคำสั่งซื้อ">
          <div className={styles.ledgerHeading}>
            <div>
              <h2>ติดตามสถานะและขั้นตอนถัดไป</h2>
            </div>
            <span className={styles.ledgerHint}>
              ยอดและสถานะแสดงจากข้อมูลล่าสุดที่โหลดจากระบบ
            </span>
          </div>

          <div className={styles.orderRows}>
            {state.items.map((order) => {
              const guidance = getCustomerOrderGuidance(order.status);
              const needsAction = guidance.action !== null;

              return (
                <article
                  className={styles.orderRow}
                  data-needs-action={needsAction || undefined}
                  aria-label={`คำสั่งซื้อ ${order.orderId}`}
                  key={order.orderId}
                >
                  <div className={styles.orderPrimary}>
                    <div className={styles.orderTopline}>
                      <OrderStatusBadge status={order.status} />
                      <time className={styles.orderMeta} dateTime={order.updatedAt}>
                        อัปเดต {formatIsoDateTime(order.updatedAt)}
                      </time>
                    </div>

                    <div className={styles.orderIdentity}>
                      <span className={styles.orderId} data-technical>
                        {order.orderId}
                      </span>
                      <p className={styles.orderNextStep}>{guidance.title}</p>
                      <p className={styles.orderGuidance}>
                        {guidance.description}
                      </p>
                    </div>
                  </div>

                  <div className={styles.orderAmount}>
                    <span className={styles.amountLabel}>ยอดรวม</span>
                    <strong className={styles.amountValue} data-numeric>
                      {formatSatang(order.total)}
                    </strong>
                    <time
                      className={styles.orderCreated}
                      dateTime={order.createdAt}
                    >
                      สร้าง {formatIsoDateTime(order.createdAt)}
                    </time>
                  </div>

                  <Link
                    href={myOrderHref(order.orderId)}
                    className={
                      needsAction
                        ? styles.detailLinkPrimary
                        : styles.detailLink
                    }
                    aria-label={`${needsAction ? "ดำเนินการต่อ" : "ดูรายละเอียด"} คำสั่งซื้อ ${order.orderId}`}
                  >
                    {needsAction ? "ดำเนินการต่อ" : "ดูรายละเอียด"}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {loadMoreError ? (
          <Notice tone="danger" role="alert" title="โหลดรายการเพิ่มเติมไม่สำเร็จ">
            {loadMoreError}
          </Notice>
        ) : null}

        {state.nextCursor ? (
          <div className={styles.loadMore}>
            <Button
              variant="secondary"
              pending={loadingMore}
              pendingLabel="กำลังโหลด"
              onClick={handleLoadMore}
            >
              โหลดคำสั่งซื้อเพิ่มเติม
            </Button>
          </div>
        ) : (
          <p className={styles.endOfList}>แสดงรายการที่มีทั้งหมดแล้ว</p>
        )}
      </main>
    </div>
  );
}
