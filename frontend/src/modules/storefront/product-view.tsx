"use client";

import { AppIcon } from "@/components/ui/app-icon";

import { PageLoadingRows, PageStateHeading, RecoveryActions } from "@/components/ui/async-page";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  EmptyIllustration,
  ErrorState,
  LoadingState,
  MediaFallback,
  Notice,
  SelectField,
  TextField,
} from "@/components";
import { useAuthSession } from "@/modules/auth";
import { ApiClientError } from "@/services";
import {
  formatSatang,
  getRequiredQueryId,
  parseRequiredQueryId,
} from "@/utils";

import {
  buildOrderEntryHref,
  calculateEstimatedTotal,
  findCampaign,
  firstOpenCampaign,
  parseQuantityInput,
} from "./product-selection";
import {
  CampaignStatusBadge,
  campaignHref,
  campaignStatusLabel,
  storeHref,
} from "./storefront-presenters";
import { StorefrontHeader } from "./storefront-header";
import styles from "./storefront-view.module.css";
import {
  storefrontService,
  type StorefrontProductView,
} from "./storefront-service";

type ProductViewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "error" }
  | {
      status: "success";
      data: StorefrontProductView;
      requestedCampaignId: string | null;
    };

function loginHref(returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `/login/?${params.toString()}`;
}

