"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, Factory, PackageCheck, RefreshCw, Search } from "lucide-react";

import {
  ErrorState, ForbiddenState, LoadingState, Notice, UnauthorizedState,
} from "@/components";
import { authSession, isDefinitiveSessionFailure } from "@/modules/auth";
import { campaignService } from "@/modules/campaigns/campaign-service";
import { campaignStatusLabel } from "@/modules/campaigns/campaign-helpers";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";
import { ApiClientError } from "@/services";
import type { CampaignDTO, Cursor, ProductionSummaryDTO } from "@/types";
import { normalizeCampaignId, productionHref } from "./production-helpers";
import { productionService } from "./production-service";
import styles from "./production-summary-view.module.css";

type SummaryState =
  | { status: "idle" }
  | { status: "loading"; campaignId: string }
  | { status: "success"; summary: ProductionSummaryDTO }
  | { status: "notFound"; campaignId: string }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error"; campaignId: string };

type CampaignDirectory =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; items: CampaignDTO[]; nextCursor: Cursor | null };

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "CAMPAIGN_NOT_FOUND") return "ไม่พบแคมเปญนี้ในหน่วยงาน";
    return error.userMessage;
  }
  return "ไม่สามารถโหลดสรุปการผลิตได้ กรุณาลองใหม่อีกครั้ง";
}

