"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components";

import { StorefrontHeader } from "./storefront-header";
import styles from "./storefront-landing.module.css";
import {
  storefrontService,
  type StorefrontLandingOrganization,
} from "./storefront-service";

type LandingState =
  | { status: "loading" }
  | { status: "success"; data: StorefrontLandingOrganization[] }
  | { status: "empty" }
  | { status: "error" };

function storeHref(organizationId: string, storeId: string): string {
  const params = new URLSearchParams({
    organizationId,
    storeId,
  });

  return `/stores/view/?${params.toString()}`;
}

export function StorefrontLanding() {
  const [state, setState] = useState<LandingState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    void storefrontService
      .getLanding({ signal: controller.signal })
      .then((data) => {
        setState(
          data.length === 0
            ? { status: "empty" }
            : { status: "success", data },
        );
      })
      .catch((error) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setState({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  const summary = useMemo(() => {
    if (state.status !== "success") {
      return null;
    }

    return {
      organizationCount: state.data.length,
      storeCount: state.data.reduce(
        (total, organization) => total + organization.stores.length,
        0,
      ),
    };
  }, [state]);

  return (
    <div className={styles.page}>
      <StorefrontHeader />

      <main>
        <section className={styles.hero} aria-labelledby="storefront-intro-heading">
          <div className={styles.heroMain}>
            <h1 className={styles.heroTitle} id="storefront-intro-heading">
              เลือกซื้อจากร้านในมหาวิทยาลัย
            </h1>
            <p className={styles.heroDescription}>
              เลือกหน่วยงานและร้านที่ต้องการ ดูสินค้าและรอบพรีออเดอร์
              จากนั้นติดตามการชำระเงินและการรับสินค้าได้จากคำสั่งซื้อของคุณ
            </p>

            <div className={styles.heroActions}>
              <a className={styles.heroPrimaryAction} href="#storefront-heading">
                ดูร้านที่เปิดอยู่
              </a>
              <Link className={styles.heroSecondaryAction} href="/my/orders/">
                ติดตามคำสั่งซื้อ
              </Link>
            </div>

            {summary ? (
              <dl className={styles.heroSummary} aria-label="สรุปร้านค้าที่เปิดให้เข้าชม">
                <div>
                  <dt>ร้านที่เปิดให้เข้าชม</dt>
                  <dd data-numeric>{summary.storeCount}</dd>
                </div>
                <div>
                  <dt>หน่วยงาน</dt>
                  <dd data-numeric>{summary.organizationCount}</dd>
                </div>
              </dl>
            ) : null}
          </div>

          <aside className={styles.heroGuide} aria-labelledby="storefront-guide-heading">
            <h2 className={styles.heroGuideTitle} id="storefront-guide-heading">
              ซื้อและติดตามในที่เดียว
            </h2>
            <ol className={styles.heroGuideList}>
              <li>
                <strong>เลือกร้าน</strong>
                <span>เริ่มจากหน่วยงานและร้านที่เปิดให้เข้าชม</span>
              </li>
              <li>
                <strong>ดูสินค้าและรอบขาย</strong>
                <span>ตรวจสอบตัวเลือก ราคา และช่วงเวลาของแคมเปญก่อนสั่ง</span>
              </li>
              <li>
                <strong>ติดตามหลังสั่งซื้อ</strong>
                <span>ดูสถานะคำสั่งซื้อ การชำระเงิน และการรับสินค้าในบัญชีของคุณ</span>
              </li>
            </ol>
          </aside>
        </section>

        <section className={styles.catalog} aria-labelledby="storefront-heading">
          <div className={styles.catalogHeader}>
            <div>
              <h2 className={styles.catalogTitle} id="storefront-heading">
                ร้านที่เปิดให้เข้าชม
              </h2>
            </div>
            <p className={styles.catalogDescription}>
              เริ่มจากหน่วยงานที่รู้จัก หรือไล่ดูร้านที่กำลังเปิดให้เข้าชมได้จากรายการด้านล่าง
            </p>
          </div>

          {state.status === "success" ? (
            <div className={styles.organizationList}>
              {state.data.map(({ organization, stores }) => (
                <section
                  className={styles.organization}
                  key={organization.organizationId}
                >
                  <div className={styles.organizationInfo}>
                    <div>
                      <div className={styles.organizationHeading}>
                        <h3 className={styles.organizationName}>
                          {organization.name}
                        </h3>
                        <span className={styles.storeCount} data-numeric>
                          {stores.length} ร้าน
                        </span>
                      </div>
                      {organization.description ? (
                        <p className={styles.organizationDescription}>
                          {organization.description}
                        </p>
                      ) : (
                        <p className={styles.organizationDescription}>
                          เลือกร้านของหน่วยงานนี้เพื่อดูสินค้าและรอบขาย
                        </p>
                      )}
                    </div>
                  </div>

                  {stores.length > 0 ? (
                    <div className={styles.storeList}>
                      {stores.map((store) => (
                        <Link
                          key={store.storeId}
                          href={storeHref(
                            organization.organizationId,
                            store.storeId,
                          )}
                          className={styles.storeRow}
                        >
                          <div className={styles.storeRowCopy}>
                            <h4 className={styles.storeName}>{store.name}</h4>
                            <p className={styles.storeDescription}>
                              {store.description || "ดูสินค้าและแคมเปญของร้านนี้"}
                            </p>
                          </div>
                          <span className={styles.storeAction}>เข้าร้าน</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.noStores}>
                      หน่วยงานนี้ยังไม่มีร้านค้าที่เปิดให้เข้าชม
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : null}
        </section>

        {state.status === "loading" ? (
          <div className={styles.stateWrap}>
            <LoadingState
              title="กำลังโหลดร้านค้า"
              description="กำลังเตรียมรายการหน่วยงานและร้านค้าที่เปิดให้เข้าชม"
            />
          </div>
        ) : null}

        {state.status === "empty" ? (
          <div className={styles.stateWrap}>
            <EmptyState
              title="ยังไม่มีร้านค้าที่เปิดให้เข้าชม"
              description="เมื่อมีร้านค้าที่พร้อมให้ลูกค้าเข้าชม รายการจะปรากฏที่หน้านี้"
            />
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className={styles.stateWrap}>
            <ErrorState
              title="ไม่สามารถโหลดร้านค้าได้"
              description="กรุณาตรวจสอบการเชื่อมต่อแล้วลองโหลดหน้านี้ใหม่"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
