"use client";

import { PageLoadingRows, PageStateHeading, RecoveryActions } from "@/components/ui/async-page";

import Link from "next/link";
import { CalendarDays, Store, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { EmptyIllustration, ErrorState, LoadingState } from "@/components";
import { useAuthSession } from "@/modules/auth";
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
  const auth = useAuthSession();
  const shopsHref = auth.status === "authenticated" ? "/shops/" : "/";
  const [state, setState] = useState<StoreViewState>({ status: "loading" });
  const [productQuery, setProductQuery] = useState("");
  const [productSort, setProductSort] = useState<"featured" | "name" | "recent">("featured");
  const [campaignFilter, setCampaignFilter] = useState<"all" | "open">("all");

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
              actions={<Link href={shopsHref}>กลับไปเลือกร้านค้า</Link>}
            />
          ) : null}
          {state.status === "notFound" ? (
            <ErrorState
              title="ไม่พบร้านค้า"
              description="ร้านค้านี้อาจปิดการเข้าชมหรือไม่มีอยู่ในระบบ"
              actions={<Link href={shopsHref}>กลับไปเลือกร้านค้า</Link>}
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
  const matchingCampaigns = orderedCampaigns.filter(campaign => campaignFilter === "all" || campaign.status === "OPEN");
  const normalizedQuery = productQuery.trim().normalize("NFKC").toLocaleLowerCase();
  const matchingProducts = products.filter(product => !normalizedQuery || (product.name + " " + (product.description ?? "")).normalize("NFKC").toLocaleLowerCase().includes(normalizedQuery));
  const visibleProducts = [...matchingProducts];
  if (productSort === "name") visibleProducts.sort((a, b) => a.name.localeCompare(b.name, "th"));
  if (productSort === "recent") visibleProducts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className={styles.page}>
      <StorefrontHeader />

      <main className={`${styles.main} ${styles.storeMain}`}>
        <nav className={styles.breadcrumbs} aria-label="เส้นทางร้านค้า">
          <Link href={shopsHref}>ร้านค้าทั้งหมด</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{store.name}</span>
        </nav>

        <section className={`${styles.hero} ${styles.storeHero}`} aria-label="ข้อมูลร้านค้า">
          <div className={styles.storeIdentity}>
            <span className={styles.storeIdentityMark} aria-hidden="true"><Store size={27} strokeWidth={1.6} /></span>
            <div className={styles.storeIdentityCopy}>
              <span className={styles.storeEyebrow}>ร้านค้าในมหาวิทยาลัย</span>
              <h1 tabIndex={-1} className={styles.title}>{store.name}</h1>
              <p className={styles.description}>
                {store.description || "สำรวจสินค้าจากร้านนี้ และติดตามรอบพรีออเดอร์ที่เปิดรับ"}
              </p>
            </div>
          </div>
          <div className={styles.storeHeroBottom}>
            <div className={styles.storeHeroActions}>
              <p className={styles.storeReadiness} role="status">
                <span className={openCampaigns.length ? styles.readinessDotActive : styles.readinessDot} aria-hidden="true" />
                {openCampaigns.length > 0
                  ? "มี " + openCampaigns.length + " รอบที่เปิดรับคำสั่งซื้อ"
                  : "ยังไม่มีรอบที่เปิดรับคำสั่งซื้อ"}
              </p>
              <nav className={styles.storeQuickLinks} aria-label="ทางลัดไปรายการในร้าน">
                <a href="#product-heading" className={styles.storeQuickLinkPrimary} onClick={(event) => focusStoreSection(event, "product-heading")}>
                  <ShoppingBag size={16} aria-hidden="true" />เลือกดูสินค้า
                </a>
                <a href="#campaign-heading" className={styles.storeQuickLinkSecondary} onClick={(event) => focusStoreSection(event, "campaign-heading")}>
                  ดูรอบพรีออเดอร์
                </a>
              </nav>
            </div>
            <dl className={styles.heroMeta} aria-label="สรุปร้านค้า">
              <div><dt className={styles.metaLabel}>รอบขายทั้งหมด</dt><dd className={styles.metaValue} data-numeric>{campaigns.length}</dd></div>
              <div><dt className={styles.metaLabel}>สินค้า</dt><dd className={styles.metaValue} data-numeric>{products.length}</dd></div>
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
            <>
              <div className={styles.detailToolbar}>
                <p className={styles.detailToolbarCount} role="status">แสดง {matchingCampaigns.length} จาก {campaigns.length} รอบขาย</p>
                <label className={styles.detailToolbarField} htmlFor="store-campaign-filter">
                  สถานะรอบขาย
                  <select id="store-campaign-filter" value={campaignFilter} onChange={event => setCampaignFilter(event.target.value as "all" | "open")}>
                    <option value="all">ทุกรอบขาย</option>
                    <option value="open">เฉพาะรอบที่เปิดรับ</option>
                  </select>
                </label>
              </div>
              {matchingCampaigns.length > 0 ? <div className={styles.cardGrid}>
              {matchingCampaigns.map((campaign) => (
                <CampaignCard
                  campaign={campaign}
                  key={campaign.campaignId}
                />
              ))}
            </div> : <div className={styles.storeCampaignNotice} role="status"><CalendarDays size={22} aria-hidden="true" /><div><strong>ไม่มีรอบที่เปิดรับคำสั่งซื้อในขณะนี้</strong><p>ลองดูรอบขายอื่นของร้านนี้</p></div><button type="button" className={styles.detailReset} onClick={() => setCampaignFilter("all")}>ดูรอบขายทั้งหมด</button></div>}
            </>
          ) : (
            <div className={styles.storeCampaignNotice} role="status">
              <CalendarDays size={22} strokeWidth={1.7} aria-hidden="true" />
              <div>
                <strong>ยังไม่มีรอบพรีออเดอร์ที่เปิดให้เข้าชม</strong>
                <p>ร้านนี้ยังไม่มีแคมเปญที่เปิดให้ลูกค้าเข้าชม</p>
              </div>
              <a href="#product-heading" onClick={(event) => focusStoreSection(event, "product-heading")}>ดูสินค้าในร้าน <span aria-hidden="true">→</span></a>
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
            <>
              <div className={styles.detailToolbar}>
                <p className={styles.detailToolbarCount} role="status">แสดง {matchingProducts.length} จาก {products.length} สินค้า</p>
                <label className={styles.detailToolbarField} htmlFor="store-product-search">
                  ค้นหาสินค้าในร้าน
                  <input id="store-product-search" type="search" value={productQuery} placeholder="ชื่อสินค้าหรือคำอธิบาย" onChange={event => setProductQuery(event.target.value)} />
                </label>
                <label className={styles.detailSortField} htmlFor="store-product-sort">
                  เรียงสินค้า
                  <select id="store-product-sort" value={productSort} onChange={(event) => setProductSort(event.target.value as "featured" | "name" | "recent")}>
                    <option value="featured">ตามลำดับร้านค้า</option>
                    <option value="recent">สินค้าใหม่ล่าสุด</option>
                    <option value="name">ชื่อสินค้า ก–ฮ</option>
                  </select>
                </label>
              </div>
              {matchingProducts.length > 0 ? <div className={`${styles.cardGrid} ${styles.storeCatalogGrid}`}>
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.productId}
                  organizationId={store.organizationId}
                  product={product}
                />
              ))}
            </div> : <div className={styles.emptyBox}><EmptyIllustration compact />ไม่พบสินค้าที่ตรงกับการค้นหา <button type="button" className={styles.detailReset} onClick={() => { setProductQuery(""); document.getElementById("store-product-search")?.focus(); }}>ล้างคำค้นหา</button></div>}
            </>
          ) : (
            <div className={styles.storeCatalogEmpty}>
              <EmptyIllustration compact />
              <div><strong>ยังไม่มีสินค้าในร้าน</strong><p>ร้านนี้ยังไม่มีสินค้าที่เปิดให้เข้าชม</p></div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
