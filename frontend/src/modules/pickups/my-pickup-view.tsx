"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Badge,
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  TaskStatus,
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
  getPickupPresentation,
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
  const [loadAttempt, setLoadAttempt] = useState(0);
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
  }, [loadAttempt]);

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

          <header className={styles.header} data-pickup-status="not-ready">
            <div className={styles.headerCopy}>
              <h1 className={styles.title}>ยังไม่ต้องเดินทางไปรับสินค้า</h1>
              <p className={styles.description}>
                ระบบจะแสดงบัตรรับสินค้าเมื่อคำสั่งซื้อเข้าสู่สถานะพร้อมรับสินค้า
              </p>
            </div>
          </header>

          <TaskStatus
            tone="info"
            label={<OrderStatusBadge status={state.order.status} />}
            title="คำสั่งซื้อนี้ยังไม่พร้อมรับสินค้า"
            description="ยังไม่ต้องเดินทางไปรับสินค้า ระบบจะแสดง QR และ Token เมื่อสถานะคำสั่งซื้อเปลี่ยนเป็นพร้อมรับสินค้า"
            actions={
              <Button
                variant="secondary"
                onClick={() => {
                  setState({ status: "loading" });
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                ตรวจสอบสถานะล่าสุด
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังโหลดข้อมูลรับสินค้า"
              description="กำลังตรวจสอบสถานะคำสั่งซื้อและข้อมูลรับสินค้าล่าสุด"
            />
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
              description="ลองดึงสถานะคำสั่งซื้อและข้อมูลรับสินค้าล่าสุดอีกครั้ง หรือกลับไปดูรายการคำสั่งซื้อ"
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

  const { order, pickup } = state;
  const received = pickup.status === "RECEIVED";
  const presentation = getPickupPresentation(pickup.status);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href={myOrderHref(order.orderId)} className={styles.backLink}>
          กลับรายละเอียดคำสั่งซื้อ
        </Link>

        <header className={styles.header} data-pickup-status={pickup.status}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>ข้อมูลรับสินค้า</h1>
            <p className={styles.description}>
              เปิดหน้านี้เมื่อถึงจุดรับสินค้า แล้วแสดง QR หรือ Pickup Token ให้เจ้าหน้าที่
            </p>
          </div>
          <Badge tone={received ? "neutral" : "success"}>
            {getPickupStatusLabel(pickup.status)}
          </Badge>
        </header>
        <TaskStatus
          tone={presentation.tone}
          label={<OrderStatusBadge status={order.status} />}
          title={presentation.title}
          description={presentation.description}
          metadata={
            <span className={styles.orderCode}>คำสั่งซื้อ {order.orderId}</span>
          }
        />

        <section
          className={[
            styles.pickupCredential,
            received ? styles.pickupCredentialReceived : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-labelledby="pickup-credential-title"
        >
          <div className={styles.credentialHeading}>
            <div>
              <h2 className={styles.sectionTitle} id="pickup-credential-title">
                {received
                  ? "QR และ Pickup Token ที่ใช้แล้ว"
                  : "QR และ Pickup Token สำหรับแสดงให้เจ้าหน้าที่"}
              </h2>
            </div>
            {!received ? (
              <span className={styles.credentialHint}>
                ใช้เพียงอย่างใดอย่างหนึ่ง
              </span>
            ) : null}
          </div>

          <div className={styles.qrTokenGrid}>
            <div
              className={styles.qrColumn}
              aria-busy={!qrDataUrl && !qrError}
            >
              <span className={styles.metaLabel}>QR สำหรับรับสินค้า</span>
              {qrDataUrl ? (
                // QR is generated locally from the pickup token only.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.qrImage}
                  src={qrDataUrl}
                  alt="QR สำหรับรับสินค้า"
                  decoding="async"
                />
              ) : (
                <div
                  className={styles.qrLoading}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {qrError
                    ? "สร้าง QR ไม่สำเร็จ ใช้ Token ด้านข้างแทนได้"
                    : "กำลังสร้าง QR"}
                </div>
              )}
            </div>

            <div className={styles.tokenColumn}>
              <span className={styles.metaLabel}>Pickup Token</span>
              <code className={styles.token}>{pickup.token}</code>
              <p className={styles.tokenInstruction}>
                หากสแกน QR ไม่ได้ ให้เจ้าหน้าที่กรอก Token นี้แทน
              </p>
              <p className={styles.securityNote}>
                QR เข้ารหัสเฉพาะ Pickup Token เท่านั้น และ Token ไม่ใช่สิทธิ์ของเจ้าหน้าที่ในการยืนยันการรับสินค้า
              </p>
            </div>
          </div>
        </section>

        <dl className={styles.pickupFacts} aria-label="ข้อมูลการรับสินค้า">
          <div>
            <dt className={styles.metaLabel}>สถานะ</dt>
            <dd className={styles.metaValue}>
              {getPickupStatusLabel(pickup.status)}
            </dd>
          </div>
          <div>
            <dt className={styles.metaLabel}>สร้างเมื่อ</dt>
            <dd className={styles.metaValue}>
              <time dateTime={pickup.createdAt}>
                {formatIsoDateTime(pickup.createdAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt className={styles.metaLabel}>
              {received ? "รับสินค้าเมื่อ" : "อัปเดตล่าสุด"}
            </dt>
            <dd className={styles.metaValue}>
              <time dateTime={received && pickup.receivedAt ? pickup.receivedAt : pickup.updatedAt}>
                {received && pickup.receivedAt
                  ? formatIsoDateTime(pickup.receivedAt)
                  : formatIsoDateTime(pickup.updatedAt)}
              </time>
            </dd>
          </div>
        </dl>

        {received ? (
          <div className={styles.receivedNote} role="status">
            รายการนี้รับสินค้าเรียบร้อยแล้ว QR และ Token ด้านบนแสดงไว้เพื่ออ้างอิงเท่านั้น
          </div>
        ) : null}
      </main>
    </div>
  );
}
