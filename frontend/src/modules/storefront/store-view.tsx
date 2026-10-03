"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

type StoreViewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "error" }
  | { status: "success"; data: StorefrontStoreView };

export function StoreView() {
  const [state, setState] = useState<StoreViewState>({ status: "loading" });

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
  }, []);

  if (state.status !== "success") {
    return (
      <div className={styles.page}>
        <StorefrontHeader />
        <main className={styles.stateWrap}>
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
              description="กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง"
              actions={<Link href="/">กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const { store, products, campaigns } = state.data;

  return (
    <div className={styles.page}>
      <StorefrontHeader />

      <main className={styles.main}>
        <Link href="/" className={styles.backLink}>
          ร้านค้าทั้งหมด
        </Link>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.title}>{store.name}</h1>
            {store.description ? (
              <p className={styles.description}>{store.description}</p>
            ) : (
              <p className={styles.description}>
                เลือกดูสินค้าและแคมเปญที่ร้านนี้เปิดให้เข้าชม
              </p>
            )}
          </div>

          <dl className={styles.heroMeta} aria-label="สรุปร้านค้า">
            <div>
              <dt className={styles.metaLabel}>แคมเปญ</dt>
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
        </section>

        <section className={styles.section} aria-labelledby="campaign-heading">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="campaign-heading">
                แคมเปญของร้าน
              </h2>
            </div>
            <p className={styles.sectionDescription}>
              ดูสถานะและช่วงเวลาของแต่ละแคมเปญก่อนเลือกสินค้า
            </p>
          </div>

          {campaigns.length > 0 ? (
            <div className={styles.cardGrid}>
              {campaigns.map((campaign) => (
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
              <h2 className={styles.sectionTitle} id="product-heading">
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
