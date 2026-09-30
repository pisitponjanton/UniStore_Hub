"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Badge,
  ErrorState,
  ForbiddenState,
  LoadingState,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import {
  myOrderHref,
  OrderStatusBadge,
  orderService,
} from "@/modules/orders";
import { ApiClientError } from "@/services";
import type { OrderDTO, PickupDTO } from "@/types";
import { formatIsoDateTime, getRequiredQueryId } from "@/utils";

import {
  canViewCustomerPickup,
  getPickupStatusLabel,
} from "./pickup-helpers";
import { createPickupQrDataUrl } from "./pickup-qr";
import { pickupService } from "./pickup-service";
import styles from "./pickup-view.module.css";

type PickupViewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "notReady"; order: OrderDTO }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "success"; order: OrderDTO; pickup: PickupDTO };

export function MyPickupView() {
  const [state, setState] = useState<PickupViewState>({
    status: "loading",
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPickup() {
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

        if (!canViewCustomerPickup(order.status)) {
          if (!controller.signal.aborted) {
            setState({ status: "notReady", order });
          }
          return;
        }

        const pickup = await pickupService.getMyPickup(order.orderId, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setState({ status: "success", order, pickup });
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

          if (error.code === "ORDER_NOT_READY_FOR_PICKUP") {
            try {
              const order = await orderService.getMyOrder(orderId.value);

              setState({ status: "notReady", order });
            } catch {
              setState({ status: "error" });
            }
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

    void loadPickup();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    let active = true;

    void createPickupQrDataUrl(state.pickup.token)
      .then((dataUrl) => {
        if (active) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setQrError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [state]);

  if (state.status === "notReady") {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <Link
            href={myOrderHref(state.order.orderId)}
            className={styles.backLink}
          >
            กลับรายละเอียดคำสั่งซื้อ
          </Link>

          <header className={styles.header} data-ledger-heading>
            <span className={styles.eyebrow}>Pickup</span>
            <h1 className={styles.title}>รับสินค้า</h1>
          </header>

          <section className={styles.notReadyPanel}>
            <OrderStatusBadge status={state.order.status} />
            <strong>คำสั่งซื้อนี้ยังไม่พร้อมรับสินค้า</strong>
            <p className={styles.description}>
              ระบบจะแสดง Pickup token และ QR เมื่อ Backend
              เปลี่ยนคำสั่งซื้อเป็นสถานะ READY_FOR_PICKUP
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดข้อมูลรับสินค้า" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์รับสินค้าไม่สมบูรณ์"
              description="ลิงก์นี้ต้องมี orderId ที่ถูกต้อง"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบข้อมูลรับสินค้า"
              description="คำสั่งซื้อหรือข้อมูลรับสินค้านี้ไม่มีอยู่สำหรับบัญชีนี้"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
          {state.status === "unauthorized" ? <UnauthorizedState /> : null}
          {state.status === "forbidden" ? <ForbiddenState /> : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดข้อมูลรับสินค้าได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/my/orders/">กลับรายการคำสั่งซื้อ</Link>}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { order, pickup } = state;
  const received = pickup.status === "RECEIVED";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href={myOrderHref(order.orderId)} className={styles.backLink}>
          กลับรายละเอียดคำสั่งซื้อ
        </Link>

        <header className={styles.header} data-ledger-heading>
          <span className={styles.eyebrow}>Pickup</span>
          <h1 className={styles.title}>รับสินค้า</h1>
          <p className={styles.description}>
            แสดง QR หรือ Pickup token นี้ให้เจ้าหน้าที่เมื่อมารับสินค้า
          </p>
        </header>

        <section className={styles.panel}>
          <div className={styles.statusRow}>
            <div className={styles.meta}>
              <span className={styles.metaLabel}>เลขคำสั่งซื้อ</span>
              <span className={styles.metaValue}>{order.orderId}</span>
            </div>
            <Badge tone={received ? "neutral" : "success"}>
              {getPickupStatusLabel(pickup.status)}
            </Badge>
          </div>

          {received ? (
            <div className={styles.receivedPanel} role="status">
              รายการนี้รับสินค้าเรียบร้อยแล้ว
              {pickup.receivedAt
                ? ` เมื่อ ${formatIsoDateTime(pickup.receivedAt)}`
                : ""}
            </div>
          ) : null}

          <div className={styles.qrWrap}>
            {qrDataUrl ? (
              // QR is generated locally from the pickup token only.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.qrImage}
                src={qrDataUrl}
                alt="QR สำหรับรับสินค้า"
              />
            ) : (
              <div className={styles.qrLoading} aria-live="polite">
                {qrError ? "สร้าง QR ไม่สำเร็จ" : "กำลังสร้าง QR"}
              </div>
            )}

            <div className={styles.tokenBlock}>
              <span className={styles.metaLabel}>Pickup token</span>
              <code className={styles.token}>{pickup.token}</code>
              <span className={styles.note}>
                QR นี้เข้ารหัสเฉพาะ Pickup token เท่านั้น
                ไม่มีข้อมูลคำสั่งซื้อหรือข้อมูลส่วนตัวอื่น
              </span>
            </div>
          </div>

          <div className={styles.meta}>
            <span className={styles.metaLabel}>สถานะ Pickup</span>
            <span className={styles.metaValue}>{pickup.status}</span>
          </div>
        </section>
      </main>
    </div>
  );
}
