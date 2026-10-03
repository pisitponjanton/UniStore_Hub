"use client";

import { useEffect, useState } from "react";

import {
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
import {
  getOrderStatusLabel,
  OrderStatusBadge,
} from "./order-status";

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
          "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว หรือไม่อยู่ในสถานะที่ยกเลิกได้ จึงโหลดข้อมูลล่าสุดมาให้ตรวจสอบอีกครั้ง",
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
              description="กำลังดึงสถานะ รายการสินค้า และยอดล่าสุด"
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบคำสั่งซื้อ"
              description="คำสั่งซื้อนี้ไม่มีอยู่ในหน่วยงาน หรือไม่สามารถเข้าถึงได้"
              actions={
                <a href={organizationOrdersHref(organizationId)}>
                  กลับรายการคำสั่งซื้อ
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
              title="ไม่สามารถโหลดคำสั่งซื้อได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={
                <a href={organizationOrdersHref(organizationId)}>
                  กลับรายการคำสั่งซื้อ
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
          กลับรายการคำสั่งซื้อ
        </a>

        <section className={styles.detailHero}>
          <div className={styles.detailTop}>
            <div className={styles.detailTitleGroup} data-ledger-heading>
              <span className={styles.pageKicker}>คำสั่งซื้อในหน่วยงาน</span>
              <h1 className={styles.title}>รายละเอียดคำสั่งซื้อ</h1>
              <span className={styles.orderCode}>
                Order {order.orderId}
              </span>
            </div>

            <OrderStatusBadge status={order.status} />
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>สถานะปัจจุบัน</span>
              <span className={styles.summaryValue}>
                {getOrderStatusLabel(order.status)}
              </span>
            </div>
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
              <span className={styles.summaryLabel}>
                อัปเดตล่าสุด
              </span>
              <span className={styles.summaryValue}>
                {formatIsoDateTime(order.updatedAt)}
              </span>
            </div>
          </div>

          <div className={styles.metaRow}>
            <span className={styles.meta}>
              Customer: {order.customerId}
            </span>
            <span className={styles.meta}>
              Campaign: {order.campaignId}
            </span>
          </div>
        </section>

        {actionError ? (
          <Notice tone="danger" role="alert" title="ดำเนินการไม่สำเร็จ">
            {actionError}
          </Notice>
        ) : null}

        <section
          className={styles.itemsPanel}
          aria-labelledby="organization-order-items"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2
                className={styles.sectionTitle}
                id="organization-order-items"
              >
                รายการสินค้า
              </h2>
              <p className={styles.sectionDescription}>
                ราคาต่อชิ้นและยอดรายการเป็น snapshot ที่บันทึกไว้กับคำสั่งซื้อนี้
              </p>
            </div>
            <span className={styles.sectionMeta}>
              {order.items.length.toLocaleString("th-TH")} รายการ
            </span>
          </div>

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
            <strong>ยอดรวมที่ยืนยันแล้ว</strong>
            <span className={styles.totalValue}>
              {formatSatang(order.total)}
            </span>
          </div>
        </section>

        {isAdmin && !canCancel ? (
          <div className={styles.adminNote}>
            ผู้ดูแลหน่วยงานยกเลิกคำสั่งซื้อได้เฉพาะสถานะ “รอชำระเงิน” หรือ “การชำระเงินถูกปฏิเสธ” เท่านั้น
          </div>
        ) : null}

        <div className={styles.actionBar}>
          {canCancel ? (
            <ConfirmDialog
              trigger={
                <Button variant="danger">
                  ยกเลิกคำสั่งซื้อ
                </Button>
              }
              title="ยืนยันการยกเลิกคำสั่งซื้อ"
              description="การยกเลิกจะเปลี่ยนสถานะคำสั่งซื้อเป็นยกเลิกเมื่อระบบยืนยัน และทำได้เฉพาะผู้ดูแลหน่วยงานในสถานะที่รองรับ"
              confirmLabel="ยืนยันยกเลิกคำสั่งซื้อ"
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
