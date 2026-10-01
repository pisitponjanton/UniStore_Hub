"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorState, LoadingState } from "@/components";
import { ApiClientError } from "@/services";
import { formatIsoDateTime, getRequiredQueryId } from "@/utils";

import {
  CampaignStatusBadge,
  ProductCard,
  storeHref,
} from "./storefront-presenters";
import { StorefrontHeader } from "./storefront-header";
import styles from "./storefront-view.module.css";
import {
  storefrontService,
  type StorefrontCampaignView,
} from "./storefront-service";

type CampaignViewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "error" }
  | { status: "success"; data: StorefrontCampaignView };

export function CampaignView() {
  const [state, setState] = useState<CampaignViewState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadCampaign() {
      const params = new URLSearchParams(window.location.search);
      const organizationId = getRequiredQueryId(params, "organizationId");
      const campaignId = getRequiredQueryId(params, "campaignId");

      if (!organizationId.ok || !campaignId.ok) {
        await Promise.resolve();

        if (!controller.signal.aborted) {
          setState({ status: "invalid" });
        }
        return;
      }

      try {
        const data = await storefrontService.getCampaignView(
          organizationId.value,
          campaignId.value,
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          setState({ status: "success", data });
        }
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

    void loadCampaign();

    return () => controller.abort();
  }, []);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.stateWrap}>
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดแคมเปญ" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์แคมเปญไม่สมบูรณ์"
              description="ลิงก์แคมเปญนี้ไม่ครบถ้วน กรุณากลับไปเลือกร้านค้าใหม่"
              actions={<Link href="/">กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบแคมเปญ"
              description="แคมเปญนี้อาจปิดการเข้าชมหรือไม่มีอยู่ในระบบ"
              actions={<Link href="/">กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดแคมเปญได้"
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/">กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { store, campaign, products } = state.data;

  return (
    <div className={styles.page}>
      <StorefrontHeader />

      <main className={styles.main}>
        <Link
          href={storeHref(store.organizationId, store.storeId)}
          className={styles.backLink}
        >
          {store.name}
        </Link>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>แคมเปญจาก {store.name}</span>
            <div>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <h1 className={styles.title}>{campaign.name}</h1>
            <p className={styles.description}>
              ตรวจสอบช่วงเวลาและสถานะของแคมเปญก่อนเลือกสินค้าที่ต้องการสั่งซื้อ
            </p>
          </div>

          <div className={styles.heroMeta} role="group" aria-label="สรุปแคมเปญ">
            <div>
              <span className={styles.metaLabel}>สินค้าในแคมเปญ</span>
              <strong className={styles.metaValue} data-numeric>
                {products.length}
              </strong>
            </div>
            <div>
              <span className={styles.metaLabel}>ร้านค้า</span>
              <strong className={styles.metaValue}>{store.name}</strong>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="schedule-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>กำหนดการ</span>
              <h2 className={styles.sectionTitle} id="schedule-heading">
                ช่วงเวลาสำคัญ
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              ใช้ช่วงเวลานี้ประกอบการวางแผนสั่งซื้อ ชำระเงิน และรับสินค้า
            </p>
          </div>

          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <span className={styles.metaLabel}>เปิดรับคำสั่งซื้อ</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.openAt)}
              </span>
            </div>
            <div className={styles.timelineItem}>
              <span className={styles.metaLabel}>ปิดรับคำสั่งซื้อ</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.closeAt)}
              </span>
            </div>
            <div className={styles.timelineItem}>
              <span className={styles.metaLabel}>กำหนดชำระเงิน</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.paymentDeadline)}
              </span>
            </div>
            <div className={styles.timelineItem}>
              <span className={styles.metaLabel}>วันรับสินค้า</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.pickupAt)}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="campaign-products">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>เลือกสินค้า</span>
              <h2 className={styles.sectionTitle} id="campaign-products">
                สินค้าสำหรับแคมเปญนี้
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              เลือกสินค้าเพื่อดูตัวเลือก ราคา และเริ่มขั้นตอนสั่งซื้อ
            </p>
          </div>

          {products.length > 0 ? (
            <div className={styles.cardGrid}>
              {products.map((product) => (
                <ProductCard
                  key={product.productId}
                  organizationId={campaign.organizationId}
                  product={product}
                  campaignId={campaign.campaignId}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyBox}>
              ยังไม่มีสินค้าที่เปิดให้เข้าชมในแคมเปญนี้
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
