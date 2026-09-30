"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  TextField,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import {
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
import { calculateEstimatedTotal, parseQuantityInput } from "@/modules/storefront";

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
          "แคมเปญนี้ไม่ได้อยู่ในสถานะ OPEN แล้ว กรุณากลับไปตรวจสอบแคมเปญก่อนสร้างคำสั่งซื้อใหม่",
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
            <LoadingState title="กำลังเตรียมคำสั่งซื้อ" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์สร้างคำสั่งซื้อไม่สมบูรณ์"
              description="ลิงก์นี้ต้องมี organizationId, campaignId, productId และ variantId ที่ถูกต้อง"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบข้อมูลสำหรับสร้างคำสั่งซื้อ"
              description="สินค้า ตัวเลือกสินค้า หรือแคมเปญอาจไม่เปิดให้ใช้งานแล้ว"
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
    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.main}>
          <section className={styles.successPanel}>
            <div className={styles.successHeading}>
              <span className={styles.eyebrow}>Order created</span>
              <h1 className={styles.successTitle}>
                สร้างคำสั่งซื้อเรียบร้อยแล้ว
              </h1>
              <p className={styles.description}>
                ระบบใช้ราคาและยอดรวมที่ Backend คำนวณเป็นข้อมูลอ้างอิงจริงของคำสั่งซื้อนี้
              </p>
            </div>

            <div className={styles.successMeta}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>เลขคำสั่งซื้อ</span>
                <span className={styles.summaryValue}>
                  {state.order.orderId}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>สถานะ</span>
                <span className={styles.summaryValue}>
                  <Badge tone="warning">รอชำระเงิน</Badge>
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>ยอดที่ระบบยืนยัน</span>
                <span className={styles.authoritativeTotal}>
                  {formatSatang(state.order.total)}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>สร้างเมื่อ</span>
                <span className={styles.summaryValue}>
                  {formatIsoDateTime(state.order.createdAt)}
                </span>
              </div>
            </div>

            <p className={styles.note}>
              รายละเอียดสินค้าและราคาที่บันทึกใน Order Item เป็น snapshot จาก Backend
              และจะไม่เปลี่ยนตามการแก้ไขสินค้าในภายหลัง
            </p>

            <Link
              href={productHref({
                organizationId: context.organizationId,
                productId: context.productId,
                campaignId: context.campaignId,
              })}
              className={styles.backLink}
            >
              กลับไปดูสินค้า
            </Link>
          </section>
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
          <span className={styles.eyebrow}>Create order</span>
          <h1 className={styles.title}>ตรวจสอบและสร้างคำสั่งซื้อ</h1>
          <p className={styles.description}>
            ตรวจสอบสินค้า ตัวเลือก และแคมเปญก่อนยืนยัน
            ราคาที่แสดงก่อนส่งเป็นเพียงค่าประมาณ
          </p>
        </header>

        <div className={styles.contentGrid}>
          <section className={styles.summary} aria-labelledby="order-summary">
            <div className={styles.summaryHeader}>
              <h2 className={styles.summaryTitle} id="order-summary">
                รายการสินค้า
              </h2>
              <p className={styles.summaryDescription}>
                {product.name}
              </p>
            </div>

            {selection ? (
              <>
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>ตัวเลือก</span>
                    <span className={styles.summaryValue}>
                      {selection.variant.name}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>ราคาต่อหน่วย</span>
                    <span className={styles.summaryValue}>
                      {formatSatang(selection.variant.price)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>แคมเปญ</span>
                    <span className={styles.summaryValue}>
                      {selection.campaign.name}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>สถานะแคมเปญ</span>
                    <span className={styles.summaryValue}>
                      {selection.campaign.status}
                    </span>
                  </div>
                </div>

                <div className={styles.estimate}>
                  <span className={styles.summaryLabel}>
                    ยอดประมาณการก่อนส่ง
                  </span>
                  <strong className={styles.estimateValue}>
                    {selection.estimate !== null
                      ? formatSatang(selection.estimate)
                      : "—"}
                  </strong>
                  <p className={styles.note}>
                    Backend จะตรวจสอบสินค้า แคมเปญ ตัวเลือก และคำนวณราคาจริงอีกครั้งเมื่อสร้างคำสั่งซื้อ
                  </p>
                </div>
              </>
            ) : null}
          </section>

          <form className={styles.formPanel} onSubmit={handleSubmit}>
            <TextField
              id="order-quantity"
              label="จำนวน"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value)}
              error={quantityError}
              disabled={pending || campaignNotOpen}
              required
            />

            {campaignNotOpen ? (
              <div className={styles.warning} role="status">
                แคมเปญนี้ไม่ได้อยู่ในสถานะ OPEN
                จึงยังไม่สามารถสร้างคำสั่งซื้อได้
              </div>
            ) : null}

            {serverError ? (
              <div className={styles.serverError} role="alert">
                {serverError}
              </div>
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
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
