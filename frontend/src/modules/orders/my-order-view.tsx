"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Button,
  ConfirmDialog,
  ErrorState,
  ForbiddenState,
  LoadingState,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { myPaymentHref } from "@/modules/payments/payment-helpers";
import { myPickupHref } from "@/modules/pickups/pickup-helpers";
import { ApiClientError } from "@/services";
import type { OrderDTO } from "@/types";
import {
  formatIsoDateTime,
  formatSatang,
  getRequiredQueryId,
} from "@/utils";

import styles from "./order-tracking.module.css";
import { orderService } from "./order-service";
import { canCustomerCancelOrder } from "./order-tracking-helpers";
import { OrderStatusBadge } from "./order-status";

type OrderDetailState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; order: OrderDTO };

export function MyOrderView() {
  const [state, setState] = useState<OrderDetailState>({
    status: "loading",
  });
  const [cancelPending, setCancelPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrder() {
      const params = new URLSearchParams(window.location.search);
      const orderId = getRequiredQueryId(params, "orderId");

      if (!orderId.ok) {
        await Promise.resolve();

        if (!controller.signal.aborted) {
          setState({ status: "invalid" });
        }
        return;
      }

      try {
        const order = await orderService.getMyOrder(orderId.value, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setState({ status: "success", order });
        }
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

          if (error.kind === "notFound") {
            setState({ status: "notFound" });
            return;
          }
        }

        setState({ status: "error" });
      }
    }

    void loadOrder();

    return () => controller.abort();
  }, []);

  async function handleCancel() {
    if (
      state.status !== "success" ||
      !canCustomerCancelOrder(state.order.status) ||
      cancelPending
    ) {
      return;
    }

    setCancelPending(true);
    setActionError(null);

    try {
      await orderService.cancelMyOrder(state.order.orderId);
      const refreshed = await orderService.getMyOrder(state.order.orderId);
      setState({ status: "success", order: refreshed });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (error instanceof ApiClientError && error.kind === "conflict") {
        setActionError(
          "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว จึงไม่สามารถยกเลิกจากสถานะปัจจุบันได้",
        );

        try {
          const refreshed = await orderService.getMyOrder(state.order.orderId);
          setState({ status: "success", order: refreshed });
        } catch {
          // Keep the last known order visible; Backend remains authoritative.
        }
      } else {
        setActionError(
          error instanceof ApiClientError
            ? error.userMessage
            : "ไม่สามารถยกเลิกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง",
        );
      }
    } finally {
      setCancelPending(false);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดรายละเอียดคำสั่งซื้อ" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์คำสั่งซื้อไม่สมบูรณ์"
              description="ลิงก์นี้ต้องมี orderId ที่ถูกต้อง"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบคำสั่งซื้อ"
              description="คำสั่งซื้อนี้ไม่มีอยู่หรือไม่ใช่คำสั่งซื้อของบัญชีนี้"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
          {state.status === "unauthorized" ? <UnauthorizedState /> : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดคำสั่งซื้อได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { order } = state;
  const cancellable = canCustomerCancelOrder(order.status);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href="/my/orders/" className={styles.backLink}>
          กลับรายการคำสั่งซื้อ
        </Link>

        <section className={styles.detailHero}>
          <div className={styles.detailTop}>
            <div className={styles.detailTitleGroup} data-ledger-heading>
              <span className={styles.eyebrow}>Order detail</span>
              <h1 className={styles.title}>รายละเอียดคำสั่งซื้อ</h1>
              <span className={styles.orderCode}>{order.orderId}</span>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>ยอดรวม</span>
              <span className={styles.summaryValue}>
                {formatSatang(order.total)}
              </span>
            </div>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>สร้างเมื่อ</span>
              <span className={styles.summaryValue}>
                {formatIsoDateTime(order.createdAt)}
              </span>
            </div>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>อัปเดตล่าสุด</span>
              <span className={styles.summaryValue}>
                {formatIsoDateTime(order.updatedAt)}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="order-items">
          <h2 className={styles.sectionTitle} id="order-items">
            รายการสินค้า
          </h2>

          <div className={styles.itemList}>
            {order.items.map((item) => (
              <article className={styles.itemCard} key={item.orderItemId}>
                <div>
                  <div className={styles.itemName}>{item.productName}</div>
                  <div className={styles.itemVariant}>{item.variantName}</div>
                  <div className={styles.itemMeta}>
                    {formatSatang(item.unitPrice)} × {item.quantity}
                  </div>
                </div>
                <div className={styles.itemTotal}>
                  {formatSatang(item.totalPrice)}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.totalPanel} aria-label="สรุปยอดคำสั่งซื้อ">
          <div className={styles.totalRow}>
            <span className={styles.summaryLabel}>ยอดสินค้า</span>
            <span className={styles.summaryValue}>
              {formatSatang(order.subtotal)}
            </span>
          </div>
          <div className={styles.totalRow}>
            <strong>ยอดรวมที่ Backend ยืนยัน</strong>
            <span className={styles.totalValue}>
              {formatSatang(order.total)}
            </span>
          </div>
        </section>

        {actionError ? (
          <div className={styles.serverError} role="alert">
            {actionError}
          </div>
        ) : null}

        <div className={styles.actionBar}>
          {order.status !== "CANCELLED" ? (
            <Link href={myPaymentHref(order.orderId)}>
              <Button variant="secondary">ดูการชำระเงิน</Button>
            </Link>
          ) : null}
          {order.status === "READY_FOR_PICKUP" ||
          order.status === "RECEIVED" ? (
            <Link href={myPickupHref(order.orderId)}>
              <Button variant="secondary">ดูข้อมูลรับสินค้า</Button>
            </Link>
          ) : null}
          {cancellable ? (
            <ConfirmDialog
              trigger={
                <Button variant="danger">
                  ยกเลิกคำสั่งซื้อ
                </Button>
              }
              title="ยืนยันการยกเลิกคำสั่งซื้อ"
              description="คำสั่งซื้อจะถูกเปลี่ยนเป็นสถานะ CANCELLED เมื่อ Backend ยืนยันการดำเนินการ"
              confirmLabel="ยืนยันยกเลิก"
              cancelLabel="กลับ"
              pending={cancelPending}
              danger
              onConfirm={handleCancel}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
