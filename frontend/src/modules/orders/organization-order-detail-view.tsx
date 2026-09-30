"use client";

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
  getActiveMembership,
  isDefinitiveSessionFailure,
  useAuthSession,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { OrderDTO } from "@/types";
import { formatIsoDateTime, formatSatang } from "@/utils";

import {
  canOrganizationCancelOrder,
  organizationOrdersHref,
} from "./organization-order-helpers";
import styles from "./organization-orders.module.css";
import { orderService } from "./order-service";
import { OrderStatusBadge } from "./order-status";

type DetailState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; order: OrderDTO };

export function OrganizationOrderDetailView({
  organizationId,
  orderId,
}: {
  organizationId: string;
  orderId: string;
}) {
  const auth = useAuthSession();
  const [state, setState] = useState<DetailState>({
    status: "loading",
  });
  const [cancelPending, setCancelPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrder() {
      try {
        const order = await orderService.getOrganizationOrder(
          organizationId,
          orderId,
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          setState({ status: "success", order });
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
  }, [organizationId, orderId]);

  const membership =
    auth.status === "authenticated"
      ? getActiveMembership(auth.memberships, organizationId)
      : null;

  const canCancel =
    state.status === "success" &&
    canOrganizationCancelOrder(
      membership?.role,
      state.order.status,
    );

  async function handleCancel() {
    if (
      state.status !== "success" ||
      !canCancel ||
      cancelPending
    ) {
      return;
    }

    setCancelPending(true);
    setActionError(null);

    try {
      const cancelled =
        await orderService.cancelOrganizationOrder(
          organizationId,
          state.order.orderId,
        );

      setState({
        status: "success",
        order: cancelled,
      });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (
        error instanceof ApiClientError &&
        error.kind === "conflict"
      ) {
        setActionError(
          "สถานะ Order เปลี่ยนไปแล้วหรือไม่อยู่ในสถานะที่ยกเลิกได้ ระบบกำลังแสดงข้อมูลล่าสุดจาก Backend",
        );

        try {
          const refreshed =
            await orderService.getOrganizationOrder(
              organizationId,
              state.order.orderId,
            );
          setState({
            status: "success",
            order: refreshed,
          });
        } catch {
          // Preserve the last known Order and the original conflict message.
        }
      } else {
        setActionError(
          error instanceof ApiClientError
            ? error.userMessage
            : "ไม่สามารถยกเลิก Order ได้ กรุณาลองใหม่อีกครั้ง",
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
            <LoadingState title="กำลังโหลดรายละเอียด Order" />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบ Order"
              description="Order นี้ไม่มีอยู่ในหน่วยงาน หรือไม่สามารถเข้าถึงได้"
              actions={
                <a href={organizationOrdersHref(organizationId)}>
                  กลับรายการ Order
                </a>
              }
            />
          ) : null}
          {state.status === "unauthorized" ? (
            <UnauthorizedState />
          ) : null}
          {state.status === "forbidden" ? (
            <ForbiddenState />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลด Order ได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={
                <a href={organizationOrdersHref(organizationId)}>
                  กลับรายการ Order
                </a>
              }
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { order } = state;
  const isAdmin =
    membership?.role === "ORGANIZATION_ADMIN";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <a
          href={organizationOrdersHref(organizationId)}
          className={styles.backLink}
        >
          กลับรายการ Order
        </a>

        <section className={styles.detailHero}>
          <div className={styles.detailTop}>
            <div className={styles.detailTitleGroup} data-ledger-heading>
              <span className={styles.eyebrow}>
                Organization order
              </span>
              <h1 className={styles.title}>
                รายละเอียดคำสั่งซื้อ
              </h1>
              <span className={styles.orderCode}>
                {order.orderId}
              </span>
            </div>

            <OrderStatusBadge status={order.status} />
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>
                Customer ID
              </span>
              <span className={styles.summaryValue}>
                {order.customerId}
              </span>
            </div>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>
                Campaign ID
              </span>
              <span className={styles.summaryValue}>
                {order.campaignId}
              </span>
            </div>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>สร้างเมื่อ</span>
              <span className={styles.summaryValue}>
                {formatIsoDateTime(order.createdAt)}
              </span>
            </div>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>
                อัปเดตล่าสุด
              </span>
              <span className={styles.summaryValue}>
                {formatIsoDateTime(order.updatedAt)}
              </span>
            </div>
          </div>
        </section>

        <section
          className={styles.itemsPanel}
          aria-labelledby="organization-order-items"
        >
          <h2
            className={styles.sectionTitle}
            id="organization-order-items"
          >
            รายการสินค้า
          </h2>

          <div className={styles.itemList}>
            {order.items.map((item) => (
              <article
                className={styles.itemCard}
                key={item.orderItemId}
              >
                <div>
                  <div className={styles.itemName}>
                    {item.productName}
                  </div>
                  <div className={styles.itemVariant}>
                    {item.variantName}
                  </div>
                  <div className={styles.itemMeta}>
                    {formatSatang(item.unitPrice)} ×{" "}
                    {item.quantity}
                  </div>
                </div>
                <div className={styles.itemTotal}>
                  {formatSatang(item.totalPrice)}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className={styles.totalPanel}
          aria-label="สรุปยอดคำสั่งซื้อ"
        >
          <div className={styles.totalRow}>
            <span className={styles.summaryLabel}>
              ยอดสินค้า
            </span>
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
          <div className={styles.inlineError} role="alert">
            {actionError}
          </div>
        ) : null}

        {isAdmin && !canCancel ? (
          <div className={styles.adminNote}>
            Organization Admin สามารถยกเลิก Order ได้เฉพาะสถานะ
            PENDING_PAYMENT หรือ PAYMENT_REJECTED ตาม Backend contract
          </div>
        ) : null}

        <div className={styles.actionBar}>
          {canCancel ? (
            <ConfirmDialog
              trigger={
                <Button variant="danger">
                  ยกเลิก Order
                </Button>
              }
              title="ยืนยันการยกเลิก Order"
              description="Order จะเปลี่ยนเป็น CANCELLED เมื่อ Backend ยืนยัน และ action นี้มีให้เฉพาะ Organization Admin"
              confirmLabel="ยืนยันยกเลิก Order"
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
