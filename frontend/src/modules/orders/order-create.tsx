"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button,
  ErrorState,
  ErrorSummary,
  LoadingState,
  MediaFallback,
  Notice,
  TaskStatus,
  TextField,
  useErrorSummaryFocus,
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
  const focusErrorSummary = useErrorSummaryFocus();
  const [state, setState] = useState<OrderCreateState>({
    status: "loading",
  });
  const [quantityInput, setQuantityInput] = useState("1");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
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
  }, [loadAttempt]);

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
      campaignNotOpen
    ) {
      return;
    }

    setSubmitAttempted(true);
    setServerError(null);

    if (orderContext.quantity === null) {
      focusErrorSummary("order-create-error-summary");
      return;
    }

    setPending(true);

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
              description="ลองโหลดข้อมูลสินค้าและรอบพรีออเดอร์อีกครั้ง หรือกลับไปเลือกสินค้าจากหน้าร้าน"
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
                  <Link href="/">กลับหน้าร้าน</Link>
                </>
              }
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
          <div className={styles.successMarker} aria-hidden="true" />

          <header className={styles.successHeading}>
            <h1 className={styles.successTitle}>สร้างคำสั่งซื้อสำเร็จ</h1>
            <p className={styles.description}>
              ยอดและสถานะด้านล่างมาจากข้อมูลที่ระบบบันทึกไว้จริง
              ใช้ขั้นตอนถัดไปเพื่อดำเนินรายการต่อ
            </p>
          </header>

          <TaskStatus
            tone={getOrderStatusTone(state.order.status)}
            label={<OrderStatusBadge status={state.order.status} />}
            title={guidance.title}
            description={guidance.description}
            metadata={
              <span data-technical>
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

          <section
            className={styles.successSummary}
            aria-label="ข้อมูลคำสั่งซื้อที่บันทึกแล้ว"
          >
            <div className={styles.successTotal}>
              <span className={styles.summaryLabel}>ยอดที่ระบบบันทึก</span>
              <strong className={styles.authoritativeTotal} data-numeric>
                {formatSatang(state.order.total)}
              </strong>
            </div>
            <div>
              <span className={styles.summaryLabel}>สินค้า</span>
              <span className={styles.summaryValue}>{product.name}</span>
            </div>
            <div>
              <span className={styles.summaryLabel}>สร้างเมื่อ</span>
              <span className={styles.summaryValue}>
                {formatIsoDateTime(state.order.createdAt)}
              </span>
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
    (quantityTouched || submitAttempted) && selection?.quantity === null
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

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>ตรวจสอบคำสั่งซื้อ</h1>
            <p className={styles.description}>
              สินค้าและตัวเลือกถูกส่งมาจากหน้าสินค้าแล้ว
              ระบุจำนวนและตรวจสอบยอดประมาณการก่อนยืนยัน
            </p>
          </div>

          <ol className={styles.progress} aria-label="ขั้นตอนการสั่งซื้อ">
            <li className={styles.progressDone}>
              <span>1</span>
              <strong>เลือกสินค้า</strong>
            </li>
            <li className={styles.progressCurrent} aria-current="step">
              <span>2</span>
              <strong>ตรวจสอบและยืนยัน</strong>
            </li>
            <li>
              <span>3</span>
              <strong>ติดตามรายการ</strong>
            </li>
          </ol>
        </header>

        <div className={styles.contentGrid}>
          <section
            className={styles.reviewPanel}
            aria-labelledby="order-summary"
          >
            <div className={styles.productOverview}>
              <div className={styles.productMedia}>
                {product.imageUrl ? (
                  // Backend supplies this short-lived Storefront URL for display only.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className={styles.productImage}
                    decoding="async"
                  />
                ) : (
                  <MediaFallback
                    variant="product"
                    label="ยังไม่มีรูปสินค้า"
                    className={styles.productPlaceholder}
                  />
                )}
              </div>

              <div className={styles.productSummary}>
                <span className={styles.storeName}>{data.store.name}</span>
                <span className={styles.summaryLabel}>สินค้าที่เลือก</span>
                <h2 className={styles.summaryTitle} id="order-summary">
                  {product.name}
                </h2>
                {product.description ? (
                  <p className={styles.productDescription}>
                    {product.description}
                  </p>
                ) : null}
                {selection ? (
                  <span className={styles.variantName}>
                    ตัวเลือก {selection.variant.name}
                  </span>
                ) : null}
              </div>
            </div>

            {selection ? (
              <>
                <div className={styles.campaignContext}>
                  <div className={styles.campaignContextTop}>
                    <div>
                      <span className={styles.summaryLabel}>รอบพรีออเดอร์</span>
                      <strong>{selection.campaign.name}</strong>
                    </div>
                    <CampaignStatusBadge status={selection.campaign.status} />
                  </div>
                  <p>
                    {selection.campaign.status === "OPEN"
                      ? "รอบนี้กำลังเปิดรับคำสั่งซื้อ สามารถยืนยันรายการได้"
                      : "รอบนี้ไม่เปิดรับคำสั่งซื้อใหม่แล้ว"}
                  </p>
                </div>

                <dl className={styles.reviewFacts}>
                  <div>
                    <dt>ตัวเลือก</dt>
                    <dd>{selection.variant.name}</dd>
                  </div>
                  <div>
                    <dt>ราคาต่อชิ้น</dt>
                    <dd data-numeric>{formatSatang(selection.variant.price)}</dd>
                  </div>
                  <div>
                    <dt>ปิดรับคำสั่งซื้อ</dt>
                    <dd>{formatIsoDateTime(selection.campaign.closeAt)}</dd>
                  </div>
                  <div>
                    <dt>กำหนดชำระเงิน</dt>
                    <dd>
                      {formatIsoDateTime(selection.campaign.paymentDeadline)}
                    </dd>
                  </div>
                </dl>
              </>
            ) : null}

            <p className={styles.authorityNote}>
              ราคาที่เห็นในหน้านี้ใช้เพื่อช่วยตรวจสอบรายการ
              ระบบฝั่งเซิร์ฟเวอร์จะตรวจสินค้าและคำนวณยอดจริงอีกครั้งตอนสร้างคำสั่งซื้อ
            </p>
          </section>

          <form
            className={styles.confirmPanel}
            onSubmit={handleSubmit}
            aria-labelledby="confirm-heading"
            noValidate
          >
            <div className={styles.confirmHeading}>
              <h2 id="confirm-heading">จำนวนและยอดประมาณการ</h2>
              <p>ตรวจจำนวนด้านล่างให้ถูกต้องก่อนกดยืนยัน</p>
            </div>

            <ErrorSummary
              id="order-create-error-summary"
              items={
                quantityError
                  ? [{ fieldId: "order-quantity", message: quantityError }]
                  : []
              }
            />

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
              onBlur={() => {
                window.setTimeout(() => {
                  setQuantityTouched(true);
                }, 0);
              }}
              error={quantityError}
              announceError={false}
              hint="ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป"
              disabled={pending || campaignNotOpen}
              required
            />

            <div className={styles.estimate}>
              <span className={styles.summaryLabel} id="order-estimate-label">
                ยอดประมาณการ
              </span>
              <output
                className={styles.estimateValue}
                htmlFor="order-quantity"
                aria-labelledby="order-estimate-label"
                data-numeric
              >
                {selection?.estimate !== null &&
                selection?.estimate !== undefined
                  ? formatSatang(selection.estimate)
                  : "ยังไม่คำนวณ"}
              </output>
              {selection ? (
                <div className={styles.estimateBreakdown}>
                  <span data-numeric>
                    {formatSatang(selection.variant.price)} ×{" "}
                    {selection.quantity ?? "—"}
                  </span>
                  <span>ราคาต่อชิ้น × จำนวน</span>
                </div>
              ) : null}
              <p className={styles.note}>
                ระบบฝั่งเซิร์ฟเวอร์จะตรวจสินค้า ราคา และบันทึกยอดจริงอีกครั้งเมื่อสร้างคำสั่งซื้อ
              </p>
            </div>

            {campaignNotOpen ? (
              <Notice tone="warning" title="รอบนี้ปิดรับคำสั่งซื้อแล้ว">
                ไม่สามารถสร้างคำสั่งซื้อใหม่จากรอบพรีออเดอร์นี้ได้
              </Notice>
            ) : null}

            {serverError ? (
              <Notice
                tone="danger"
                role="alert"
                title="สร้างคำสั่งซื้อไม่สำเร็จ"
              >
                {serverError}
              </Notice>
            ) : null}

            <div className={styles.actions}>
              <Button
                type="submit"
                formNoValidate
                size="large"
                pending={pending}
                onClick={(event) => {
                  if (orderContext?.quantity !== null) {
                    return;
                  }

                  event.preventDefault();
                  setSubmitAttempted(true);
                  setServerError(null);
                  focusErrorSummary(
                    "order-create-error-summary",
                  );
                }}
                pendingLabel="กำลังสร้างคำสั่งซื้อ"
                disabled={campaignNotOpen || !selection}
              >
                ยืนยันสร้างคำสั่งซื้อ
              </Button>
              <span className={styles.submitHint}>
                กดยืนยันครั้งเดียว แล้วรอให้ระบบสร้างรายการให้เสร็จ
              </span>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