export function ProductView() {
  const auth = useAuthSession();
  const shopsHref = auth.status === "authenticated" ? "/shops/" : "/";
  const [state, setState] = useState<ProductViewState>({ status: "loading" });
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryFocusRequested = useRef(false);

  function retryDetail() {
    retryFocusRequested.current = true;
    setState({ status: "loading" });
    setRetryAttempt(attempt => attempt + 1);
  }

  useEffect(() => {
    if (!retryFocusRequested.current || state.status === "loading") return;
    retryFocusRequested.current = false;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>("main h1[tabindex]")
        ?? document.querySelector<HTMLElement>("main");
      target?.focus();
      target?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.status]);

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProduct() {
      const params = new URLSearchParams(window.location.search);
      const organizationId = getRequiredQueryId(params, "organizationId");
      const productId = getRequiredQueryId(params, "productId");
      const campaignRaw = params.get("campaignId");
      const campaignId =
        campaignRaw === null ? null : parseRequiredQueryId(campaignRaw);

      if (
        !organizationId.ok ||
        !productId.ok ||
        (campaignId !== null && !campaignId.ok)
      ) {
        await Promise.resolve();

        if (!controller.signal.aborted) {
          setState({ status: "invalid" });
        }
        return;
      }

      try {
        const data = await storefrontService.getProductView(
          organizationId.value,
          productId.value,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) {
          return;
        }

        const requestedCampaignId =
          campaignId && campaignId.ok ? campaignId.value : null;
        const requestedCampaign = findCampaign(
          data.campaigns,
          requestedCampaignId,
        );
        const fallbackCampaign =
          requestedCampaignId === null
            ? firstOpenCampaign(data.campaigns)
            : null;

        setSelectedVariantId(data.product.variants?.[0]?.variantId ?? "");
        setSelectedCampaignId(
          requestedCampaign?.campaignId ??
            fallbackCampaign?.campaignId ??
            "",
        );
        setState({
          status: "success",
          data,
          requestedCampaignId,
        });
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

    void loadProduct();

    return () => controller.abort();
  }, [retryAttempt]);

  const selection = useMemo(() => {
    if (state.status !== "success") {
      return null;
    }

    const variant = state.data.product.variants?.find(
      (item) => item.variantId === selectedVariantId,
    );
    const campaign = findCampaign(
      state.data.campaigns,
      selectedCampaignId,
    );
    const quantity = parseQuantityInput(quantityInput);
    const estimate = calculateEstimatedTotal(variant, quantity);

    return {
      variant,
      campaign,
      quantity,
      estimate,
    };
  }, [quantityInput, selectedCampaignId, selectedVariantId, state]);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.stateWrap} tabIndex={-1}>
          <PageStateHeading title="รายละเอียดสินค้า" description="เลือกสินค้าและตัวเลือกจากร้านค้าที่เปิดให้เข้าชม" />
          {state.status === "loading" ? <PageLoadingRows /> : null}
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดสินค้า" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์สินค้าไม่สมบูรณ์"
              description="ลิงก์สินค้านี้ไม่ครบถ้วน กรุณากลับไปเลือกร้านค้าใหม่"
              actions={<Link href={shopsHref}>กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบสินค้า"
              description="สินค้านี้อาจปิดการเข้าชมหรือไม่มีอยู่ในระบบ"
              actions={<Link href={shopsHref}>กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดสินค้าได้"
              description="ไม่สามารถดึงข้อมูลล่าสุดได้ ลองใหม่หรือกลับไปเลือกร้านค้า"
              actions={<RecoveryActions backHref="/" backLabel="กลับไปเลือกร้านค้า" onRetry={retryDetail} />}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { store, product, campaigns } = state.data;
  const variants = product.variants ?? [];
  const requestedCampaignMissing =
    state.requestedCampaignId !== null &&
    !findCampaign(campaigns, state.requestedCampaignId);
  const otherOpenCampaignExists = campaigns.some((campaign) => campaign.status === "OPEN");
  const selectedCampaignIsClosed = selection?.campaign !== undefined
    && selection?.campaign !== null
    && selection.campaign.status !== "OPEN";
  const startingPrice =
    variants.length > 0
      ? Math.min(...variants.map((variant) => variant.price))
      : null;
  const orderHref =
    selection?.variant &&
    selection.campaign &&
    selection.campaign.status === "OPEN" &&
    selection.quantity !== null
      ? buildOrderEntryHref({
          organizationId: product.organizationId,
          campaignId: selection.campaign.campaignId,
          productId: product.productId,
          variantId: selection.variant.variantId,
        })
      : null;

  return (
    <div className={styles.page}>
      <StorefrontHeader />

      <main className={styles.main}>
        <nav className={styles.breadcrumbs} aria-label="เส้นทางสินค้า">
          <Link href={shopsHref}>ร้านค้าทั้งหมด</Link>
          <span aria-hidden="true">/</span>
          <Link href={storeHref(store.organizationId, store.storeId)}>{store.name}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <section className={styles.productDetail} data-has-image={product.imageUrl ? "true" : "false"}>
          <div className={styles.productDetailMedia} data-has-image={product.imageUrl ? "true" : "false"}>
            {product.imageUrl ? (
              // Backend supplies this short-lived Storefront URL for display only.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className={styles.productDetailImage}
                decoding="async"
              />
            ) : (
              <MediaFallback
                variant="product"
                label="ยังไม่มีรูปสินค้า"
                className={styles.productDetailPlaceholder}
              />
            )}
          </div>

          <div className={styles.productDetailBody}>
            <div className={styles.heroCopy}>
              <span className={styles.contextLine}>PRODUCT / {store.name}</span>
              <h1 tabIndex={-1} className={styles.title}>{product.name}</h1>
              {product.description ? (
                <p className={styles.description}>
                  {product.description}
                </p>
              ) : (
                <p className={styles.description}>
                  เลือกตัวเลือกสินค้า แคมเปญ และจำนวนเพื่อดูยอดประมาณการก่อนสั่งซื้อ
                </p>
              )}
            </div>

            <div className={styles.productOpeningSummary}>
              <div>
                <span>ราคาเริ่มต้น</span>
                <strong data-numeric>
                  {startingPrice === null ? "ยังไม่มีราคาที่ใช้งาน" : formatSatang(startingPrice)}
                </strong>
              </div>
              {variants.length > 0 ? (
                <a className={styles.productJump} href="#product-selection">
                  เลือกตัวเลือกและคำนวณยอด <AppIcon name="arrow-up-right" size={17} />
                </a>
              ) : null}
            </div>
            <p className={styles.productReadiness} role="status">
              <span aria-hidden="true" className={!selectedCampaignIsClosed && otherOpenCampaignExists ? styles.readinessDotActive : styles.readinessDot} />
              {selectedCampaignIsClosed
                ? "รอบที่เลือกยังไม่เปิดรับคำสั่งซื้อ กรุณาเลือกรอบที่เปิดรับ"
                : otherOpenCampaignExists
                  ? "มีรอบพรีออเดอร์ที่เปิดรับคำสั่งซื้อ"
                  : "ยังไม่มีรอบพรีออเดอร์ที่เปิดรับคำสั่งซื้อ"}
            </p>
            <dl className={styles.productFacts} aria-label="ข้อมูลสินค้าสำหรับการสั่งซื้อ">
              <div>
                <dt>ตัวเลือกสินค้า</dt>
                <dd data-numeric>{variants.length}</dd>
              </div>
              <div>
                <dt>แคมเปญที่พบ</dt>
                <dd data-numeric>{campaigns.length}</dd>
              </div>
            </dl>

            {variants.length > 0 ? (
              <div id="product-selection" className={styles.selectionPanel}>
                <div className={styles.selectionHeading}>
                  <div>
                    <h2 className={styles.selectionTitle}>
                      เลือกรายละเอียดที่ต้องการ
                    </h2>
                    <p className={styles.selectionDescription}>
                      เลือกตัวเลือกสินค้า รอบพรีออเดอร์ แล้วระบุจำนวนที่ต้องการ
                    </p>
                  </div>
                  <span className={styles.selectionStep}>ตรวจสอบก่อนสั่ง</span>
                </div>

                <ol className={styles.purchaseSteps} aria-label="ขั้นตอนการเริ่มสั่งซื้อ">
                  <li><span aria-hidden="true">1</span> เลือกตัวเลือกสินค้า</li>
                  <li><span aria-hidden="true">2</span> เลือกรอบที่เปิดรับ</li>
                  <li><span aria-hidden="true">3</span> ตรวจยอดและดำเนินการต่อ</li>
                </ol>

                <div className={styles.selectionFields}>
                  <SelectField
                    id="product-variant"
                    label="ตัวเลือกสินค้า"
                    value={selectedVariantId}
                    onChange={(event) =>
                      setSelectedVariantId(event.target.value)
                    }
                    required
                  >
                    {variants.map((variant) => (
                      <option
                        key={variant.variantId}
                        value={variant.variantId}
                      >
                        {variant.name} ({formatSatang(variant.price)})
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    id="product-campaign"
                    label="รอบพรีออเดอร์"
                    value={selectedCampaignId}
                    onChange={(event) =>
                      setSelectedCampaignId(event.target.value)
                    }
                    hint="สั่งซื้อได้เฉพาะรอบที่เปิดรับคำสั่งซื้อเท่านั้น"
                  >
                    <option value="">เลือกแคมเปญ</option>
                    {campaigns.map((campaign) => (
                      <option
                        key={campaign.campaignId}
                        value={campaign.campaignId}
                      >
                        {campaign.name} ({campaignStatusLabel(campaign.status)})
                      </option>
                    ))}
                  </SelectField>

                  <TextField
                    id="product-quantity"
                    label="จำนวน"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={quantityInput}
                    onChange={(event) =>
                      setQuantityInput(event.target.value)
                    }
                    error={
                      selection?.quantity === null
                        ? "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป"
                        : undefined
                    }
                    required
                  />
                </div>

                <div className={styles.estimatePanel}>
                  <span className={styles.metaLabel}>ยอดรวมโดยประมาณ</span>
                  {selection?.variant ? (
                    <p className={styles.estimateBreakdown} data-numeric>
                      {selection.variant.name} · {formatSatang(selection.variant.price)} × {selection.quantity ?? "—"}
                    </p>
                  ) : null}
                  <output
                    className={styles.estimateValue}
                    htmlFor="product-variant product-campaign product-quantity"
                    aria-live="polite"
                    aria-atomic="true"
                    data-numeric
                  >
                    {selection?.estimate !== null &&
                    selection?.estimate !== undefined
                      ? formatSatang(selection.estimate)
                      : "ยังไม่คำนวณ"}
                  </output>
                  <p className={styles.estimateNote}>
                    ยอดนี้คำนวณจากตัวเลือกและจำนวนที่เลือก
                    ยอดหลังสร้างคำสั่งซื้อเป็นยอดที่ใช้ดำเนินการจริง
                  </p>
                </div>

                {selection?.campaign ? (
                  <div className={styles.campaignContext}>
                    <div className={styles.cardHeader}>
                      <div>
                        <span className={styles.metaLabel}>แคมเปญที่เลือก</span>
                        <div className={styles.metaValue}>
                          {selection.campaign.name}
                        </div>
                      </div>
                      <CampaignStatusBadge
                        status={selection.campaign.status}
                      />
                    </div>
                    <Link
                      href={campaignHref(
                        selection.campaign.organizationId,
                        selection.campaign.campaignId,
                      )}
                      className={styles.inlineLink}
                    >
                      ดูรายละเอียดแคมเปญ
                    </Link>
                  </div>
                ) : null}

                {requestedCampaignMissing ? (
                  <Notice tone="warning" title="ต้องเลือกแคมเปญใหม่">
                    ไม่พบแคมเปญจากลิงก์เดิมสำหรับร้านนี้
                    กรุณาเลือกแคมเปญที่ต้องการก่อนสั่งซื้อ
                  </Notice>
                ) : null}

                <div className={styles.purchaseArea}>
                  {orderHref ? (
                    auth.status === "authenticated" ? (
                      <Link
                        href={orderHref}
                        className={styles.primaryAction}
                      >
                        ตรวจสอบคำสั่งซื้อ
                      </Link>
                    ) : auth.status === "anonymous" ? (
                      <Link
                        href={loginHref(orderHref)}
                        className={styles.primaryAction}
                      >
                        เข้าสู่ระบบเพื่อสั่งซื้อ
                      </Link>
                    ) : (
                      <span
                        className={styles.disabledAction}
                        aria-live="polite"
                      >
                        กำลังตรวจสอบบัญชี
                      </span>
                    )
                  ) : (
                    <Notice
                      tone={
                        selection?.campaign &&
                        selection.campaign.status !== "OPEN"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {selection?.campaign &&
                      selection.campaign.status !== "OPEN"
                        ? "รอบพรีออเดอร์ที่เลือกยังไม่เปิดรับคำสั่งซื้อ"
                        : "เลือกตัวเลือกสินค้า รอบพรีออเดอร์ที่เปิดรับ และจำนวนที่ถูกต้องเพื่อดำเนินการต่อ"}
                    </Notice>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyBox}>
                <EmptyIllustration compact />
                สินค้านี้ยังไม่มีตัวเลือกที่เปิดใช้งาน
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
