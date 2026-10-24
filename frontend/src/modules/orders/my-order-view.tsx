"use client";


import { PageLoadingRows, PageStateHeading } from "@/components/ui/async-page";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  ActionBar,
  Button,
  ConfirmDialog,
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
import {
  canCustomerCancelOrder,
  getCustomerOrderGuidance,
  getOrderJourneySteps,
} from "./order-tracking-helpers";
import {
  getOrderStatusTone,
  OrderStatusBadge,
} from "./order-status";

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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const cancelFeedbackRef = useRef<HTMLDivElement>(null);
  const focusAfterRetry = useRef(false);

  useEffect(() => {
    if ((!actionError && !actionSuccess) || cancelDialogOpen || cancelPending) return;
    // Focus after Radix releases the confirmation dialog's focus trap.
    const timeout = window.setTimeout(() => {
      cancelFeedbackRef.current?.focus({ preventScroll: true });
      cancelFeedbackRef.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [actionError, actionSuccess, cancelDialogOpen, cancelPending]);

  function retryLoad() {
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
  }, [loadAttempt]);

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
    setActionSuccess(null);

    try {
      await orderService.cancelMyOrder(state.order.orderId);
      const refreshed = await orderService.getMyOrder(state.order.orderId);
      setState({ status: "success", order: refreshed });
      setActionSuccess("ยกเลิกคำสั่งซื้อแล้ว");
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
      setCancelDialogOpen(false);
    }
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <PageStateHeading title="รายละเอียดคำสั่งซื้อ" description="ติดตามสถานะล่าสุดและขั้นตอนถัดไป" />
          {state.status === "loading" ? <PageLoadingRows /> : null}
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดรายละเอียดคำสั่งซื้อ"
              description="กำลังดึงสถานะและยอดล่าสุดของคำสั่งซื้อ"
            />
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
              description="ลองดึงสถานะล่าสุดของคำสั่งซื้อนี้อีกครั้ง หรือกลับไปดูรายการทั้งหมด"
              actions={
                <>
                  <Button
                    onClick={retryLoad}
                  >
                    ลองโหลดอีกครั้ง
                  </Button>
                  <Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>
                </>
              }
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { order } = state;
  const cancellable = canCustomerCancelOrder(order.status);
  const guidance = getCustomerOrderGuidance(order.status);
  const journey = getOrderJourneySteps(order.status);

  const primaryAction =
    guidance.action === "PAYMENT" ? (
      <Link
        href={myPaymentHref(order.orderId)}
        className={styles.primaryActionLink}
      >
        {order.status === "PAYMENT_REJECTED"
          ? "เปิดการชำระเงินและส่งใหม่"
          : "ไปชำระเงิน"}
        <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
      </Link>
    ) : guidance.action === "PICKUP" ? (
      <Link
        href={myPickupHref(order.orderId)}
        className={styles.primaryActionLink}
      >
        เปิดข้อมูลรับสินค้า
        <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
      </Link>
    ) : undefined;

  return (
    <div className={styles.page}>
      <main className={`${styles.main} ${styles.customerDetailPage}`}>
        <Link href="/my/orders/" className={styles.backLink}>
          กลับรายการคำสั่งซื้อ
        </Link>

        <header className={styles.detailHero} data-order-status={order.status}>
          <div className={styles.detailHeroCopy}>
            <h1 className={styles.title}>รายละเอียดคำสั่งซื้อ</h1>
            <span className={styles.orderCode} data-technical>#{order.orderId}</span>
            <div className={styles.detailHeaderMetadata}>
              <span>สั่งซื้อ <time dateTime={order.createdAt}>{formatIsoDateTime(order.createdAt)}</time></span>
              <span>อัปเดต <time dateTime={order.updatedAt}>{formatIsoDateTime(order.updatedAt)}</time></span>
            </div>
          </div>
          <div className={styles.detailAmount}>
            <span className={styles.summaryLabel}>ยอดรวมคำสั่งซื้อ</span>
            <strong className={styles.totalValue} data-numeric>{formatSatang(order.total)}</strong>
          </div>
        </header>

        <section className={styles.detailStatusBar} data-tone={getOrderStatusTone(order.status)} aria-label="สถานะและขั้นตอนถัดไป">
          <div className={styles.detailStatusContent}>
            <div className={styles.detailStatusHeading}>
              <OrderStatusBadge status={order.status} />
            </div>
            <p>{guidance.description}</p>
          </div>
        </section>

        {journey.length > 0 ? (
          <section className={styles.journeySection} aria-labelledby="order-journey">
            <h2 className={styles.sectionTitle} id="order-journey">ความคืบหน้าคำสั่งซื้อ</h2>
            <ol className={styles.journeyList} aria-label="ขั้นตอนคำสั่งซื้อ">
              {journey.map((step, index) => (
                <li
                  className={styles.journeyStep}
                  data-state={step.state}
                  key={step.key}
                  aria-current={step.state === "current" ? "step" : undefined}
                >
                  <div className={styles.journeyIndex} aria-hidden="true">{index + 1}</div>
                  <div className={styles.journeyCopy}>
                    <strong>{step.label}</strong>
                    <span className={styles.journeyStateLabel}>
                      {step.state === "done" ? "เสร็จแล้ว" : step.state === "current" ? "ขั้นตอนปัจจุบัน" : "ขั้นตอนถัดไป"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="order-items">
          <div className={styles.sectionHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="order-items">
                สินค้าในคำสั่งซื้อ
              </h2>
            </div>
            <span className={styles.detailItemCount}>{order.items.length} รายการ</span>
          </div>

          <div className={styles.itemList}>
            <div className={styles.itemListHeader} aria-hidden="true">
              <span>สินค้า</span>
              <span>จำนวน</span>
              <span>ราคา/ชิ้น</span>
              <span>รวม</span>
            </div>
            {order.items.map((item) => (
              <article className={styles.itemRow} key={item.orderItemId}>
                <div className={styles.itemPrimary}>
                  <div className={styles.itemName}>{item.productName}</div>
                  <div className={styles.itemVariant}>{item.variantName}</div>
                </div>
                <div className={styles.itemQuantity}>
                  <span className={styles.mobileItemLabel}>จำนวน</span>
                  <strong data-numeric>{item.quantity}</strong>
                </div>
                <div className={styles.itemPrice}>
                  <span className={styles.mobileItemLabel}>ราคา/ชิ้น</span>
                  <span data-numeric>{formatSatang(item.unitPrice)}</span>
                </div>
                <div className={styles.itemTotal}>
                  <span className={styles.mobileItemLabel}>รวม</span>
                  <strong data-numeric>{formatSatang(item.totalPrice)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        {order.subtotal !== order.total ? (
          <p className={styles.detailSubtotal} aria-label="ยอดสินค้าก่อนปรับยอด">
            ยอดสินค้า <strong data-numeric>{formatSatang(order.subtotal)}</strong>
          </p>
        ) : null}

        {actionError || actionSuccess ? (
          <div ref={cancelFeedbackRef} tabIndex={-1} data-customer-order-action-feedback className={styles.focusableOrderFeedback}>
            {actionSuccess ? (
              <Notice tone="success" role="status" title="อัปเดตคำสั่งซื้อแล้ว">
                {actionSuccess}
              </Notice>
            ) : null}
            {actionError ? (
              <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
                {actionError}
              </Notice>
            ) : null}
          </div>
        ) : null}

        {(primaryAction || cancellable || order.status !== "CANCELLED") ? (
        <section className={styles.orderTools} aria-label="การดำเนินการคำสั่งซื้อ">
          <ActionBar className={styles.orderActions}>
            {guidance.action !== "PAYMENT" && order.status !== "CANCELLED" ? (
              <Link
                href={myPaymentHref(order.orderId)}
                className={styles.secondaryActionLink}
              >
                ดูการชำระเงิน
              </Link>
            ) : null}

            {guidance.action !== "PICKUP" &&
            (order.status === "READY_FOR_PICKUP" ||
              order.status === "RECEIVED") ? (
              <Link
                href={myPickupHref(order.orderId)}
                className={styles.secondaryActionLink}
              >
                ดูข้อมูลรับสินค้า
              </Link>
            ) : null}

            {cancellable ? (
              <div className={styles.destructiveAction}>
                <ConfirmDialog
                  open={cancelDialogOpen}
                  onOpenChange={(open) => {
                    if (cancelPending) return;
                    if (open) {
                      setActionError(null);
                      setActionSuccess(null);
                    }
                    setCancelDialogOpen(open);
                  }}
                  onCloseAutoFocus={(event) => {
                    if (actionError || actionSuccess) event.preventDefault();
                  }}
                  trigger={<Button variant="quiet" className={styles.cancelTextAction}>ยกเลิกคำสั่งซื้อ</Button>}
                  title="ยืนยันการยกเลิกคำสั่งซื้อ"
                  description="ยกเลิกได้เฉพาะก่อนการชำระเงินได้รับอนุมัติ เมื่อยืนยันแล้วคำสั่งซื้อจะเปลี่ยนเป็นสถานะยกเลิก"
                  confirmLabel="ยืนยันยกเลิก"
                  cancelLabel="กลับ"
                  pending={cancelPending}
                  danger
                  onConfirm={handleCancel}
                />
              </div>
            ) : null}
            {primaryAction}
          </ActionBar>
        </section>
        ) : null}
      </main>
    </div>
  );
}
