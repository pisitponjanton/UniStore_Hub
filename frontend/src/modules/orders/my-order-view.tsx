"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ActionBar,
  Button,
  ConfirmDialog,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
  TaskStatus,
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
      </Link>
    ) : guidance.action === "PICKUP" ? (
      <Link
        href={myPickupHref(order.orderId)}
        className={styles.primaryActionLink}
      >
        เปิดข้อมูลรับสินค้า
      </Link>
    ) : undefined;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href="/my/orders/" className={styles.backLink}>
          กลับรายการคำสั่งซื้อ
        </Link>

        <header className={styles.detailHeading} data-ledger-heading>
          <div>
            <h1 className={styles.title}>รายละเอียดคำสั่งซื้อ</h1>
            <p className={styles.orderCode}>{order.orderId}</p>
          </div>
          <div className={styles.detailAmount}>
            <span className={styles.summaryLabel}>ยอดรวม</span>
            <strong className={styles.totalValue}>
              {formatSatang(order.total)}
            </strong>
          </div>
        </header>

        <TaskStatus
          tone={getOrderStatusTone(order.status)}
          label={<OrderStatusBadge status={order.status} />}
          title={guidance.title}
          description={guidance.description}
          metadata={
            <span>
              อัปเดตล่าสุด {formatIsoDateTime(order.updatedAt)}
            </span>
          }
          actions={primaryAction}
        />

        {journey.length > 0 ? (
          <section className={styles.journeySection} aria-labelledby="order-journey">
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle} id="order-journey">
                ขั้นตอนคำสั่งซื้อ
              </h2>
              <span className={styles.sectionMeta}>
                สถานะจะอัปเดตตามการชำระเงิน การผลิต และการรับสินค้า
              </span>
            </div>

            <ol className={styles.journeyList}>
              {journey.map((step) => (
                <li
                  className={styles.journeyStep}
                  data-state={step.state}
                  key={step.key}
                >
                  <span className={styles.journeyMarker} aria-hidden="true" />
                  <div>
                    <strong>{step.label}</strong>
                    <span className={styles.journeyStateLabel}>
                      {step.state === "done"
                        ? "เสร็จแล้ว"
                        : step.state === "current"
                          ? "ขั้นตอนปัจจุบัน"
                          : "ถัดไป"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className={styles.orderFacts} aria-label="ข้อมูลคำสั่งซื้อ">
          <div>
            <span className={styles.summaryLabel}>สร้างเมื่อ</span>
            <span className={styles.summaryValue}>
              {formatIsoDateTime(order.createdAt)}
            </span>
          </div>
          <div>
            <span className={styles.summaryLabel}>จำนวนรายการ</span>
            <span className={styles.summaryValue}>{order.items.length}</span>
          </div>
          <div>
            <span className={styles.summaryLabel}>สถานะปัจจุบัน</span>
            <span className={styles.summaryValue}>{guidance.title}</span>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="order-items">
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle} id="order-items">
              รายการสินค้า
            </h2>
            <span className={styles.sectionMeta}>
              ราคาในรายการเป็นราคาที่บันทึกไว้ตอนสร้างคำสั่งซื้อ
            </span>
          </div>

          <div className={styles.itemList}>
            {order.items.map((item) => (
              <article className={styles.itemRow} key={item.orderItemId}>
                <div className={styles.itemPrimary}>
                  <div className={styles.itemName}>{item.productName}</div>
                  <div className={styles.itemVariant}>{item.variantName}</div>
                </div>
                <div className={styles.itemQuantity}>
                  <span className={styles.summaryLabel}>จำนวน</span>
                  <strong>{item.quantity}</strong>
                </div>
                <div className={styles.itemPrice}>
                  <span className={styles.summaryLabel}>ราคา/ชิ้น</span>
                  <span>{formatSatang(item.unitPrice)}</span>
                </div>
                <div className={styles.itemTotal}>
                  <span className={styles.summaryLabel}>รวม</span>
                  <strong>{formatSatang(item.totalPrice)}</strong>
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
          <div className={styles.totalRowPrimary}>
            <strong>ยอดรวม</strong>
            <span className={styles.totalValue}>
              {formatSatang(order.total)}
            </span>
          </div>
        </section>

        {actionError ? (
          <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
            {actionError}
          </Notice>
        ) : null}

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
                trigger={<Button variant="danger">ยกเลิกคำสั่งซื้อ</Button>}
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
        </ActionBar>
      </main>
    </div>
  );
}
