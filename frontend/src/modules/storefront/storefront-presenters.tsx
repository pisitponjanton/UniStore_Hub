import Link from "next/link";

import { Badge } from "@/components";
import type {
  CampaignDTO,
  CampaignStatus,
  StorefrontProductDTO,
} from "@/types";
import { formatIsoDateTime, formatSatang } from "@/utils";

import styles from "./storefront-view.module.css";

const campaignLabel: Record<CampaignStatus, string> = {
  DRAFT: "ฉบับร่าง",
  OPEN: "เปิดรับคำสั่งซื้อ",
  CLOSED: "ปิดรับคำสั่งซื้อ",
  PRODUCING: "กำลังผลิต",
  READY_FOR_PICKUP: "พร้อมรับสินค้า",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const campaignTone: Record<
  CampaignStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "warning",
  PRODUCING: "info",
  READY_FOR_PICKUP: "success",
  COMPLETED: "neutral",
  CANCELLED: "danger",
};

export function campaignStatusLabel(status: CampaignStatus): string {
  return campaignLabel[status];
}

export function CampaignStatusBadge({
  status,
}: {
  status: CampaignStatus;
}) {
  return <Badge tone={campaignTone[status]}>{campaignLabel[status]}</Badge>;
}

export function campaignHref(
  organizationId: string,
  campaignId: string,
): string {
  const params = new URLSearchParams({
    organizationId,
    campaignId,
  });

  return `/campaigns/view/?${params.toString()}`;
}

export function storeHref(
  organizationId: string,
  storeId: string,
): string {
  const params = new URLSearchParams({
    organizationId,
    storeId,
  });

  return `/stores/view/?${params.toString()}`;
}

export function productHref({
  organizationId,
  productId,
  campaignId,
}: {
  organizationId: string;
  productId: string;
  campaignId?: string;
}): string {
  const params = new URLSearchParams({
    organizationId,
    productId,
  });

  if (campaignId) {
    params.set("campaignId", campaignId);
  }

  return `/products/view/?${params.toString()}`;
}

export function CampaignCard({
  campaign,
}: {
  campaign: CampaignDTO;
}) {
  return (
    <Link
      href={campaignHref(campaign.organizationId, campaign.campaignId)}
      className={styles.campaignCard}
    >
      <div className={styles.cardHeader}>
        <div className={styles.campaignIdentity}>
                    <h3 className={styles.cardTitle}>{campaign.name}</h3>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <div className={styles.cardMeta} aria-label="ช่วงเวลารับคำสั่งซื้อ">
        <div className={styles.cardMetaRow}>
          <span>เริ่มรับ</span>
          <span className={styles.cardMetaValue}>
            {formatIsoDateTime(campaign.openAt)}
          </span>
        </div>
        <div className={styles.cardMetaRow}>
          <span>ปิดรับ</span>
          <span className={styles.cardMetaValue}>
            {formatIsoDateTime(campaign.closeAt)}
          </span>
        </div>
      </div>

      <div className={styles.campaignCardFooter}>
        <span className={styles.cardAction}>ดูรอบขาย</span>
      </div>
    </Link>
  );
}

function productPrice(product: StorefrontProductDTO): string | null {
  const prices = (product.variants ?? [])
    .filter((variant) => variant.status === "ACTIVE")
    .map((variant) => variant.price);

  if (prices.length === 0) {
    return null;
  }

  return formatSatang(Math.min(...prices));
}

export function ProductCard({
  organizationId,
  product,
  campaignId,
}: {
  organizationId: string;
  product: StorefrontProductDTO;
  campaignId?: string;
}) {
  const activeVariantCount = (product.variants ?? []).filter(
    (variant) => variant.status === "ACTIVE",
  ).length;
  const price = productPrice(product);

  return (
    <Link
      href={productHref({
        organizationId,
        productId: product.productId,
        campaignId,
      })}
      className={styles.productCard}
    >
      <div className={styles.productMedia}>
        {product.imageUrl ? (
          // Backend supplies this short-lived Storefront URL for display only.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className={styles.productImage}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={styles.productPlaceholder}>ยังไม่มีรูปสินค้า</div>
        )}
      </div>

      <div className={styles.productIdentity}>
                <h3 className={styles.cardTitle}>{product.name}</h3>
        {product.description ? (
          <p className={styles.cardDescription}>{product.description}</p>
        ) : null}
      </div>

      <div className={styles.productFooter}>
        <div>
          {price ? (
            <>
              <span className={styles.priceLabel}>ราคาเริ่มต้น</span>
              <strong className={styles.price}>{price}</strong>
            </>
          ) : (
            <span className={styles.priceUnavailable}>ยังไม่มีราคาที่ใช้งาน</span>
          )}
          <span className={styles.productAvailability} data-numeric>
            {activeVariantCount > 0
              ? `${activeVariantCount} ตัวเลือก`
              : "ยังไม่มีตัวเลือกที่ใช้งาน"}
          </span>
        </div>
        <span className={styles.cardAction}>ดูสินค้า</span>
      </div>
    </Link>
  );
}
