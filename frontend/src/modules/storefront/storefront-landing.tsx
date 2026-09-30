"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components";
import { useAuthSession } from "@/modules/auth";

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
  const auth = useAuthSession();
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            <span>UniStore Hub</span>
          </Link>

          <nav className={styles.headerActions} aria-label="บัญชีผู้ใช้">
            {auth.status === "authenticated" ? (
              <>
                <Link href="/my/orders/" className={styles.headerLink}>
                  คำสั่งซื้อของฉัน
                </Link>
                <Link href="/notifications/" className={styles.headerPrimary}>
                  การแจ้งเตือน
                </Link>
              </>
            ) : (
              <>
                <Link href="/login/" className={styles.headerLink}>
                  เข้าสู่ระบบ
                </Link>
                <Link href="/register/" className={styles.headerPrimary}>
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>University storefront</span>
            <h1 className={styles.heroTitle}>UniStore Hub</h1>
            <p className={styles.heroDescription}>
              รวมร้านค้าและพรีออเดอร์จากหน่วยงานในมหาวิทยาลัย
              เพื่อให้ค้นหาร้าน เลือกสินค้า และติดตามคำสั่งซื้อได้จากที่เดียว
            </p>
          </div>

          <aside className={styles.heroAside}>
            <span className={styles.heroAsideTitle}>
              ร้านค้าที่เปิดใช้งานเท่านั้น
            </span>
            <p className={styles.heroAsideText}>
              หน้านี้อ่านข้อมูลสาธารณะจาก Storefront API เท่านั้น
              การสั่งซื้อจะขอให้เข้าสู่ระบบเมื่อจำเป็น
            </p>
          </aside>
        </section>

        <section className={styles.catalog} aria-labelledby="storefront-heading">
          <div className={styles.catalogHeader}>
            <div>
              <span className={styles.eyebrow}>Browse</span>
              <h2 className={styles.catalogTitle} id="storefront-heading">
                ร้านค้าจากหน่วยงาน
              </h2>
            </div>
            <p className={styles.catalogDescription}>
              เลือกหน่วยงานและร้านค้าเพื่อดูสินค้าและแคมเปญที่เปิดให้ลูกค้าเข้าถึง
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
                    <h3 className={styles.organizationName}>
                      {organization.name}
                    </h3>
                    {organization.description ? (
                      <p className={styles.organizationDescription}>
                        {organization.description}
                      </p>
                    ) : null}
                  </div>

                  {stores.length > 0 ? (
                    <div className={styles.storeGrid}>
                      {stores.map((store) => (
                        <Link
                          key={store.storeId}
                          href={storeHref(
                            organization.organizationId,
                            store.storeId,
                          )}
                          className={styles.storeCard}
                        >
                          <div>
                            <h4 className={styles.storeName}>{store.name}</h4>
                            {store.description ? (
                              <p className={styles.storeDescription}>
                                {store.description}
                              </p>
                            ) : null}
                          </div>
                          <span className={styles.storeAction}>ดูร้านค้า</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.noStores}>
                      หน่วยงานนี้ยังไม่มีร้านค้าที่เปิดใช้งาน
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
              description="กำลังดึงหน่วยงานและร้านค้าที่เปิดให้เข้าชม"
            />
          </div>
        ) : null}

        {state.status === "empty" ? (
          <div className={styles.stateWrap}>
            <EmptyState
              title="ยังไม่มีร้านค้าที่เปิดให้เข้าชม"
              description="เมื่อมีหน่วยงานและร้านค้าที่เปิดใช้งาน รายการจะปรากฏที่หน้านี้"
            />
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className={styles.stateWrap}>
            <ErrorState
              title="ไม่สามารถโหลดหน้าร้านค้าได้"
              description="กรุณาตรวจสอบการเชื่อมต่อแล้วลองโหลดหน้านี้ใหม่"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