export function ProductionSummaryView({
  organizationId,
  initialCampaignId,
}: {
  organizationId: string;
  initialCampaignId: string | null;
}) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
  const [selectedCampaignId, setSelectedCampaignId] = useState(initialCampaignId ?? "");
  const [campaigns, setCampaigns] = useState<CampaignDirectory>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [state, setState] = useState<SummaryState>(
    initialCampaignId
      ? { status: "loading", campaignId: initialCampaignId }
      : { status: "idle" },
  );
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [summaryFeedback, setSummaryFeedback] = useState<string | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    campaignService.list(organizationId, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setCampaigns({
          status: "success",
          items: result.items,
          nextCursor: result.nextCursor,
        });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }
        setCampaigns({ status: "error" });
      });
    return () => controller.abort();
  }, [organizationId]);

  useEffect(() => {
    if (!campaignPickerOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        setCampaignPickerOpen(false);
        setSearchText("");
        setIsTyping(false);
        setActiveIndex(-1);
      }
    }
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!pickerRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      setCampaignPickerOpen(false);
      setSearchText("");
      setIsTyping(false);
      setActiveIndex(-1);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [campaignPickerOpen]);

  useEffect(() => {
    if (!initialCampaignId) return;
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    productionService.getSummary(organizationId, initialCampaignId, { signal: controller.signal })
      .then(summary => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setState({ status: "success", summary });
        setSummaryFeedback("โหลดสรุปการผลิตของ " + summary.campaignId + " แล้ว");
      })
      .catch(error => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        handleSummaryError(error, initialCampaignId);
      });
    return () => controller.abort();
  }, [initialCampaignId, organizationId]);

  function handleSummaryError(error: unknown, id: string) {
    if (isDefinitiveSessionFailure(error)) {
      authSession.logout();
      return;
    }
    if (error instanceof ApiClientError) {
      if (error.kind === "unauthorized") { setState({ status: "unauthorized" }); return; }
      if (error.kind === "forbidden") { setState({ status: "forbidden" }); return; }
      if (error.kind === "notFound" || error.code === "CAMPAIGN_NOT_FOUND") {
        setState({ status: "notFound", campaignId: id });
        return;
      }
    }
    setInlineError(loadErrorMessage(error));
    setState({ status: "error", campaignId: id });
  }

  async function loadSummary(nextCampaignId: string) {
    const sequence = ++requestSequence.current;
    setSelectedCampaignId(nextCampaignId);
    setDirectoryQuery("");
    setDirectoryLimit(24);
    setState({ status: "loading", campaignId: nextCampaignId });
    setInlineError(null);
    setSummaryFeedback(null);
    try {
      const summary = await productionService.getSummary(organizationId, nextCampaignId);
      if (sequence !== requestSequence.current) return;
      setState({ status: "success", summary });
      setSummaryFeedback("โหลดสรุปการผลิตของ " + summary.campaignId + " แล้ว");
      window.history.replaceState({}, "", productionHref(organizationId, nextCampaignId));
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      handleSummaryError(error, nextCampaignId);
    }
  }

  function selectCampaign(campaignId: string) {
    setCampaignError(null);
    setSearchText("");
    setIsTyping(false);
    setCampaignPickerOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
    void loadSummary(campaignId);
  }

  function submitCampaignId(raw: string) {
    const id = normalizeCampaignId(raw);
    if (!id) {
      setCampaignError("กรุณาเลือกแคมเปญหรือระบุ Campaign ID");
      inputRef.current?.focus();
      return;
    }
    selectCampaign(id);
  }

  async function handleLoadMoreCampaigns() {
    if (campaigns.status !== "success" || !campaigns.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setCampaignError(null);
    try {
      const result = await campaignService.list(organizationId, { cursor: campaigns.nextCursor });
      setCampaigns(current => current.status === "success"
        ? {
            status: "success",
            items: [
              ...current.items,
              ...result.items.filter(item =>
                !current.items.some(existing => existing.campaignId === item.campaignId)),
            ],
            nextCursor: result.nextCursor,
          }
        : current);
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }
      setCampaignError("โหลดแคมเปญเพิ่มเติมไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoadingMore(false);
    }
  }

  const selectedCampaign = campaigns.status === "success"
    ? campaigns.items.find(item => item.campaignId === selectedCampaignId)
    : undefined;
  const matchingCampaigns = campaigns.status === "success"
    ? isTyping
      ? searchLoadedItems(campaigns.items, searchText, item =>
          [item.name, item.campaignId, campaignStatusLabel(item.status)])
      : campaigns.items
    : [];
  const comboValue = isTyping ? searchText
    : selectedCampaign?.name ?? selectedCampaignId;
  const loadedCampaignId = state.status === "success"
    ? state.summary.campaignId
    : state.status === "loading" || state.status === "notFound" || state.status === "error"
      ? state.campaignId : null;
  const totalVariants = state.status === "success"
    ? state.summary.products.reduce((total, product) => total + product.variants.length, 0) : 0;
  const totalQuantity = state.status === "success"
    ? state.summary.products.reduce((total, product) =>
        total + product.variants.reduce((sum, variant) => sum + variant.quantity, 0), 0) : 0;
  const productionMatches = state.status === "success"
    ? searchLoadedItems(state.summary.products, directoryQuery, product => [
        product.productName, product.productId,
        ...product.variants.map(variant => variant.variantName),
      ])
    : [];
  const productionVisible = visibleLoadedItems(productionMatches, directoryLimit);
  const isLoading = state.status === "loading";

  function handleComboKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab") {
      setCampaignPickerOpen(false);
      setIsTyping(false);
      setSearchText("");
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Escape") {
      setCampaignPickerOpen(false);
      setIsTyping(false);
      setSearchText("");
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setCampaignPickerOpen(true);
      if (!matchingCampaigns.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(current => current < 0
        ? (direction === 1 ? 0 : matchingCampaigns.length - 1)
        : (current + direction + matchingCampaigns.length) % matchingCampaigns.length);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const normalized = normalizeCampaignId(isTyping ? searchText : comboValue);
    const exact = matchingCampaigns.find(campaign =>
      campaign.campaignId === normalized || campaign.name === normalized);
    const candidate = activeIndex >= 0 ? matchingCampaigns[activeIndex]
      : exact ?? (isTyping ? matchingCampaigns[0] : undefined);
    if (candidate) {
      selectCampaign(candidate.campaignId);
    } else if (isTyping) {
      submitCampaignId(searchText);
    } else if (selectedCampaignId) {
      selectCampaign(selectedCampaignId);
    } else {
      submitCampaignId("");
    }
  }

  if (state.status === "unauthorized") {
    return <div className={styles.page}><main className={styles.stateWrap}><UnauthorizedState /></main></div>;
  }
  if (state.status === "forbidden") {
    return <div className={styles.page}><main className={styles.stateWrap}><ForbiddenState /></main></div>;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>สรุปงานผลิต</h1>
          <p className={styles.description}>จำนวนสินค้าที่ต้องผลิตในแต่ละรอบขาย</p>
        </header>

        <section className={styles.campaignBar} aria-label="เลือกรอบขายเพื่อดูสรุปการผลิต">
          <div className={styles.barHeading}>
            <label className={styles.eyebrow} htmlFor="production-campaign-id">แคมเปญ</label>
            <Link className={styles.directoryLink}
              href={"/org/campaigns/?" + new URLSearchParams({ organizationId }).toString()}>
              จัดการรอบขาย <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.campaignControls}>
            <div className={styles.pickerAnchor} ref={pickerRef}>
              <div className={styles.comboControl}>
                <Search size={18} aria-hidden="true" />
                <input
                  ref={inputRef}
                  id="production-campaign-id"
                  role="combobox"
                  type="text"
                  autoComplete="off"
                  aria-label="เลือกแคมเปญ"
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-expanded={campaignPickerOpen}
                  aria-controls={campaignPickerOpen ? "production-campaign-options" : undefined}
                  aria-activedescendant={campaignPickerOpen && activeIndex >= 0 && matchingCampaigns[activeIndex]
                    ? "production-option-" + activeIndex : undefined}
                  aria-invalid={Boolean(campaignError)}
                  aria-describedby={campaignError ? "production-campaign-error" : undefined}
                  placeholder="ค้นหาชื่อหรือรหัสแคมเปญ..."
                  value={comboValue}
                  onFocus={() => {
                    setCampaignPickerOpen(true);
                    setActiveIndex(-1);
                  }}
                  onChange={event => {
                    setSearchText(event.target.value);
                    setIsTyping(true);
                    setActiveIndex(-1);
                    setCampaignError(null);
                    setCampaignPickerOpen(true);
                  }}
                  onKeyDown={handleComboKeyDown}
                />
                <ChevronDown size={17} className={campaignPickerOpen ? styles.chevronOpen : ""} aria-hidden="true" />
              </div>
              {campaignPickerOpen ? (
                <div className={styles.pickerPanel}>
                  <div id="production-campaign-options" className={styles.campaignOptions} role="listbox"
                    aria-label="ผลการค้นหาแคมเปญ">
                    {campaigns.status === "loading" ? <p className={styles.optionState}>กำลังโหลดแคมเปญ…</p> : null}
                    {campaigns.status === "error" ? (
                      <p className={styles.optionState}>โหลดรายการไม่ได้ หากทราบ Campaign ID สามารถพิมพ์แล้วกด Enter ได้</p>
                    ) : null}
                    {campaigns.status === "success" && campaigns.items.length === 0 && !campaigns.nextCursor ? (
                      <p className={styles.optionState}>ยังไม่มีแคมเปญในหน่วยงานนี้</p>
                    ) : null}
                    {campaigns.status === "success" && campaigns.items.length > 0 &&
                      matchingCampaigns.length === 0 ? (
                        <p className={styles.optionState}>
                          {campaigns.nextCursor
                            ? "ไม่พบในรายการที่โหลด ลองโหลดแคมเปญเพิ่มเติม"
                            : "ไม่พบชื่อในรายการ หากเป็น Campaign ID ให้กด Enter เพื่อค้นหาโดยตรง"}
                        </p>
                      ) : null}
                    {matchingCampaigns.map((campaign, index) => (
                      <button key={campaign.campaignId} type="button"
                        id={"production-option-" + index}
                        role="option"
                        aria-selected={selectedCampaignId === campaign.campaignId}
                        data-active={index === activeIndex || undefined}
                        className={styles.campaignOption}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectCampaign(campaign.campaignId)}>
                        <span><strong>{campaign.name}</strong><small>{campaign.campaignId}</small></span>
                        <span className={styles.optionStatus}>{campaignStatusLabel(campaign.status)}</span>
                      </button>
                    ))}
                  </div>
                  {campaigns.status === "success" && campaigns.nextCursor ? (
                    <button type="button" className={styles.loadMore}
                      disabled={loadingMore}
                      onClick={() => void handleLoadMoreCampaigns()}>
                      {loadingMore ? "กำลังโหลด…" : "โหลดแคมเปญเพิ่มเติม"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button className={styles.refreshButton} type="button"
              onClick={() => selectedCampaignId && void loadSummary(selectedCampaignId)}
              disabled={!selectedCampaignId || isLoading}
              aria-label="รีเฟรชสรุปการผลิต" title="รีเฟรชสรุปการผลิต">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
          {campaignError ? <p className={styles.fieldError} id="production-campaign-error" role="alert">{campaignError}</p> : null}
        </section>

        {summaryFeedback ? (
          <p role="status" aria-live="polite" className={styles.srOnly}>{summaryFeedback}</p>
        ) : null}
        {inlineError ? <Notice tone="danger" role="alert" title="โหลดข้อมูลไม่สำเร็จ">{inlineError}</Notice> : null}

        {state.status === "idle" ? (
          <section className={styles.blankState} aria-label="ยังไม่ได้เลือกแคมเปญ">
            <Factory size={28} strokeWidth={1.5} aria-hidden="true" />
            <strong>เลือกแคมเปญเพื่อดูยอดผลิต</strong>
            <p>เลือกหรือค้นหาจากช่องด้านบนเพื่อดูรายการผลิต</p>
          </section>
        ) : null}
        {state.status === "loading" ? (
          <LoadingState title="กำลังโหลดสรุปการผลิต" description="กำลังดึงจำนวนสินค้าจากระบบ" />
        ) : null}
        {state.status === "notFound" ? (
          <ErrorState title="ไม่พบแคมเปญ" description="ตรวจสอบ Campaign ID หรือเลือกแคมเปญอื่นจากรายการ" />
        ) : null}
        {state.status === "error" ? (
          <ErrorState title="ไม่สามารถโหลดสรุปการผลิตได้" description="รีเฟรชหรือเลือกแคมเปญอีกครั้ง" />
        ) : null}

        {state.status === "success" ? (
          <>
            <section className={styles.summaryStrip} aria-label="สรุปจำนวนที่ต้องผลิต">
              <div><span>สินค้าทั้งหมด</span><strong data-numeric>{state.summary.products.length.toLocaleString("th-TH")}</strong></div>
              <div><span>ตัวเลือกสินค้า</span><strong data-numeric>{totalVariants.toLocaleString("th-TH")}</strong></div>
              <div className={styles.totalMetric}><span>จำนวนที่ต้องผลิต</span><strong data-numeric>{totalQuantity.toLocaleString("th-TH")} <small>ชิ้น</small></strong></div>
            </section>

            <section className={styles.productionSection} aria-labelledby="production-summary-products">
              <div className={styles.sectionHeader}>
                <div><h2 id="production-summary-products">รายการที่ต้องผลิต</h2>
                  <p>แยกจำนวนตามสินค้าและตัวเลือกในรอบขายที่เลือก</p></div>
                {loadedCampaignId ? <details className={styles.reportId}><summary>รหัสรอบขาย</summary><code>{loadedCampaignId}</code></details> : null}
              </div>
              {state.summary.products.length > 0 ? (
                <div className={styles.catalogTools}>
                  <LoadedDirectoryControls
                    id="production-product-search" label="ค้นหารายการสินค้าที่ต้องผลิต"
                    query={directoryQuery}
                    onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
                    loadedCount={state.summary.products.length}
                    matchingCount={productionMatches.length}
                    visibleCount={productionVisible.length}
                    onShowMore={() => setDirectoryLimit(limit => limit + 24)}
                    placeholder="ค้นหาชื่อสินค้า สี ขนาด หรือรหัส"
                  />
                </div>
              ) : null}
              {state.summary.products.length === 0 ? (
                <div className={styles.blankState}>
                  <PackageCheck size={26} strokeWidth={1.5} aria-hidden="true" />
                  <strong>ยังไม่มีรายการที่ต้องผลิต</strong>
                  <p>แคมเปญนี้ยังไม่มีคำสั่งซื้อที่เข้าเงื่อนไขสำหรับสรุปงานผลิต</p>
                </div>
              ) : productionVisible.length > 0 ? (
                <div className={styles.productList}>
                  {productionVisible.map(product => {
                    const quantity = product.variants.reduce((total, variant) => total + variant.quantity, 0);
                    return (
                      <article className={styles.productGroup} key={product.productId}>
                        <div className={styles.productHeader}>
                          <div><h3>{product.productName}</h3>
                            <details className={styles.technicalId}><summary>ดูรหัสสินค้า</summary><code>{product.productId}</code></details></div>
                          <div className={styles.productTotal}><strong data-numeric>{quantity.toLocaleString("th-TH")}</strong><span>ชิ้น</span></div>
                        </div>
                        <div className={styles.variantList}>
                          {product.variants.map(variant => (
                            <div className={styles.variantRow} key={variant.variantId}>
                              <div className={styles.variantCopy}><span>{variant.variantName}</span>
                                <details className={styles.technicalId}><summary>รหัสตัวเลือก</summary><code>{variant.variantId}</code></details>
                              </div>
                              <strong data-numeric>{variant.quantity.toLocaleString("th-TH")} <small>ชิ้น</small></strong>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
