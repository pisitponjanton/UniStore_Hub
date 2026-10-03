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
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <span className={styles.heroKicker}>ตลาดของชุมชนมหาวิทยาลัย</span>
            <h1 className={styles.heroTitle}>
              ของที่อยากได้
              <span> จากร้านที่อยู่ใกล้ตัวคุณ</span>
            </h1>
            <p className={styles.heroDescription}>
              เลือกร้าน ดูรอบพรีออเดอร์ และติดตามคำสั่งซื้อจากหน่วยงานในมหาวิทยาลัย
              ด้วยสถานะที่อ่านง่ายตั้งแต่เริ่มสั่งจนถึงรับสินค้า
            </p>
          </div>

          <div className={styles.heroRail} aria-label="วิธีเริ่มใช้งาน">
            <div className={styles.heroRailItem}>
              <span className={styles.heroRailIndex}>01</span>
              <div>
                <strong>เลือกร้าน</strong>
                <span>ดูร้านที่เปิดให้เข้าชมตามหน่วยงาน</span>
              </div>
            </div>
            <div className={styles.heroRailItem}>
              <span className={styles.heroRailIndex}>02</span>
              <div>
                <strong>ดูรอบขาย</strong>
                <span>เช็กแคมเปญ ราคา และช่วงเวลาที่เกี่ยวข้อง</span>
              </div>
            </div>
            <div className={styles.heroRailItem}>
              <span className={styles.heroRailIndex}>03</span>
              <div>
                <strong>ติดตามต่อ</strong>
                <span>ชำระเงินและดูสถานะรับสินค้าจากบัญชีเดียว</span>
              </div>
            </div>
          </div>

          {summary ? (
            <div className={styles.heroSummary} role="group" aria-label="สรุปร้านค้าที่เปิดให้เข้าชม">
              <div>
                <strong data-numeric>{summary.storeCount}</strong>
                <span>ร้านที่เปิดให้เข้าชม</span>
              </div>
              <div>
                <strong data-numeric>{summary.organizationCount}</strong>
                <span>หน่วยงาน</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.catalog} aria-labelledby="storefront-heading">
          <div className={styles.catalogHeader}>
            <div>
              <span className={styles.sectionKicker}>ร้านค้าใน UniStore Hub</span>
              <h2 className={styles.catalogTitle} id="storefront-heading">
                เลือกร้านตามหน่วยงาน
              </h2>
            </div>
            <p className={styles.catalogDescription}>
              เริ่มจากหน่วยงานที่รู้จัก หรือไล่ดูร้านที่กำลังเปิดให้เข้าชมได้จากรายการด้านล่าง
            </p>
          </div>

          {state.status === "success" ? (
            <div className={styles.organizationList}>
              {state.data.map(({ organization, stores }, organizationIndex) => (
                <section
                  className={styles.organization}
                  key={organization.organizationId}
                >
                  <div className={styles.organizationInfo}>
                    <span className={styles.organizationIndex} data-numeric>
                      {String(organizationIndex + 1).padStart(2, "0")}
                    </span>
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
                          <span className={styles.storeMarker} aria-hidden="true" />
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
