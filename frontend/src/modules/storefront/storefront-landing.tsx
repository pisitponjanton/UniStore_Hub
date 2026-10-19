"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, EmptyState, ErrorState, LoadingState, Skeleton } from "@/components";
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
import { storefrontService, type StorefrontLandingOrganization } from "./storefront-service";
import styles from "./storefront-landing.module.css";

type LandingState =
  | { status: "loading" }
  | { status: "success"; data: StorefrontLandingOrganization[] }
  | { status: "empty" }
  | { status: "error" };

function storeHref(organizationId: string, storeId: string): string {
  const params = new URLSearchParams({ organizationId, storeId });
  return "/stores/view/?" + params.toString();
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
    void storefrontService.getLanding({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState(data.length === 0 ? { status: "empty" } : { status: "success", data });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
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

  const directoryEntries = useMemo(() => buildDirectoryEntries(directoryData), [directoryData]);
  const availableStores = useMemo(
    () => directoryEntries.filter((entry) => entry.store !== null),
    [directoryEntries],
  );
  const featured = availableStores[0];
  const recommendedStores = availableStores.slice(1, 4);
  const summary = state.status === "success"
    ? { organizations: directoryData.length, stores: availableStores.length }
    : null;

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

  const orderTrackingPath = auth.status === "authenticated"
    ? "/my/orders/"
    : buildAuthPagePath("/login/", "/my/orders/");

  return (
    <div className={styles.page} data-filtering={hasActiveFilters ? "true" : "false"}>
      <StorefrontHeader />
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="storefront-intro-heading">
          <div className={styles.heroMain}>
            <span className={styles.heroEyebrow}>UNISTORE HUB / CAMPUS MARKETPLACE</span>
            <h1 className={styles.heroTitle} id="storefront-intro-heading">
              ร้านค้าและพรีออเดอร์<br />ในมหาวิทยาลัย
            </h1>
            <p className={styles.heroDescription}>
              เลือกซื้อสินค้าจากร้านของหน่วยงานและชมรม ดูรอบพรีออเดอร์
              แล้วติดตามการชำระเงินและการรับสินค้าได้ในที่เดียว
            </p>
            <div className={styles.heroActions}>
              <a className={styles.heroPrimaryAction} href="#storefront-heading">
                เลือกดูร้านค้า <span aria-hidden="true">↗</span>
              </a>
              {auth.status === "loading" ? (
                <span className={styles.heroSecondaryActionPending} role="status" aria-live="polite">
                  กำลังตรวจสอบบัญชี
                </span>
              ) : (
                <Link className={styles.heroSecondaryAction} href={orderTrackingPath}>
                  ติดตามคำสั่งซื้อ <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
            <div className={styles.heroFootnote}>
              <span className={styles.heroFootnoteMark} aria-hidden="true" />
              ร้านค้าและรอบขายขึ้นอยู่กับแต่ละหน่วยงาน ตรวจสอบรายละเอียดก่อนสั่งทุกครั้ง
            </div>
          </div>
          {featured?.store ? (
            <Link
              className={styles.heroSpotlight}
              href={storeHref(featured.organization.organizationId, featured.store.storeId)}
              aria-label={"เข้าร้าน " + featured.store.name}
            >
              <span className={styles.heroSpotlightEyebrow}>พบร้านค้าที่เปิดให้เข้าชม</span>
              <span className={styles.heroSpotlightMonogram} aria-hidden="true">
                {featured.store.name.trim().slice(0, 1)}
              </span>
              <span className={styles.heroSpotlightOrganization}>{featured.organization.name}</span>
              <strong className={styles.heroSpotlightName}>{featured.store.name}</strong>
              <span className={styles.heroSpotlightDescription}>
                {featured.store.description || "เลือกดูสินค้าและรอบพรีออเดอร์ของร้านนี้"}
              </span>
              <span className={styles.heroSpotlightAction}>เข้าชมหน้าร้าน <span aria-hidden="true">↗</span></span>
            </Link>
          ) : (
            <div className={styles.heroAside} aria-label="วิธีใช้ UniStore Hub">
              <span className={styles.heroAsideLabel}>HOW IT WORKS</span>
              <ol className={styles.heroAsideSteps}>
                <li><span>01</span><strong>เลือกร้านค้า</strong><small>ดูร้านและสินค้าที่เปิดให้เข้าชม</small></li>
                <li><span>02</span><strong>สั่งพรีออเดอร์</strong><small>ตรวจราคาและช่วงเวลารับคำสั่งซื้อ</small></li>
                <li><span>03</span><strong>ติดตามและรับสินค้า</strong><small>ดูสถานะจากบัญชีของคุณ</small></li>
              </ol>
            </div>
          )}
        </section>

        <section className={styles.finder} aria-label="ค้นหาและกรองร้านค้า">
          <div className={styles.finderHeading}>
            <span className={styles.finderKicker}>ค้นพบร้านค้า</span>
            <strong>หาร้านที่อยากซื้อ</strong>
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
                placeholder="ชื่อร้าน หรือชื่อหน่วยงาน"
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
                <option value="all">ทุกรายการ</option>
                <option value="with-stores">ร้านค้าที่เปิดอยู่</option>
                <option value="without-stores">หน่วยงานที่ยังไม่มีร้าน</option>
              </select>
            </div>
            <button className={styles.searchJump} type="submit">ดูผลลัพธ์ <span aria-hidden="true">↗</span></button>
          </form>
          {summary ? (
            <p className={styles.finderSummary} role="status">
              มีร้านค้า <strong data-numeric>{summary.stores}</strong> ร้าน
              จาก <strong data-numeric>{summary.organizations}</strong> หน่วยงาน
            </p>
          ) : null}
        </section>

        {state.status === "success" && !hasActiveFilters && recommendedStores.length > 0 ? (
          <section className={styles.discovery} aria-labelledby="storefront-discovery-heading">
            <div className={styles.discoveryHeader}>
              <div>
                <span className={styles.discoveryLabel}>EXPLORE / ร้านค้าเพิ่มเติม</span>
                <h2 className={styles.discoveryTitle} id="storefront-discovery-heading">ร้านอื่นที่เปิดให้เข้าชม</h2>
              </div>
              <a className={styles.discoveryJump} href="#storefront-heading">ดูทุกร้าน <span aria-hidden="true">↗</span></a>
            </div>
            <div className={styles.discoveryGrid}>
              {recommendedStores.map(({ organization, store }, index) => (
                store ? (
                  <Link
                    key={store.storeId}
                    href={storeHref(organization.organizationId, store.storeId)}
                    className={styles.discoveryCard}
                  >
                    <span className={styles.discoveryCardIndex}>0{index + 2} / STORE</span>
                    <span className={styles.discoveryOrganization}>{organization.name}</span>
                    <h3 className={styles.discoveryStoreName}>{store.name}</h3>
                    <p className={styles.discoveryStoreDescription}>
                      {store.description || "ดูสินค้าและรอบขายของร้านนี้"}
                    </p>
                    <span className={styles.discoveryCardAction}>เปิดหน้าร้าน <span aria-hidden="true">↗</span></span>
                  </Link>
                ) : null
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.catalog} aria-labelledby="storefront-heading">
          <div className={styles.catalogHeader}>
            <div>
              <span className={styles.catalogEyebrow}>DIRECTORY / ร้านค้าทั้งหมด</span>
              <h2 className={styles.catalogTitle} id="storefront-heading" tabIndex={-1}>
                ร้านที่เปิดให้เข้าชม
              </h2>
            </div>
            <p className={styles.catalogDescription}>เลือกร้านเพื่อดูสินค้า ตัวเลือก และรอบขายที่มีอยู่จริง</p>
          </div>

          {state.status === "success" ? (
            <>
              <div className={styles.directoryResultsHeader}>
                <p className={styles.resultSummary} role="status" aria-live="polite" aria-atomic="true">
                  พบ {resultStoreCount} ร้าน
                  {resultEmptyOrganizationCount > 0 ? " และ " + resultEmptyOrganizationCount + " หน่วยงานที่ยังไม่มีร้าน" : ""}
                  {filteredEntries.length > 0
                    ? " · แสดง " + (start + 1) + "–" + (start + visibleEntries.length) + " จาก " + filteredEntries.length + " รายการ"
                    : ""}
                </p>
                {fixtureCount > 0 ? (
                  <button className={styles.clearFilters} type="button" aria-pressed={showAutomationFixtures}
                    onClick={() => { setShowAutomationFixtures((current) => !current); setCurrentPage(1); }}>
                    {showAutomationFixtures ? "ซ่อนข้อมูล E2E/QA" : "แสดงข้อมูล E2E/QA (" + fixtureCount + " หน่วยงาน)"}
                  </button>
                ) : null}
                {hasActiveFilters ? (
                  <button className={styles.clearFilters} type="button" onClick={clearFilters}>ล้างตัวกรอง</button>
                ) : null}
              </div>

              {filteredEntries.length === 0 ? (
                <div className={styles.directoryEmpty}>
                  <h3>ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา</h3>
                  <p>ลองเปลี่ยนชื่อที่ค้นหา หรือเลือกตัวกรองอื่น</p>
                  <button className={styles.clearFilters} type="button" onClick={clearFilters}>แสดงรายการทั้งหมด</button>
                </div>
              ) : (
                <>
                  <div className={styles.organizationList} aria-label="ผลการค้นหาร้านค้าและหน่วยงาน">
                    {directoryGroups.map(({ organization, stores, totalStores }) => (
                      <section className={styles.organization} key={organization.organizationId}>
                        <div className={styles.organizationInfo}>
                          <div className={styles.organizationHeading}>
                            <h3 className={styles.organizationName}>{organization.name}</h3>
                            <span className={styles.storeCount} data-numeric>
                              {stores.length === totalStores
                                ? totalStores + " ร้าน"
                                : "แสดง " + stores.length + " จาก " + totalStores + " ร้าน"}
                            </span>
                          </div>
                          {organization.description ? (
                            <p className={styles.organizationDescription}>{organization.description}</p>
                          ) : null}
                        </div>
                        {stores.length > 0 ? (
                          <div className={styles.storeList}>
                            {stores.map((store) => (
                              <Link key={store.storeId} href={storeHref(organization.organizationId, store.storeId)}
                                className={styles.storeRow}>
                                <div className={styles.storeRowCopy}>
                                  <h4 className={styles.storeName}>{store.name}</h4>
                                  <p className={styles.storeDescription}>
                                    {store.description || "ดูสินค้าและรอบพรีออเดอร์ของร้านนี้"}
                                  </p>
                                </div>
                                <span className={styles.storeAction}>เข้าร้าน <span aria-hidden="true">↗</span></span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.noStores}>หน่วยงานนี้ยังไม่มีร้านค้าที่เปิดให้เข้าชม</div>
                        )}
                      </section>
                    ))}
                  </div>
                  {pageCount > 1 ? (
                    <nav className={styles.directoryPagination} aria-label="การแบ่งหน้ารายการร้านค้า">
                      <button className={styles.pageButton} type="button"
                        disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>ก่อนหน้า</button>
                      <span className={styles.pageIndicator} aria-live="polite" data-numeric>
                        หน้า {currentPage} จาก {pageCount}
                      </span>
                      <button className={styles.pageButton} type="button"
                        disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)}>ถัดไป</button>
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
              <Skeleton shape="block" className={styles.loadingCard} />
              <Skeleton shape="block" className={styles.loadingCard} />
              <Skeleton shape="block" className={styles.loadingCard} />
            </div>
            <div className={styles.stateWrap}>
              <LoadingState title="กำลังโหลดร้านค้า" description="กำลังดึงข้อมูลร้านและหน่วยงานที่เปิดให้เข้าชม" />
            </div>
          </div>
        ) : null}
        {state.status === "empty" ? (
          <div className={styles.stateWrap}>
            <EmptyState title="ยังไม่มีร้านค้าที่เปิดให้เข้าชม"
              description="เมื่อมีร้านค้าที่พร้อมให้ลูกค้าเข้าชม รายการจะปรากฏที่หน้านี้" />
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className={styles.stateWrap}>
            <ErrorState title="ไม่สามารถโหลดร้านค้าได้"
              description="กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"
              actions={<Button onClick={() => {
                setState({ status: "loading" });
                setLoadAttempt((attempt) => attempt + 1);
              }}>ลองโหลดอีกครั้ง</Button>} />
          </div>
        ) : null}
        <footer className={styles.footer}>
          <strong>UniStore Hub</strong>
          <span>เลือกร้าน สั่งพรีออเดอร์ และติดตามการรับสินค้าในมหาวิทยาลัย</span>
          <Link href={orderTrackingPath}>คำสั่งซื้อของฉัน <span aria-hidden="true">↗</span></Link>
        </footer>
      </main>
    </div>
  );
}
