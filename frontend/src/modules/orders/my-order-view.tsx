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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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
              description="ลองดึงสถานะล่าสุดของคำสั่งซื้อนี้อีกครั้ง หรือกลับไปดูรายการทั้งหมด"
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

        <header className={styles.detailHero} data-order-status={order.status}>
          <div className={styles.detailHeroCopy}>
            <h1 className={styles.title}>รายละเอียดคำสั่งซื้อ</h1>
            <span className={styles.orderCode} data-technical>
              {order.orderId}
            </span>
          </div>

          <div className={styles.detailAmount}>
            <span className={styles.summaryLabel}>ยอดรวมที่บันทึก</span>
            <strong className={styles.totalValue} data-numeric>
              {formatSatang(order.total)}
            </strong>
            <time className={styles.detailUpdated} dateTime={order.updatedAt}>
              อัปเดตล่าสุด {formatIsoDateTime(order.updatedAt)}
            </time>
          </div>
        </header>

        <section className={styles.currentState} aria-label="สถานะและขั้นตอนถัดไป">
          <TaskStatus
            tone={getOrderStatusTone(order.status)}
            label={<OrderStatusBadge status={order.status} />}
            title={guidance.title}
            description={guidance.description}
            metadata={
              <span>
                สถานะนี้มาจากข้อมูลล่าสุดของคำสั่งซื้อ
              </span>
            }
            actions={primaryAction}
          />
        </section>

        {order.status === "CANCELLED" ? (
          <Notice tone="warning" title="คำสั่งซื้อนี้สิ้นสุดแล้ว">
            รายการถูกยกเลิกและไม่มีขั้นตอนการชำระเงิน การผลิต หรือการรับสินค้าต่อ
          </Notice>
        ) : null}

        {journey.length > 0 ? (
          <section
            className={styles.journeySection}
            aria-labelledby="order-journey"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2 className={styles.sectionTitle} id="order-journey">
                  ขั้นตอนคำสั่งซื้อ
                </h2>
              </div>
              <span className={styles.sectionMeta}>
                สถานะจะเปลี่ยนตามการชำระเงิน การยืนยัน การผลิต และการรับสินค้า
              </span>
            </div>

            <ol className={styles.journeyList} aria-label="ขั้นตอนคำสั่งซื้อ">
              {journey.map((step, index) => (
                <li
                  className={styles.journeyStep}
                  data-state={step.state}
                  key={step.key}
                  aria-current={step.state === "current" ? "step" : undefined}
                >
                  <div className={styles.journeyIndex} aria-hidden="true">
                    {index + 1}
                  </div>
                  <div className={styles.journeyCopy}>
                    <strong>{step.label}</strong>
                    <span className={styles.journeyStateLabel}>
                      {step.state === "done"
                        ? "เสร็จแล้ว"
                        : step.state === "current"
                          ? "ขั้นตอนปัจจุบัน"
                          : "ขั้นตอนถัดไป"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className={styles.orderContext} aria-label="ข้อมูลคำสั่งซื้อ">
          <div className={styles.contextLead}>
            <h2 className={styles.sectionTitle}>ข้อมูลของรายการนี้</h2>
          </div>
          <dl className={styles.orderFacts}>
            <div>
              <dt>สร้างเมื่อ</dt>
              <dd>
                <time dateTime={order.createdAt}>
                  {formatIsoDateTime(order.createdAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>จำนวนรายการสินค้า</dt>
              <dd data-numeric>{order.items.length} รายการ</dd>
            </div>
            <div>
              <dt>สถานะปัจจุบัน</dt>
              <dd>{guidance.title}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="order-items">
          <div className={styles.sectionHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="order-items">
                สินค้าในคำสั่งซื้อ
              </h2>
            </div>
            <span className={styles.sectionMeta}>
              ราคาในรายการเป็นราคาที่บันทึกไว้ตอนสร้างคำสั่งซื้อ
            </span>
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

        <section className={styles.totalPanel} aria-label="สรุปยอดคำสั่งซื้อ">
          <div>
            <span className={styles.summaryLabel}>ยอดสินค้า</span>
            <span className={styles.summaryValue} data-numeric>
              {formatSatang(order.subtotal)}
            </span>
          </div>
          <div className={styles.totalRowPrimary}>
            <strong>ยอดรวม</strong>
            <span className={styles.totalValue} data-numeric>
              {formatSatang(order.total)}
            </span>
          </div>
        </section>

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

        <section className={styles.orderTools} aria-labelledby="order-tools">
          <div className={styles.orderToolsHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="order-tools">
                ดูข้อมูลที่เกี่ยวข้อง
              </h2>
            </div>
            <p>
              ปุ่มด้านล่างเป็นทางลัดไปยังข้อมูลของคำสั่งซื้อนี้
              การยกเลิกจะปรากฏเฉพาะสถานะที่ระบบอนุญาต
            </p>
          </div>

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
        </section>
      </main>
    </div>
  );
}
