"use client";

import { PageLoadingRows, PageStateHeading, RecoveryActions } from "@/components/ui/async-page";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { ErrorState, LoadingState } from "@/components";
import { ApiClientError } from "@/services";
import { getRequiredQueryId } from "@/utils";

import {
  CampaignCard,
  ProductCard,
} from "./storefront-presenters";
import { StorefrontHeader } from "./storefront-header";
import styles from "./storefront-view.module.css";
import {
  storefrontService,
  type StorefrontStoreView,
} from "./storefront-service";

/**
 * Scroll to store sections without adding a fragment history entry.
 * A fragment history entry can prevent Next's client navigation state from
 * restoring the Store view after visiting an item and pressing Back.
 */
function focusStoreSection(
  event: MouseEvent<HTMLAnchorElement>,
  headingId: "campaign-heading" | "product-heading",
) {
  const heading = document.getElementById(headingId);
  if (!heading) return;

  event.preventDefault();
  heading.scrollIntoView({ behavior: "auto", block: "start" });
  heading.focus({ preventScroll: true });
}

type StoreViewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "error" }
  | { status: "success"; data: StorefrontStoreView };

export function StoreView() {
  const [state, setState] = useState<StoreViewState>({ status: "loading" });

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

    async function loadStore() {
      const params = new URLSearchParams(window.location.search);
      const organizationId = getRequiredQueryId(params, "organizationId");
      const storeId = getRequiredQueryId(params, "storeId");

      if (!organizationId.ok || !storeId.ok) {
        await Promise.resolve();

        if (!controller.signal.aborted) {
          setState({ status: "invalid" });
        }
        return;
      }

      try {
        const data = await storefrontService.getStoreView(
          organizationId.value,
          storeId.value,
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

    void loadStore();

    return () => controller.abort();
  }, [retryAttempt]);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.stateWrap} tabIndex={-1}>
          <PageStateHeading title="รายละเอียดร้านค้า" description="เลือกร้านค้าและตรวจสอบรายการที่เปิดให้เข้าชม" />
          {state.status === "loading" ? <PageLoadingRows /> : null}
          {state.status === "loading" ? (
            <LoadingState title="กำลังโหลดร้านค้า" />
          ) : null}
          {state.status === "invalid" ? (
            <ErrorState
              title="ลิงก์ร้านค้าไม่สมบูรณ์"
              description="ลิงก์ร้านค้านี้ไม่ครบถ้วน กรุณากลับไปเลือกร้านค้าใหม่"
              actions={<Link href="/">กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบร้านค้า"
              description="ร้านค้านี้อาจปิดการเข้าชมหรือไม่มีอยู่ในระบบ"
              actions={<Link href="/">กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "error" ? (
            <ErrorState
              title="ไม่สามารถโหลดร้านค้าได้"
              description="ไม่สามารถดึงข้อมูลล่าสุดได้ ลองใหม่หรือกลับไปเลือกร้านค้า"
              actions={<RecoveryActions backHref="/" backLabel="กลับไปเลือกร้านค้า" onRetry={retryDetail} />}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { store, products, campaigns } = state.data;
  const openCampaigns = campaigns.filter((campaign) => campaign.status === "OPEN");
  const orderedCampaigns = [
    ...openCampaigns,
    ...campaigns.filter((campaign) => campaign.status !== "OPEN"),
  ];

  return (
    <div className={styles.page}>
      <StorefrontHeader />

      <main className={`${styles.main} ${styles.storeMain}`}>
        <nav className={styles.breadcrumbs} aria-label="เส้นทางร้านค้า">
          <Link href="/">ร้านค้าทั้งหมด</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{store.name}</span>
        </nav>

        <section className={`${styles.hero} ${styles.storeHero}`}>
          <div className={styles.heroCopy}>
            <h1 tabIndex={-1} className={styles.title}>{store.name}</h1>
            {store.description ? (
              <p className={styles.description}>{store.description}</p>
            ) : (
              <p className={styles.description}>
                เลือกดูสินค้าและแคมเปญที่ร้านนี้เปิดให้เข้าชม
              </p>
            )}
            <p className={styles.storeReadiness} role="status">
              <span className={openCampaigns.length ? styles.readinessDotActive : styles.readinessDot} aria-hidden="true" />
              {openCampaigns.length > 0
                ? "มี " + openCampaigns.length + " รอบที่เปิดรับคำสั่งซื้อ"
                : "ยังไม่มีรอบที่เปิดรับคำสั่งซื้อ ตรวจสอบรายการสินค้าที่ร้านมีได้"}
            </p>
            <nav className={styles.storeQuickLinks} aria-label="ทางลัดไปรายการในร้าน">
              <a href="#campaign-heading" className={styles.storeQuickLinkPrimary} onClick={(event) => focusStoreSection(event, "campaign-heading")}>
                ดูรอบพรีออเดอร์
              </a>
              <a href="#product-heading" className={styles.storeQuickLinkSecondary} onClick={(event) => focusStoreSection(event, "product-heading")}>
                เลือกดูสินค้า
              </a>
            </nav>
          </div>

          <div className={styles.storeHeroAside}>
            <dl className={styles.heroMeta} aria-label="สรุปร้านค้า">
            <div>
              <dt className={styles.metaLabel}>รอบขายทั้งหมด</dt>
              <dd className={styles.metaValue} data-numeric>
                {campaigns.length}
              </dd>
            </div>
            <div>
              <dt className={styles.metaLabel}>สินค้า</dt>
              <dd className={styles.metaValue} data-numeric>
                {products.length}
              </dd>
            </div>
            </dl>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="campaign-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionKicker}>PRE-ORDER / รอบที่เปิดให้เข้าชม</span>
              <h2 className={styles.sectionTitle} id="campaign-heading" tabIndex={-1}>
                รอบพรีออเดอร์ของร้าน
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              ดูสถานะและช่วงเวลาของแต่ละแคมเปญก่อนเลือกสินค้า
            </p>
          </div>

          {campaigns.length > 0 ? (
            <div className={styles.cardGrid}>
              {orderedCampaigns.map((campaign) => (
                <CampaignCard
                  campaign={campaign}
                  key={campaign.campaignId}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyBox}>
              ร้านนี้ยังไม่มีแคมเปญที่เปิดให้ลูกค้าเข้าชม
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby="product-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionKicker}>CATALOG / สินค้าที่มีให้ดู</span>
              <h2 className={styles.sectionTitle} id="product-heading" tabIndex={-1}>
                สินค้าของร้าน
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              เปิดสินค้าเพื่อดูตัวเลือก ราคา และแคมเปญที่ใช้สั่งซื้อได้
            </p>
          </div>

          {products.length > 0 ? (
            <div className={styles.cardGrid}>
              {products.map((product) => (
                <ProductCard
                  key={product.productId}
                  organizationId={store.organizationId}
                  product={product}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyBox}>
              ร้านนี้ยังไม่มีสินค้าที่เปิดให้เข้าชม
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
