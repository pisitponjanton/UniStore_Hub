"use client";

import { AppIcon } from "@/components/ui/app-icon";

import { PageLoadingRows, PageStateHeading, RecoveryActions } from "@/components/ui/async-page";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { EmptyIllustration, ErrorState, LoadingState } from "@/components";
import { useAuthSession } from "@/modules/auth";
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
  const auth = useAuthSession();
  const shopsHref = auth.status === "authenticated" ? "/shops/" : "/";
  const [state, setState] = useState<CampaignViewState>({
    status: "loading",
  });

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
  }, [retryAttempt]);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.stateWrap} tabIndex={-1}>
          <PageStateHeading title="รายละเอียดแคมเปญ" description="ตรวจสอบสถานะและรายละเอียดรอบขาย" />
          {state.status === "loading" ? <PageLoadingRows /> : null}
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดแคมเปญ" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์แคมเปญไม่สมบูรณ์"
              description="ลิงก์แคมเปญนี้ไม่ครบถ้วน กรุณากลับไปเลือกร้านค้าใหม่"
              actions={<Link href={shopsHref}>กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบแคมเปญ"
              description="แคมเปญนี้อาจปิดการเข้าชมหรือไม่มีอยู่ในระบบ"
              actions={<Link href={shopsHref}>กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดแคมเปญได้"
              description="ไม่สามารถดึงข้อมูลล่าสุดได้ ลองใหม่หรือกลับไปเลือกร้านค้า"
              actions={<RecoveryActions backHref="/" backLabel="กลับไปเลือกร้านค้า" onRetry={retryDetail} />}
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
        <nav className={styles.breadcrumbs} aria-label="เส้นทางรอบพรีออเดอร์">
          <Link href={shopsHref}>ร้านค้าทั้งหมด</Link>
          <span aria-hidden="true">/</span>
          <Link href={storeHref(store.organizationId, store.storeId)}>{store.name}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{campaign.name}</span>
        </nav>

        <section className={`${styles.hero} ${styles.campaignHero}`}>
          <div className={styles.heroCopy}>
            <span className={styles.contextLine}>PRE-ORDER / {store.name}</span>
            <h1 tabIndex={-1} className={styles.title}>{campaign.name}</h1>
            <p className={styles.description}>{campaignGuidance[campaign.status]}</p>
            {campaign.status === "OPEN" && products.length > 0 ? (
              <a className={styles.campaignShopAction} href="#campaign-products">
                ดูสินค้าและตรวจสอบตัวเลือก <AppIcon name="arrow-up-right" size={17} />
              </a>
            ) : (
              <p className={styles.campaignClosedHint} role="status">
                {campaign.status === "OPEN"
                  ? "รอบนี้เปิดรับคำสั่งซื้อแต่ยังไม่มีสินค้าให้เลือก โปรดกลับมาตรวจสอบภายหลัง"
                  : "รอบนี้ยังสั่งซื้อเพิ่มไม่ได้ แต่ยังดูรายละเอียดและสินค้าได้"}
              </p>
            )}
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
              {campaign.status === "OPEN"
                ? products.length > 0
                  ? "รอบนี้เปิดรับคำสั่งซื้อ ตรวจสอบสินค้าและตัวเลือกก่อนดำเนินการ"
                  : "เปิดรับคำสั่งซื้อ แต่ยังไม่มีสินค้าในรายการที่เข้าชมได้"
                : campaignGuidance[campaign.status]}
            </p>
            <div className={styles.deadlineSpotlight}>
              <span>ปิดรับคำสั่งซื้อ</span>
              <strong>{formatIsoDateTime(campaign.closeAt)}</strong>
            </div>
            <dl className={styles.campaignFacts}>
              <div>
                <dt className={styles.metaLabel}>สินค้า</dt>
                <dd data-numeric>{products.length}</dd>
              </div>
              <div>
                <dt className={styles.metaLabel}>ร้าน</dt>
                <dd>{store.name}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="schedule-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionKicker}>YOUR TIMELINE / วันสำคัญ</span>
              <h2 className={styles.sectionTitle} id="schedule-heading">
                ช่วงเวลาสำคัญ
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              วันที่เหล่านี้เป็นข้อมูลของแคมเปญปัจจุบัน ใช้ประกอบการวางแผนสั่งซื้อ ชำระเงิน และรับสินค้า
            </p>
          </div>

          <ol className={styles.timeline}>
            <li className={styles.timelineItem}>
              <span className={styles.metaLabel}>เปิดรับคำสั่งซื้อ</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.openAt)}
              </span>
            </li>
            <li className={styles.timelineItem}>
              <span className={styles.metaLabel}>ปิดรับคำสั่งซื้อ</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.closeAt)}
              </span>
            </li>
            <li className={styles.timelineItem}>
              <span className={styles.metaLabel}>กำหนดชำระเงิน</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.paymentDeadline)}
              </span>
            </li>
            <li className={styles.timelineItem}>
              <span className={styles.metaLabel}>วันรับสินค้า</span>
              <span className={styles.metaValue}>
                {formatIsoDateTime(campaign.pickupAt)}
              </span>
            </li>
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="campaign-products">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionKicker}>STORE CATALOG / สินค้าของร้าน</span>
              <h2 className={styles.sectionTitle} id="campaign-products" tabIndex={-1}>
                สินค้าที่เปิดให้เข้าชม
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              รายการนี้เป็นสินค้าของร้าน กรุณาเปิดสินค้าเพื่อตรวจสอบตัวเลือก ราคา และรอบขายที่ใช้สั่งซื้อได้
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
              <EmptyIllustration compact />
              ร้านนี้ยังไม่มีสินค้าที่เปิดให้เข้าชม
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
