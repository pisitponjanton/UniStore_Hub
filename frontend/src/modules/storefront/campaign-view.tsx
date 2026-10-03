"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorState, LoadingState } from "@/components";
import { ApiClientError } from "@/services";
import type { CampaignStatus } from "@/types";
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

const campaignGuidance: Record<CampaignStatus, string> = {
  DRAFT: "แคมเปญนี้ยังไม่เปิดให้สั่งซื้อ",
  OPEN: "กำลังเปิดรับคำสั่งซื้อ เลือกสินค้าด้านล่างเพื่อดูตัวเลือกและราคา",
  CLOSED: "ปิดรับคำสั่งซื้อแล้ว รายการที่สั่งไว้จะดำเนินต่อไปตามสถานะของระบบ",
  PRODUCING: "อยู่ระหว่างการผลิตสำหรับคำสั่งซื้อที่ผ่านขั้นตอนก่อนหน้า",
  READY_FOR_PICKUP: "คำสั่งซื้อที่พร้อมแล้วสามารถติดตามขั้นตอนรับสินค้าได้จากบัญชีของคุณ",
  COMPLETED: "แคมเปญนี้ดำเนินการเสร็จสิ้นแล้ว",
  CANCELLED: "แคมเปญนี้ถูกยกเลิกและไม่เปิดรับคำสั่งซื้อ",
};

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
            <span className={styles.eyebrow}>รอบขายจาก {store.name}</span>
            <h1 className={styles.title}>{campaign.name}</h1>
            <p className={styles.description}>
              ตรวจสอบสถานะและช่วงเวลาสำคัญของรอบนี้ก่อนเลือกสินค้าที่ต้องการ
            </p>
          </div>

          <aside
            className={styles.campaignStatusPanel}
            aria-label="สถานะแคมเปญปัจจุบัน"
          >
            <div className={styles.campaignStatusTop}>
              <span className={styles.metaLabel}>สถานะปัจจุบัน</span>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className={styles.campaignStatusDescription}>
              {campaignGuidance[campaign.status]}
            </p>
            <div className={styles.campaignFacts}>
              <div>
                <span className={styles.metaLabel}>สินค้า</span>
                <strong data-numeric>{products.length}</strong>
              </div>
              <div>
                <span className={styles.metaLabel}>ร้าน</span>
                <strong>{store.name}</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="schedule-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>กำหนดการของรอบนี้</span>
              <h2 className={styles.sectionTitle} id="schedule-heading">
                ช่วงเวลาสำคัญ
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              วันที่เหล่านี้เป็นข้อมูลของแคมเปญปัจจุบัน ใช้ประกอบการวางแผนสั่งซื้อ ชำระเงิน และรับสินค้า
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
              <span className={styles.eyebrow}>สินค้าในรอบนี้</span>
              <h2 className={styles.sectionTitle} id="campaign-products">
                เลือกสินค้าที่ต้องการ
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              เปิดสินค้าเพื่อดูตัวเลือก ราคา และตรวจสอบว่าสถานะปัจจุบันสามารถเริ่มสั่งซื้อได้หรือไม่
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
