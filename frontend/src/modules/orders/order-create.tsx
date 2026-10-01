"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Button,
  ErrorState,
  LoadingState,
  Notice,
  TaskStatus,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { myPaymentHref } from "@/modules/payments/payment-helpers";
import {
  calculateEstimatedTotal,
  CampaignStatusBadge,
  parseQuantityInput,
  productHref,
  StorefrontHeader,
  storefrontService,
  type StorefrontProductView,
} from "@/modules/storefront";
import { ApiClientError } from "@/services";
import type { OrderDTO } from "@/types";
import {
  formatIsoDateTime,
  formatSatang,
  getRequiredQueryId,
} from "@/utils";

import styles from "./order-create.module.css";
import {
  buildCreateOrderRequest,
  resolveOrderEntrySelection,
  type OrderEntryContext,
} from "./order-create-helpers";
import { orderService } from "./order-service";
import {
  getCustomerOrderGuidance,
  myOrderHref,
} from "./order-tracking-helpers";
import {
  getOrderStatusTone,
  OrderStatusBadge,
} from "./order-status";

type OrderCreateState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "error" }
  | {
      status: "ready";
      data: StorefrontProductView;
      context: OrderEntryContext;
    }
  | {
      status: "success";
      order: OrderDTO;
      data: StorefrontProductView;
      context: OrderEntryContext;
    };

