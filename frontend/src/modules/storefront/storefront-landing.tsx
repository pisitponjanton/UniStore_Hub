"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  BrandIllustration,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Skeleton,
} from "@/components";
import { buildAuthPagePath, useAuthSession } from "@/modules/auth";
import {
  buildDirectoryEntries,
  DIRECTORY_PAGE_SIZE,
  filterDirectoryEntries,
  groupDirectoryPage,
  separateAutomationFixtures,
  type DirectoryFilter,
} from "./storefront-directory";
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
  const auth = useAuthSession();
  const [state, setState] = useState<LandingState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<DirectoryFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAutomationFixtures, setShowAutomationFixtures] = useState(false);
  const localQaDirectory = process.env.NODE_ENV === "development";

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
  }, [loadAttempt]);

  const directoryData = useMemo(() => {
    if (state.status !== "success") return [];
    if (!localQaDirectory) return state.data;
    const { regular, fixtures } = separateAutomationFixtures(state.data);
    return showAutomationFixtures ? [...regular, ...fixtures] : regular;
  }, [state, localQaDirectory, showAutomationFixtures]);

  const fixtureCount = useMemo(() => {
    if (!localQaDirectory || state.status !== "success") return 0;
    return separateAutomationFixtures(state.data).fixtures.length;
  }, [state, localQaDirectory]);

  const summary = useMemo(() => {
    if (state.status !== "success") {
      return null;
    }

    return {
      organizationCount: directoryData.length,
      storeCount: directoryData.reduce(
        (total, organization) => total + organization.stores.length,
        0,
      ),
    };
  }, [state, directoryData]);

  const discoveryStores = useMemo(() => {
    if (state.status !== "success") {
      return [];
    }

    return directoryData
      .flatMap(({ organization, stores }) =>
        stores.map((store) => ({ organization, store })),
      )
      .slice(0, 4);
  }, [state, directoryData]);

  const directoryEntries = useMemo(
    () => buildDirectoryEntries(directoryData),
    [directoryData],
  );
  const filteredEntries = useMemo(
    () => filterDirectoryEntries(directoryEntries, searchQuery, availabilityFilter),
    [directoryEntries, searchQuery, availabilityFilter],
  );
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / DIRECTORY_PAGE_SIZE));
  const start = (currentPage - 1) * DIRECTORY_PAGE_SIZE;
  const visibleEntries = filteredEntries.slice(start, start + DIRECTORY_PAGE_SIZE);
  const directoryGroups = groupDirectoryPage(visibleEntries);
  const resultStoreCount = filteredEntries.filter((entry) => entry.store !== null).length;
  const resultEmptyOrganizationCount = filteredEntries.length - resultStoreCount;
  const hasActiveFilters = searchQuery.trim().length > 0 || availabilityFilter !== "all";

  function clearFilters() {
    setSearchQuery("");
    setAvailabilityFilter("all");
    setCurrentPage(1);
    document.getElementById("storefront-search")?.focus();
  }

  function goToPage(nextPage: number) {
    setCurrentPage(nextPage);
    document.getElementById("storefront-heading")?.focus();
  }

  return (
    <div className={styles.page} data-filtering={hasActiveFilters ? "true" : "false"}>
      <StorefrontHeader />

      <main>
        <section className={styles.hero} data-filtering={hasActiveFilters ? "true" : "false"} aria-labelledby="storefront-intro-heading">
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
              {auth.status === "loading" ? (
                <span
                  className={`${styles.heroSecondaryAction} ${styles.heroSecondaryActionPending}`}
                  role="status"
                  aria-live="polite"
                >
                  กำลังตรวจสอบบัญชี
                </span>
              ) : (
                <Link
                  className={styles.heroSecondaryAction}
                  href={
                    auth.status === "authenticated"
                      ? "/my/orders/"
                      : buildAuthPagePath("/login/", "/my/orders/")
                  }
                >
                  ติดตามคำสั่งซื้อ
                </Link>
              )}
            </div>

            <form
              className={styles.heroSearch}
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                document.getElementById("storefront-heading")?.focus();
              }}
            >
              <div className={styles.searchField}>
                <label htmlFor="storefront-search">ค้นหาร้านค้าหรือหน่วยงาน</label>
                <input
                  id="storefront-search"
                  type="search"
                  autoComplete="off"
                  placeholder="พิมพ์ชื่อร้านหรือหน่วยงาน"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className={styles.filterField}>
                <label htmlFor="storefront-filter">แสดงรายการ</label>
                <select
                  id="storefront-filter"
                  value={availabilityFilter}
                  onChange={(event) => {
                    setAvailabilityFilter(event.target.value as DirectoryFilter);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="with-stores">ร้านค้าที่เปิดอยู่</option>
                  <option value="without-stores">หน่วยงานที่ยังไม่มีร้าน</option>
                </select>
              </div>
              <a className={styles.searchJump} href="#storefront-heading">
                ดูผลลัพธ์
              </a>
            </form>

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

          <div className={styles.heroScene} aria-hidden="true">
            <BrandIllustration
              variant="market"
              className={styles.heroSceneIllustration}
              decorative
            />
          </div>

        </section>

        {!hasActiveFilters ? (
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
        ) : null}

        {state.status === "success" && !hasActiveFilters && discoveryStores.length > 0 ? (
          <section
            className={styles.discovery}
            aria-labelledby="storefront-discovery-heading"
          >
            <div className={styles.discoveryHeader}>
              <div>
                <span className={styles.discoveryLabel}>เริ่มสำรวจ</span>
                <h2
                  className={styles.discoveryTitle}
                  id="storefront-discovery-heading"
                >
                  เลือกร้านจากพื้นที่ที่เปิดอยู่
                </h2>
              </div>
              <a className={styles.discoveryJump} href="#storefront-heading">
                ดูทุกร้าน
              </a>
            </div>

            <div className={styles.discoveryGrid}>
              {discoveryStores.map(({ organization, store }, index) => (
                <Link
                  key={store.storeId}
                  href={storeHref(organization.organizationId, store.storeId)}
                  className={styles.discoveryCard}
                  data-size={index === 0 ? "feature" : "standard"}
                >
                  <span className={styles.discoveryCardIndex} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className={styles.discoveryCardBody}>
                    <span className={styles.discoveryOrganization}>
                      {organization.name}
                    </span>
                    <h3 className={styles.discoveryStoreName}>{store.name}</h3>
                    <p className={styles.discoveryStoreDescription}>
                      {store.description || "ดูสินค้าและแคมเปญของร้านนี้"}
                    </p>
                  </div>
                  <span className={styles.discoveryCardAction}>เข้าร้าน</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.catalog} aria-labelledby="storefront-heading">
          <div className={styles.catalogHeader}>
            <div>
              <h2 className={styles.catalogTitle} id="storefront-heading" tabIndex={-1}>
                ร้านที่เปิดให้เข้าชม
              </h2>
            </div>
            <p className={styles.catalogDescription}>
              เริ่มจากหน่วยงานที่รู้จัก หรือไล่ดูร้านที่กำลังเปิดให้เข้าชมได้จากรายการด้านล่าง
            </p>
          </div>

          {state.status === "success" ? (
            <>
              <div className={styles.directoryResultsHeader}>
                <p className={styles.resultSummary} role="status" aria-live="polite" aria-atomic="true">
                  พบ {resultStoreCount} ร้าน
                  {resultEmptyOrganizationCount > 0
                    ? ` และ ${resultEmptyOrganizationCount} หน่วยงานที่ยังไม่มีร้าน`
                    : ""}
                  {filteredEntries.length > 0
                    ? ` · แสดง ${start + 1}–${start + visibleEntries.length} จาก ${filteredEntries.length} รายการ`
                    : ""}
                </p>
                {fixtureCount > 0 ? (
                  <button
                    className={styles.clearFilters}
                    type="button"
                    aria-pressed={showAutomationFixtures}
                    onClick={() => {
                      setShowAutomationFixtures((current) => !current);
                      setCurrentPage(1);
                    }}
                  >
                    {showAutomationFixtures
                      ? "ซ่อนข้อมูล E2E/QA"
                      : `แสดงข้อมูล E2E/QA (${fixtureCount} หน่วยงาน)`}
                  </button>
                ) : null}
                {hasActiveFilters ? (
                  <button className={styles.clearFilters} type="button" onClick={clearFilters}>
                    ล้างตัวกรอง
                  </button>
                ) : null}
              </div>

              {filteredEntries.length === 0 ? (
                <div className={styles.directoryEmpty}>
                  <h3>ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา</h3>
                  <p>ลองเปลี่ยนชื่อที่ค้นหา หรือเลือกตัวกรองอื่น</p>
                  <button className={styles.clearFilters} type="button" onClick={clearFilters}>
                    แสดงรายการทั้งหมด
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.organizationList} aria-label="ผลการค้นหาร้านค้าและหน่วยงาน">
                    {directoryGroups.map(({ organization, stores, totalStores }) => (
                      <section className={styles.organization} key={organization.organizationId}>
                        <div className={styles.organizationInfo}>
                          <div>
                            <div className={styles.organizationHeading}>
                              <h3 className={styles.organizationName}>{organization.name}</h3>
                              <span className={styles.storeCount} data-numeric>
                                {stores.length === totalStores
                                  ? `${totalStores} ร้าน`
                                  : `แสดง ${stores.length} จาก ${totalStores} ร้าน`}
                              </span>
                            </div>
                            <p className={styles.organizationDescription}>
                              {organization.description || "เลือกร้านของหน่วยงานนี้เพื่อดูสินค้าและรอบขาย"}
                            </p>
                          </div>
                        </div>

                        {stores.length > 0 ? (
                          <div className={styles.storeList}>
                            {stores.map((store) => (
                              <Link
                                key={store.storeId}
                                href={storeHref(organization.organizationId, store.storeId)}
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

                  {pageCount > 1 ? (
                    <nav className={styles.directoryPagination} aria-label="การแบ่งหน้ารายการร้านค้า">
                      <button
                        className={styles.pageButton}
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => goToPage(currentPage - 1)}
                      >
                        ก่อนหน้า
                      </button>
                      <span className={styles.pageIndicator} aria-live="polite" data-numeric>
                        หน้า {currentPage} จาก {pageCount}
                      </span>
                      <button
                        className={styles.pageButton}
                        type="button"
                        disabled={currentPage === pageCount}
                        onClick={() => goToPage(currentPage + 1)}
                      >
                        ถัดไป
                      </button>
                    </nav>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </section>

        {state.status === "loading" ? (
          <div className={styles.loadingArea}>
            <div className={styles.loadingPreview} aria-hidden="true">
              <Skeleton shape="block" className={styles.loadingFeature} />
              <div className={styles.loadingStack}>
                <Skeleton shape="block" className={styles.loadingCard} />
                <Skeleton shape="block" className={styles.loadingCard} />
              </div>
            </div>
            <div className={styles.stateWrap}>
              <LoadingState
                title="กำลังโหลดร้านค้า"
                description="กำลังเตรียมรายการหน่วยงานและร้านค้าที่เปิดให้เข้าชม"
              />
            </div>
          </div>
        ) : null}

        {state.status === "empty" ? (
          <div className={styles.stateWrap}>
            <EmptyState
              title="ยังไม่มีร้านค้าที่เปิดให้เข้าชม"
              media={<BrandIllustration variant="market" decorative />}
              description="เมื่อมีร้านค้าที่พร้อมให้ลูกค้าเข้าชม รายการจะปรากฏที่หน้านี้"
            />
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className={styles.stateWrap}>
            <ErrorState
              title="ไม่สามารถโหลดร้านค้าได้"
              description="กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"
              actions={
                <Button
                  onClick={() => {
                    setState({ status: "loading" });
                    setLoadAttempt((attempt) => attempt + 1);
                  }}
                >
                  ลองโหลดอีกครั้ง
                </Button>
              }
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
