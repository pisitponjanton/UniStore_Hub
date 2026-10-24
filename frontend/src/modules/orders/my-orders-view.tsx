"use client";


import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  EmptyState,
  EmptyIllustration,
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
import { myPaymentHref } from "@/modules/payments/payment-helpers";
import { myPickupHref } from "@/modules/pickups/pickup-helpers";
import { formatIsoDateTime, formatSatang } from "@/utils";

import styles from "./order-tracking.module.css";
import { orderService } from "./order-service";
import {
  customerOrderBucket,
  getCustomerOrderGuidance,
  myOrderHref,
  prioritizeLoadedOrders,
  type CustomerOrderViewFilter,
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
  const [viewFilter, setViewFilter] = useState<CustomerOrderViewFilter>("all");

  const focusAfterRetry = useRef(false);
  const cursorErrorRef = useRef<HTMLDivElement>(null);

  function retryInitialLoad() {
    focusAfterRetry.current = true;
    setState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }

  useEffect(() => {
    if (!focusAfterRetry.current || state.status === "loading") return;
    focusAfterRetry.current = false;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.status]);

  useEffect(() => {
    if (!loadMoreError) return;
    const frame = window.requestAnimationFrame(() => {
      cursorErrorRef.current?.focus({ preventScroll: true });
      cursorErrorRef.current?.scrollIntoView?.({ block: "center", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadMoreError]);

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

  const loadedOrders = useMemo(
    () => state.status === "success" ? prioritizeLoadedOrders(state.items) : [],
    [state],
  );
  const filteredOrders = loadedOrders.filter(order =>
    viewFilter === "all" || customerOrderBucket(order.status) === viewFilter,
  );
  const filterCounts = {
    action: loadedOrders.filter(order => customerOrderBucket(order.status) === "action").length,
    progress: loadedOrders.filter(order => customerOrderBucket(order.status) === "progress").length,
    finished: loadedOrders.filter(order => customerOrderBucket(order.status) === "finished").length,
    all: loadedOrders.length,
  };
  const orderFilters: Array<{ value: CustomerOrderViewFilter; label: string }> = [
    { value: "action", label: "ต้องทำต่อ" },
    { value: "progress", label: "กำลังดำเนินการ" },
    { value: "finished", label: "เสร็จสิ้น" },
  ];

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap} data-empty-orders={state.status === "empty" ? "true" : undefined}>
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
              description="เริ่มเลือกสินค้า แล้วติดตามคำสั่งซื้อได้ที่นี่"
              actions={<Link href="/shops/">เลือกสินค้า</Link>}
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
                    onClick={retryInitialLoad}
                  >
                    ลองโหลดอีกครั้ง
                  </Button>
                  <Link href="/shops/">กลับหน้าร้าน</Link>
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
          <Link href="/shops/" className={styles.headerAction}>
            เลือกสินค้าเพิ่ม
          </Link>
        </header>

        <section className={styles.orderLedger} aria-label="รายการคำสั่งซื้อ">
          <div className={styles.customerFilterToolbar} role="group" aria-label="กรองคำสั่งซื้อที่โหลดแล้ว">
            <div className={styles.customerStatusFilterGroup}>
              <span className={styles.customerFilterLabel}>สถานะคำสั่งซื้อ</span>
              <div className={styles.customerOrderFilters}>
                {orderFilters.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={viewFilter === option.value}
                    className={styles.customerOrderFilter}
                    data-active={viewFilter === option.value || undefined}
                    onClick={() => setViewFilter(option.value)}
                  >
                    {option.label} <span data-numeric>{filterCounts[option.value]}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className={styles.customerOrderShowAll}
              data-active={viewFilter === "all" || undefined}
              aria-pressed={viewFilter === "all"}
              onClick={() => setViewFilter("all")}
            >
              ดูทั้งหมด <span data-numeric>{filterCounts.all}</span>
            </button>
            <label className={styles.customerMobileFilter}>
              สถานะคำสั่งซื้อ
              <select
                aria-label="เลือกสถานะคำสั่งซื้อ"
                value={viewFilter}
                onChange={event => setViewFilter(event.target.value as CustomerOrderViewFilter)}
              >
                {orderFilters.map(option => (
                  <option value={option.value} key={option.value}>{option.label} ({filterCounts[option.value]})</option>
                ))}
                <option value="all">ดูทั้งหมด ({filterCounts.all})</option>
              </select>
            </label>
          </div>
          <div className={styles.ledgerHeading}>
            <div>
              <h2>ติดตามสถานะและขั้นตอนถัดไป</h2>
            </div>
            <span className={styles.ledgerHint}>
              ยอดและสถานะแสดงจากข้อมูลล่าสุดที่โหลดจากระบบ
            </span>
          </div>

          <div className={styles.orderRows}>
            {filteredOrders.map((order) => {
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
                      <p className={styles.orderNextStep}>{guidance.title}</p>
                      <span className={styles.orderId} data-technical title={order.orderId}>
                        อ้างอิง {order.orderId.slice(0, 8)}
                      </span>
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

                  <div className={styles.orderRowActions}>
                    {needsAction ? (
                      <Link
                        href={guidance.action === "PAYMENT" ? myPaymentHref(order.orderId) : myPickupHref(order.orderId)}
                        className={styles.detailLinkPrimary}
                        aria-label={guidance.action === "PAYMENT" ? "ชำระเงิน คำสั่งซื้อ " + order.orderId : "เปิดข้อมูลรับสินค้า คำสั่งซื้อ " + order.orderId}
                      >
                        {guidance.action === "PAYMENT"
                          ? order.status === "PAYMENT_REJECTED" ? "ส่งหลักฐานใหม่" : "ไปชำระเงิน"
                          : "ข้อมูลรับสินค้า"}
                      </Link>
                    ) : null}
                    <Link
                      href={myOrderHref(order.orderId)}
                      className={`${styles.detailLink} ${styles.customerDetailLink}`}
                      aria-label={"ดูรายละเอียด คำสั่งซื้อ " + order.orderId}
                    ><span className={styles.customerDetailLabel}>ดูรายละเอียด</span> <AppIcon name="arrow-up-right" size={17} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
          {filteredOrders.length === 0 ? (
            <div className={styles.filteredEmpty} role="status">
              <EmptyIllustration compact />
              <p>ยังไม่มีคำสั่งซื้อในกลุ่มนี้จากรายการที่โหลดแล้ว</p>
              <button type="button" onClick={() => setViewFilter("all")}>ดูคำสั่งซื้อทั้งหมด</button>
            </div>
          ) : null}
        </section>

        {loadMoreError ? (
          <div ref={cursorErrorRef} tabIndex={-1} data-customer-orders-page-error className={styles.focusableQueueFeedback}>
            <Notice tone="danger" role="alert" title="โหลดรายการเพิ่มเติมไม่สำเร็จ">
              {loadMoreError}
            </Notice>
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