export function OrderCreateView() {
  const [state, setState] = useState<OrderCreateState>({
    status: "loading",
  });
  const [quantityInput, setQuantityInput] = useState("1");
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [campaignNotOpen, setCampaignNotOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrderContext() {
      const params = new URLSearchParams(window.location.search);
      const organizationId = getRequiredQueryId(params, "organizationId");
      const campaignId = getRequiredQueryId(params, "campaignId");
      const productId = getRequiredQueryId(params, "productId");
      const variantId = getRequiredQueryId(params, "variantId");

      if (
        !organizationId.ok ||
        !campaignId.ok ||
        !productId.ok ||
        !variantId.ok
      ) {
        await Promise.resolve();

        if (!controller.signal.aborted) {
          setState({ status: "invalid" });
        }
        return;
      }

      const context: OrderEntryContext = {
        organizationId: organizationId.value,
        campaignId: campaignId.value,
        productId: productId.value,
        variantId: variantId.value,
      };

      try {
        const data = await storefrontService.getProductView(
          context.organizationId,
          context.productId,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) {
          return;
        }

        const selection = resolveOrderEntrySelection({
          product: data.product,
          campaigns: data.campaigns,
          context,
        });

        if (!selection.ok) {
          setState({
            status:
              selection.reason === "PRODUCT_MISMATCH"
                ? "invalid"
                : "notFound",
          });
          return;
        }

        setCampaignNotOpen(selection.campaign.status !== "OPEN");
        setState({ status: "ready", data, context });
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        setState({
          status:
            error instanceof ApiClientError && error.kind === "notFound"
              ? "notFound"
              : "error",
        });
      }
    }

    void loadOrderContext();

    return () => controller.abort();
  }, []);

  const orderContext = useMemo(() => {
    if (state.status !== "ready" && state.status !== "success") {
      return null;
    }

    const selection = resolveOrderEntrySelection({
      product: state.data.product,
      campaigns: state.data.campaigns,
      context: state.context,
    });

    if (!selection.ok) {
      return null;
    }

    const quantity = parseQuantityInput(quantityInput);
    const estimate = calculateEstimatedTotal(selection.variant, quantity);

    return {
      ...selection,
      quantity,
      estimate,
    };
  }, [quantityInput, state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      pending ||
      state.status !== "ready" ||
      !orderContext ||
      orderContext.quantity === null ||
      campaignNotOpen
    ) {
      return;
    }

    setPending(true);
    setServerError(null);

    const request = buildCreateOrderRequest({
      ...state.context,
      quantity: orderContext.quantity,
    });

    try {
      const order = await orderService.createOrder(
        state.context.organizationId,
        request,
      );

      setState({
        status: "success",
        order,
        data: state.data,
        context: state.context,
      });
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (
        error instanceof ApiClientError &&
        error.code === "CAMPAIGN_NOT_OPEN"
      ) {
        setCampaignNotOpen(true);
        setServerError(
          "รอบพรีออเดอร์นี้ปิดรับคำสั่งซื้อแล้ว กรุณากลับไปดูสินค้าหรือรอบอื่น",
        );
      } else {
        setServerError(
          error instanceof ApiClientError
            ? error.userMessage
            : "ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง",
        );
      }
    } finally {
      setPending(false);
    }
  }

  if (
    state.status === "loading" ||
    state.status === "invalid" ||
    state.status === "notFound" ||
    state.status === "error"
  ) {
    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState
              title="กำลังเตรียมคำสั่งซื้อ"
              description="กำลังตรวจสอบสินค้า ตัวเลือก และรอบพรีออเดอร์"
            />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์สร้างคำสั่งซื้อไม่สมบูรณ์"
              description="ไม่พบข้อมูลที่จำเป็นสำหรับสินค้า ตัวเลือก หรือรอบพรีออเดอร์"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบข้อมูลสำหรับสร้างคำสั่งซื้อ"
              description="สินค้า ตัวเลือกสินค้า หรือรอบพรีออเดอร์อาจไม่เปิดให้ใช้งานแล้ว"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
            />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถเตรียมคำสั่งซื้อได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { data, context } = state;
  const product = data.product;

  if (state.status === "success") {
    const guidance = getCustomerOrderGuidance(state.order.status);

    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.successMain}>
          <header className={styles.successHeading} data-ledger-heading>
            <h1 className={styles.successTitle}>
              สร้างคำสั่งซื้อเรียบร้อยแล้ว
            </h1>
            <p className={styles.description}>
              ยอดและรายการด้านล่างคือข้อมูลที่ระบบบันทึกไว้สำหรับคำสั่งซื้อนี้
            </p>
          </header>

          <TaskStatus
            tone={getOrderStatusTone(state.order.status)}
            label={<OrderStatusBadge status={state.order.status} />}
            title={guidance.title}
            description={guidance.description}
            metadata={
              <span>
                เลขคำสั่งซื้อ {state.order.orderId}
              </span>
            }
            actions={
              guidance.action === "PAYMENT" ? (
                <Link
                  href={myPaymentHref(state.order.orderId)}
                  className={styles.primaryLink}
                >
                  ไปชำระเงิน
                </Link>
              ) : undefined
            }
          />

          <section className={styles.successSummary} aria-label="สรุปคำสั่งซื้อ">
            <div>
              <span className={styles.summaryLabel}>ยอดรวม</span>
              <strong className={styles.authoritativeTotal}>
                {formatSatang(state.order.total)}
              </strong>
            </div>
            <div>
              <span className={styles.summaryLabel}>สร้างเมื่อ</span>
              <span className={styles.summaryValue}>
                {formatIsoDateTime(state.order.createdAt)}
              </span>
            </div>
            <div>
              <span className={styles.summaryLabel}>สินค้า</span>
              <span className={styles.summaryValue}>{product.name}</span>
            </div>
          </section>

          <div className={styles.successActions}>
            <Link
              href={myOrderHref(state.order.orderId)}
              className={styles.secondaryLink}
            >
              ดูรายละเอียดคำสั่งซื้อ
            </Link>
            <Link
              href={productHref({
                organizationId: context.organizationId,
                productId: context.productId,
                campaignId: context.campaignId,
              })}
              className={styles.quietLink}
            >
              กลับไปดูสินค้า
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const selection = orderContext;
  const quantityError =
    quantityInput.length > 0 && selection?.quantity === null
      ? "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป"
      : undefined;

  return (
    <div className={styles.page}>
      <StorefrontHeader />

      <main className={styles.main}>
        <Link
          href={productHref({
            organizationId: context.organizationId,
            productId: context.productId,
            campaignId: context.campaignId,
          })}
          className={styles.backLink}
        >
          กลับไปที่สินค้า
        </Link>

        <header className={styles.header} data-ledger-heading>
          <h1 className={styles.title}>ตรวจสอบคำสั่งซื้อ</h1>
          <p className={styles.description}>
            ตรวจสอบสินค้า ตัวเลือก จำนวน และยอดประมาณการก่อนยืนยันคำสั่งซื้อ
          </p>
        </header>

        <div className={styles.contentGrid}>
          <section className={styles.reviewPanel} aria-labelledby="order-summary">
            <div className={styles.productSummary}>
              <span className={styles.summaryLabel}>สินค้าที่เลือก</span>
              <h2 className={styles.summaryTitle} id="order-summary">
                {product.name}
              </h2>
              {selection ? (
                <span className={styles.variantName}>
                  {selection.variant.name}
                </span>
              ) : null}
            </div>

            {selection ? (
              <div className={styles.reviewRows}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>รอบพรีออเดอร์</span>
                  <div className={styles.summaryValueGroup}>
                    <span className={styles.summaryValue}>
                      {selection.campaign.name}
                    </span>
                    <CampaignStatusBadge status={selection.campaign.status} />
                  </div>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>ราคาต่อชิ้น</span>
                  <span className={styles.summaryValue}>
                    {formatSatang(selection.variant.price)}
                  </span>
                </div>
              </div>
            ) : null}
          </section>

          <form className={styles.confirmPanel} onSubmit={handleSubmit}>
            <div className={styles.confirmHeading}>
              <span className={styles.stepLabel}>ขั้นตอนสุดท้าย</span>
              <h2>ระบุจำนวนและยืนยัน</h2>
            </div>

            <TextField
              id="order-quantity"
              label="จำนวน"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={quantityInput}
              onChange={(event) => {
                setQuantityInput(event.target.value);
                setServerError(null);
              }}
              error={quantityError}
              hint="อย่างน้อย 1 ชิ้น"
              disabled={pending || campaignNotOpen}
              required
            />

            <div className={styles.estimate}>
              <span className={styles.summaryLabel}>ยอดประมาณการ</span>
              <strong className={styles.estimateValue}>
                {selection?.estimate !== null && selection?.estimate !== undefined
                  ? formatSatang(selection.estimate)
                  : "ยังไม่คำนวณ"}
              </strong>
              <p className={styles.note}>
                ระบบจะตรวจสอบสินค้าและคำนวณยอดจริงอีกครั้งเมื่อคุณยืนยัน
              </p>
            </div>

            {campaignNotOpen ? (
              <Notice tone="warning" title="รอบนี้ปิดรับคำสั่งซื้อแล้ว">
                ไม่สามารถสร้างคำสั่งซื้อใหม่จากรอบพรีออเดอร์นี้ได้
              </Notice>
            ) : null}

            {serverError ? (
              <Notice tone="danger" role="alert" title="สร้างคำสั่งซื้อไม่สำเร็จ">
                {serverError}
              </Notice>
            ) : null}

            <div className={styles.actions}>
              <Button
                type="submit"
                size="large"
                pending={pending}
                pendingLabel="กำลังสร้างคำสั่งซื้อ"
                disabled={
                  campaignNotOpen ||
                  !selection ||
                  selection.quantity === null
                }
              >
                ยืนยันสร้างคำสั่งซื้อ
              </Button>
              <span className={styles.submitHint}>
                หลังยืนยัน คุณจะเห็นยอดที่ระบบบันทึกและขั้นตอนถัดไป
              </span>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
