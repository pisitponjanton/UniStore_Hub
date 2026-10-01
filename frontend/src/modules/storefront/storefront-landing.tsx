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
          <div className={styles.heroCopy}>
            <span className={styles.contextLabel}>ร้านค้าในมหาวิทยาลัย</span>
            <h1 className={styles.heroTitle}>
              เลือกร้าน เลือกสินค้า แล้วติดตามคำสั่งซื้อจากที่เดียว
            </h1>
            <p className={styles.heroDescription}>
              UniStore Hub รวมร้านค้าและแคมเปญพรีออเดอร์จากหน่วยงาน
              ให้ค้นหาสินค้าและเริ่มสั่งซื้อได้ง่ายขึ้น
            </p>

            {summary ? (
              <div className={styles.heroSummary} role="group" aria-label="สรุปร้านค้าที่เปิดให้เข้าชม">
                <div>
                  <strong data-numeric>{summary.organizationCount}</strong>
                  <span>หน่วยงาน</span>
                </div>
                <div>
                  <strong data-numeric>{summary.storeCount}</strong>
                  <span>ร้านค้า</span>
                </div>
              </div>
            ) : null}
          </div>

          <aside className={styles.heroAside}>
            <span className={styles.heroAsideMarker} aria-hidden="true" />
            <div>
              <strong>เริ่มจากร้านค้าที่ต้องการ</strong>
              <p>
                เลือกร้านเพื่อดูสินค้าและแคมเปญที่กำลังเปิดให้เข้าชม
                จากนั้นระบบจะแจ้งขั้นตอนถัดไปตามสถานะจริงของรายการ
              </p>
            </div>
          </aside>
        </section>

        <section className={styles.catalog} aria-labelledby="storefront-heading">
          <div className={styles.catalogHeader}>
            <div>
              <span className={styles.contextLabel}>เลือกจากหน่วยงาน</span>
              <h2 className={styles.catalogTitle} id="storefront-heading">
                ร้านค้าที่เปิดให้เข้าชม
              </h2>
            </div>
            <p className={styles.catalogDescription}>
              ร้านค้าถูกจัดกลุ่มตามหน่วยงาน เพื่อให้หาแหล่งสินค้าได้เร็วขึ้น
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
                    ) : null}
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
                            {store.description ? (
                              <p className={styles.storeDescription}>
                                {store.description}
                              </p>
                            ) : (
                              <p className={styles.storeDescription}>
                                ดูสินค้าและแคมเปญของร้านนี้
                              </p>
                            )}
                          </div>
                          <span className={styles.storeAction}>เปิดร้าน</span>
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
