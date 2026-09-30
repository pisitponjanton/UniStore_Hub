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
        <h3 className={styles.cardTitle}>{campaign.name}</h3>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <div className={styles.cardMeta}>
        <div className={styles.cardMetaRow}>
          <span>เปิดรับ</span>
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

      <span className={styles.cardAction}>ดูแคมเปญ</span>
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
            alt=""
            className={styles.productImage}
          />
        ) : (
          <div className={styles.productPlaceholder}>ยังไม่มีรูปสินค้า</div>
        )}
      </div>

      <div>
        <h3 className={styles.cardTitle}>{product.name}</h3>
        {product.description ? (
          <p className={styles.cardDescription}>{product.description}</p>
        ) : null}
      </div>

      {price ? <div className={styles.price}>เริ่มต้น {price}</div> : null}
      <span className={styles.cardAction}>ดูสินค้า</span>
    </Link>
  );
}
