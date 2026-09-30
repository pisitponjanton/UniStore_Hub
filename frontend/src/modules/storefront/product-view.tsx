"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ErrorState,
  LoadingState,
  SelectField,
  TextField,
} from "@/components";
import { useAuthSession } from "@/modules/auth";
import { ApiClientError } from "@/services";
import { formatSatang, getRequiredQueryId, parseRequiredQueryId } from "@/utils";

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
  const [state, setState] = useState<ProductViewState>({ status: "loading" });
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
  }, []);

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
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดสินค้า" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์สินค้าไม่สมบูรณ์"
              description="ลิงก์นี้ต้องมี organizationId และ productId ที่ถูกต้อง"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบสินค้า"
              description="สินค้านี้อาจไม่เปิดให้ลูกค้าเข้าชมหรือไม่มีอยู่ในระบบ"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
            />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดสินค้าได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/">กลับหน้าร้าน</Link>}
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
        <Link
          href={storeHref(store.organizationId, store.storeId)}
          className={styles.backLink}
        >
          กลับไปที่ {store.name}
        </Link>

        <section className={styles.productDetail}>
          <div className={styles.productDetailMedia}>
            {product.imageUrl ? (
              // Backend supplies this short-lived Storefront URL for display only.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className={styles.productDetailImage}
              />
            ) : (
              <div className={styles.productDetailPlaceholder}>
                ยังไม่มีรูปสินค้า
              </div>
            )}
          </div>

          <div className={styles.productDetailBody}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Product</span>
              <h1 className={styles.title}>{product.name}</h1>
              {product.description ? (
                <p className={styles.description}>
                  {product.description}
                </p>
              ) : null}
            </div>

            {variants.length > 0 ? (
              <div className={styles.selectionPanel}>
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
                      {variant.name} — {formatSatang(variant.price)}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="product-campaign"
                  label="แคมเปญ"
                  value={selectedCampaignId}
                  onChange={(event) =>
                    setSelectedCampaignId(event.target.value)
                  }
                  hint="การสั่งซื้อทำได้เมื่อ Backend ระบุสถานะแคมเปญเป็น OPEN"
                >
                  <option value="">เลือกแคมเปญ</option>
                  {campaigns.map((campaign) => (
                    <option
                      key={campaign.campaignId}
                      value={campaign.campaignId}
                    >
                      {campaign.name} — {campaign.status}
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

                <div className={styles.estimatePanel}>
                  <span className={styles.metaLabel}>
                    ราคาประมาณการ
                  </span>
                  <strong className={styles.estimateValue}>
                    {selection?.estimate !== null &&
                    selection?.estimate !== undefined
                      ? formatSatang(selection.estimate)
                      : "—"}
                  </strong>
                  <p className={styles.estimateNote}>
                    ราคานี้เป็นเพียงค่าประมาณจากตัวเลือกและจำนวนที่เลือก
                    ยอดจาก Backend หลังสร้างคำสั่งซื้อเป็นค่าที่ใช้จริง
                  </p>
                </div>

                {selection?.campaign ? (
                  <div className={styles.campaignContext}>
                    <div className={styles.cardHeader}>
                      <div>
                        <span className={styles.metaLabel}>
                          แคมเปญที่เลือก
                        </span>
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
                  <p className={styles.selectionNotice} role="status">
                    ไม่พบแคมเปญจากลิงก์เดิมสำหรับร้านนี้
                    กรุณาเลือกแคมเปญใหม่ก่อนสั่งซื้อ
                  </p>
                ) : null}

                {orderHref ? (
                  auth.status === "authenticated" ? (
                    <Link
                      href={orderHref}
                      className={styles.primaryAction}
                    >
                      ดำเนินการสั่งซื้อ
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
                  <div className={styles.selectionNotice} role="status">
                    {selection?.campaign &&
                    selection.campaign.status !== "OPEN"
                      ? "แคมเปญที่เลือกยังไม่อยู่ในสถานะ OPEN จึงยังเริ่มสั่งซื้อไม่ได้"
                      : "เลือกตัวเลือกสินค้า แคมเปญที่เปิดรับ และจำนวนที่ถูกต้องเพื่อดำเนินการต่อ"}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.emptyBox}>
                สินค้านี้ยังไม่มีตัวเลือกที่เปิดใช้งาน
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
