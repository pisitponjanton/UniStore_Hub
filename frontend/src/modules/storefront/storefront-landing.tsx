"use client";

import { AppIcon } from "@/components/ui/app-icon";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, EmptyIllustration, EmptyState, ErrorState, LoadingState, Skeleton } from "@/components";
import { buildAuthPagePath, useAuthSession } from "@/modules/auth";

import {
  buildDirectoryEntries,
  DIRECTORY_PAGE_SIZE,
  filterDirectoryEntries,
  separateAutomationFixtures,
  type DirectoryFilter,
} from "./storefront-directory";
import { StorefrontHeader } from "./storefront-header";
import { storefrontService, type StorefrontLandingOrganization } from "./storefront-service";
import styles from "./storefront-landing.module.css";
import gridStyles from "./storefront-grid.module.css";

type LandingState =
  | { status: "loading" }
  | { status: "success"; data: StorefrontLandingOrganization[] }
  | { status: "empty" }
  | { status: "error" };

function storeHref(organizationId: string, storeId: string): string {
  const params = new URLSearchParams({ organizationId, storeId });
  return "/stores/view/?" + params.toString();
}

const SHOP_FILTERS_KEY = "unistoreHub.customerShopFilters.v1";

export function StorefrontLanding({ workspace = false }: { workspace?: boolean } = {}) {
  const auth = useAuthSession();
  const [state, setState] = useState<LandingState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<DirectoryFilter>("all");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAutomationFixtures, setShowAutomationFixtures] = useState(false);
  const [shopFiltersReady, setShopFiltersReady] = useState(!workspace);
  const localQaDirectory = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!workspace) return;
    let canceled = false;
    // Restore after hydration; do not read tab storage during server rendering.
    queueMicrotask(() => {
      if (canceled) return;
      try {
        const saved = window.sessionStorage.getItem(SHOP_FILTERS_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          const filters = parsed as Record<string, unknown>;
          if (typeof filters.query === "string") setSearchQuery(filters.query.slice(0, 160));
          if (filters.availability === "all" || filters.availability === "with-stores" || filters.availability === "without-stores") {
            setAvailabilityFilter(filters.availability);
          }
          if (typeof filters.organizationId === "string") setSelectedOrganizationId(filters.organizationId);
          if (localQaDirectory && filters.showQa === true) setShowAutomationFixtures(true);
          if (typeof filters.page === "number" && Number.isSafeInteger(filters.page) && filters.page > 0) {
            setCurrentPage(Math.min(filters.page, 999));
          }
        }
      }
      } catch {
        // Browsing remains functional with storage disabled or invalid.
      }
      if (!canceled) setShopFiltersReady(true);
    });
    return () => { canceled = true; };
  }, [workspace, localQaDirectory]);

  useEffect(() => {
    if (!workspace || !shopFiltersReady) return;
    try {
      window.sessionStorage.setItem(SHOP_FILTERS_KEY, JSON.stringify({
        query: searchQuery,
        availability: availabilityFilter,
        organizationId: selectedOrganizationId,
        page: currentPage,
        showQa: localQaDirectory && showAutomationFixtures,
      }));
    } catch {
      // Session storage is only a convenience, never a requirement.
    }
  }, [workspace, shopFiltersReady, searchQuery, availabilityFilter, selectedOrganizationId, currentPage, localQaDirectory, showAutomationFixtures]);

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

  const fixturePartition = useMemo(
    () => state.status === "success" ? separateAutomationFixtures(state.data) : { regular: [], fixtures: [] },
    [state],
  );
  const directoryData = useMemo(() => {
    if (state.status !== "success") return [];
    if (!localQaDirectory) return state.data;
    return showAutomationFixtures ? [...fixturePartition.regular, ...fixturePartition.fixtures] : fixturePartition.regular;
  }, [state, localQaDirectory, showAutomationFixtures, fixturePartition]);

  const fixtureCount = localQaDirectory ? fixturePartition.fixtures.length : 0;
  const qaOrganizationIds = useMemo(
    () => new Set(fixturePartition.fixtures.map((item) => item.organization.organizationId)),
    [fixturePartition],
  );
  const noOrdinaryStoresYet = localQaDirectory &&
    state.status === "success" &&
    fixturePartition.regular.length === 0 && fixturePartition.fixtures.length > 0 &&
    !showAutomationFixtures;

  const organizationOptions = useMemo(
    () => directoryData.map(({ organization }) => ({ value: organization.organizationId, label: organization.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "th")),
    [directoryData],
  );
  const directoryEntries = useMemo(() => buildDirectoryEntries(directoryData), [directoryData]);
  const filteredEntries = useMemo(
    () => filterDirectoryEntries(directoryEntries, searchQuery, availabilityFilter)
      .filter(({ organization }) => !selectedOrganizationId || organization.organizationId === selectedOrganizationId),
    [directoryEntries, searchQuery, availabilityFilter, selectedOrganizationId],
  );
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / DIRECTORY_PAGE_SIZE));
  const displayedPage = Math.min(currentPage, pageCount);
  const start = (displayedPage - 1) * DIRECTORY_PAGE_SIZE;
  const visibleEntries = filteredEntries.slice(start, start + DIRECTORY_PAGE_SIZE);
  const visibleStores = visibleEntries.filter((entry) => entry.store !== null);
  const visibleEmptyOrganizations = visibleEntries.filter((entry) => entry.store === null);
  const hasActiveFilters = searchQuery.trim().length > 0 || availabilityFilter !== "all" || selectedOrganizationId !== "";

  function clearFilters() {
    setSearchQuery("");
    setAvailabilityFilter("all");
    setSelectedOrganizationId("");
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
    <div className={styles.page} data-workspace={workspace ? "true" : undefined} data-filtering={hasActiveFilters ? "true" : "false"}>
      {!workspace ? <StorefrontHeader /> : null}
      <main className={styles.main}>
        {workspace ? (
          <header className={styles.workspaceHeading}>
            <h1>เลือกร้านค้า</h1>
            <p>ค้นหาร้านค้าและสินค้าที่สนใจ</p>
          </header>
        ) : null}
        {!workspace ? (
        <section className={styles.hero} aria-labelledby="storefront-intro-heading">
          <div className={styles.heroMain}>
            <span className={styles.heroEyebrow}>UNISTORE HUB / CAMPUS MARKETPLACE</span>
            <h1 className={styles.heroTitle} id="storefront-intro-heading">
              ร้านค้าและพรีออเดอร์ในมหาวิทยาลัย
            </h1>
            <p className={styles.heroDescription}>
              เลือกซื้อสินค้าจากร้านของหน่วยงานและชมรม ดูรอบพรีออเดอร์
              แล้วติดตามการชำระเงินและการรับสินค้าได้ในที่เดียว
            </p>
            <div className={styles.heroActions}>
              <a className={styles.heroPrimaryAction} href="#storefront-heading">
                เลือกดูร้านค้า <AppIcon name="arrow-up-right" size={17} />
              </a>
              {auth.status === "loading" ? (
                <span className={styles.heroSecondaryActionPending} role="status" aria-live="polite">
                  กำลังตรวจสอบบัญชี
                </span>
              ) : (
                <Link className={styles.heroSecondaryAction} href={orderTrackingPath}>
                  ติดตามคำสั่งซื้อ <AppIcon name="arrow-right" size={17} />
                </Link>
              )}
            </div>
            <div className={styles.heroFootnote}>
              <span className={styles.heroFootnoteMark} aria-hidden="true" />
              ร้านค้าและรอบขายขึ้นอยู่กับแต่ละหน่วยงาน ตรวจสอบรายละเอียดก่อนสั่งทุกครั้ง
            </div>
          </div>
          <div className={styles.heroGuide} aria-label="วิธีเริ่มซื้อสินค้า">
            <div className={styles.heroGuideHeading}>
              <span>เริ่มใช้งานใน 3 ขั้นตอน</span>
              <strong>ค้นหา เลือก แล้วติดตาม</strong>
            </div>
            <ol className={styles.heroGuideSteps}>
              <li><strong>เลือกร้านที่สนใจ</strong><span>ค้นหาร้านของชมรมและหน่วยงาน</span></li>
              <li><strong>ดูสินค้าและรอบขาย</strong><span>ตรวจสอบรายละเอียดและสถานะก่อนสั่ง</span></li>
              <li><strong>ติดตามคำสั่งซื้อ</strong><span>ดูการชำระเงินและขั้นตอนรับสินค้า</span></li>
            </ol>
          </div>
        </section>
        ) : null}

        <section className={styles.finder} aria-label="ค้นหาและกรองร้านค้า">
          {!workspace ? (
            <div className={styles.finderHeading}>
              <span className={styles.finderKicker}>ค้นพบร้านค้า</span>
              <strong>หาร้านที่อยากซื้อ</strong>
            </div>
          ) : null}
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
              <span className={styles.selectShell}>
                <select
                  data-custom-chevron
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
                <ChevronDown size={18} aria-hidden="true" className={styles.selectChevron} />
              </span>
            </div>
            <div className={styles.organizationFilter}>
              <label htmlFor="storefront-organization">หน่วยงาน</label>
              <span className={styles.selectShell}>
                <select
                  data-custom-chevron
                  id="storefront-organization"
                  value={selectedOrganizationId}
                  onChange={(event) => {
                    setSelectedOrganizationId(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">ทุกหน่วยงาน</option>
                  {organizationOptions.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden="true" className={styles.selectChevron} />
              </span>
            </div>
            <button className={styles.searchJump} type="submit">ดูผลลัพธ์ <AppIcon name="arrow-up-right" size={17} /></button>
          </form>
        </section>

        <section className={styles.catalog} aria-labelledby="storefront-heading">
          <div className={styles.catalogHeader}>
            <div>
              {!workspace ? <span className={styles.catalogEyebrow}>EXPLORE / ร้านค้าในมหาวิทยาลัย</span> : null}
              <h2 className={styles.catalogTitle} id="storefront-heading" tabIndex={-1}>
                {workspace ? "ร้านค้าทั้งหมด" : "เลือกร้านที่อยากซื้อ"}
              </h2>
            </div>
            {!workspace ? <p className={styles.catalogDescription}>ค้นหาร้านค้าและดูสินค้าหรือรอบพรีออเดอร์ของแต่ละร้านโดยตรง</p> : null}
          </div>

          {state.status === "success" ? (
            <>
              {(fixtureCount > 0 || hasActiveFilters) ? (
                <div className={styles.directoryResultsHeader}>
                {fixtureCount > 0 ? (
                  <button className={styles.clearFilters} type="button" aria-pressed={showAutomationFixtures}
                    onClick={() => { setShowAutomationFixtures((current) => !current); setSelectedOrganizationId(""); setCurrentPage(1); }}>
                    {showAutomationFixtures ? "ซ่อนข้อมูล E2E/QA" : "แสดงข้อมูล E2E/QA"}
                  </button>
                ) : null}
                {hasActiveFilters ? (
                  <button className={styles.clearFilters} type="button" onClick={clearFilters}>ล้างตัวกรอง</button>
                ) : null}
                </div>
              ) : null}

              {showAutomationFixtures && localQaDirectory && fixtureCount > 0 ? (
                <p className={styles.qaNotice} role="note">โหมดตรวจสอบ QA — ข้อมูลทดสอบไม่ได้หมายถึงร้านที่เปิดขายจริง</p>
              ) : null}

              {filteredEntries.length === 0 ? (
                <div className={styles.directoryEmpty}>
                  <EmptyIllustration compact />
                  <h3>{noOrdinaryStoresYet && !hasActiveFilters ? "ยังไม่มีร้านค้าเปิดให้ชม" : "ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา"}</h3>
                  <p>{noOrdinaryStoresYet && !hasActiveFilters ? "ขณะนี้ยังไม่มีร้านค้าสำหรับผู้ใช้ทั่วไป" : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"}</p>
                  {hasActiveFilters ? <button className={styles.clearFilters} type="button" onClick={clearFilters}>แสดงรายการทั้งหมด</button> : null}
                </div>
              ) : (
                <>

                  {visibleStores.length > 0 ? (
                    <div className={gridStyles.storeGrid} aria-label="ผลการค้นหาร้านค้า">
                      {visibleStores.map(({ organization, store }) => store ? (
                        <Link
                          key={store.storeId}
                          href={storeHref(organization.organizationId, store.storeId)}
                          className={gridStyles.storeCard}
                          data-qa-fixture={qaOrganizationIds.has(organization.organizationId) ? "true" : undefined}
                          aria-label={"เข้าร้าน " + store.name + " ของ " + organization.name}
                        >
                          <div className={gridStyles.storeCardMedia} aria-hidden="true">
                            <AppIcon name="store" size={32} />
                            <span>ยังไม่มีรูปหน้าร้าน</span>
                          </div>
                          <div className={gridStyles.storeCardBody}>
                            <span className={gridStyles.storeCardOrganization}>{organization.name}</span>
                            {qaOrganizationIds.has(organization.organizationId) ? <span className={gridStyles.qaBadge}>ข้อมูลทดสอบ QA</span> : null}
                            <h3 className={gridStyles.storeName}>{store.name}</h3>
                            <p className={gridStyles.storeDescription}>
                              {store.description || "เข้าชมร้านเพื่อดูสินค้าและรอบขายที่เปิดให้สั่งซื้อ"}
                            </p>
                            <div className={gridStyles.storeCardFooter}>
                              <span className={gridStyles.storeStatus}>เปิดให้เข้าชม</span>
                              <span className={gridStyles.storeAction}>ดูหน้าร้าน <AppIcon name="arrow-up-right" size={17} /></span>
                            </div>
                          </div>
                        </Link>
                      ) : null)}
                    </div>
                  ) : null}
                  {visibleEmptyOrganizations.length > 0 ? (
                    <section className={gridStyles.noStoreSection} aria-labelledby="storefront-no-stores-heading">
                      <div className={gridStyles.noStoreHeading}>
                        <h3 id="storefront-no-stores-heading">หน่วยงานที่ยังไม่มีร้านค้า</h3>
                        <p>หน่วยงานเหล่านี้ยังไม่มีร้านที่เปิดให้เข้าชม</p>
                      </div>
                      <div className={gridStyles.emptyOrganizationGrid}>
                        {visibleEmptyOrganizations.map(({ organization }) => (
                          <article className={gridStyles.emptyOrganization} key={organization.organizationId}>
                            <strong>{organization.name}</strong>
                            {qaOrganizationIds.has(organization.organizationId) ? <span className={gridStyles.qaBadge}>ข้อมูลทดสอบ QA</span> : null}
                            {organization.description ? <p>{organization.description}</p> : null}
                            <span>ยังไม่เปิดร้านค้า</span>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {pageCount > 1 ? (
                    <nav className={styles.directoryPagination} aria-label="การแบ่งหน้ารายการร้านค้า">
                      <button className={styles.pageButton} type="button"
                        disabled={displayedPage === 1} onClick={() => goToPage(displayedPage - 1)}>ก่อนหน้า</button>
                      <span className={styles.pageIndicator} aria-live="polite" data-numeric>
                        หน้า {displayedPage} จาก {pageCount}
                      </span>
                      <button className={styles.pageButton} type="button"
                        disabled={displayedPage === pageCount} onClick={() => goToPage(displayedPage + 1)}>ถัดไป</button>
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
        {!workspace ? <footer className={styles.footer}>
          <strong>UniStore Hub</strong>
          <span>เลือกร้าน สั่งพรีออเดอร์ และติดตามการรับสินค้าในมหาวิทยาลัย</span>
          <Link href={orderTrackingPath} className={styles.footerOrdersLink}>
            <span>คำสั่งซื้อของฉัน</span>
            <AppIcon name="arrow-up-right" size={17} />
          </Link>
        </footer> : null}
      </main>
    </div>
  );
}
